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
from app.models.db_models import Lot, ScorePerformance, HammerPrice, LotUpsidePrediction
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

    Also captures ml_upside_prob from lot_upside_predictions if a prediction
    exists for this lot — enables post-auction ML validation automatically.

    Skipped when auction_date is None (gallery/primary lots without a sale date).
    """
    if auction_date is None:
        return

    # Self-heal: pick up ML prediction if one exists for this lot.
    ml_upside_prob: "float | None" = None
    try:
        res = await session.execute(
            select(LotUpsidePrediction.upside_prob)
            .where(LotUpsidePrediction.lot_id == lot_id)
            .order_by(LotUpsidePrediction.predicted_at.desc())
            .limit(1)
        )
        ml_upside_prob = res.scalar_one_or_none()
    except Exception:
        pass  # no prediction table yet or no row — stay null, never block scoring

    stmt = (
        pg_insert(ScorePerformance)
        .values(
            id=uuid.uuid4(),
            lot_id=lot_id,
            nautilus_score=nautilus_score,
            predicted_upside=predicted_upside,
            ml_upside_prob=ml_upside_prob,
            auction_date=auction_date,
            created_at=datetime.utcnow(),
        )
        .on_conflict_do_update(
            constraint="uq_score_performance_lot",
            set_={
                "nautilus_score": nautilus_score,
                "predicted_upside": predicted_upside,
                "ml_upside_prob": ml_upside_prob,
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

        # ML accuracy: compare ml_upside_prob threshold (>=0.6) vs actual_upside (>0)
        ml_perfs = [p for p in perfs if p.ml_upside_prob is not None and p.actual_upside is not None]
        ml_correct = sum(1 for p in ml_perfs if (p.ml_upside_prob >= 0.6) == (p.actual_upside > 0))

        return {
            "overall_accuracy": round(correct / len(perfs) * 100, 1),
            "high_conviction_accuracy": round(hc_correct / len(high_conviction) * 100, 1) if high_conviction else 0,
            "sample_size": len(perfs),
            "high_conviction_sample": len(high_conviction),
            "ml_accuracy": round(ml_correct / len(ml_perfs) * 100, 1) if ml_perfs else None,
            "ml_sample_size": len(ml_perfs),
        }
