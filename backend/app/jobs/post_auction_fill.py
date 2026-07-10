"""
Post-Auction Fill Job
Matches past lots against the hammer_prices table and populates:
  - lots.hammer_price
  - score_performance.actual_hammer_price / actual_upside / prediction_correct
"""
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
import structlog

from app.models.db_models import Lot, HammerPrice, ScorePerformance

logger = structlog.get_logger()


async def fill_post_auction_results(db: AsyncSession, limit: int = 100) -> dict:
    """
    Find past lots that have a ScorePerformance row but no hammer_price yet.
    Match against HammerPrice table — by lot_id first, then by
    (artist name similarity + sale_date within 7 days).

    Args:
        limit: max lots to process per call (default 100, keeps request under ~5s)

    Returns {"total": int, "matched": int, "unmatched": int}
    """
    now = datetime.utcnow()

    # Count total eligible (for reporting) — fast COUNT query
    count_stmt = (
        select(func.count(Lot.id))
        .join(ScorePerformance, ScorePerformance.lot_id == Lot.id)
        .where(
            and_(
                Lot.auction_date < now,
                Lot.auction_date.isnot(None),
                Lot.hammer_price.is_(None),
                ScorePerformance.actual_hammer_price.is_(None),
            )
        )
    )
    total: int = (await db.execute(count_stmt)).scalar() or 0

    if total == 0:
        logger.info("post_auction_fill: no eligible lots found")
        return {"total": 0, "matched": 0, "unmatched": 0}

    logger.info("post_auction_fill: eligible lots", count=total, processing=min(limit, total))

    # Fetch up to `limit` rows to process this run
    stmt = (
        select(Lot, ScorePerformance)
        .join(ScorePerformance, ScorePerformance.lot_id == Lot.id)
        .where(
            and_(
                Lot.auction_date < now,
                Lot.auction_date.isnot(None),
                Lot.hammer_price.is_(None),
                ScorePerformance.actual_hammer_price.is_(None),
            )
        )
        .limit(limit)
    )
    rows = (await db.execute(stmt)).all()

    if total == 0:
        logger.info("post_auction_fill: no eligible lots found")
        return {"total": 0, "matched": 0, "unmatched": 0}

    logger.info("post_auction_fill: eligible lots", count=total)

    matched = 0
    unmatched = 0

    # Keywords signalant une reproduction (pas un original)
    _REPRODUCTION_KEYWORDS = [
        'efter', 'nach', "d'après", 'after', 'attributed to',
        'attribué', 'follower of', 'circle of', 'school of',
        'manner of', 'studio of', 'workshop of', 'tillskriven',
    ]

    for lot, sp in rows:
        # Skip reproductions — their prices are not comparable to originals
        title_lower = (lot.title or '').lower()
        artist_lower = (lot.artist_name_raw or '').lower()
        if any(kw in title_lower or kw in artist_lower for kw in _REPRODUCTION_KEYWORDS):
            unmatched += 1
            continue

        hammer_eur = await _find_hammer_price(lot, db)

        if hammer_eur is None:
            unmatched += 1
            continue

        # ── Update Lot ───────────────────────────────────────────────────────
        lot.hammer_price = hammer_eur
        lot.updated_at = now

        # ── Compute upside (vs current_price, fallback to estimate_low) ─────
        ref_price = lot.current_price or lot.estimate_low
        if ref_price and ref_price > 0:
            actual_upside = round((hammer_eur - ref_price) / ref_price * 100, 2)
        else:
            actual_upside = None

        # ── Update ScorePerformance ──────────────────────────────────────────
        sp.actual_hammer_price = hammer_eur
        sp.actual_upside = actual_upside

        if actual_upside is not None and sp.predicted_upside is not None:
            # Correct if actual upside ≥ 70% of what we predicted
            sp.prediction_correct = actual_upside >= sp.predicted_upside * 0.7
        else:
            sp.prediction_correct = None

        sp.verified_at = now

        matched += 1
        logger.debug(
            "post_auction_fill: matched",
            lot_id=str(lot.id),
            artist=lot.artist_name_raw,
            hammer_eur=hammer_eur,
            actual_upside=actual_upside,
            prediction_correct=sp.prediction_correct,
        )

    if matched > 0:
        await db.commit()
        logger.info("post_auction_fill: committed", matched=matched)

    return {"total": total, "matched": matched, "unmatched": unmatched}


async def _find_hammer_price(lot: Lot, db: AsyncSession) -> float | None:
    """
    Two-pass lookup:
      1. Exact: HammerPrice.lot_id == lot.id
      2. Fuzzy: artist name contains first word of lot.artist_name_raw
                AND sale_date within ±7 days of lot.auction_date
    Returns hammer_price_eur if found, else None.
    """
    # ── Pass 1: exact lot_id match ───────────────────────────────────────────
    hp = (await db.execute(
        select(HammerPrice).where(
            and_(
                HammerPrice.lot_id == lot.id,
                HammerPrice.hammer_price_eur.isnot(None),
            )
        )
    )).scalar_one_or_none()

    if hp:
        return hp.hammer_price_eur

    # ── Pass 2: artist name + date window (strict matching) ─────────────────
    if not lot.artist_name_raw or not lot.auction_date:
        return None

    # Use full normalized artist name for strict matching
    # Avoid first-word-only matching which causes cross-lot contamination
    from app.jobs.quality_filter import normalize_artist_name as _norm
    artist_normalized = _norm(lot.artist_name_raw)
    if not artist_normalized or len(artist_normalized) < 4:
        return None

    window_start = lot.auction_date - timedelta(days=3)
    window_end   = lot.auction_date + timedelta(days=3)

    # Match on normalized artist name + auction house + date window
    candidates = (await db.execute(
        select(HammerPrice).where(
            and_(
                HammerPrice.artist_name.ilike(f"%{artist_normalized}%"),
                HammerPrice.sale_date >= window_start,
                HammerPrice.sale_date <= window_end,
                HammerPrice.hammer_price_eur.isnot(None),
                HammerPrice.hammer_price_eur > 0,
            )
        )
        .order_by(HammerPrice.sale_date)
        .limit(5)
    )).scalars().all()

    if not candidates:
        return None

    # If multiple candidates, pick the one closest to lot.current_price or estimate_low
    ref_price = lot.current_price or lot.estimate_low
    if not ref_price or len(candidates) == 1:
        return candidates[0].hammer_price_eur

    # Pick closest to reference price (avoids tier mismatch)
    best = min(candidates, key=lambda h: abs(h.hammer_price_eur - ref_price))
    # Sanity check: reject if >20x the reference price (likely wrong match)
    if best.hammer_price_eur > ref_price * 20:
        return None

    return best.hammer_price_eur
