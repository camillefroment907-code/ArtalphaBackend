from fastapi import APIRouter, Depends, HTTPException, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, delete
from sqlalchemy.orm import selectinload
from typing import Any, Dict, Optional
from datetime import datetime, timedelta

from app.database import get_db
from app.models.db_models import Lot, User, Alert, LotStatus

router = APIRouter(prefix="/admin", tags=["admin"])

ADMIN_KEY = "hono-admin-2024"
ADMIN_EMAILS = {"camillefroment907@gmail.com"}

_bearer = HTTPBearer(auto_error=False)


def verify_admin(
    x_admin_key: Optional[str] = Header(None),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
):
    # Accept X-Admin-Key header
    if x_admin_key == ADMIN_KEY:
        return True
    # Accept Bearer JWT from known admin emails
    if credentials:
        try:
            from app.api.auth_utils import decode_token
            payload = decode_token(credentials.credentials)
            if payload.get("email") in ADMIN_EMAILS:
                return True
        except Exception:
            pass
    raise HTTPException(status_code=403, detail="Admin access denied")


@router.get("/stats")
async def admin_stats(
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin),
) -> Dict[str, Any]:
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = datetime.utcnow() - timedelta(days=7)

    total_lots = (await db.execute(select(func.count(Lot.id)))).scalar() or 0
    total_users = (await db.execute(select(func.count(User.id)))).scalar() or 0
    total_deals = (await db.execute(
        select(func.count(Lot.id)).where(Lot.is_deal == True)
    )).scalar() or 0
    lots_today = (await db.execute(
        select(func.count(Lot.id)).where(Lot.created_at >= today)
    )).scalar() or 0
    deals_today = (await db.execute(
        select(func.count(Lot.id)).where(and_(Lot.is_deal == True, Lot.created_at >= today))
    )).scalar() or 0
    lots_week = (await db.execute(
        select(func.count(Lot.id)).where(Lot.created_at >= week_ago)
    )).scalar() or 0
    avg_score = (await db.execute(
        select(func.avg(Lot.deal_score)).where(Lot.deal_score.isnot(None))
    )).scalar() or 0
    top_score = (await db.execute(select(func.max(Lot.deal_score)))).scalar() or 0
    total_alerts = (await db.execute(select(func.count(Alert.id)))).scalar() or 0
    alerts_today = (await db.execute(
        select(func.count(Alert.id)).where(Alert.sent_at >= today)
    )).scalar() or 0

    # Source distribution
    source_stmt = (
        select(Lot.source, func.count(Lot.id).label("cnt"))
        .group_by(Lot.source)
        .order_by(func.count(Lot.id).desc())
    )
    source_rows = (await db.execute(source_stmt)).all()
    sources = {row.source.value if hasattr(row.source, 'value') else str(row.source): row.cnt for row in source_rows}

    # Top 5 deals
    top_lots_stmt = (
        select(Lot)
        .options(selectinload(Lot.artist))
        .where(Lot.is_deal == True)
        .order_by(Lot.deal_score.desc())
        .limit(5)
    )
    top_lots = (await db.execute(top_lots_stmt)).scalars().all()

    return {
        "lots": {
            "total": total_lots,
            "today": lots_today,
            "this_week": lots_week,
            "deals_total": total_deals,
            "deals_today": deals_today,
            "deal_rate_pct": round(total_deals / total_lots * 100, 1) if total_lots else 0,
        },
        "scoring": {
            "avg_score": round(float(avg_score), 1),
            "top_score": round(float(top_score), 1),
        },
        "users": {"total": total_users},
        "alerts": {"total": total_alerts, "today": alerts_today},
        "sources": sources,
        "top_deals": [
            {
                "id": str(lot.id),
                "title": lot.title[:60],
                "deal_score": lot.deal_score,
                "artist": lot.artist.name if lot.artist else lot.artist_name_raw,
                "source": lot.source.value if hasattr(lot.source, 'value') else lot.source,
                "current_price": lot.current_price,
                "currency": lot.currency,
            }
            for lot in top_lots
        ],
        "generated_at": datetime.utcnow().isoformat(),
    }


# Keywords that identify non-art lots (jewelry, watches, silverware, etc.)
_JEWELRY_KEYWORDS = [
    "adam's", "adams fine art",
    "diamond", "brillant", "bague", "ring",
    "bracelet", "collier", "necklace",
    "montre", "watch", "rolex", "cartier watch",
    "silver", "argent", "vermeil", "goldsmith",
    "bijou", "bijoux", "jewelry", "jewellery",
    "sapphire", "ruby", "emerald", "pearl",
    "saphir", "rubis", "émeraude", "perle",
]

_JEWELRY_HOUSES = ["adam's", "adams"]


@router.delete("/cleanup-jewelry")
async def cleanup_jewelry(
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin),
) -> Dict[str, Any]:
    """Delete non-art lots: jewelry, watches, and Adam's auction house lots."""
    from sqlalchemy import or_
    from app.models.db_models import Lot as LotModel

    conditions = []

    # Auction house blacklist
    for house in _JEWELRY_HOUSES:
        conditions.append(func.lower(LotModel.auction_house_name).contains(house))

    # Title/category keyword blacklist
    for kw in _JEWELRY_KEYWORDS:
        conditions.append(func.lower(LotModel.title).contains(kw))

    if not conditions:
        return {"deleted": 0}

    stmt = select(func.count(LotModel.id)).where(or_(*conditions))
    count_before = (await db.execute(stmt)).scalar() or 0

    del_stmt = delete(LotModel).where(or_(*conditions))
    await db.execute(del_stmt)
    await db.commit()

    return {
        "deleted": count_before,
        "message": f"Removed {count_before} non-art lots",
        "timestamp": datetime.utcnow().isoformat(),
    }
