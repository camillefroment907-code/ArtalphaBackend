"""
Post-Auction Fill Job
Matches past lots against the hammer_prices table and populates:
  - lots.hammer_price
  - score_performance.actual_hammer_price / actual_upside / prediction_correct
"""
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
import structlog

from app.models.db_models import Lot, HammerPrice, ScorePerformance

logger = structlog.get_logger()


async def fill_post_auction_results(db: AsyncSession) -> dict:
    """
    Find past lots that have a ScorePerformance row but no hammer_price yet.
    Match against HammerPrice table — by lot_id first, then by
    (artist name similarity + sale_date within 7 days).

    Returns {"total": int, "matched": int, "unmatched": int}
    """
    now = datetime.utcnow()

    # Lots: past auction date, no hammer_price, with a score_performance row
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
    )
    rows = (await db.execute(stmt)).all()
    total = len(rows)

    if total == 0:
        logger.info("post_auction_fill: no eligible lots found")
        return {"total": 0, "matched": 0, "unmatched": 0}

    logger.info("post_auction_fill: eligible lots", count=total)

    matched = 0
    unmatched = 0

    for lot, sp in rows:
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

    # ── Pass 2: artist name + date window ───────────────────────────────────
    if not lot.artist_name_raw or not lot.auction_date:
        return None

    # Use the first word of the artist name — most distinctive token
    keyword = lot.artist_name_raw.strip().split()[0]
    if len(keyword) < 3:
        # Too short to be useful (e.g. "De", "Le") — use full name
        keyword = lot.artist_name_raw.strip()

    window_start = lot.auction_date - timedelta(days=7)
    window_end   = lot.auction_date + timedelta(days=7)

    hp2 = (await db.execute(
        select(HammerPrice).where(
            and_(
                HammerPrice.artist_name.ilike(f"%{keyword}%"),
                HammerPrice.sale_date >= window_start,
                HammerPrice.sale_date <= window_end,
                HammerPrice.hammer_price_eur.isnot(None),
            )
        )
        .order_by(HammerPrice.sale_date)
        .limit(1)
    )).scalar_one_or_none()

    return hp2.hammer_price_eur if hp2 else None
