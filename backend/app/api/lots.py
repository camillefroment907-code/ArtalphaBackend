from fastapi import APIRouter, Depends, Query, HTTPException, Request, Header, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, desc
from sqlalchemy.orm import selectinload
from typing import Optional, List
from datetime import datetime, timedelta
import math
import asyncio
import json
import re

from app.utils.cache import get_cached, set_cached
from app.utils.real_cost import compute_real_cost
from app.utils.estimation_bias import get_estimation_bias
from app.utils.cycle_stage import get_cycle_stage
from app.utils.consignment_alert import get_consignment_alert
from app.utils.provenance_risk import get_provenance_risk


def lot_to_list_dict(lot) -> dict:
    """Minimal lot payload for list views — skip heavy fields."""
    hammer = lot.current_price or lot.estimate_low
    real_cost = compute_real_cost(float(hammer), lot.auction_house_name) if hammer else None
    return {
        "id": str(lot.id),
        "title": lot.title,
        "artist_name_raw": lot.artist_name_raw,
        "current_price": lot.current_price,
        "estimate_low": lot.estimate_low,
        "estimate_high": lot.estimate_high,
        "deal_score": lot.deal_score,
        "pct_below_low_estimate": lot.pct_below_low_estimate,
        "image_url": lot.image_url,
        "auction_house_name": lot.auction_house_name,
        "auction_date": lot.auction_date.isoformat() if lot.auction_date else None,
        "category": lot.category,
        "source": lot.source.value if lot.source else None,
        "currency": lot.currency,
        "medium": lot.medium,
        "real_cost": real_cost,
    }


def parse_dimensions(dimensions_str: str) -> dict:
    """
    Parse dimensions from strings like:
    - "81.3 × 116.8 cm"
    - "32 x 46 in."
    - "H: 120 cm, W: 80 cm"
    Returns: { width_cm: float | None, height_cm: float | None }
    """
    if not dimensions_str:
        return {"width_cm": None, "height_cm": None}

    # Try "W × H cm/in" or "W x H cm/in"
    match = re.search(
        r'(\d+\.?\d*)\s*[×x]\s*(\d+\.?\d*)\s*(cm|in)',
        dimensions_str,
        re.IGNORECASE,
    )
    if match:
        w, h, unit = float(match.group(1)), float(match.group(2)), match.group(3).lower()
        if unit == 'in':
            w, h = w * 2.54, h * 2.54
        return {"width_cm": round(w, 1), "height_cm": round(h, 1)}

    return {"width_cm": None, "height_cm": None}

from app.database import get_db, AsyncSessionLocal
from app.models.db_models import Lot, Artist, LotStatus, AuctionHouse, MarketType
from app.models.schemas import LotOut, LotListResponse, TopDeal, DashboardStats
from app.api.auth_utils import get_current_user_optional, get_current_user
from app.models.db_models import User, Subscription
import os

ADMIN_EMAILS = frozenset({
    "camillefroment907@gmail.com",
    "demo@hono.art",
    "demo@balthus.art",
    *os.environ.get("ADMIN_EMAILS", "").split(","),
}) - {""}


async def get_user_plan(user: Optional[User], db: AsyncSession) -> str:
    """Get effective plan — admins always get institutional."""
    if not user:
        return "free"
    if user.email.strip() in ADMIN_EMAILS:
        return "institutional"
    result = await db.execute(select(Subscription).where(Subscription.user_id == user.id))
    sub = result.scalar_one_or_none()
    if sub and sub.status.value.lower() in ("active", "trialing") and sub.plan.value.upper() != "FREE":
        return sub.plan.value.lower()
    return "free"


# Max results per page by plan — enforced server-side so API bypass is impossible
_PLAN_PAGE_LIMIT: dict[str, int] = {
    "free":          3,
    "starter":       10,
    "investor":      9999,
    "pro":           9999,
    "institutional": 9999,
}


router = APIRouter(prefix="/lots", tags=["lots"])


# ── SSE: real-time stream ─────────────────────────────────────────────────────

async def _lot_stream_generator(request: Request, min_score: float = 0):
    last_seen: set = set()
    heartbeat = 0

    while True:
        if await request.is_disconnected():
            break

        heartbeat += 1

        try:
            async with AsyncSessionLocal() as session:
                cutoff = datetime.utcnow() - timedelta(seconds=30)
                stmt = (
                    select(Lot)
                    .options(selectinload(Lot.artist))
                    .where(
                        and_(
                            Lot.scored_at >= cutoff,
                            Lot.deal_score >= min_score,
                        )
                    )
                    .order_by(desc(Lot.deal_score))
                    .limit(20)
                )
                result = await session.execute(stmt)
                lots = result.scalars().all()

                new_lots = [l for l in lots if str(l.id) not in last_seen]

                for lot in new_lots:
                    last_seen.add(str(lot.id))
                    lot_data = {
                        "id": str(lot.id),
                        "title": lot.title,
                        "artist_name_raw": lot.artist_name_raw,
                        "source": lot.source.value if lot.source else None,
                        "category": lot.category,
                        "estimate_low": lot.estimate_low,
                        "estimate_high": lot.estimate_high,
                        "current_price": lot.current_price,
                        "currency": lot.currency,
                        "deal_score": lot.deal_score,
                        "is_deal": lot.is_deal,
                        "pct_below_low_estimate": lot.pct_below_low_estimate,
                        "pct_below_market_avg": lot.pct_below_market_avg,
                        "auction_date": lot.auction_date.isoformat() if lot.auction_date else None,
                        "auction_house_name": lot.auction_house_name,
                        "image_url": lot.image_url,
                        "url": lot.url,
                        "status": lot.status.value if lot.status else None,
                        "artist": {
                            "name": lot.artist.name,
                            "liquidity_score": lot.artist.liquidity_score,
                            "avg_auction_price": lot.artist.avg_auction_price,
                            "trend": lot.artist.trend.value if lot.artist.trend else None,
                        } if lot.artist else None,
                        "scored_at": lot.scored_at.isoformat() if lot.scored_at else None,
                    }
                    yield f"event: lot\ndata: {json.dumps(lot_data)}\n\n"

        except Exception as e:
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"

        if heartbeat % 5 == 0:
            yield f"event: heartbeat\ndata: {json.dumps({'ts': datetime.utcnow().isoformat()})}\n\n"

        await asyncio.sleep(8)


@router.get("/stream")
async def stream_lots(
    request: Request,
    min_score: float = Query(0, ge=0, le=100),
):
    """SSE — streams new scored lots every 8s."""
    return StreamingResponse(
        _lot_stream_generator(request, min_score),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ── REST ──────────────────────────────────────────────────────────────────────

@router.get("")
async def list_lots(
    response: Response,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    min_score: Optional[float] = Query(None, ge=0, le=100),
    max_score: Optional[float] = Query(None, ge=0, le=100),
    is_deal: Optional[bool] = None,
    # Single source (alpha tab) — kept for backward compat
    source: Optional[str] = None,
    # Multi-source (market tab) — comma-separated: "drouot,invaluable"
    sources: Optional[str] = Query(None),
    category: Optional[str] = None,
    medium: Optional[str] = None,
    auction_house: Optional[str] = Query(None),
    artist: Optional[str] = None,
    search: Optional[str] = Query(None),
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    # Both naming conventions accepted (frontend sends auction_date_from)
    auction_from: Optional[datetime] = None,
    auction_to: Optional[datetime] = None,
    auction_date_from: Optional[datetime] = Query(None),
    auction_date_to: Optional[datetime] = Query(None),
    status: Optional[str] = None,
    market_type: Optional[str] = Query(None, pattern="^(auction|primary|gallery)$"),
    min_confidence: Optional[float] = Query(None, ge=0, le=100),
    low_supply: bool = Query(False),
    sort_by: str = Query("deal_score", pattern="^(deal_score|auction_date|created_at|current_price)$"),
    sort_dir: str = Query("desc", pattern="^(asc|desc)$"),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    # ── Plan enforcement ─────────────────────────────────────────────────────
    # Cap page_size to the caller's plan limit so API bypass is impossible.
    plan = await get_user_plan(current_user, db)
    max_per_page = _PLAN_PAGE_LIMIT.get(plan, 3)
    if page_size > max_per_page:
        page_size = max_per_page

    # ── Cache lookup ─────────────────────────────────────────────────────────
    cache_key = f"lots:{plan}:{sort_by}:{sort_dir}:{min_score}:{page}:{page_size}:{category or ''}:{search or ''}:{source or ''}:{sources or ''}:{min_price or 0}:{max_price or 0}:{auction_date_from or ''}:{auction_date_to or ''}"
    cached = get_cached(cache_key, ttl=120)
    if cached:
        response.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=120"
        response.headers["Vary"] = "Accept-Encoding"
        return cached

    # Coalesce date param names — frontend may send either form
    resolved_from = auction_date_from or auction_from
    resolved_to   = auction_date_to   or auction_to

    filters = [
        # Only show upcoming/live lots in main feed — past lots go to /missed
        or_(
            Lot.auction_date.is_(None),
            Lot.auction_date >= datetime.utcnow(),
        )
    ]
    if min_score is not None:
        filters.append(Lot.deal_score >= min_score)
    if max_score is not None:
        filters.append(Lot.deal_score <= max_score)
    if is_deal is not None:
        filters.append(Lot.is_deal == is_deal)
    if source:
        try:
            filters.append(Lot.source == AuctionHouse[source.upper()])
        except KeyError:
            return LotListResponse(items=[], total=0, page=page, page_size=page_size, pages=0)
    if sources:
        tokens = [s.strip() for s in sources.split(",") if s.strip()]
        valid_enums = []
        for token in tokens:
            try:
                valid_enums.append(AuctionHouse[token.upper()])
            except KeyError:
                pass
        if valid_enums:
            filters.append(or_(*[Lot.source == e for e in valid_enums]))
    if category:
        # Fallback keywords for lots where category is NULL — match against medium/title
        _CAT_FALLBACK: dict[str, list[str]] = {
            "Paintings":          ["oil", "paint", "huile", "acrylic", "canvas", "toile", "watercolor", "aquarelle"],
            "Prints & Multiples": ["print", "lithograph", "gravure", "etching", "screenprint", "estampe", "woodcut"],
            "Drawings":           ["drawing", "dessin", "pastel", "pencil", "crayon", "gouache", "charcoal", "ink"],
            "Sculpture":          ["sculpture", "bronze", "ceramic", "marble", "terracotta", "resin"],
            "Photography":        ["photo", "photograph", "tirage"],
            "Street Art":         ["street art", "urban art", "graffiti", "spray"],
        }
        category_conds = [Lot.category.ilike(f"%{category}%")]
        for kw in _CAT_FALLBACK.get(category, []):
            category_conds.append(Lot.medium.ilike(f"%{kw}%"))
            category_conds.append(Lot.title.ilike(f"%{kw}%"))
        filters.append(or_(*category_conds))
    if medium:
        filters.append(Lot.medium.ilike(f"%{medium}%"))
    if auction_house:
        filters.append(Lot.auction_house_name.ilike(f"%{auction_house}%"))
    if artist:
        filters.append(Lot.artist_name_raw.ilike(f"%{artist}%"))
    if search:
        filters.append(
            or_(
                Lot.title.ilike(f"%{search}%"),
                Lot.artist_name_raw.ilike(f"%{search}%"),
                Lot.auction_house_name.ilike(f"%{search}%"),
                Lot.category.ilike(f"%{search}%"),
            )
        )
    if min_price is not None and min_price > 0:
        filters.append(
            or_(Lot.current_price >= min_price, Lot.estimate_low >= min_price)
        )
    if max_price is not None and max_price > 0:
        filters.append(
            or_(Lot.current_price <= max_price, Lot.estimate_low <= max_price)
        )
    if resolved_from:
        filters.append(Lot.auction_date >= resolved_from)
    if resolved_to:
        filters.append(Lot.auction_date <= resolved_to)
    if status:
        filters.append(Lot.status == status)
    if market_type:
        try:
            filters.append(Lot.market_type == MarketType[market_type.upper()])
        except KeyError:
            pass
    if min_confidence is not None:
        filters.append(
            or_(
                Lot.confidence_score >= min_confidence,
                Lot.confidence_score.is_(None),  # don't filter out unscored lots
            )
        )
    if low_supply:
        # Only keep lots whose artist has ≤ 3 active lots at auction
        supply_subq = (
            select(Lot.artist_name_raw)
            .where(
                and_(
                    Lot.artist_name_raw.isnot(None),
                    or_(Lot.auction_date.is_(None), Lot.auction_date >= datetime.utcnow()),
                )
            )
            .group_by(Lot.artist_name_raw)
            .having(func.count(Lot.id) <= 3)
        )
        filters.append(Lot.artist_name_raw.in_(supply_subq))

    count_stmt = select(func.count(Lot.id))
    if filters:
        count_stmt = count_stmt.where(and_(*filters))
    count_result = await db.execute(count_stmt)
    total = count_result.scalar()

    sort_col = getattr(Lot, sort_by, Lot.deal_score)
    sort_expr = desc(sort_col) if sort_dir == "desc" else sort_col

    stmt = (
        select(Lot)
        .order_by(sort_expr.nullslast() if sort_dir == "desc" else sort_expr)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    if filters:
        stmt = stmt.where(and_(*filters))

    result = await db.execute(stmt)
    lots = result.scalars().all()

    # Compute supply_count per artist for returned lots
    artist_names = list({l.artist_name_raw for l in lots if l.artist_name_raw})
    supply_map: dict = {}
    if artist_names:
        from sqlalchemy import text as _text
        sc_result = await db.execute(
            _text("""
                SELECT artist_name_raw, COUNT(*) as cnt
                FROM lots
                WHERE artist_name_raw = ANY(:names)
                  AND (auction_date IS NULL OR auction_date >= NOW())
                GROUP BY artist_name_raw
            """),
            {"names": artist_names},
        )
        supply_map = {r[0]: r[1] for r in sc_result.fetchall()}

    def _enrich(lot):
        d = lot_to_list_dict(lot)
        cnt = supply_map.get(lot.artist_name_raw, 0)
        d["supply_count"] = cnt
        d["is_low_supply"] = cnt <= 3
        return d

    result = {
        "items": [_enrich(lot) for lot in lots],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": math.ceil(total / page_size) if total > 0 else 0,
    }
    set_cached(cache_key, result)
    response.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=120"
    response.headers["Vary"] = "Accept-Encoding"
    return result


@router.get("/hot-deals")
async def get_hot_deals(
    limit: int = Query(20, ge=1, le=200),
    min_score: float = Query(30.0, ge=0, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Returns the best deals right now — lots significantly below market value."""
    now = datetime.utcnow()

    # Top scored lots (ordered by score)
    stmt = (
        select(Lot)
        .options(selectinload(Lot.artist))
        .where(
            and_(
                Lot.deal_score.isnot(None),
                Lot.deal_score >= min_score,
                Lot.auction_date >= now,
                Lot.url.isnot(None),
                Lot.url != "",
            )
        )
        .order_by(desc(Lot.deal_score))
        .limit(limit)
    )
    result = await db.execute(stmt)
    scored_lots = result.scalars().all()

    # Always include real lots (verified lot URLs from actual auction sites)
    real_stmt = (
        select(Lot)
        .options(selectinload(Lot.artist))
        .where(
            and_(
                Lot.deal_score.isnot(None),
                Lot.auction_date >= now,
                Lot.url.isnot(None),
                Lot.url != "",
                or_(
                    Lot.url.like("%drouot.com/fr/l/%"),
                    Lot.url.like("%drouot.com/en/l/%"),
                ),
            )
        )
        .order_by(desc(Lot.deal_score))
        .limit(30)
    )
    real_result = await db.execute(real_stmt)
    real_lots = real_result.scalars().all()

    # Build final list: real lots first (always included), then fill with scored lots
    seen_ids: set = set(lot.id for lot in real_lots)
    extra = [lot for lot in scored_lots if lot.id not in seen_ids]
    lots = list(real_lots) + extra[:max(0, limit - len(real_lots))]

    return [
        {
            "id": str(lot.id),
            "title": lot.title,
            "artist": lot.artist_name_raw,
            "source": lot.source.value if lot.source else None,
            "deal_score": lot.deal_score,
            "deal_class": (
                "FIRE" if (lot.deal_score or 0) >= 90 else
                "HOT" if (lot.deal_score or 0) >= 80 else
                "GOOD"
            ),
            "current_price": lot.current_price,
            "estimate_low": lot.estimate_low,
            "estimate_high": lot.estimate_high,
            "pct_below_estimate": lot.pct_below_low_estimate,
            "pct_below_market": lot.pct_below_market_avg,
            "currency": lot.currency,
            "auction_date": lot.auction_date.isoformat() if lot.auction_date else None,
            "auction_house": lot.auction_house_name,
            "url": lot.url,
            "image_url": lot.image_url,
            "category": lot.category,
        }
        for lot in lots
    ]


@router.get("/top-deals", response_model=List[TopDeal])
async def get_top_deals(
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    today = datetime.utcnow()
    week_ahead = today + timedelta(days=7)

    stmt = (
        select(Lot)
        .options(selectinload(Lot.artist))
        .where(
            and_(
                Lot.is_deal == True,
                Lot.deal_score.isnot(None),
                Lot.auction_date >= today,
                Lot.auction_date <= week_ahead,
                Lot.status == LotStatus.UPCOMING,
            )
        )
        .order_by(desc(Lot.deal_score))
        .limit(limit)
    )

    result = await db.execute(stmt)
    lots = result.scalars().all()

    top_deals = []
    for rank, lot in enumerate(lots, 1):
        saving_eur = None
        saving_pct = None
        if lot.current_price and lot.estimate_low:
            saving_eur = max(0, lot.estimate_low - lot.current_price)
            saving_pct = saving_eur / lot.estimate_low * 100 if lot.estimate_low > 0 else None

        top_deals.append(TopDeal(
            lot=lot,
            rank=rank,
            estimated_saving_eur=round(saving_eur, 2) if saving_eur else None,
            estimated_saving_pct=round(saving_pct, 1) if saving_pct else None,
        ))

    return top_deals


@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(db: AsyncSession = Depends(get_db)):
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    total = await db.execute(select(func.count(Lot.id)))
    deals_today = await db.execute(
        select(func.count(Lot.id)).where(
            and_(Lot.is_deal == True, Lot.created_at >= today_start)
        )
    )
    avg_score = await db.execute(
        select(func.avg(Lot.deal_score)).where(Lot.deal_score.isnot(None))
    )
    top_score = await db.execute(
        select(func.max(Lot.deal_score)).where(Lot.is_deal == True)
    )

    from app.models.db_models import Alert
    alerts_today = await db.execute(
        select(func.count(Alert.id)).where(Alert.sent_at >= today_start)
    )

    return DashboardStats(
        total_lots_tracked=total.scalar() or 0,
        deals_detected_today=deals_today.scalar() or 0,
        avg_deal_score=round(avg_score.scalar() or 0, 1),
        top_deal_score=round(top_score.scalar() or 0, 1),
        alerts_sent_today=alerts_today.scalar() or 0,
        sources_active=3,
    )


@router.get("/trending", response_model=LotListResponse)
async def get_trending_lots(
    page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Lots by blue-chip or trending artists."""
    from app.engines.artist_trends import BLUE_CHIP_ARTISTS, TRENDING_ARTISTS

    all_artists = list(BLUE_CHIP_ARTISTS | TRENDING_ARTISTS)
    now = datetime.utcnow()

    # Build OR conditions for partial name matching
    artist_filters = [
        func.lower(Lot.artist_name_raw).contains(name)
        for name in all_artists
    ]

    base = and_(
        Lot.auction_date > now,
        Lot.status == LotStatus.UPCOMING,
        or_(*artist_filters),
    )

    total = (await db.execute(select(func.count(Lot.id)).where(base))).scalar() or 0
    stmt = (
        select(Lot)
        .options(selectinload(Lot.artist))
        .where(base)
        .order_by(desc(Lot.deal_score))
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    lots = (await db.execute(stmt)).scalars().all()
    return LotListResponse(
        items=lots, total=total, page=page, page_size=page_size,
        pages=math.ceil(total / page_size) if total > 0 else 0,
    )


@router.get("/categories", response_model=List[str])
async def get_categories(db: AsyncSession = Depends(get_db)):
    """Returns distinct non-null categories ordered by frequency."""
    stmt = (
        select(Lot.category, func.count(Lot.id).label("cnt"))
        .where(Lot.category.isnot(None))
        .group_by(Lot.category)
        .order_by(desc("cnt"))
        .limit(20)
    )
    result = await db.execute(stmt)
    return [row.category for row in result.all() if row.category]


@router.get("/missed", response_model=LotListResponse)
async def get_missed_deals(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Past lots — all sales whose auction date has passed."""
    now = datetime.utcnow()
    filters = [
        Lot.auction_date < now,
        Lot.auction_date.isnot(None),
    ]
    total = (await db.execute(select(func.count(Lot.id)).where(and_(*filters)))).scalar() or 0
    stmt = (
        select(Lot)
        .options(selectinload(Lot.artist))
        .where(and_(*filters))
        .order_by(desc(Lot.auction_date))  # Most recently ended first
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    lots = (await db.execute(stmt)).scalars().all()
    return LotListResponse(
        items=lots, total=total, page=page, page_size=page_size,
        pages=math.ceil(total / page_size) if total > 0 else 0,
    )


@router.get("/sources")
async def get_source_stats(db: AsyncSession = Depends(get_db)):
    """
    Per-source stats for the World Auctions source health monitor.
    Returns lot count, last_added datetime, and freshness status per source.
    Status thresholds: fresh < 30 min, stale < 120 min, offline >= 120 min.
    """
    FRESH_MIN = 30
    STALE_MIN = 120

    now = datetime.utcnow()
    stmt = (
        select(
            Lot.source,
            func.count(Lot.id).label("lot_count"),
            func.max(Lot.created_at).label("last_added"),
        )
        .where(
            or_(Lot.auction_date.is_(None), Lot.auction_date >= now)
        )
        .group_by(Lot.source)
        .order_by(desc("lot_count"))
    )
    result = await db.execute(stmt)
    rows = result.all()

    out = []
    for row in rows:
        last = row.last_added
        if last:
            age_min = (now - last).total_seconds() / 60
            if age_min < FRESH_MIN:
                status = "fresh"
            elif age_min < STALE_MIN:
                status = "stale"
            else:
                status = "offline"
        else:
            status = "offline"
            age_min = None
        out.append({
            "source": row.source.value if row.source else "unknown",
            "lot_count": row.lot_count,
            "last_added": last.isoformat() if last else None,
            "age_minutes": round(age_min) if age_min is not None else None,
            "status": status,
        })

    # For OTHER sources, break down by auction_house_name
    other_breakdown_stmt = (
        select(
            Lot.auction_house_name,
            func.count(Lot.id).label("lot_count"),
            func.max(Lot.created_at).label("last_added"),
        )
        .where(
            and_(
                Lot.source == AuctionHouse.OTHER,
                Lot.auction_house_name.isnot(None),
                or_(Lot.auction_date.is_(None), Lot.auction_date >= now)
            )
        )
        .group_by(Lot.auction_house_name)
        .order_by(desc("lot_count"))
    )
    other_result = await db.execute(other_breakdown_stmt)
    other_rows = other_result.all()

    for row in other_rows:
        if not row.auction_house_name:
            continue
        last = row.last_added
        age_min = (now - last).total_seconds() / 60 if last else None
        if age_min is None:
            status = "offline"
        elif age_min < FRESH_MIN:
            status = "fresh"
        elif age_min < STALE_MIN:
            status = "stale"
        else:
            status = "offline"
        out.append({
            "source": row.auction_house_name.lower().replace(" ", "_"),
            "lot_count": row.lot_count,
            "last_added": last.isoformat() if last else None,
            "age_minutes": round(age_min) if age_min else None,
            "status": status,
        })

    return out


@router.get("/coverage")
async def get_market_coverage(db: AsyncSession = Depends(get_db)):
    """
    Global market coverage metrics for the dashboard status bar.
    Returns coverage score, total lots, fresh sources count, avg confidence.
    """
    now = datetime.utcnow()
    FRESH_MIN = 30

    # Active sources
    sources_stmt = (
        select(
            Lot.source,
            func.count(Lot.id).label("lot_count"),
            func.max(Lot.created_at).label("last_added"),
            func.avg(Lot.confidence_score).label("avg_confidence"),
        )
        .where(or_(Lot.auction_date.is_(None), Lot.auction_date >= now))
        .group_by(Lot.source)
    )
    sources_result = await db.execute(sources_stmt)
    sources = sources_result.all()

    total_sources = 10  # known total sources
    fresh_sources = 0
    total_lots = 0
    confidence_sum = 0.0
    confidence_count = 0

    for row in sources:
        total_lots += row.lot_count
        if row.last_added:
            age_min = (now - row.last_added).total_seconds() / 60
            if age_min < FRESH_MIN:
                fresh_sources += 1
        if row.avg_confidence:
            confidence_sum += float(row.avg_confidence)
            confidence_count += 1

    coverage_pct = round((fresh_sources / total_sources) * 100)
    avg_confidence = round(confidence_sum / confidence_count) if confidence_count > 0 else 0

    # Count lots with rationale
    rationale_count = (await db.execute(
        select(func.count(Lot.id)).where(
            and_(
                Lot.score_rationale.isnot(None),
                or_(Lot.auction_date.is_(None), Lot.auction_date >= now),
            )
        )
    )).scalar() or 0

    return {
        "coverage_pct": coverage_pct,
        "fresh_sources": fresh_sources,
        "total_sources": total_sources,
        "total_lots": total_lots,
        "avg_confidence": avg_confidence,
        "lots_with_rationale": rationale_count,
        "status": "live",
        "updated_at": now.isoformat(),
    }


@router.get("/primary", response_model=LotListResponse)
async def get_primary_lots(
    page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1, le=100),
    sort_by: str = Query("deal_score", pattern="^(deal_score|created_at|current_price)$"),
    sort_dir: str = Query("desc", pattern="^(asc|desc)$"),
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """Primary market feed — galleries, emerging artists, direct sales."""
    plan = await get_user_plan(current_user, db)
    max_per_page = _PLAN_PAGE_LIMIT.get(plan, 3)
    page_size = min(page_size, max_per_page)

    filters = [
        or_(
            Lot.market_type == MarketType.PRIMARY,
            Lot.market_type == MarketType.GALLERY,
            Lot.auction_house_name.in_(["Artsper", "Saatchi Art", "Singulart"]),
        )
    ]
    if min_price is not None:
        filters.append(Lot.current_price >= min_price)
    if max_price is not None:
        filters.append(Lot.current_price <= max_price)
    if category:
        filters.append(Lot.category.ilike(f"%{category}%"))
    if search:
        filters.append(or_(
            Lot.title.ilike(f"%{search}%"),
            Lot.artist_name_raw.ilike(f"%{search}%"),
        ))

    sort_col = {
        "deal_score":    Lot.deal_score,
        "created_at":    Lot.created_at,
        "current_price": Lot.current_price,
    }.get(sort_by, Lot.deal_score)
    order = desc(sort_col) if sort_dir == "desc" else sort_col

    total = (await db.execute(
        select(func.count(Lot.id)).where(and_(*filters))
    )).scalar() or 0

    lots = (await db.execute(
        select(Lot)
        .options(selectinload(Lot.artist))
        .where(and_(*filters))
        .order_by(order)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )).scalars().all()

    return LotListResponse(
        items=lots,
        total=total,
        page=page,
        page_size=page_size,
        pages=math.ceil(total / page_size) if total > 0 else 0,
    )


@router.get("/for-investor", response_model=LotListResponse)
async def get_lots_for_investor(
    budget_min: Optional[float] = Query(None, description="Min budget EUR"),
    budget_max: Optional[float] = Query(None, description="Max budget EUR"),
    horizon: Optional[str] = Query(None, pattern="^(short|medium|long)$", description="short=<2y, medium=2-5y, long=5y+"),
    profile: Optional[str] = Query(None, pattern="^(first_time|collector|investor)$"),
    limit: int = Query(12, ge=1, le=24),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """
    Investor-first endpoint. Returns top N lots curated for a specific budget + profile.
    This is the main feed for the new onboarding experience.
    Always returns max `limit` lots (default 12), sorted by relevance score.
    """
    plan = await get_user_plan(current_user, db)
    # Free users get preview of 3
    effective_limit = min(limit, 3) if plan == "free" else limit

    filters = [
        or_(Lot.auction_date.is_(None), Lot.auction_date >= datetime.utcnow()),
        Lot.deal_score >= 45,  # Only Interesting+ lots
        Lot.deal_score.isnot(None),
        # Only show high-confidence lots in investor feed
        or_(
            Lot.confidence_score >= 50,
            Lot.confidence_score.is_(None),
        ),
    ]

    # Budget filter
    if budget_min is not None:
        filters.append(
            or_(
                Lot.current_price >= budget_min,
                and_(Lot.current_price.is_(None), Lot.estimate_low >= budget_min),
            )
        )
    if budget_max is not None:
        filters.append(
            or_(
                Lot.current_price <= budget_max,
                and_(Lot.current_price.is_(None), Lot.estimate_low <= budget_max),
            )
        )

    # Horizon → liquidity proxy via artist join
    # short = high liquidity artists (liquidity_score >= 70)
    # long = any (including lower liquidity = niche/emerging)
    liquidity_filter = None
    if horizon == "short":
        liquidity_filter = Artist.liquidity_score >= 70
    elif horizon == "medium":
        liquidity_filter = Artist.liquidity_score >= 40

    stmt = (
        select(Lot)
        .options(selectinload(Lot.artist))
        .outerjoin(Artist, Lot.artist_id == Artist.id)
        .where(and_(*filters))
    )
    if liquidity_filter is not None:
        stmt = stmt.where(or_(liquidity_filter, Lot.artist_id.is_(None)))

    # Order by deal_score desc — best opportunities first
    stmt = stmt.order_by(desc(Lot.deal_score)).limit(effective_limit * 3)  # fetch 3x, re-rank below

    lots = (await db.execute(stmt)).scalars().all()

    # Re-rank: penalize lots without image, boost lots with high upside
    def relevance(lot: Lot) -> float:
        s = lot.deal_score or 0
        if not lot.image_url:
            s -= 10
        if (lot.pct_below_low_estimate or 0) > 20:
            s += 5
        if lot.artist and lot.artist.liquidity_score and lot.artist.liquidity_score > 70:
            s += 3
        return s

    lots_sorted = sorted(lots, key=relevance, reverse=True)[:effective_limit]

    return LotListResponse(
        items=lots_sorted,
        total=len(lots_sorted),
        page=1,
        page_size=effective_limit,
        pages=1,
    )


@router.delete("/admin/cleanup-non-art")
async def cleanup_non_art_lots(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin only — remove non-art lots from DB."""
    if current_user.email not in ADMIN_EMAILS:
        raise HTTPException(403, "Admin only")

    from sqlalchemy import delete

    total_before = (await db.execute(select(func.count(Lot.id)))).scalar()

    # Delete Adam's lots
    r_adams = await db.execute(
        delete(Lot).where(
            or_(
                Lot.auction_house_name.ilike('%adam%'),
                Lot.auction_house_name.ilike('%adams%'),
            )
        )
    )

    # Delete jewelry/non-art categories
    r_cat = await db.execute(
        delete(Lot).where(
            or_(
                Lot.category.ilike('%ring%'),
                Lot.category.ilike('%jewel%'),
                Lot.category.ilike('%watch%'),
                Lot.category.ilike('%coin%'),
                Lot.category.ilike('%stamp%'),
                Lot.category.ilike('%brooch%'),
                Lot.category.ilike('%necklace%'),
                Lot.category.ilike('%bracelet%'),
                Lot.category.ilike('%pendant%'),
                Lot.category.ilike('%earring%'),
            )
        )
    )

    # Delete lots with jewelry/non-art keywords in title
    jewelry_patterns = [
        '%diamond ring%', '%cocktail ring%', '%pearl ring%',
        '%ruby ring%', '%emerald ring%', '%diamond pendant%',
        '%diamond necklace%', '%diamond brooch%', '%cultured pearl%',
        '%gold ring%', '%silver ring%', '%engagement ring%',
        '%wedding band%', '%signet ring%', '%diamond bracelet%',
        '%pocket watch%', '%wristwatch%', '%gold coin%',
        '%silver coin%', '%postage stamp%', '%medal for%',
        '%médaille%', '%monnaie de%', '%prix sur demande%',
        '%price on request%', '%price upon request%',
    ]
    r_jewelry = await db.execute(
        delete(Lot).where(or_(*[Lot.title.ilike(p) for p in jewelry_patterns]))
    )

    # Delete lots with no price at all
    r_no_price = await db.execute(
        delete(Lot).where(
            and_(
                Lot.current_price.is_(None),
                Lot.estimate_low.is_(None),
            )
        )
    )

    await db.commit()

    total_after = (await db.execute(select(func.count(Lot.id)))).scalar()

    return {
        "deleted_adams": r_adams.rowcount,
        "deleted_jewelry_category": r_cat.rowcount,
        "deleted_jewelry_titles": r_jewelry.rowcount,
        "deleted_no_price": r_no_price.rowcount,
        "total_before": total_before,
        "total_after": total_after,
        "freed": total_before - total_after,
    }


@router.post("/admin/generate-rationales")
async def trigger_rationale_generation(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin only — generate GPT rationales for lots missing them."""
    if current_user.email not in ADMIN_EMAILS:
        raise HTTPException(403, "Admin only")

    from app.jobs.tasks import _generate_rationales_async
    generated = await _generate_rationales_async(max_lots=30)
    return {"generated": generated, "status": "done"}


@router.post("/admin/send-weekly-report")
async def trigger_weekly_report(
    x_api_key: str = Header(None, alias="x-api-key"),
):
    """Manual trigger for weekly report — admin only."""
    import asyncio
    from app.config import get_settings
    settings = get_settings()

    if not x_api_key or x_api_key != settings.n8n_api_key:
        raise HTTPException(403, "Unauthorized")

    try:
        from app.jobs.weekly_report import send_weekly_report
        asyncio.create_task(send_weekly_report())
        return {"message": "Weekly report sending started"}
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/admin/fetch-historical/{artist_name}")
async def fetch_historical_for_artist(
    artist_name: str,
    x_api_key: str = Header(None, alias="x-api-key"),
    db: AsyncSession = Depends(get_db),
):
    """Trigger historical auction results fetch for an artist."""
    from app.config import get_settings as gs
    s = gs()
    if x_api_key != s.n8n_api_key:
        raise HTTPException(403, "Unauthorized")

    try:
        from app.scrapers.artsy_historical_scraper import fetch_artist_auction_results
        from app.scrapers.hammer_price_saver import save_hammer_prices

        prices = await fetch_artist_auction_results(
            artist_name=artist_name,
            artsy_token=s.artsy_api_key,  # None is fine — public API
            max_results=200,
        )

        saved = await save_hammer_prices(prices, db)

        return {
            "artist": artist_name,
            "fetched": len(prices),
            "saved": saved,
            "message": f"Successfully fetched {len(prices)} historical results, saved {saved} new records."
        }
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/admin/ingest-hammer-prices")
async def ingest_hammer_prices(
    request: Request,
    x_api_key: str = Header(None, alias="x-api-key"),
    db: AsyncSession = Depends(get_db),
):
    """Accept a JSON array of pre-scraped hammer price records and save to DB."""
    from app.config import get_settings as gs
    s = gs()
    if x_api_key != s.n8n_api_key:
        raise HTTPException(403, "Unauthorized")

    try:
        from app.scrapers.hammer_price_saver import save_hammer_prices
        body = await request.json()
        if not isinstance(body, list):
            raise HTTPException(400, "Expected a JSON array of records")

        # Parse sale_date strings to datetime objects
        from dateutil import parser as dp
        for rec in body:
            if rec.get("sale_date") and isinstance(rec["sale_date"], str):
                try:
                    rec["sale_date"] = dp.parse(rec["sale_date"])
                except Exception:
                    rec["sale_date"] = None

        saved = await save_hammer_prices(body, db)
        return {"received": len(body), "saved": saved}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/calendar")
async def get_auction_calendar(
    days: int = Query(30, ge=1, le=90),
    db: AsyncSession = Depends(get_db),
):
    """Upcoming auctions grouped by house and date."""
    cache_key = f"calendar:{days}"
    cached = get_cached(cache_key, ttl=900)
    if cached:
        return cached

    cutoff_start = datetime.utcnow()
    cutoff_end = cutoff_start + timedelta(days=days)

    result = await db.execute(
        select(Lot)
        .where(
            and_(
                Lot.auction_date >= cutoff_start.date(),
                Lot.auction_date <= cutoff_end.date(),
            )
        )
        .order_by(Lot.auction_date, Lot.deal_score.desc().nullslast())
        .limit(500)
    )
    lots = result.scalars().all()

    # Group by house
    from collections import defaultdict
    by_house: dict = defaultdict(list)
    by_date: dict = defaultdict(list)

    for lot in lots:
        house = lot.auction_house_name or "Unknown"
        date_str = lot.auction_date.isoformat() if lot.auction_date else "TBD"
        by_house[house].append(lot)
        by_date[date_str].append(lot)

    def lot_summary(lot) -> dict:
        return {
            "id": str(lot.id),
            "title": lot.title,
            "artist_name_raw": lot.artist_name_raw,
            "deal_score": lot.deal_score,
            "current_price": lot.current_price,
            "estimate_low": lot.estimate_low,
            "estimate_high": lot.estimate_high,
            "image_url": lot.image_url,
            "auction_date": lot.auction_date.isoformat() if lot.auction_date else None,
            "category": lot.category,
            "currency": lot.currency,
        }

    def house_stats(house_lots: list) -> dict:
        scores = [l.deal_score for l in house_lots if l.deal_score]
        dates = sorted({l.auction_date for l in house_lots if l.auction_date})
        return {
            "lot_count": len(house_lots),
            "avg_score": round(sum(scores) / len(scores), 1) if scores else 0,
            "max_score": round(max(scores), 1) if scores else 0,
            "dates": [d.isoformat() for d in dates],
            "top_lots": [lot_summary(l) for l in sorted(house_lots, key=lambda x: x.deal_score or 0, reverse=True)[:4]],
        }

    now = datetime.utcnow()
    urgent_threshold = now + timedelta(days=3)

    houses_out = [
        {"house": house, **house_stats(house_lots)}
        for house, house_lots in sorted(by_house.items(), key=lambda kv: len(kv[1]), reverse=True)
    ]

    dates_out = []
    for date_str, date_lots in sorted(by_date.items()):
        try:
            auction_dt = datetime.fromisoformat(date_str)
            urgent = auction_dt <= urgent_threshold
        except Exception:
            urgent = False
        scores = [l.deal_score for l in date_lots if l.deal_score]
        houses_on_date = list({l.auction_house_name for l in date_lots if l.auction_house_name})
        dates_out.append({
            "date": date_str,
            "urgent": urgent,
            "lot_count": len(date_lots),
            "avg_score": round(sum(scores) / len(scores), 1) if scores else 0,
            "houses": houses_on_date,
            "top_lots": [lot_summary(l) for l in sorted(date_lots, key=lambda x: x.deal_score or 0, reverse=True)[:4]],
        })

    response = {
        "total_lots": len(lots),
        "days": days,
        "by_house": houses_out,
        "by_date": dates_out,
    }
    set_cached(cache_key, response)
    return response


# ── Public endpoint (no auth) — MUST be before /{lot_id} to avoid route shadowing ──────────────

@router.get("/public")
async def get_public_lots(
    limit: int = Query(default=3, le=6),
    sort: str = Query(default="deal_score"),
    db: AsyncSession = Depends(get_db),
):
    """
    Public (unauthenticated) endpoint returning top N lots by deal_score.
    Used by landing page Today's Signals section.
    Returns minimal fields only — no sensitive pricing context.
    """
    order_col = desc(Lot.deal_score) if sort == "deal_score" else desc(Lot.created_at)
    result = await db.execute(
        select(Lot)
        .where(and_(
            Lot.status.in_([LotStatus.UPCOMING, LotStatus.LIVE]),
            Lot.market_type == MarketType.AUCTION,
            Lot.deal_score.isnot(None),
            Lot.title.isnot(None),
        ))
        .order_by(order_col)
        .limit(limit * 2)
    )
    lots = result.scalars().all()[:limit]
    return {
        "lots": [
            {
                "id": str(l.id),
                "title": l.title,
                "artist_name_raw": l.artist_name_raw,
                "deal_score": l.deal_score,
                "estimate_low": l.estimate_low,
                "estimate_high": l.estimate_high,
                "auction_house_name": l.auction_house_name,
                "auction_date": l.auction_date.isoformat() if l.auction_date else None,
                "image_url": l.image_url,
                "category": l.category,
            }
            for l in lots
        ]
    }


@router.get("/{lot_id}")
async def get_lot(lot_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Lot)
        .options(selectinload(Lot.artist))
        .where(Lot.id == lot_id)
    )
    lot = result.scalar_one_or_none()
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")

    # Serialize via schema then inject parsed dimension fields
    lot_dict = LotOut.model_validate(lot).model_dump(mode="json")
    dims = parse_dimensions(lot.dimensions or "")
    lot_dict["width_cm"] = dims["width_cm"]
    lot_dict["height_cm"] = dims["height_cm"]
    lot_dict["dimensions_parsed"] = dims
    hammer = lot.current_price or lot.estimate_low
    lot_dict["real_cost"] = compute_real_cost(float(hammer), lot.auction_house_name) if hammer else None
    lot_dict["estimation_bias"] = await get_estimation_bias(lot.auction_house_name, db)
    lot_dict["cycle_stage"] = await get_cycle_stage(lot.artist_name_raw, db)
    lot_dict["consignment_alert"] = await get_consignment_alert(lot.artist_name_raw, str(lot.id), db)
    lot_dict["provenance_risk"] = await get_provenance_risk(lot, db)
    return lot_dict


@router.get("/{lot_id}/comparables")
async def get_comparables(
    lot_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Find comparable lots — same artist or same category + similar price range."""
    cache_key = f"comparables:{lot_id}"
    cached = get_cached(cache_key, ttl=3600)
    if cached:
        return cached

    lot_result = await db.execute(select(Lot).where(Lot.id == lot_id))
    lot = lot_result.scalar_one_or_none()
    if not lot:
        raise HTTPException(404, "Lot not found")

    comparables = []

    # Strategy 1 — Same artist, different lot
    if lot.artist_name_raw:
        same_artist = await db.execute(
            select(Lot)
            .where(
                and_(
                    Lot.artist_name_raw.ilike(f"%{lot.artist_name_raw}%"),
                    Lot.id != lot.id,
                    Lot.estimate_low.isnot(None),
                )
            )
            .order_by(Lot.deal_score.desc().nullslast())
            .limit(6)
        )
        comparables.extend(same_artist.scalars().all())

    # Strategy 2 — Same category + similar price range
    if len(comparables) < 3 and lot.category:
        ref_price = lot.current_price or lot.estimate_low or 0
        if ref_price > 0:
            price_min = ref_price * 0.4
            price_max = ref_price * 2.5
            similar = await db.execute(
                select(Lot)
                .where(
                    and_(
                        Lot.category.ilike(f"%{lot.category}%"),
                        Lot.id != lot.id,
                        Lot.id.notin_([c.id for c in comparables]),
                        or_(
                            and_(Lot.current_price >= price_min, Lot.current_price <= price_max),
                            and_(Lot.estimate_low >= price_min, Lot.estimate_low <= price_max),
                        ),
                        Lot.deal_score.isnot(None),
                    )
                )
                .order_by(Lot.deal_score.desc())
                .limit(6 - len(comparables))
            )
            comparables.extend(similar.scalars().all())

    ref_price = lot.current_price or lot.estimate_low or 0
    comp_prices = [
        c.current_price or c.estimate_low
        for c in comparables
        if (c.current_price or c.estimate_low)
    ]
    market_avg = sum(comp_prices) / len(comp_prices) if comp_prices else 0
    price_gap_pct = ((market_avg - ref_price) / ref_price * 100) if ref_price and market_avg else 0

    response = {
        "lot_id": lot_id,
        "reference": {
            "title": lot.title,
            "artist": lot.artist_name_raw,
            "price": ref_price,
            "score": lot.deal_score,
        },
        "comparables": [lot_to_list_dict(c) for c in comparables[:6]],
        "market_analysis": {
            "comparable_count": len(comparables),
            "market_avg_price": round(market_avg) if market_avg else None,
            "price_gap_pct": round(price_gap_pct, 1),
            "verdict": (
                "Significantly underpriced" if price_gap_pct > 30
                else "Underpriced" if price_gap_pct > 10
                else "Fairly priced" if price_gap_pct > -10
                else "Above market"
            ),
            "verdict_color": (
                "#C6A85A" if price_gap_pct > 30
                else "#2563EB" if price_gap_pct > 10
                else "#64748B" if price_gap_pct > -10
                else "#EF4444"
            ),
        }
    }

    set_cached(cache_key, response)
    return response


@router.get("/{lot_id}/similar", response_model=List[LotOut])
async def get_similar(
    lot_id: str,
    limit: int = Query(6, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
):
    """Similar lots by category and price range."""
    lot = (await db.execute(
        select(Lot).where(Lot.id == lot_id)
    )).scalar_one_or_none()
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")

    filters = [Lot.id != lot_id, Lot.is_deal == True]
    if lot.category:
        filters.append(Lot.category.ilike(f"%{lot.category}%"))
    if lot.current_price:
        low = lot.current_price * 0.3
        high = lot.current_price * 3.0
        filters.append(Lot.current_price.between(low, high))

    stmt = (
        select(Lot)
        .options(selectinload(Lot.artist))
        .where(and_(*filters))
        .order_by(desc(Lot.deal_score).nullslast())
        .limit(limit)
    )
    results = (await db.execute(stmt)).scalars().all()

    # Fallback: if not enough results, broaden to category only
    if len(results) < 3 and lot.category:
        stmt2 = (
            select(Lot)
            .options(selectinload(Lot.artist))
            .where(and_(
                Lot.id != lot_id,
                Lot.category.ilike(f"%{lot.category}%"),
            ))
            .order_by(desc(Lot.deal_score).nullslast())
            .limit(limit)
        )
        results = (await db.execute(stmt2)).scalars().all()

    return results


@router.get("/{lot_id}/projection")
async def get_lot_projection(
    lot_id: str,
    purchase_price: Optional[float] = Query(None, description="Override price for projection (EUR)"),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """Value projection for a lot over 5/10/20/30/50 years."""
    result = await db.execute(
        select(Lot).options(selectinload(Lot.artist)).where(Lot.id == lot_id)
    )
    lot = result.scalar_one_or_none()
    if not lot:
        raise HTTPException(404, "Lot not found")

    price = purchase_price or lot.current_price or lot.estimate_low or 1000.0

    from app.engines.projections import project_value
    return project_value(
        purchase_price_eur=float(price),
        artist_name=lot.artist_name_raw,
        liquidity_score=lot.artist.liquidity_score if lot.artist else 50.0,
        popularity_score=lot.artist.popularity_score if lot.artist else 50.0,
        trend=lot.artist.trend.value if lot.artist and lot.artist.trend else "stable",
    )
