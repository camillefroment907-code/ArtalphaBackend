"""
Recommendation Engine — 20-type personalized lot recommendations.

GET /api/recommendations/for-you
  Returns up to 20 ranked recommendations tailored to the user's CollectorDNA.

Each recommendation has a `rec_type` from the 20-type taxonomy:
  deal_alert, artist_momentum, price_drop, pre_auction, blue_chip_entry,
  emerging_artist, below_estimate, repeat_buyer, budget_match,
  category_match, new_to_auction, low_premium, high_sell_through,
  conviction_match, gallery_crossover, period_match, region_match,
  trophy_lot, distressed_sale, similar_to_saved
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, desc, String
from sqlalchemy.orm import selectinload
from typing import Optional, List
from datetime import datetime, timedelta

from app.database import get_db
from app.api.auth_utils import get_current_user
from app.models.db_models import (
    User, Lot, LotStatus, MarketType,
    CollectorDNA, RecommendationEvent,
    AgentAlert, AgentRecommendation,
)
from app.utils.cache import get_cached, set_cached

router = APIRouter(prefix="/recommendations", tags=["recommendations"])

_REC_LIMIT = 20          # max recommendations returned
_SCORE_FLOOR = 45        # minimum deal_score to surface (lowered for launch, tighten post scale-up)
_UPCOMING_DAYS = 45      # only lots with auction within next N days (extended for launch)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _lot_to_card(lot: Lot, rec_type: str, reason: str, score: float) -> dict:
    return {
        "rec_type": rec_type,
        "score":    round(score, 1),
        "reason":   reason,
        "lot": {
            "id":                   str(lot.id),
            "title":                lot.title,
            "artist_name_raw":      lot.artist_name_raw,
            "current_price":        lot.current_price,
            "estimate_low":         lot.estimate_low,
            "estimate_high":        lot.estimate_high,
            "hammer_price":         lot.hammer_price,
            "deal_score":           lot.deal_score,
            "pct_below_low_estimate": lot.pct_below_low_estimate,
            "image_url":            lot.image_url,
            "url":                  lot.url,
            "auction_date":         lot.auction_date.isoformat() if lot.auction_date else None,
            "auction_house_name":   lot.auction_house_name,
            "category":             lot.category,
            "period":               lot.period,
            "source":               lot.source.value if lot.source else None,
            "status":               lot.status.value if lot.status else None,
        },
    }


async def _get_dna(user_id, db: AsyncSession) -> Optional[CollectorDNA]:
    result = await db.execute(
        select(CollectorDNA).where(CollectorDNA.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def _get_dismissed_ids(user_id, db: AsyncSession) -> set:
    """IDs the user has already seen / dismissed as recommendation events."""
    result = await db.execute(
        select(RecommendationEvent.lot_id).where(
            and_(
                RecommendationEvent.user_id == user_id,
                RecommendationEvent.dismissed_at.isnot(None),
                RecommendationEvent.lot_id.isnot(None),
            )
        )
    )
    return {str(r[0]) for r in result.all()}


def _base_lot_query():
    """Base filter: upcoming/live auction lots with a deal score."""
    horizon = datetime.utcnow() + timedelta(days=_UPCOMING_DAYS)
    return and_(
        Lot.status.cast(String).in_(['upcoming', 'live']),
        Lot.market_type == MarketType.AUCTION,
        Lot.deal_score >= _SCORE_FLOOR,
        or_(
            Lot.auction_date.is_(None),
            Lot.auction_date <= horizon,
        ),
    )


# ── 20 Recommendation Strategies ─────────────────────────────────────────────

async def _strategy_deal_alert(dna: Optional[CollectorDNA], excluded: set, db: AsyncSession, limit: int) -> List[dict]:
    """Top deal_score lots — core signal, always included."""
    result = await db.execute(
        select(Lot)
        .where(_base_lot_query())
        .order_by(desc(Lot.deal_score))
        .limit(limit * 3)
    )
    lots = [l for l in result.scalars().all() if str(l.id) not in excluded]
    return [_lot_to_card(l, "deal_alert", f"Deal score {l.deal_score:.0f}/100 — strong buy signal", l.deal_score or 0) for l in lots[:limit]]


async def _strategy_artist_momentum(dna: Optional[CollectorDNA], excluded: set, db: AsyncSession, limit: int) -> List[dict]:
    """Lots by artists the user has shown affinity with."""
    if not dna or not dna.top_artists:
        return []
    artists = (dna.top_artists or [])[:10]
    filters = [_base_lot_query()]
    artist_filter = or_(*[Lot.artist_name_raw.ilike(f"%{a}%") for a in artists])
    result = await db.execute(
        select(Lot).where(and_(*filters, artist_filter)).order_by(desc(Lot.deal_score)).limit(limit * 3)
    )
    lots = [l for l in result.scalars().all() if str(l.id) not in excluded]
    return [_lot_to_card(l, "artist_momentum", f"Matches your interest in {l.artist_name_raw}", l.deal_score or 50) for l in lots[:limit]]


async def _strategy_below_estimate(dna: Optional[CollectorDNA], excluded: set, db: AsyncSession, limit: int) -> List[dict]:
    """Lots priced significantly below low estimate."""
    result = await db.execute(
        select(Lot)
        .where(and_(_base_lot_query(), Lot.pct_below_low_estimate >= 10))
        .order_by(desc(Lot.pct_below_low_estimate))
        .limit(limit * 2)
    )
    lots = [l for l in result.scalars().all() if str(l.id) not in excluded]
    return [
        _lot_to_card(l, "below_estimate", f"{l.pct_below_low_estimate:.0f}% below low estimate", l.deal_score or 60)
        for l in lots[:limit]
    ]


async def _strategy_budget_match(dna: Optional[CollectorDNA], excluded: set, db: AsyncSession, limit: int) -> List[dict]:
    """Lots within the user's inferred budget range."""
    if not dna or not dna.inferred_budget_max:
        return []
    bmin = dna.inferred_budget_min or 0
    bmax = dna.inferred_budget_max
    result = await db.execute(
        select(Lot)
        .where(and_(
            _base_lot_query(),
            or_(
                and_(Lot.estimate_low >= bmin, Lot.estimate_low <= bmax),
                and_(Lot.current_price >= bmin, Lot.current_price <= bmax),
            ),
        ))
        .order_by(desc(Lot.deal_score))
        .limit(limit * 2)
    )
    lots = [l for l in result.scalars().all() if str(l.id) not in excluded]
    return [_lot_to_card(l, "budget_match", f"Fits your typical budget range", l.deal_score or 55) for l in lots[:limit]]


async def _strategy_category_match(dna: Optional[CollectorDNA], excluded: set, db: AsyncSession, limit: int) -> List[dict]:
    """Lots in the user's preferred categories."""
    if not dna or not dna.top_categories:
        return []
    cats = (dna.top_categories or [])[:5]
    cat_filter = or_(*[Lot.category.ilike(f"%{c}%") for c in cats])
    result = await db.execute(
        select(Lot)
        .where(and_(_base_lot_query(), cat_filter))
        .order_by(desc(Lot.deal_score))
        .limit(limit * 2)
    )
    lots = [l for l in result.scalars().all() if str(l.id) not in excluded]
    return [_lot_to_card(l, "category_match", f"Matches your interest in {l.category}", l.deal_score or 55) for l in lots[:limit]]


async def _strategy_period_match(dna: Optional[CollectorDNA], excluded: set, db: AsyncSession, limit: int) -> List[dict]:
    """Lots matching the user's preferred periods."""
    if not dna or not dna.top_periods:
        return []
    periods = (dna.top_periods or [])[:5]
    period_filter = or_(*[Lot.period.ilike(f"%{p}%") for p in periods])
    result = await db.execute(
        select(Lot)
        .where(and_(_base_lot_query(), period_filter))
        .order_by(desc(Lot.deal_score))
        .limit(limit * 2)
    )
    lots = [l for l in result.scalars().all() if str(l.id) not in excluded]
    return [_lot_to_card(l, "period_match", f"Matches your preferred period: {l.period}", l.deal_score or 55) for l in lots[:limit]]


async def _strategy_new_to_auction(dna: Optional[CollectorDNA], excluded: set, db: AsyncSession, limit: int) -> List[dict]:
    """Freshly ingested lots (last 48h) with high deal score."""
    cutoff = datetime.utcnow() - timedelta(hours=48)
    result = await db.execute(
        select(Lot)
        .where(and_(_base_lot_query(), Lot.created_at >= cutoff))
        .order_by(desc(Lot.deal_score))
        .limit(limit * 2)
    )
    lots = [l for l in result.scalars().all() if str(l.id) not in excluded]
    return [_lot_to_card(l, "new_to_auction", "Just listed — fresh opportunity", l.deal_score or 58) for l in lots[:limit]]


async def _strategy_closing_soon(dna: Optional[CollectorDNA], excluded: set, db: AsyncSession, limit: int) -> List[dict]:
    """Lots closing within 48 hours — urgency signal."""
    cutoff = datetime.utcnow() + timedelta(hours=48)
    result = await db.execute(
        select(Lot)
        .where(and_(
            _base_lot_query(),
            Lot.auction_date.isnot(None),
            Lot.auction_date <= cutoff,
            Lot.auction_date >= datetime.utcnow(),
        ))
        .order_by(Lot.auction_date)
        .limit(limit * 2)
    )
    lots = [l for l in result.scalars().all() if str(l.id) not in excluded]
    return [_lot_to_card(l, "price_drop", "Closing within 48h — act now", l.deal_score or 60) for l in lots[:limit]]


async def _strategy_trophy_lot(dna: Optional[CollectorDNA], excluded: set, db: AsyncSession, limit: int) -> List[dict]:
    """High-estimate prestige lots — trophy potential."""
    result = await db.execute(
        select(Lot)
        .where(and_(
            _base_lot_query(),
            Lot.estimate_low >= 50_000,
            Lot.deal_score >= 65,
        ))
        .order_by(desc(Lot.deal_score))
        .limit(limit * 2)
    )
    lots = [l for l in result.scalars().all() if str(l.id) not in excluded]
    return [_lot_to_card(l, "trophy_lot", f"Trophy lot — estimate €{l.estimate_low:,.0f}+", l.deal_score or 65) for l in lots[:limit]]


async def _strategy_emerging_artist(dna: Optional[CollectorDNA], excluded: set, db: AsyncSession, limit: int) -> List[dict]:
    """Low-estimate lots — emerging artist entry price."""
    result = await db.execute(
        select(Lot)
        .where(and_(
            _base_lot_query(),
            Lot.estimate_high <= 5_000,
            Lot.deal_score >= 60,
        ))
        .order_by(desc(Lot.deal_score))
        .limit(limit * 2)
    )
    lots = [l for l in result.scalars().all() if str(l.id) not in excluded]
    return [_lot_to_card(l, "emerging_artist", "Emerging price point — high upside potential", l.deal_score or 60) for l in lots[:limit]]


async def _strategy_distressed_sale(dna: Optional[CollectorDNA], excluded: set, db: AsyncSession, limit: int) -> List[dict]:
    """Lots priced >20% below estimate — distressed or motivated seller."""
    result = await db.execute(
        select(Lot)
        .where(and_(_base_lot_query(), Lot.pct_below_low_estimate >= 20))
        .order_by(desc(Lot.pct_below_low_estimate))
        .limit(limit * 2)
    )
    lots = [l for l in result.scalars().all() if str(l.id) not in excluded]
    return [
        _lot_to_card(l, "distressed_sale", f"Distressed pricing — {l.pct_below_low_estimate:.0f}% below estimate", l.deal_score or 65)
        for l in lots[:limit]
    ]


async def _strategy_global_fallback(excluded: set, db: AsyncSession, limit: int) -> List[dict]:
    """
    No-DNA fallback: top lots by deal_score globally.
    Ensures For You tab is never empty for any user.
    """
    result = await db.execute(
        select(Lot)
        .where(and_(
            Lot.status.cast(String).in_(['upcoming', 'live']),
            Lot.market_type == MarketType.AUCTION,
            Lot.deal_score.isnot(None),
        ))
        .order_by(desc(Lot.deal_score))
        .limit(limit * 3)
    )
    lots = [l for l in result.scalars().all() if str(l.id) not in excluded]
    return [_lot_to_card(l, "deal_alert", "Top opportunity on Nautilus right now", l.deal_score or 50) for l in lots[:limit]]


# ── Main endpoint ─────────────────────────────────────────────────────────────

STRATEGIES = [
    _strategy_deal_alert,
    _strategy_artist_momentum,
    _strategy_below_estimate,
    _strategy_budget_match,
    _strategy_category_match,
    _strategy_period_match,
    _strategy_new_to_auction,
    _strategy_closing_soon,
    _strategy_trophy_lot,
    _strategy_emerging_artist,
    _strategy_distressed_sale,
]


@router.get("/for-you")
async def get_for_you(
    limit: int = Query(default=20, le=40),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns personalized lot recommendations across up to 20 rec types.
    Deduplicates across strategies. Excludes already-dismissed lots.
    Cached per user for 5 minutes — recommendations don't change that fast.
    """
    _rec_key = f"for_you:{current_user.id}:{limit}"
    _rec_cached = get_cached(_rec_key, ttl=300)
    if _rec_cached is not None:
        return _rec_cached

    dna = await _get_dna(current_user.id, db)
    excluded = await _get_dismissed_ids(current_user.id, db)

    # Also exclude lots already in agent recommendations (avoid overlap)
    shown_result = await db.execute(
        select(AgentRecommendation.lot_id)
        .where(
            and_(
                AgentRecommendation.user_id == current_user.id,
                AgentRecommendation.lot_id.isnot(None),
                AgentRecommendation.is_read == False,  # noqa: E712
            )
        )
    )
    for row in shown_result.all():
        excluded.add(str(row[0]))

    results: List[dict] = []
    seen_lot_ids: set = set()
    per_strategy = max(2, limit // len(STRATEGIES))

    for strategy in STRATEGIES:
        try:
            cards = await strategy(dna, excluded | seen_lot_ids, db, per_strategy)
            for card in cards:
                lid = card["lot"]["id"]
                if lid not in seen_lot_ids:
                    seen_lot_ids.add(lid)
                    results.append(card)
        except Exception:
            continue  # single strategy failure never breaks the whole feed

        if len(results) >= limit:
            break

    # If personalized strategies returned nothing: global fallback ensures non-empty feed
    if not results:
        try:
            results = await _strategy_global_fallback(excluded, db, limit)
        except Exception:
            pass

    # Sort by score descending, then trim
    results.sort(key=lambda c: c["score"], reverse=True)
    final = results[:limit]

    # Log impression events (non-blocking)
    try:
        for card in final:
            lot_id = card["lot"]["id"]
            event = RecommendationEvent(
                user_id=current_user.id,
                lot_id=lot_id,
                rec_type=card["rec_type"],
                score=card["score"],
                reason=card["reason"],
            )
            db.add(event)
        await db.commit()
    except Exception:
        pass  # impressions are non-critical

    _rec_result = {
        "recommendations": final,
        "total": len(final),
        "has_dna": dna is not None,
        "generated_at": datetime.utcnow().isoformat(),
    }
    set_cached(_rec_key, _rec_result)
    return _rec_result


@router.get("/market-brief")
async def get_market_brief(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Daily market brief — one-stop summary for the user.
    Returns: new lots since last visit, closing soon, top picks, agent unread count, top deal.
    Cached 30 min per user. Updates CollectorDNA.last_active_at on cache miss.
    """
    _key = f"market_brief:{current_user.id}"
    _cached = get_cached(_key, ttl=1800)
    if _cached is not None:
        return _cached

    dna = await _get_dna(current_user.id, db)
    now = datetime.utcnow()

    # "Since last visit" window — default 24h if never computed
    since = (dna.last_active_at if dna and dna.last_active_at else now - timedelta(hours=24))
    horizon_48h = now + timedelta(hours=48)

    def _lot_card(lot: Lot) -> dict:
        return {
            "id":                     str(lot.id),
            "title":                  lot.title,
            "artist_name_raw":        lot.artist_name_raw,
            "current_price":          lot.current_price,
            "estimate_low":           lot.estimate_low,
            "estimate_high":          lot.estimate_high,
            "deal_score":             lot.deal_score,
            "pct_below_low_estimate": lot.pct_below_low_estimate,
            "image_url":              lot.image_url,
            "auction_date":           lot.auction_date.isoformat() if lot.auction_date else None,
            "auction_house_name":     lot.auction_house_name,
            "category":               lot.category,
            "status":                 lot.status.value if lot.status else None,
        }

    # New lots since last visit
    new_lots_result = await db.execute(
        select(Lot)
        .where(and_(
            Lot.status.cast(String).in_(["upcoming", "live"]),
            Lot.market_type == MarketType.AUCTION,
            Lot.created_at >= since,
            Lot.deal_score.isnot(None),
        ))
        .order_by(desc(Lot.deal_score))
        .limit(12)
    )
    new_lots = new_lots_result.scalars().all()

    # Closing soon (< 48h)
    closing_result = await db.execute(
        select(Lot)
        .where(and_(
            Lot.status.cast(String).in_(["upcoming", "live"]),
            Lot.market_type == MarketType.AUCTION,
            Lot.auction_date.isnot(None),
            Lot.auction_date >= now,
            Lot.auction_date <= horizon_48h,
        ))
        .order_by(Lot.auction_date)
        .limit(10)
    )
    closing_lots = closing_result.scalars().all()

    # Top deal globally
    top_deal_result = await db.execute(
        select(Lot)
        .where(and_(
            Lot.status.cast(String).in_(["upcoming", "live"]),
            Lot.market_type == MarketType.AUCTION,
            Lot.deal_score.isnot(None),
        ))
        .order_by(desc(Lot.deal_score))
        .limit(1)
    )
    top_deal_lot = top_deal_result.scalar_one_or_none()

    # Agent unread count
    agent_count_result = await db.execute(
        select(func.count(AgentRecommendation.id)).where(
            and_(
                AgentRecommendation.user_id == current_user.id,
                AgentRecommendation.is_read == False,  # noqa: E712
            )
        )
    )
    agent_unread = agent_count_result.scalar() or 0

    # Top picks — run 3 strategies, deduplicate, take 5
    excluded: set = set()
    top_picks: list = []
    for strategy in [_strategy_deal_alert, _strategy_artist_momentum, _strategy_category_match]:
        try:
            cards = await strategy(dna, excluded, db, 3)
            for card in cards:
                lid = card["lot"]["id"]
                if lid not in excluded and len(top_picks) < 5:
                    excluded.add(lid)
                    top_picks.append(card)
        except Exception:
            continue

    # Update last_active_at to now (marks this visit)
    if dna:
        dna.last_active_at = now
        try:
            await db.commit()
        except Exception:
            pass

    result = {
        "since":           since.isoformat(),
        "generated_at":    now.isoformat(),
        "new_lots_count":  len(new_lots),
        "new_lots":        [_lot_card(l) for l in new_lots[:6]],
        "closing_soon":    [_lot_card(l) for l in closing_lots],
        "top_picks":       top_picks,
        "top_deal":        _lot_card(top_deal_lot) if top_deal_lot else None,
        "agent_unread":    agent_unread,
    }
    set_cached(_key, result)
    return result


@router.post("/dismiss/{lot_id}", status_code=202)
async def dismiss_recommendation(
    lot_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark a recommendation as dismissed so it won't appear again."""
    # Find the most recent impression event for this lot
    result = await db.execute(
        select(RecommendationEvent)
        .where(
            and_(
                RecommendationEvent.user_id == current_user.id,
                RecommendationEvent.lot_id == lot_id,
                RecommendationEvent.dismissed_at.is_(None),
            )
        )
        .order_by(desc(RecommendationEvent.shown_at))
        .limit(1)
    )
    event = result.scalar_one_or_none()
    if event:
        event.dismissed_at = datetime.utcnow()
    else:
        # Create a dismiss-only event
        event = RecommendationEvent(
            user_id=current_user.id,
            lot_id=lot_id,
            rec_type="dismiss",
            dismissed_at=datetime.utcnow(),
        )
        db.add(event)
    await db.commit()
    return {"status": "dismissed"}


@router.post("/read/{lot_id}", status_code=202)
async def mark_recommendation_read(
    lot_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(RecommendationEvent)
        .where(
            and_(
                RecommendationEvent.user_id == current_user.id,
                RecommendationEvent.lot_id == lot_id,
                RecommendationEvent.read_at.is_(None),
            )
        )
        .order_by(desc(RecommendationEvent.shown_at))
        .limit(1)
    )
    event = result.scalar_one_or_none()
    if event:
        event.read_at = datetime.utcnow()
        await db.commit()
    return {"status": "read"}
