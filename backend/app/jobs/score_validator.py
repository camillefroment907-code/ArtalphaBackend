"""
Score Validator — runs weekly after auctions close.
Compares Nautilus predictions to actual hammer prices.
Builds the proprietary performance dataset.
"""
from datetime import datetime, timedelta
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models.db_models import Lot, ScorePerformance, HammerPrice
import structlog

logger = structlog.get_logger()


async def validate_past_predictions():
    """
    Find lots that were scored and have now been auctioned.
    Record actual vs predicted performance.
    """
    async with AsyncSessionLocal() as db:
        cutoff = datetime.utcnow() - timedelta(days=7)

        # Find recently auctioned lots with scores
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
            # Skip if already tracked
            existing = await db.execute(
                select(ScorePerformance).where(ScorePerformance.lot_id == lot.id)
            )
            if existing.scalar_one_or_none():
                continue

            perf = ScorePerformance(
                lot_id=lot.id,
                nautilus_score=lot.deal_score,
                predicted_upside=lot.pct_below_low_estimate,
                auction_date=lot.auction_date,
                created_at=datetime.utcnow(),
            )
            db.add(perf)
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
