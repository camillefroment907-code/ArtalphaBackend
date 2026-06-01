"""
Score Validator — runs weekly after auctions close.
Compares Nautilus predictions to actual hammer prices.
Builds the proprietary performance dataset.
"""
import uuid
from datetime import datetime, timedelta
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.database import AsyncSessionLocal
from app.models.db_models import Lot, ScorePerformance, HammerPrice
import structlog

logger = structlog.get_logger()


async def upsert_score_performance(
    session: AsyncSession,
    lot_id: "uuid.UUID",
    nautilus_score: float,
    predicted_upside: "float | None",
    auction_date: "datetime | None",
) -> None:
    """
    Insert or update a ScorePerformance row for a given lot.

    Called at scoring time (ingest + rescore) so predicted_upside is populated
    before the auction, not only after. Safe to call multiple times:
    - On new lots: creates the row
    - On rescored lots: updates nautilus_score and predicted_upside
    - Never overwrites post-auction fields (actual_hammer_price, actual_upside,
      prediction_correct, verified_at)

    Skipped when auction_date is None (gallery/primary lots without a sale date).
    """
    if auction_date is None:
        return

    stmt = (
        pg_insert(ScorePerformance)
        .values(
            id=uuid.uuid4(),
            lot_id=lot_id,
            nautilus_score=nautilus_score,
            predicted_upside=predicted_upside,
            auction_date=auction_date,
            created_at=datetime.utcnow(),
        )
        .on_conflict_do_update(
            constraint="uq_score_performance_lot",
            set_={
                "nautilus_score": nautilus_score,
                "predicted_upside": predicted_upside,
                # auction_date intentionally not updated (stays as first-seen)
                # actual_hammer_price, actual_upside, prediction_correct, verified_at
                # are NEVER overwritten here — they belong to post_auction_fill.py
            },
        )
    )
    await session.execute(stmt)


async def validate_past_predictions():
    """
    Find lots that were scored and have now been auctioned.
    Fills actual_hammer_price / actual_upside / prediction_correct via
    post_auction_fill.py — this function only back-fills rows that were
    missed before upsert_score_performance was wired into ingest.
    """
    async with AsyncSessionLocal() as db:
        cutoff = datetime.utcnow() - timedelta(days=7)

        result = await db.execute(
            select(Lot).where(
                and_(
                    Lot.deal_score.isnot(None),
                    Lot.auction_date <= datetime.utcnow(),
                    Lot.auction_date >= cutoff,
                )
            )
        )
        lots = result.scalars().all()

        validated = 0
        for lot in lots:
            if not lot.auction_date:
                continue
            await upsert_score_performance(
                db,
                lot_id=lot.id,
                nautilus_score=lot.deal_score,
                predicted_upside=lot.pct_below_low_estimate,
                auction_date=lot.auction_date,
            )
            validated += 1

        await db.commit()
        logger.info("score_validation_complete", validated=validated)
        return validated


async def get_accuracy_stats() -> dict:
    """
    Returns Nautilus prediction accuracy stats.
    This becomes our marketing asset.
    """
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(ScorePerformance).where(
                ScorePerformance.prediction_correct.isnot(None)
            )
        )
        perfs = result.scalars().all()

        if not perfs:
            return {"overall_accuracy": 0, "high_conviction_accuracy": 0, "sample_size": 0, "high_conviction_sample": 0}

        correct = sum(1 for p in perfs if p.prediction_correct)
        high_conviction = [p for p in perfs if p.nautilus_score >= 75]
        hc_correct = sum(1 for p in high_conviction if p.prediction_correct)

        return {
            "overall_accuracy": round(correct / len(perfs) * 100, 1),
            "high_conviction_accuracy": round(hc_correct / len(high_conviction) * 100, 1) if high_conviction else 0,
            "sample_size": len(perfs),
            "high_conviction_sample": len(high_conviction),
        }
