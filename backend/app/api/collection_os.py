"""
Nautilus Collection OS — The intelligence layer for art ownership.

Four endpoints powering the Collection Operating System:
  /collection-os/match    — Collection Match Engine (lots that fit your profile)
  /collection-os/pulse    — Collection Pulse (what happened this week for your artists)
  /collection-os/health   — Collection Health Score (5-dimension portfolio health)
  /collection-os/advisor  — Collection Advisor (one actionable recommendation)

Plan gating:
  free       → limited previews (3 matches, 3 pulse events, score only, 1 action)
  investor   → full access to all 4 endpoints
  pro/inst   → full access + richer Advisor responses
"""
from __future__ import annotations

import math
from datetime import datetime, timedelta
from typing import Optional

import structlog
from fastapi import APIRouter, Depends
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth_utils import get_current_user
from app.api.billing import _get_user_plan
from app.database import get_db
from app.engines.projections import get_artist_tier
from app.models.db_models import Artist, Lot, PortfolioItem, PortfolioSnapshot, User

logger = structlog.get_logger().bind(module="collection_os")
router = APIRouter(prefix="/collection-os", tags=["collection-os"])

# ── Constants ─────────────────────────────────────────────────────────────────

_PAID_PLANS = {"investor", "pro", "institutional", "elite"}
_PRO_PLANS  = {"pro", "institutional", "elite"}

_FREE_MATCH_LIMIT    = 3
_FREE_PULSE_LIMIT    = 3
_INVESTOR_MATCH_LIMIT = 50

_MIN_DEAL_SCORE = 52      # floor for matching lots
_MIN_MATCH_SCORE = 45     # floor to appear in results


# ── Internal helpers ──────────────────────────────────────────────────────────

def _normalize(name: str) -> str:
    return name.lower().strip() if name else ""


def _days_until(dt: Optional[datetime]) -> Optional[int]:
    if dt is None:
        return None
    delta = dt - datetime.utcnow()
    return max(0, delta.days)


def _price_match_score(lot_price: float, price_min: float, price_max: float) -> float:
    """
    0–25 pts. Full score when lot_price is in [price_min, price_max].
    Decays linearly outside the range; 0 at 3× outside.
    """
    if price_min <= lot_price <= price_max:
        return 25.0
    if lot_price < price_min:
        ratio = lot_price / price_min if price_min > 0 else 0
        return max(0.0, 25.0 * (ratio - 0.33) / 0.67)
    # lot_price > price_max
    ratio = price_max / lot_price if lot_price > 0 else 0
    return max(0.0, 25.0 * (ratio - 0.33) / 0.67)


def _tier_order(tier: str) -> int:
    return {"blue_chip": 3, "established": 2, "emerging": 1, "unknown": 0}.get(tier, 0)


# ══════════════════════════════════════════════════════════════════════════════
# ENDPOINT 1 — Collection Match Engine
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/match")
async def collection_match(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns lots that match the user's collection profile.
    Scoring: tier proximity (30) + price range (25) + deal score (20)
             + artist momentum (10) + artist liquidity (10) + urgency (5)
    """
    plan = await _get_user_plan(current_user, db)
    is_paid = plan in _PAID_PLANS

    # ── 1. Load portfolio items ───────────────────────────────────────────────
    result = await db.execute(
        select(PortfolioItem).where(PortfolioItem.user_id == current_user.id)
    )
    items = result.scalars().all()

    if not items:
        return {"total_matches": 0, "lots": [], "profile": None, "is_limited": False}

    # ── 2. Build taste profile ────────────────────────────────────────────────
    artist_names  = [i.artist_name for i in items if i.artist_name]
    artist_tiers  = {get_artist_tier(n) for n in artist_names}
    prices        = [i.purchase_price_eur for i in items if i.purchase_price_eur and i.purchase_price_eur > 0]

    price_min = min(prices) * 0.35 if prices else 500
    price_max = max(prices) * 2.5  if prices else 50000
    price_sweet = (sum(prices) / len(prices)) if prices else 5000

    profile = {
        "artist_count": len(items),
        "artist_names": artist_names,
        "tiers": sorted(artist_tiers, key=_tier_order, reverse=True),
        "price_range": {"min": round(price_min), "max": round(price_max),
                        "sweet_spot": round(price_sweet)},
    }

    # ── 3. Query candidate lots ───────────────────────────────────────────────
    lot_result = await db.execute(
        select(Lot, Artist).outerjoin(Artist, Lot.artist_id == Artist.id).where(
            and_(
                Lot.hammer_price.is_(None),
                or_(
                    Lot.auction_date.is_(None),
                    Lot.auction_date >= datetime.utcnow(),
                ),
                Lot.deal_score >= _MIN_DEAL_SCORE,
                Lot.current_price.isnot(None),
                Lot.current_price > 0,
            )
        ).order_by(Lot.deal_score.desc()).limit(200)
    )
    candidates = lot_result.all()

    # ── 4. Score each candidate ───────────────────────────────────────────────
    scored: list[dict] = []

    for lot, artist in candidates:
        lot_price    = lot.current_price or 0
        lot_tier     = get_artist_tier(lot.artist_name_raw)
        deal_score   = lot.deal_score or 0
        liquidity    = artist.liquidity_score if artist else 50.0
        trend        = (artist.trend.value if hasattr(artist.trend, "value") else str(artist.trend or "stable")).lower()
        days_left    = _days_until(lot.auction_date)

        # --- Scoring dimensions ---
        # 1. Tier proximity (0–30)
        if lot_tier in artist_tiers:
            tier_pts = 30.0
        else:
            # Adjacent tier gets partial credit
            lot_tier_ord = _tier_order(lot_tier)
            closest = max(_tier_order(t) for t in artist_tiers) if artist_tiers else 0
            tier_pts = max(0.0, 30.0 - abs(lot_tier_ord - closest) * 10)

        # 2. Price range (0–25)
        price_pts = _price_match_score(lot_price, price_min, price_max)

        # 3. Deal score (0–20)
        deal_pts = (deal_score / 100) * 20

        # 4. Momentum (0–10)
        momentum_pts = 10.0 if trend == "up" else (5.0 if trend == "stable" else 0.0)

        # 5. Liquidity (0–10)
        liquidity_pts = min(10.0, (liquidity / 100) * 10)

        # 6. Urgency (0–5)
        if days_left is not None and 0 < days_left <= 7:
            urgency_pts = 5.0
        elif days_left is not None and days_left <= 14:
            urgency_pts = 2.5
        else:
            urgency_pts = 0.0

        match_score = round(tier_pts + price_pts + deal_pts + momentum_pts + liquidity_pts + urgency_pts)

        if match_score < _MIN_MATCH_SCORE:
            continue

        # --- Build explanation (max 3 reasons) ---
        reasons: list[str] = []

        if tier_pts >= 25 and artist_names:
            # Find the portfolio artist with the closest tier
            closest_artist = next(
                (n for n in artist_names if get_artist_tier(n) == lot_tier),
                artist_names[0]
            )
            reasons.append(f"Même profil que {closest_artist}")

        if price_pts >= 18:
            reasons.append(f"Dans votre gamme (€{round(price_min/1000, 0):.0f}k–€{round(price_max/1000, 0):.0f}k)")
        elif price_pts >= 8:
            reasons.append("Prix proche de votre gamme")

        if deal_pts >= 14:
            reasons.append(f"Score Nautilus {round(deal_score)}/100")
        elif deal_pts >= 10:
            reasons.append(f"Bon score Nautilus ({round(deal_score)}/100)")

        if momentum_pts == 10 and len(reasons) < 3:
            reasons.append("Artiste en hausse de marché")

        if urgency_pts == 5 and len(reasons) < 3 and days_left is not None:
            reasons.append(f"Clôture dans {days_left} jour{'s' if days_left > 1 else ''}")

        scored.append({
            "id": str(lot.id),
            "title": lot.title,
            "artist": lot.artist_name_raw or "—",
            "artist_tier": lot_tier,
            "price": lot_price,
            "deal_score": round(deal_score),
            "match_score": match_score,
            "match_reasons": reasons[:3],
            "auction_house": lot.auction_house_name,
            "auction_date": lot.auction_date.isoformat() if lot.auction_date else None,
            "days_until_close": days_left,
            "image_url": lot.image_url,
            "url": lot.url,
            "estimate_low": lot.estimate_low,
            "estimate_high": lot.estimate_high,
        })

    scored.sort(key=lambda x: -x["match_score"])
    total = len(scored)

    # ── 5. Apply plan gating ──────────────────────────────────────────────────
    limit = _INVESTOR_MATCH_LIMIT if is_paid else _FREE_MATCH_LIMIT
    visible = scored[:limit]

    return {
        "total_matches": total,
        "shown": len(visible),
        "is_limited": not is_paid and total > _FREE_MATCH_LIMIT,
        "profile": profile,
        "lots": visible,
    }


# ══════════════════════════════════════════════════════════════════════════════
# ENDPOINT 2 — Collection Pulse
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/pulse")
async def collection_pulse(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns market events from the past 30 days that are relevant to
    the user's owned artists: comparable sales, new upcoming lots,
    artist trend signals.
    """
    plan = await _get_user_plan(current_user, db)
    is_paid = plan in _PAID_PLANS

    # ── 1. Load portfolio artists ─────────────────────────────────────────────
    result = await db.execute(
        select(PortfolioItem).where(PortfolioItem.user_id == current_user.id)
    )
    items = result.scalars().all()

    if not items:
        return {"events": [], "summary": None, "is_limited": False}

    owned_artists = [_normalize(i.artist_name) for i in items if i.artist_name]
    if not owned_artists:
        return {"events": [], "summary": None, "is_limited": False}

    # Build a map: normalized_name → portfolio item (for context)
    item_by_artist: dict[str, PortfolioItem] = {}
    for i in items:
        if i.artist_name:
            item_by_artist[_normalize(i.artist_name)] = i

    now = datetime.utcnow()
    cutoff = now - timedelta(days=30)
    events: list[dict] = []

    # ── 2. Comparable sales (hammer prices in last 30 days) ───────────────────
    sold_result = await db.execute(
        select(Lot).where(
            and_(
                Lot.hammer_price.isnot(None),
                Lot.updated_at >= cutoff,
            )
        ).order_by(Lot.updated_at.desc()).limit(500)
    )
    sold_lots = sold_result.scalars().all()

    artist_sales: dict[str, list[Lot]] = {}
    for lot in sold_lots:
        norm = _normalize(lot.artist_name_raw)
        if norm in owned_artists:
            artist_sales.setdefault(norm, []).append(lot)

    for norm_name, sales in artist_sales.items():
        portfolio_item = item_by_artist.get(norm_name)
        prices = [s.hammer_price for s in sales if s.hammer_price]
        if not prices:
            continue
        median_price = sorted(prices)[len(prices) // 2]
        portfolio_value = portfolio_item.estimated_current_value_eur if portfolio_item else None

        # Determine impact on owned work
        if portfolio_value and portfolio_value > 0:
            pct_diff = (median_price - portfolio_value) / portfolio_value * 100
            if pct_diff > 15:
                impact = "positive"
                impact_text = f"Votre estimation ({_fmt_eur(portfolio_value)}) semble sous-évaluée"
            elif pct_diff < -15:
                impact = "negative"
                impact_text = f"Les ventes récentes sont en dessous de votre estimation"
            else:
                impact = "neutral"
                impact_text = f"Votre estimation est cohérente avec le marché"
        else:
            impact = "neutral"
            impact_text = f"Médiane des ventes récentes : {_fmt_eur(median_price)}"

        events.append({
            "type": "COMPARABLE_SALE",
            "priority": 1 if impact == "positive" else 2,
            "artist": sales[0].artist_name_raw or norm_name,
            "title": f"{len(sales)} vente{'s' if len(sales) > 1 else ''} comparable{'s' if len(sales) > 1 else ''}",
            "description": f"Fourchette : {_fmt_eur(min(prices))}–{_fmt_eur(max(prices))}. {impact_text}.",
            "impact": impact,
            "data": {
                "sale_count": len(sales),
                "price_min": min(prices),
                "price_max": max(prices),
                "price_median": median_price,
                "portfolio_value": portfolio_value,
            },
            "lot_id": str(sales[0].id),
        })

    # ── 3. Upcoming lots for owned artists ────────────────────────────────────
    upcoming_result = await db.execute(
        select(Lot).where(
            and_(
                Lot.hammer_price.is_(None),
                Lot.auction_date >= now,
                Lot.auction_date <= now + timedelta(days=45),
            )
        ).order_by(Lot.deal_score.desc()).limit(300)
    )
    upcoming_lots = upcoming_result.scalars().all()

    artist_upcoming: dict[str, list[Lot]] = {}
    for lot in upcoming_lots:
        norm = _normalize(lot.artist_name_raw)
        if norm in owned_artists:
            artist_upcoming.setdefault(norm, []).append(lot)

    for norm_name, lots in artist_upcoming.items():
        best = max(lots, key=lambda l: l.deal_score or 0)
        days_left = _days_until(best.auction_date)
        events.append({
            "type": "UPCOMING_LOT",
            "priority": 3,
            "artist": best.artist_name_raw or norm_name,
            "title": f"{len(lots)} lot{'s' if len(lots) > 1 else ''} à venir",
            "description": (
                f"Meilleur score : {round(best.deal_score or 0)}/100 "
                f"— {best.auction_house_name or 'maison inconnue'}"
                + (f" — dans {days_left} j." if days_left is not None else "")
            ),
            "impact": "opportunity",
            "data": {
                "lot_count": len(lots),
                "best_deal_score": round(best.deal_score or 0),
                "best_lot_id": str(best.id),
                "best_lot_price": best.current_price,
                "days_until_close": days_left,
            },
            "lot_id": str(best.id),
        })

    # ── 4. Artist trend signals ───────────────────────────────────────────────
    artist_result = await db.execute(
        select(Artist).where(
            Artist.name_normalized.in_(owned_artists)
        )
    )
    artists_db = artist_result.scalars().all()

    for artist in artists_db:
        trend_val = (
            artist.trend.value if hasattr(artist.trend, "value") else str(artist.trend or "stable")
        ).lower()
        if trend_val == "up":
            events.append({
                "type": "TREND_UP",
                "priority": 2,
                "artist": artist.name,
                "title": "Momentum positif",
                "description": (
                    f"Liquidité {round(artist.liquidity_score or 50)}/100"
                    + (f" · {round(artist.sell_through_rate * 100)}% sell-through" if artist.sell_through_rate else "")
                ),
                "impact": "positive",
                "data": {
                    "liquidity_score": artist.liquidity_score,
                    "sell_through_rate": artist.sell_through_rate,
                    "trend": "up",
                },
                "lot_id": None,
            })
        elif trend_val == "down":
            events.append({
                "type": "TREND_DOWN",
                "priority": 1,
                "artist": artist.name,
                "title": "Signal d'attention",
                "description": (
                    f"Marché en recul — liquidité {round(artist.liquidity_score or 50)}/100. "
                    f"À surveiller avant toute décision de vente."
                ),
                "impact": "negative",
                "data": {
                    "liquidity_score": artist.liquidity_score,
                    "trend": "down",
                },
                "lot_id": None,
            })

    # ── 5. Sort by priority, apply gating ────────────────────────────────────
    events.sort(key=lambda e: e["priority"])
    total_events = len(events)
    limit = 50 if is_paid else _FREE_PULSE_LIMIT
    visible = events[:limit]

    # Summary line
    comparables = sum(1 for e in events if e["type"] == "COMPARABLE_SALE")
    upcoming    = sum(1 for e in events if e["type"] == "UPCOMING_LOT")
    positives   = sum(1 for e in events if e["impact"] == "positive")

    summary = _build_pulse_summary(comparables, upcoming, positives, len(items))

    return {
        "total_events": total_events,
        "shown": len(visible),
        "is_limited": not is_paid and total_events > _FREE_PULSE_LIMIT,
        "summary": summary,
        "events": visible,
        "generated_at": now.isoformat(),
    }


# ══════════════════════════════════════════════════════════════════════════════
# ENDPOINT 3 — Collection Health Score
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/health")
async def collection_health(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    5-dimension health score (0–100):
      Diversification · Liquidity · Documentation · Momentum · Valuation
    """
    plan = await _get_user_plan(current_user, db)
    is_paid = plan in _PAID_PLANS

    result = await db.execute(
        select(PortfolioItem).where(PortfolioItem.user_id == current_user.id)
    )
    items = result.scalars().all()

    if not items:
        return {
            "score": 0, "grade": "—", "is_limited": False,
            "message": "Ajoutez des œuvres pour obtenir votre score de santé.",
            "dimensions": None, "top_action": None,
        }

    n = len(items)

    # ── Dimension 1 : Diversification (0–20) ─────────────────────────────────
    # Herfindahl index on artist names (1 = fully concentrated, 1/n = perfectly spread)
    artist_counts: dict[str, int] = {}
    for i in items:
        name = _normalize(i.artist_name) or "unknown"
        artist_counts[name] = artist_counts.get(name, 0) + 1

    hhi = sum((c / n) ** 2 for c in artist_counts.values())
    # hhi ranges: 1.0 (one artist) → 1/n (n artists)
    # map to 0–20: 0 when hhi=1, 20 when hhi<=1/max(n,5)
    hhi_ideal = 1 / max(n, 5)
    diversification = round(max(0.0, 20.0 * (1 - (hhi - hhi_ideal) / (1 - hhi_ideal + 1e-9))))

    # ── Dimension 2 : Liquidity (0–20) ───────────────────────────────────────
    artist_names_norm = [_normalize(i.artist_name) for i in items if i.artist_name]
    artists_result = await db.execute(
        select(Artist).where(Artist.name_normalized.in_(artist_names_norm))
    )
    artists_db_list = artists_result.scalars().all()
    liquidity_map = {_normalize(a.name): a.liquidity_score or 50.0 for a in artists_db_list}

    scores = [liquidity_map.get(_normalize(i.artist_name), 50.0) for i in items if i.artist_name]
    avg_liquidity = sum(scores) / len(scores) if scores else 50.0
    liquidity_dim = round((avg_liquidity / 100) * 20)

    # ── Dimension 3 : Documentation (0–20) ───────────────────────────────────
    doc_scores = []
    for i in items:
        pts = 0
        if i.medium:      pts += 5
        if i.dimensions:  pts += 5
        if i.image_url:   pts += 5
        if getattr(i, "provenance", None): pts += 5
        doc_scores.append(pts)
    documentation = round(sum(doc_scores) / (len(doc_scores) * 20) * 20) if doc_scores else 0

    # ── Dimension 4 : Momentum (0–20) ────────────────────────────────────────
    trend_map = {_normalize(a.name): (
        a.trend.value if hasattr(a.trend, "value") else str(a.trend or "stable")
    ).lower() for a in artists_db_list}

    trend_scores = []
    for i in items:
        t = trend_map.get(_normalize(i.artist_name), "stable")
        trend_scores.append(20 if t == "up" else 10 if t == "stable" else 0)
    momentum = round(sum(trend_scores) / len(trend_scores)) if trend_scores else 10

    # ── Dimension 5 : Valuation freshness (0–20) ─────────────────────────────
    now = datetime.utcnow()
    val_scores = []
    for i in items:
        if i.last_valuation_at:
            age_days = (now - i.last_valuation_at).days
            if age_days <= 30:   val_scores.append(20)
            elif age_days <= 90: val_scores.append(12)
            elif age_days <= 180:val_scores.append(6)
            else:                val_scores.append(2)
        elif i.estimated_current_value_eur:
            val_scores.append(6)  # has estimate but no date — partial credit
        else:
            val_scores.append(0)
    valuation_dim = round(sum(val_scores) / len(val_scores)) if val_scores else 0

    total = diversification + liquidity_dim + documentation + momentum + valuation_dim
    grade = "A" if total >= 80 else "B" if total >= 65 else "C" if total >= 50 else "D"

    # ── Top action ────────────────────────────────────────────────────────────
    dims = [
        ("Documentation", documentation, 20, "Complétez les données de vos œuvres (médium, dimensions, image)"),
        ("Valorisation",  valuation_dim,  20, "Mettez à jour les estimations de valeur"),
        ("Diversification", diversification, 20, "Diversifiez votre collection sur plusieurs artistes"),
        ("Liquidité",     liquidity_dim,  20, "Ajoutez des œuvres d'artistes plus liquides"),
        ("Momentum",      momentum,       20, "Attention : certains artistes sont en recul"),
    ]
    weakest = min(dims, key=lambda d: d[1] / d[2])
    top_action = {
        "dimension": weakest[0],
        "score": weakest[1],
        "max": weakest[2],
        "message": weakest[3],
        "impact": f"+{min(20 - weakest[1], 12)} pts de Health Score estimés",
    }

    dimensions = {
        "diversification": {"score": diversification, "max": 20,
                            "label": "Diversification",
                            "description": f"{len(artist_counts)} artiste{'s' if len(artist_counts) > 1 else ''}"},
        "liquidity":       {"score": liquidity_dim,   "max": 20,
                            "label": "Liquidité",
                            "description": f"Moyenne {round(avg_liquidity)}/100"},
        "documentation":   {"score": documentation,   "max": 20,
                            "label": "Documentation",
                            "description": f"{round(sum(1 for s in doc_scores if s >= 15) / n * 100)}% bien documentées"},
        "momentum":        {"score": momentum,         "max": 20,
                            "label": "Momentum",
                            "description": _momentum_description(trend_scores)},
        "valuation":       {"score": valuation_dim,    "max": 20,
                            "label": "Valorisation",
                            "description": f"{sum(1 for i in items if i.estimated_current_value_eur)}/{n} estimées"},
    }

    return {
        "score": total,
        "grade": grade,
        "is_limited": False,  # score is visible to all; breakdown gated below
        "dimensions": dimensions if is_paid else None,
        "top_action": top_action,
        "item_count": n,
        "generated_at": now.isoformat(),
    }


# ══════════════════════════════════════════════════════════════════════════════
# ENDPOINT 4 — Collection Advisor (Next Best Action)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/advisor")
async def collection_advisor(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Rule-based recommendation engine. Returns the most important action
    the user should take right now, with supporting context.

    Free: 1 action. Investor: top 3. Pro: all 5.
    """
    plan = await _get_user_plan(current_user, db)
    is_paid = plan in _PAID_PLANS
    is_pro  = plan in _PRO_PLANS

    result = await db.execute(
        select(PortfolioItem).where(PortfolioItem.user_id == current_user.id)
    )
    items = result.scalars().all()

    if not items:
        return {
            "actions": [],
            "primary": None,
            "is_limited": False,
            "message": "Ajoutez vos premières œuvres pour recevoir des recommandations.",
        }

    recommendations: list[dict] = []
    now = datetime.utcnow()

    # ── Rule 1 : Documentation incomplète ────────────────────────────────────
    undoc = [i for i in items if not i.medium or not i.dimensions]
    if undoc:
        worst = undoc[0]
        missing = []
        if not worst.medium:      missing.append("médium")
        if not worst.dimensions:  missing.append("dimensions")
        recommendations.append({
            "id": "complete_documentation",
            "priority": 1,
            "type": "DATA_QUALITY",
            "icon": "✏️",
            "title": f"Complétez les données de « {worst.title[:40]} »",
            "description": (
                f"Il manque : {', '.join(missing)}. "
                f"Des informations complètes améliorent la précision de valorisation "
                f"et votre Health Score."
            ),
            "impact": "ÉLEVÉ",
            "cta_label": "Compléter maintenant",
            "cta_url": f"/app/portfolio",
            "affected_items": len(undoc),
        })

    # ── Rule 2 : Valorisation obsolète (> 90 jours) ───────────────────────────
    stale = [
        i for i in items
        if i.last_valuation_at and (now - i.last_valuation_at).days > 90
        or (not i.last_valuation_at and i.estimated_current_value_eur)
    ]
    if stale:
        oldest = max(stale, key=lambda i: (
            (now - i.last_valuation_at).days if i.last_valuation_at else 999
        ))
        age = (now - oldest.last_valuation_at).days if oldest.last_valuation_at else None
        recommendations.append({
            "id": "refresh_valuation",
            "priority": 2,
            "type": "VALUATION",
            "icon": "📊",
            "title": f"Mettez à jour l'estimation de « {oldest.title[:40]} »",
            "description": (
                (f"Dernière estimation il y a {age} jours. " if age else "Estimation sans date. ")
                + "Le marché a pu évoluer depuis."
            ),
            "impact": "MOYEN",
            "cta_label": "Voir les comparables",
            "cta_url": f"/app/portfolio",
            "affected_items": len(stale),
        })

    # ── Rule 3 : Concentration > 55% sur un artiste ───────────────────────────
    artist_counts: dict[str, int] = {}
    for i in items:
        name = _normalize(i.artist_name) or "unknown"
        artist_counts[name] = artist_counts.get(name, 0) + 1

    if len(items) >= 3:
        max_artist = max(artist_counts, key=artist_counts.get)
        concentration = artist_counts[max_artist] / len(items)
        if concentration > 0.55:
            display_name = next(
                (i.artist_name for i in items if _normalize(i.artist_name) == max_artist),
                max_artist
            )
            recommendations.append({
                "id": "diversify_collection",
                "priority": 3,
                "type": "RISK",
                "icon": "⚖️",
                "title": f"Diversifiez — {round(concentration * 100)}% concentré sur {display_name}",
                "description": (
                    f"{artist_counts[max_artist]} de vos {len(items)} œuvres sont du même artiste. "
                    f"Une concentration excessive augmente le risque si ce marché se retourne."
                ),
                "impact": "ÉLEVÉ" if concentration > 0.7 else "MOYEN",
                "cta_label": "Découvrir d'autres artistes",
                "cta_url": "/app/explore",
                "affected_items": artist_counts[max_artist],
            })

    # ── Rule 4 : Artiste owned en baisse de trend ─────────────────────────────
    artist_names_norm = [_normalize(i.artist_name) for i in items if i.artist_name]
    if artist_names_norm:
        artists_result = await db.execute(
            select(Artist).where(Artist.name_normalized.in_(artist_names_norm))
        )
        artists_db_list = artists_result.scalars().all()
        declining = [
            a for a in artists_db_list
            if (a.trend.value if hasattr(a.trend, "value") else str(a.trend or "")).lower() == "down"
        ]
        if declining:
            a = declining[0]
            recommendations.append({
                "id": "review_declining_artist",
                "priority": 2,
                "type": "MARKET_SIGNAL",
                "icon": "⚠️",
                "title": f"Signal d'attention sur {a.name}",
                "description": (
                    f"Le marché de {a.name} est en recul. "
                    f"Liquidité actuelle : {round(a.liquidity_score or 50)}/100. "
                    f"Évaluez si maintenir ou vendre est optimal."
                ),
                "impact": "ÉLEVÉ",
                "cta_label": "Voir Exit Intelligence",
                "cta_url": "/app/portfolio",
                "affected_items": sum(
                    1 for i in items
                    if _normalize(i.artist_name) == _normalize(a.name)
                ),
            })

    # ── Rule 5 : Aucune valorisation pour certaines œuvres ───────────────────
    unvalued = [i for i in items if not i.estimated_current_value_eur]
    if unvalued:
        recommendations.append({
            "id": "add_valuation",
            "priority": 4,
            "type": "VALUATION",
            "icon": "💶",
            "title": f"{len(unvalued)} œuvre{'s' if len(unvalued) > 1 else ''} sans estimation de valeur",
            "description": (
                "Sans estimation, votre valeur totale de collection est sous-estimée. "
                "Ajoutez une valeur estimée pour chaque œuvre."
            ),
            "impact": "MOYEN",
            "cta_label": "Ajouter les estimations",
            "cta_url": "/app/portfolio",
            "affected_items": len(unvalued),
        })

    # ── Sort and gate ─────────────────────────────────────────────────────────
    recommendations.sort(key=lambda r: r["priority"])
    limit = 5 if is_pro else (3 if is_paid else 1)
    visible = recommendations[:limit]
    primary = visible[0] if visible else None

    return {
        "primary": primary,
        "actions": visible,
        "total_actions": len(recommendations),
        "is_limited": len(recommendations) > limit,
        "generated_at": now.isoformat(),
    }


# ══════════════════════════════════════════════════════════════════════════════
# ENDPOINT 5 — Collection Timeline
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/timeline")
async def collection_timeline(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns weekly portfolio snapshots for the Collection Timeline graph.

    Each point contains:
      - snapshot_date     ISO date string (weekly)
      - total_value_eur   estimated portfolio value
      - purchase_cost_eur total acquisition cost
      - item_count        number of items at that date
      - health_score      0-100 health score
      - roi_pct           (total_value - purchase_cost) / purchase_cost × 100

    Free: last 4 weeks (1 month preview).
    Investor+: full history.
    """
    plan = await _get_user_plan(current_user, db)
    is_paid = plan in _PAID_PLANS

    result = await db.execute(
        select(PortfolioSnapshot)
        .where(PortfolioSnapshot.user_id == current_user.id)
        .order_by(PortfolioSnapshot.snapshot_date.asc())
    )
    snapshots = result.scalars().all()

    if not snapshots:
        # No snapshots yet — build a synthetic single-point from live portfolio
        items_result = await db.execute(
            select(PortfolioItem).where(PortfolioItem.user_id == current_user.id)
        )
        items = items_result.scalars().all()
        if not items:
            return {"points": [], "is_limited": False, "has_data": False,
                    "message": "Ajoutez des œuvres pour activer le Collection Timeline."}

        total_value   = sum((i.estimated_current_value_eur or i.purchase_price_eur or 0) for i in items)
        purchase_cost = sum(i.purchase_price_eur or 0 for i in items)
        roi = round((total_value - purchase_cost) / purchase_cost * 100, 1) if purchase_cost else 0
        from datetime import date
        return {
            "points": [{
                "snapshot_date":    date.today().isoformat(),
                "total_value_eur":  round(total_value, 2),
                "purchase_cost_eur": round(purchase_cost, 2),
                "item_count":       len(items),
                "health_score":     None,
                "roi_pct":          roi,
            }],
            "is_limited": False,
            "has_data":   False,
            "message":    "Premier snapshot dimanche prochain. En attendant, voici la valeur actuelle.",
        }

    # Build points
    points = []
    for s in snapshots:
        cost  = s.purchase_cost_eur or 0
        value = s.total_value_eur   or 0
        roi   = round((value - cost) / cost * 100, 1) if cost else 0
        points.append({
            "snapshot_date":     s.snapshot_date.isoformat(),
            "total_value_eur":   s.total_value_eur,
            "purchase_cost_eur": s.purchase_cost_eur,
            "item_count":        s.item_count,
            "health_score":      s.health_score,
            "health_breakdown":  s.health_breakdown if is_paid else None,
            "roi_pct":           roi,
        })

    # Plan gating: free → last 4 points (~1 month)
    total_points = len(points)
    visible = points if is_paid else points[-4:]

    # Summary stats
    first = visible[0]  if visible else None
    last  = visible[-1] if visible else None
    trend_pct = None
    if first and last and first["total_value_eur"] and last["total_value_eur"]:
        trend_pct = round(
            (last["total_value_eur"] - first["total_value_eur"]) / first["total_value_eur"] * 100, 1
        )

    return {
        "points":       visible,
        "total_points": total_points,
        "is_limited":   not is_paid and total_points > 4,
        "has_data":     True,
        "summary": {
            "latest_value_eur":   last["total_value_eur"]   if last else None,
            "latest_cost_eur":    last["purchase_cost_eur"] if last else None,
            "latest_roi_pct":     last["roi_pct"]           if last else None,
            "latest_health":      last["health_score"]      if last else None,
            "trend_pct":          trend_pct,
            "period_weeks":       len(visible),
        },
    }


# ── Private helpers ───────────────────────────────────────────────────────────

def _fmt_eur(value: float) -> str:
    if value >= 1_000_000:
        return f"€{value / 1_000_000:.1f}M"
    if value >= 1_000:
        return f"€{round(value / 1_000)}k"
    return f"€{round(value)}"


def _build_pulse_summary(comparables: int, upcoming: int, positives: int, total_items: int) -> str:
    parts = []
    if comparables > 0:
        parts.append(f"{comparables} vente{'s' if comparables > 1 else ''} comparable{'s' if comparables > 1 else ''}")
    if upcoming > 0:
        parts.append(f"{upcoming} lot{'s' if upcoming > 1 else ''} à venir")
    if positives > 0:
        parts.append(f"{positives} signal{'s' if positives > 1 else ''} positif{'s' if positives > 1 else ''}")
    if not parts:
        return "Aucune activité notable cette semaine sur vos artistes."
    return "Cette semaine : " + " · ".join(parts) + "."


def _momentum_description(trend_scores: list[int]) -> str:
    if not trend_scores:
        return "Données insuffisantes"
    ups   = sum(1 for s in trend_scores if s == 20)
    downs = sum(1 for s in trend_scores if s == 0)
    if ups > downs:
        return f"{ups}/{len(trend_scores)} artiste{'s' if ups > 1 else ''} en hausse"
    if downs > ups:
        return f"{downs}/{len(trend_scores)} artiste{'s' if downs > 1 else ''} en recul"
    return "Marché stable"
