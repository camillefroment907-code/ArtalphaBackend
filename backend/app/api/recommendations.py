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
import random
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, desc, String
from sqlalchemy.orm import selectinload
from typing import Optional, List
from datetime import datetime, timedelta, date

from app.database import get_db
from app.api.auth_utils import get_current_user
from app.models.db_models import (
    User, Lot, LotStatus, MarketType,
    CollectorDNA, RecommendationEvent,
    AgentAlert, AgentRecommendation,
    UserPreference,
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
    """Base filter: upcoming/live auction lots with a deal score, not yet adjudicated."""
    now = datetime.utcnow()
    horizon = now + timedelta(days=_UPCOMING_DAYS)
    return and_(
        Lot.status.cast(String).in_(['upcoming', 'live']),
        Lot.market_type == MarketType.AUCTION,
        Lot.deal_score >= _SCORE_FLOOR,
        Lot.hammer_price.is_(None),          # exclude adjudicated lots
        or_(
            Lot.auction_date.is_(None),
            and_(
                Lot.auction_date >= now,      # exclude past/expired lots
                Lot.auction_date <= horizon,
            ),
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
    now = datetime.utcnow()
    result = await db.execute(
        select(Lot)
        .where(and_(
            Lot.status.cast(String).in_(['upcoming', 'live']),
            Lot.market_type == MarketType.AUCTION,
            Lot.deal_score.isnot(None),
            Lot.hammer_price.is_(None),
            or_(
                Lot.auction_date.is_(None),
                Lot.auction_date >= now,
            ),
        ))
        .order_by(desc(Lot.deal_score))
        .limit(limit * 3)
    )
    lots = [l for l in result.scalars().all() if str(l.id) not in excluded]
    return [_lot_to_card(l, "deal_alert", "Top opportunity on Nautilus right now", l.deal_score or 50) for l in lots[:limit]]


# ── Composite scoring ─────────────────────────────────────────────────────────

def _composite_score(card: dict, now: datetime) -> float:
    """
    Boost base deal_score with urgency, live status, and price anomaly signals.
    Urgency: +15 if < 6h, +8 if < 24h, +3 if < 48h.
    Live:    +10 if status == 'live'.
    Anomaly: +12 if pct_below ≥ 25%, +6 if ≥ 15%.
    """
    score = card["score"]
    lot = card["lot"]

    auction_date_str = lot.get("auction_date")
    if auction_date_str:
        try:
            ad = datetime.fromisoformat(auction_date_str)
            h = (ad - now).total_seconds() / 3600
            if 0 < h < 6:
                score += 15
            elif 0 < h < 24:
                score += 8
            elif 0 < h < 48:
                score += 3
        except Exception:
            pass

    if lot.get("status") == "live":
        score += 10

    pct = lot.get("pct_below_low_estimate") or 0
    if pct >= 25:
        score += 12
    elif pct >= 15:
        score += 6

    return min(round(score, 1), 100)


# ── Conviction strategies (market-brief only) ────────────────────────────────

async def _strategy_preferences(
    pref,
    excluded: set,
    db: AsyncSession,
    limit: int,
) -> List[dict]:
    """
    Primary conviction source — explicitly declared profile preferences.
    Uses categories + budget set at onboarding / preferences page.
    Available from day 1 for every user who completed onboarding.
    """
    if not pref or not pref.categories:
        return []

    cats = pref.categories[:6]
    cat_filter = or_(*[Lot.category.ilike(f"%{c}%") for c in cats])
    conditions = [_base_lot_query(), cat_filter]

    # Budget filter — use tightest bound available
    budget_max = pref.max_lot_budget_eur or pref.budget_max
    budget_min = pref.min_lot_budget_eur or 0
    if budget_max:
        conditions.append(
            or_(
                and_(Lot.estimate_low >= budget_min, Lot.estimate_low <= budget_max),
                and_(Lot.estimate_high >= budget_min, Lot.estimate_high <= budget_max),
            )
        )

    # Respect user's minimum score preference (default 65)
    min_score = pref.min_deal_score if pref.min_deal_score is not None else 65
    conditions.append(Lot.deal_score >= min_score)

    result = await db.execute(
        select(Lot)
        .where(and_(*conditions))
        .order_by(desc(Lot.deal_score))
        .limit(limit * 4)
    )
    lots = [l for l in result.scalars().all() if str(l.id) not in excluded]

    def _reason(l: Lot) -> str:
        parts = []
        if l.category:
            parts.append(l.category)
        if l.pct_below_low_estimate and l.pct_below_low_estimate > 0:
            parts.append(f"{l.pct_below_low_estimate:.0f}% sous l'estimation")
        elif l.deal_score:
            parts.append(f"Score {l.deal_score:.0f}/100")
        return " · ".join(parts) if parts else "Correspond à vos préférences"

    return [
        _lot_to_card(l, "preference_match", _reason(l), l.deal_score or 65)
        for l in lots[:limit]
    ]


async def _strategy_from_agent_alerts(
    user_id,
    excluded: set,
    db: AsyncSession,
    limit: int,
) -> List[dict]:
    """
    Enrichment layer — matches user's active agent strategies.
    Most specific signal available; Investor+ only in practice.
    """
    alerts_result = await db.execute(
        select(AgentAlert).where(
            and_(AgentAlert.user_id == user_id, AgentAlert.is_active == True)  # noqa: E712
        ).limit(5)
    )
    alerts = alerts_result.scalars().all()
    if not alerts:
        return []

    parts = []
    for a in alerts:
        conds = [_base_lot_query()]
        if a.artist_name:
            conds.append(Lot.artist_name_raw.ilike(f"%{a.artist_name}%"))
        if a.category:
            conds.append(Lot.category.ilike(f"%{a.category}%"))
        if a.budget_max_eur:
            conds.append(Lot.estimate_low <= a.budget_max_eur)
        if a.min_conviction_score:
            conds.append(Lot.deal_score >= a.min_conviction_score)
        if len(conds) > 1:
            parts.append(and_(*conds))

    if not parts:
        return []

    result = await db.execute(
        select(Lot)
        .where(or_(*parts))
        .order_by(desc(Lot.deal_score))
        .limit(limit * 3)
    )
    lots = [l for l in result.scalars().all() if str(l.id) not in excluded]
    return [
        _lot_to_card(
            l, "agent_match",
            f"Correspond à votre stratégie · Score {l.deal_score:.0f}/100",
            l.deal_score or 70,
        )
        for l in lots[:limit]
    ]


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

    # Apply composite scoring boosts (urgency, live, price anomaly), then re-sort
    now_for_boost = datetime.utcnow()
    for card in results:
        card["score"] = _composite_score(card, now_for_boost)
    results.sort(key=lambda c: c["score"], reverse=True)

    # Diversification: max 2 lots per artist to avoid artist-level repetition
    artist_count: dict = {}
    diversified = []
    for card in results:
        artist = (card["lot"].get("artist_name_raw") or "").lower().strip()
        cnt = artist_count.get(artist, 0)
        if not artist or cnt < 2:
            artist_count[artist] = cnt + 1
            diversified.append(card)
    final = diversified[:limit]

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

    Cache strategy: date-based key guarantees a fresh brief every morning at midnight.
    TTL = 1h within the same day — balances freshness with DB load.

    Conviction hierarchy:
      1. preference_match  — profile categories + budget (day-1 personalization)
      2. agent_match       — active agent strategies (Investor+ enrichment)
      3. artist_momentum   — DNA top artists (behavioural, builds over time)
      4. deal_alert        — global fallback (ensures 3 convictions always returned)
    """
    # Date-based key → brief regenerates automatically every morning at midnight
    # v2 suffix busts any cached result with incorrect new_lots_count=0
    _today = date.today().isoformat()
    _key = f"market_brief_v2:{current_user.id}:{_today}"
    _cached = get_cached(_key, ttl=3600)
    if _cached is not None:
        return _cached

    # Load DNA and preferences in parallel
    dna = await _get_dna(current_user.id, db)
    pref_result = await db.execute(
        select(UserPreference).where(UserPreference.user_id == current_user.id)
    )
    pref = pref_result.scalar_one_or_none()

    now = datetime.utcnow()

    # "Since last visit" window — floor at 24h so same-day revisits still show new lots
    _floor = now - timedelta(hours=24)
    since = min(dna.last_active_at, _floor) if dna and dna.last_active_at else _floor
    horizon_48h = now + timedelta(hours=48)

    # Update last_active_at now (marks this visit regardless of cache state)
    if dna:
        dna.last_active_at = now
        try:
            await db.commit()
        except Exception:
            pass

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

    # New lots since last visit — count all, display top 6
    _new_filter = and_(
        Lot.status.cast(String).in_(["upcoming", "live"]),
        Lot.market_type == MarketType.AUCTION,
        Lot.created_at >= since,
    )
    new_count_result = await db.execute(
        select(func.count(Lot.id)).where(_new_filter)
    )
    new_lots_total = new_count_result.scalar() or 0

    new_lots_result = await db.execute(
        select(Lot)
        .where(and_(_new_filter, Lot.deal_score.isnot(None)))
        .order_by(desc(Lot.deal_score))
        .limit(9)  # fetch extra — some will be deduplicated against convictions
    )
    new_lots = new_lots_result.scalars().all()

    # Closing soon (< 48h) + currently live (started < 4h ago)
    closing_result = await db.execute(
        select(Lot)
        .where(and_(
            Lot.status.cast(String).in_(["upcoming", "live"]),
            Lot.market_type == MarketType.AUCTION,
            Lot.auction_date.isnot(None),
            or_(
                Lot.auction_date >= now,                          # upcoming
                Lot.auction_date >= now - timedelta(hours=4),     # live: started < 4h ago
            ),
            Lot.auction_date <= horizon_48h,
        ))
        .order_by(Lot.auction_date)
        .limit(20)
    )
    closing_lots = closing_result.scalars().all()

    horizon_24h = now + timedelta(hours=24)
    closing_today_result = await db.execute(
        select(func.count()).where(and_(
            Lot.status.cast(String).in_(["upcoming", "live"]),
            Lot.market_type == MarketType.AUCTION,
            Lot.auction_date.isnot(None),
            Lot.auction_date >= now,
            Lot.auction_date <= horizon_24h,
        ))
    )
    closing_today_count = closing_today_result.scalar() or 0

    # Top deal globally (used as emergency fallback on frontend if top_picks empty)
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

    # ── Conviction engine — 4-level hierarchy ──────────────────────────────────
    excluded: set = set()
    top_picks: list = []

    # Daily seed — different per user per day, drives conviction rotation
    _today_seed = int(date.today().isoformat().replace("-", "")) * 1000 + (current_user.id % 1000)

    async def _fill(cards_coro, target: int = 3):
        """Pull cards from a strategy coroutine until top_picks reaches target.
        Shuffles the candidate pool with a daily seed so convictions rotate each day."""
        try:
            cards = await cards_coro
        except Exception:
            return
        if len(cards) > target:
            rng = random.Random(_today_seed)
            rng.shuffle(cards)
        for card in cards:
            lid = card["lot"]["id"]
            if lid not in excluded and len(top_picks) < target:
                excluded.add(lid)
                top_picks.append(card)

    # Fetch a larger pool (9) per strategy so the daily shuffle has candidates to rotate through
    _pool = 9

    # Level 1 — profile preferences (categories + budget) — day-1 personalization
    await _fill(_strategy_preferences(pref, excluded, db, _pool))

    # Level 2 — active agent strategies (Investor+ enrichment, most specific signal)
    if len(top_picks) < 3:
        await _fill(_strategy_from_agent_alerts(current_user.id, excluded, db, _pool))

    # Level 3 — DNA behavioural affinity (builds over time from engagement)
    if len(top_picks) < 3:
        await _fill(_strategy_artist_momentum(dna, excluded, db, _pool))

    # Level 4 — global deal_score fallback (guarantees 3 convictions are always returned)
    if len(top_picks) < 3:
        await _fill(_strategy_deal_alert(dna, excluded, db, _pool))

    # Apply composite scoring to top_picks — most urgent/live conviction surfaces first
    now_for_boost = datetime.utcnow()
    for card in top_picks:
        card["score"] = _composite_score(card, now_for_boost)
    top_picks.sort(key=lambda c: c["score"], reverse=True)

    # Deduplicate new_lots against convictions to avoid the same lot appearing twice
    conviction_ids = {c["lot"]["id"] for c in top_picks}
    new_lots_deduped = [l for l in new_lots if str(l.id) not in conviction_ids][:6]

    result = {
        "since":                since.isoformat(),
        "generated_at":         now.isoformat(),
        "new_lots_count":       new_lots_total,
        "closing_today_count":  closing_today_count,
        "new_lots":             [_lot_card(l) for l in new_lots_deduped],
        "closing_soon":         [_lot_card(l) for l in closing_lots],
        "top_picks":            top_picks,
        "top_deal":             _lot_card(top_deal_lot) if top_deal_lot else None,
        "agent_unread":         agent_unread,
    }
    set_cached(_key, result)
    return result


@router.get("/closing-soon")
async def get_closing_soon(
    hours: int = Query(default=48, ge=1, le=168),
    limit: int = Query(default=40, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lots whose auction closes within the next `hours` hours, sorted by auction_date asc."""
    now = datetime.utcnow()
    cutoff = now + timedelta(hours=hours)

    result = await db.execute(
        select(Lot)
        .where(and_(
            Lot.auction_date.isnot(None),
            Lot.auction_date >= now,
            Lot.auction_date <= cutoff,
            Lot.hammer_price.is_(None),
        ))
        .order_by(Lot.auction_date)
        .limit(limit)
    )
    lots = result.scalars().all()

    def _card(lot: Lot) -> dict:
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

    return {"lots": [_card(l) for l in lots], "total": len(lots), "hours": hours}


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
