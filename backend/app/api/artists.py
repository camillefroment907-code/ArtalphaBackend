"""Artists API — investment intelligence from Artsy data."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, or_
from typing import Optional

from app.database import get_db
from app.models.db_models import ArtistProfile, Lot
from app.api.auth_utils import get_current_user_optional

router = APIRouter(prefix="/artist-profiles", tags=["artist-profiles"])


@router.get("/")
async def list_artists(
    tier: Optional[str] = Query(None),  # blue_chip, mid_career, emerging
    min_momentum: Optional[float] = Query(None),
    is_pre_auction: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(20, le=100),
    db: AsyncSession = Depends(get_db),
):
    """List artists with investment intelligence scores."""
    filters = []
    if tier:
        filters.append(ArtistProfile.investment_tier == tier)
    if min_momentum is not None:
        filters.append(ArtistProfile.momentum_score >= min_momentum)
    if is_pre_auction is not None:
        filters.append(ArtistProfile.is_pre_auction == is_pre_auction)
    if search:
        filters.append(ArtistProfile.name.ilike(f"%{search}%"))

    from sqlalchemy import and_
    stmt = (
        select(ArtistProfile)
        .where(and_(*filters) if filters else True)
        .order_by(desc(ArtistProfile.momentum_score))
        .limit(limit)
    )
    result = await db.execute(stmt)
    artists = result.scalars().all()

    return [_serialize_artist(a) for a in artists]


@router.get("/momentum")
async def get_momentum_artists(
    limit: int = Query(10, le=50),
    db: AsyncSession = Depends(get_db),
):
    """Top artists by momentum score — for dashboard widget."""
    result = await db.execute(
        select(ArtistProfile)
        .where(ArtistProfile.momentum_score.isnot(None))
        .order_by(desc(ArtistProfile.momentum_score))
        .limit(limit)
    )
    artists = result.scalars().all()
    return [_serialize_artist(a) for a in artists]


@router.get("/pre-auction")
async def get_pre_auction_artists(
    limit: int = Query(10, le=50),
    db: AsyncSession = Depends(get_db),
):
    """Artists in galleries but not yet at auction — best entry point."""
    result = await db.execute(
        select(ArtistProfile)
        .where(ArtistProfile.is_pre_auction == True)  # noqa: E712
        .order_by(desc(ArtistProfile.momentum_score))
        .limit(limit)
    )
    artists = result.scalars().all()
    return [_serialize_artist(a) for a in artists]


@router.get("/{artist_name}")
async def get_artist(
    artist_name: str,
    db: AsyncSession = Depends(get_db),
):
    """Get full artist intelligence profile."""
    result = await db.execute(
        select(ArtistProfile)
        .where(ArtistProfile.name.ilike(f"%{artist_name}%"))
        .limit(1)
    )
    artist = result.scalar_one_or_none()
    if not artist:
        from fastapi import HTTPException
        raise HTTPException(404, f"Artist '{artist_name}' not found")

    # Get lots for this artist
    lots_result = await db.execute(
        select(Lot)
        .where(Lot.artist_name_raw.ilike(f"%{artist_name}%"))
        .order_by(desc(Lot.deal_score))
        .limit(10)
    )
    lots = lots_result.scalars().all()

    data = _serialize_artist(artist)
    data["lots"] = [
        {
            "id": str(l.id),
            "title": l.title,
            "current_price": l.current_price,
            "deal_score": l.deal_score,
            "image_url": l.image_url,
            "auction_house_name": l.auction_house_name,
            "url": l.url,
        }
        for l in lots
    ]
    return data


def _serialize_artist(a: ArtistProfile) -> dict:
    return {
        "id": str(a.id),
        "name": a.name,
        "nationality": a.nationality,
        "birth_year": a.birth_year,
        "death_year": a.death_year,
        "biography": a.biography,
        "image_url": a.image_url,
        "artsy_url": a.artsy_url,
        "investment_tier": a.investment_tier,
        "momentum_score": a.momentum_score,
        "liquidity_score": a.liquidity_score,
        "institutional_score": a.institutional_score,
        "gallery_tier_avg": a.gallery_tier_avg,
        "gallery_count": a.gallery_count,
        "top_gallery_name": a.top_gallery_name,
        "public_collections_count": a.public_collections_count,
        "shows_last_12m": a.shows_last_12m,
        "is_pre_auction": a.is_pre_auction,
        "signals": _generate_signals(a),
    }


def _generate_signals(a: ArtistProfile) -> list:
    """Generate human-readable investment signals for the UI."""
    signals = []

    if a.is_pre_auction:
        signals.append({
            "type": "opportunity",
            "icon": "◆",
            "label": "Pre-auction opportunity",
            "detail": "In serious galleries but not yet at auction — optimal entry window",
            "color": "gold",
        })

    if a.momentum_score and a.momentum_score >= 70:
        signals.append({
            "type": "momentum",
            "icon": "↑",
            "label": f"Strong momentum ({a.momentum_score:.0f}/100)",
            "detail": f"{a.shows_last_12m} shows in last 12 months",
            "color": "electric",
        })
    elif a.momentum_score and a.momentum_score >= 50:
        signals.append({
            "type": "momentum",
            "icon": "→",
            "label": f"Growing momentum ({a.momentum_score:.0f}/100)",
            "detail": f"{a.shows_last_12m} shows in last 12 months",
            "color": "text",
        })

    if a.institutional_score and a.institutional_score >= 60:
        signals.append({
            "type": "institutional",
            "icon": "◎",
            "label": "Institutional validation",
            "detail": f"Present in {a.public_collections_count} public collections",
            "color": "navy",
        })

    if a.gallery_tier_avg and a.gallery_tier_avg <= 1.5:
        signals.append({
            "type": "gallery",
            "icon": "★",
            "label": "Top-tier representation",
            "detail": f"Represented by {a.top_gallery_name or 'Tier 1 gallery'}",
            "color": "gold",
        })

    if a.liquidity_score and a.liquidity_score >= 70:
        signals.append({
            "type": "liquidity",
            "icon": "◇",
            "label": "High liquidity",
            "detail": f"Active in {a.gallery_count} galleries across multiple markets",
            "color": "electric",
        })

    return signals
