"""
Admin Scoring Performance Analytics
GET /api/admin/scoring-performance

Measures Nautilus score prediction accuracy against verified hammer prices.
Requires admin auth (X-Admin-Key or Bearer JWT from admin email).
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case

from app.database import get_db
from app.models.db_models import Lot, ScorePerformance
from app.api.admin import verify_admin

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/scoring-performance")
async def get_scoring_performance(
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """
    Aggregate accuracy metrics for Nautilus deal scores.

    Returns:
      total_tracked   — all score_performance rows (ever scored)
      filled          — rows with actual_hammer_price (post-auction verified)
      accuracy_rate   — % where prediction_correct = True (among filled)
      avg_predicted_upside — mean predicted upside across filled rows
      avg_actual_upside    — mean actual upside across filled rows
      by_source       — per auction-house breakdown {accuracy, count}
    """
    # ── Total rows ever created ───────────────────────────────────────────────
    total_tracked: int = (
        await db.execute(select(func.count(ScorePerformance.id)))
    ).scalar() or 0

    # ── Aggregate over verified rows ─────────────────────────────────────────
    agg = (await db.execute(
        select(
            func.count(ScorePerformance.id).label("filled"),
            func.avg(ScorePerformance.predicted_upside).label("avg_predicted"),
            func.avg(ScorePerformance.actual_upside).label("avg_actual"),
            func.avg(
                case((ScorePerformance.prediction_correct == True, 1.0), else_=0.0)
            ).label("accuracy_rate"),
        )
        .where(ScorePerformance.actual_hammer_price.isnot(None))
    )).one()

    filled          = agg.filled or 0
    avg_predicted   = round(float(agg.avg_predicted), 2) if agg.avg_predicted is not None else None
    avg_actual      = round(float(agg.avg_actual), 2)    if agg.avg_actual is not None else None
    accuracy_rate   = round(float(agg.accuracy_rate) * 100, 1) if agg.accuracy_rate is not None else None

    # ── Per-source breakdown ──────────────────────────────────────────────────
    source_rows = (await db.execute(
        select(
            Lot.source,
            func.count(ScorePerformance.id).label("count"),
            func.avg(
                case((ScorePerformance.prediction_correct == True, 1.0), else_=0.0)
            ).label("accuracy"),
        )
        .join(Lot, ScorePerformance.lot_id == Lot.id)
        .where(ScorePerformance.actual_hammer_price.isnot(None))
        .group_by(Lot.source)
        .order_by(func.count(ScorePerformance.id).desc())
    )).all()

    by_source = {
        (row.source.value if row.source else "unknown"): {
            "count":    row.count,
            "accuracy": round(float(row.accuracy) * 100, 1) if row.accuracy is not None else None,
        }
        for row in source_rows
    }

    return {
        "total_tracked":       total_tracked,
        "filled":              filled,
        "accuracy_rate":       accuracy_rate,
        "avg_predicted_upside": avg_predicted,
        "avg_actual_upside":   avg_actual,
        "by_source":           by_source,
    }
