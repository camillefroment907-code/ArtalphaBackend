from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from typing import List, Optional

from app.database import get_db
from app.models.db_models import Artist, Lot
from app.models.schemas import ArtistOut

artists_router = APIRouter(prefix="/artists", tags=["artists"])
external_router = APIRouter(prefix="/v1", tags=["external-api"])


# ── Artists ───────────────────────────────────────────────────────────────────

@artists_router.get("", response_model=List[ArtistOut])
async def list_artists(
    q: Optional[str] = None,
    min_liquidity: Optional[float] = None,
    trend: Optional[str] = None,
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Artist)
    filters = []

    if q:
        filters.append(Artist.name.ilike(f"%{q}%"))
    if min_liquidity is not None:
        filters.append(Artist.liquidity_score >= min_liquidity)
    if trend:
        filters.append(Artist.trend == trend)

    if filters:
        from sqlalchemy import and_
        stmt = stmt.where(and_(*filters))

    stmt = stmt.order_by(desc(Artist.popularity_score)).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@artists_router.get("/{artist_id}", response_model=ArtistOut)
async def get_artist(artist_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Artist).where(Artist.id == artist_id))
    artist = result.scalar_one_or_none()
    if not artist:
        raise HTTPException(status_code=404, detail="Artist not found")
    return artist


@artists_router.get("/{artist_id}/lots")
async def get_artist_lots(
    artist_id: str,
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(Lot)
        .where(Lot.artist_id == artist_id)
        .order_by(desc(Lot.deal_score))
        .limit(limit)
    )
    return result.scalars().all()


# ── External API (for integrations) ──────────────────────────────────────────

@external_router.get("/deals", summary="External: Get current top deals")
async def external_get_deals(
    min_score: float = Query(75, ge=0, le=100),
    limit: int = Query(10, ge=1, le=50),
    api_key: Optional[str] = Query(None, description="Your HONO API key"),
    db: AsyncSession = Depends(get_db),
):
    """
    External integration endpoint.
    Returns current top deals in a simplified format for third-party apps.
    """
    # In production: validate api_key against a keys table
    if not api_key:
        raise HTTPException(
            status_code=401,
            detail="API key required. Get yours at hono.art/developers",
        )

    from sqlalchemy import and_
    from datetime import datetime
    from sqlalchemy.orm import selectinload

    result = await db.execute(
        select(Lot)
        .options(selectinload(Lot.artist))
        .where(
            and_(
                Lot.is_deal == True,
                Lot.deal_score >= min_score,
                Lot.auction_date >= datetime.utcnow(),
            )
        )
        .order_by(desc(Lot.deal_score))
        .limit(limit)
    )
    lots = result.scalars().all()

    return {
        "api_version": "1.0",
        "generated_at": datetime.utcnow().isoformat(),
        "count": len(lots),
        "deals": [
            {
                "id": str(lot.id),
                "title": lot.title,
                "artist": lot.artist_name_raw,
                "source": lot.source.value,
                "estimate_low": lot.estimate_low,
                "estimate_high": lot.estimate_high,
                "current_price": lot.current_price,
                "currency": lot.currency,
                "deal_score": lot.deal_score,
                "pct_below_estimate": lot.pct_below_low_estimate,
                "auction_date": lot.auction_date.isoformat() if lot.auction_date else None,
                "auction_house": lot.auction_house_name,
                "url": lot.url,
                "image_url": lot.image_url,
            }
            for lot in lots
        ],
    }


@external_router.get("/health")
async def health():
    return {"status": "ok", "service": "HONO API", "version": "1.0.0"}
