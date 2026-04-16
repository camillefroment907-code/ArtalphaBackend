"""Artists API — investment intelligence from Artsy data + Lot market data."""
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, or_, text
from typing import Optional

from app.database import get_db
from app.models.db_models import ArtistProfile, Lot

router = APIRouter(prefix="/artist-profiles", tags=["artist-profiles"])


@router.get("/")
async def list_artists(
    tier: Optional[str] = Query(None),
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
    stmt = select(ArtistProfile).order_by(desc(ArtistProfile.momentum_score)).limit(limit)
    if filters:
        stmt = stmt.where(and_(*filters))
    result = await db.execute(stmt)
    artists = result.scalars().all()
    return [_serialize_artist(a) for a in artists]


@router.get("/momentum")
async def get_momentum_artists(
    limit: int = Query(10, le=50),
    db: AsyncSession = Depends(get_db),
):
    """Top artists by momentum score."""
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
    """Artists in galleries but not yet at auction."""
    result = await db.execute(
        select(ArtistProfile)
        .where(ArtistProfile.is_pre_auction == True)  # noqa: E712
        .order_by(desc(ArtistProfile.momentum_score))
        .limit(limit)
    )
    artists = result.scalars().all()
    return [_serialize_artist(a) for a in artists]


@router.get("/search/{query}")
async def search_artists(
    query: str,
    db: AsyncSession = Depends(get_db),
):
    """Search artists by name — returns list with basic stats from lot data."""
    result = await db.execute(
        select(
            Lot.artist_name_raw,
            func.count(Lot.id).label("lot_count"),
            func.avg(Lot.deal_score).label("avg_score"),
            func.avg(Lot.current_price).label("avg_price"),
        )
        .where(Lot.artist_name_raw.ilike(f"%{query}%"))
        .group_by(Lot.artist_name_raw)
        .order_by(func.count(Lot.id).desc())
        .limit(10)
    )
    artists = result.all()
    return {
        "artists": [
            {
                "name": a.artist_name_raw,
                "lot_count": a.lot_count,
                "avg_score": round(float(a.avg_score or 0), 1),
                "avg_price": round(float(a.avg_price or 0)),
            }
            for a in artists
            if a.artist_name_raw
        ]
    }


@router.get("/{artist_name}/price-history")
async def get_artist_price_history(
    artist_name: str,
    db: AsyncSession = Depends(get_db),
):
    """Full price history for an artist — hammer prices over time."""
    from app.utils.cache import get_cached, set_cached

    cache_key = f"price_history:{artist_name.lower()}"
    cached = get_cached(cache_key, ttl=3600)
    if cached:
        return cached

    result = await db.execute(
        text("""
        SELECT
            artist_name, artwork_title, year_created, medium,
            sale_date, hammer_price_eur, hammer_price, currency,
            estimate_low, estimate_high, premium_ratio,
            auction_house, image_url, lot_number, external_id
        FROM hammer_prices
        WHERE artist_name ILIKE :name
        ORDER BY sale_date DESC NULLS LAST
        LIMIT 200
        """),
        {"name": f"%{artist_name}%"}
    )
    rows = result.mappings().all()

    if not rows:
        return {
            "artist_name": artist_name,
            "total_sales": 0,
            "sales": [],
            "statistics": None,
            "message": "No historical data yet. Fetching in background..."
        }

    sales = [dict(r) for r in rows]

    # Serialize datetimes
    for s in sales:
        if s.get("sale_date"):
            s["sale_date"] = s["sale_date"].isoformat() if hasattr(s["sale_date"], "isoformat") else str(s["sale_date"])

    prices = [s["hammer_price_eur"] for s in sales if s.get("hammer_price_eur")]
    ratios = [s["premium_ratio"] for s in sales if s.get("premium_ratio")]

    # Year-by-year breakdown
    from collections import defaultdict
    by_year: dict = defaultdict(list)
    for s in sales:
        if s.get("sale_date") and s.get("hammer_price_eur"):
            year = s["sale_date"][:4] if isinstance(s["sale_date"], str) else str(s["sale_date"])[:4]
            by_year[year].append(s["hammer_price_eur"])

    price_by_year = [
        {
            "year": year,
            "avg_price": round(sum(ps) / len(ps)),
            "max_price": round(max(ps)),
            "sale_count": len(ps),
        }
        for year, ps in sorted(by_year.items())
    ]

    recent_prices = [s["hammer_price_eur"] for s in sales[:20] if s.get("hammer_price_eur")]
    older_prices = [s["hammer_price_eur"] for s in sales[20:40] if s.get("hammer_price_eur")]
    trend_pct = 0.0
    if recent_prices and older_prices:
        recent_avg = sum(recent_prices) / len(recent_prices)
        older_avg = sum(older_prices) / len(older_prices)
        trend_pct = round((recent_avg - older_avg) / older_avg * 100, 1) if older_avg > 0 else 0.0

    response = {
        "artist_name": artist_name,
        "total_sales": len(sales),
        "sales": sales[:50],
        "statistics": {
            "avg_hammer_eur": round(sum(prices) / len(prices)) if prices else None,
            "min_hammer_eur": round(min(prices)) if prices else None,
            "max_hammer_eur": round(max(prices)) if prices else None,
            "avg_premium_ratio": round(sum(ratios) / len(ratios), 2) if ratios else None,
            "sell_above_estimate_pct": round(len([r for r in ratios if r > 1]) / len(ratios) * 100, 1) if ratios else None,
            "trend_pct": trend_pct,
            "trend_direction": "up" if trend_pct > 5 else "down" if trend_pct < -5 else "stable",
        },
        "price_by_year": price_by_year,
    }

    set_cached(cache_key, response)
    return response


@router.get("/{artist_name}")
async def get_artist_intelligence(
    artist_name: str,
    db: AsyncSession = Depends(get_db),
):
    """Full artist intelligence — all market data Nautilus has on this artist."""
    from app.utils.cache import get_cached, set_cached
    from collections import Counter
    from datetime import datetime, timedelta

    cache_key = f"artist_intel:{artist_name.lower()}"
    cached = get_cached(cache_key, ttl=3600)
    if cached:
        return cached

    name_clean = artist_name.strip()

    # All lots by this artist
    lots_result = await db.execute(
        select(Lot)
        .where(Lot.artist_name_raw.ilike(f"%{name_clean}%"))
        .order_by(Lot.deal_score.desc().nullslast())
        .limit(50)
    )
    lots = lots_result.scalars().all()

    if not lots:
        # Fall back to ArtistProfile lookup
        profile_result = await db.execute(
            select(ArtistProfile)
            .where(ArtistProfile.name.ilike(f"%{name_clean}%"))
            .limit(1)
        )
        profile = profile_result.scalar_one_or_none()
        if profile:
            data = _serialize_artist(profile)
            data["total_lots"] = 0
            data["statistics"] = {}
            data["top_lots"] = []
            data["all_lots"] = []
            data["top_auction_houses"] = []
            data["categories"] = []
            data["ai_brief"] = ""
            data["artist_name"] = profile.name
            return data
        raise HTTPException(404, f"No data found for artist: {artist_name}")

    # Statistics
    scores = [l.deal_score for l in lots if l.deal_score]
    prices = [l.current_price or l.estimate_low for l in lots if (l.current_price or l.estimate_low)]
    hammer_prices = [l.hammer_price for l in lots if l.hammer_price]

    avg_price = sum(prices) / len(prices) if prices else 0
    min_price = min(prices) if prices else 0
    max_price = max(prices) if prices else 0
    sell_through = len(hammer_prices) / len(lots) * 100 if lots else 0

    house_counts = Counter(l.auction_house_name for l in lots if l.auction_house_name)
    cat_counts = Counter(l.category for l in lots if l.category)

    recent_cutoff = datetime.utcnow() - timedelta(days=90)
    recent_lots = [l for l in lots if l.created_at and l.created_at >= recent_cutoff]
    momentum = "rising" if len(recent_lots) > len(lots) * 0.3 else "stable" if len(recent_lots) > 0 else "low"

    top_lots = sorted([l for l in lots if l.deal_score], key=lambda x: x.deal_score, reverse=True)[:6]

    # AI brief (non-blocking — returns "" on failure)
    artist_brief = await _generate_artist_brief(name_clean, lots, avg_price)

    # Try to get nationality/movement from linked Artist record
    nationality = None
    movement = None
    for lot in lots:
        if lot.artist_id:
            from app.models.db_models import Artist
            artist_row = await db.get(Artist, lot.artist_id)
            if artist_row:
                nationality = artist_row.nationality
                movement = artist_row.movement
            break

    from app.api.lots import lot_to_list_dict
    response = {
        "artist_name": name_clean,
        "total_lots": len(lots),
        "nationality": nationality,
        "movement": movement,
        "statistics": {
            "avg_score": round(sum(scores) / len(scores), 1) if scores else 0,
            "max_score": round(max(scores), 1) if scores else 0,
            "avg_price": round(avg_price),
            "min_price": round(min_price),
            "max_price": round(max_price),
            "sell_through_rate": round(sell_through, 1),
            "momentum": momentum,
            "recent_lots_90d": len(recent_lots),
        },
        "top_auction_houses": [
            {"name": house, "count": count}
            for house, count in house_counts.most_common(5)
        ],
        "categories": [
            {"name": cat, "count": count}
            for cat, count in cat_counts.most_common(5)
        ],
        "top_lots": [lot_to_list_dict(l) for l in top_lots],
        "all_lots": [lot_to_list_dict(l) for l in lots[:20]],
        "ai_brief": artist_brief,
    }

    set_cached(cache_key, response)
    return response


async def _generate_artist_brief(artist_name: str, lots: list, avg_price: float) -> str:
    """Generate AI brief about artist market position."""
    try:
        from openai import AsyncOpenAI
        from app.utils.openai_guard import can_make_request, record_request
        from app.config import get_settings
        settings = get_settings()

        if not settings.openai_api_key or not can_make_request():
            return ""

        client = AsyncOpenAI(api_key=settings.openai_api_key)
        scores = [l.deal_score for l in lots if l.deal_score]
        avg_score = sum(scores) / len(scores) if scores else 0
        houses = list({l.auction_house_name for l in lots[:5] if l.auction_house_name})

        prompt = f"""You are a senior art market analyst.
In 3 concise sentences, analyse the market position of {artist_name}:
- {len(lots)} lots tracked on Nautilus
- Avg conviction score: {avg_score:.0f}/100
- Avg price: €{avg_price:,.0f}
- Houses: {', '.join(houses) if houses else 'various'}

Be precise and factual. Mention investment potential."""

        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=200,
            temperature=0.3,
        )
        record_request()
        return response.choices[0].message.content.strip()
    except Exception:
        return ""


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
    signals = []
    if a.is_pre_auction:
        signals.append({"type": "opportunity", "icon": "◆", "label": "Pre-auction opportunity",
                        "detail": "In serious galleries but not yet at auction — optimal entry window", "color": "gold"})
    if a.momentum_score and a.momentum_score >= 70:
        signals.append({"type": "momentum", "icon": "↑", "label": f"Strong momentum ({a.momentum_score:.0f}/100)",
                        "detail": f"{a.shows_last_12m} shows in last 12 months", "color": "electric"})
    elif a.momentum_score and a.momentum_score >= 50:
        signals.append({"type": "momentum", "icon": "→", "label": f"Growing momentum ({a.momentum_score:.0f}/100)",
                        "detail": f"{a.shows_last_12m} shows in last 12 months", "color": "text"})
    if a.institutional_score and a.institutional_score >= 60:
        signals.append({"type": "institutional", "icon": "◎", "label": "Institutional validation",
                        "detail": f"Present in {a.public_collections_count} public collections", "color": "navy"})
    if a.gallery_tier_avg and a.gallery_tier_avg <= 1.5:
        signals.append({"type": "gallery", "icon": "★", "label": "Top-tier representation",
                        "detail": f"Represented by {a.top_gallery_name or 'Tier 1 gallery'}", "color": "gold"})
    if a.liquidity_score and a.liquidity_score >= 70:
        signals.append({"type": "liquidity", "icon": "◇", "label": "High liquidity",
                        "detail": f"Active in {a.gallery_count} galleries across multiple markets", "color": "electric"})
    return signals
