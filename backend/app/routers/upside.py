"""
Nautilus — Upside Prediction Engine API (Step 3).

Additive-only router. Does NOT modify any existing router or endpoint.

Endpoints:
    GET  /api/v1/upside/lot/{lot_id}
         Latest prediction for this lot (or null if none available).
         Auth: JWT required.

    GET  /api/v1/upside/lot/{lot_id}/signal
         Human-readable signal label + explanation in requested language.
         Query: ?lang=fr|en
         Auth: JWT required.

    GET  /api/v1/upside/model/active
         Active model metadata (version, metrics, feature_list).
         Auth: JWT required.

All endpoints:
  - Require JWT authentication.
  - Return null fields gracefully — never 500 on missing data.
  - Are wrapped in try/except.
  - Do NOT influence existing deal scores, rankings, or recommendations.
"""
from __future__ import annotations

import logging
from typing import Optional, Any
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text

from app.database import get_db
from app.models.db_models import (
    LotUpsidePrediction,
    UpsideModelVersion,
    User,
)
from app.models.schemas import (
    UpsidePredictionOut,
    UpsideModelVersionOut,
    UpsideSignalOut,
)
from app.api.auth_utils import get_current_user
from app.engines.upside_predictor import (
    upside_signal_label,
    upside_signal_explanation,
)

log = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/upside", tags=["upside-predictions"])


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_active_model(db: AsyncSession) -> Optional[UpsideModelVersion]:
    """Fetch the active model version. Returns None if not found."""
    try:
        result = await db.execute(
            select(UpsideModelVersion)
            .where(UpsideModelVersion.is_active.is_(True))
            .order_by(UpsideModelVersion.created_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()
    except Exception as exc:
        log.warning("_get_active_model failed: %s", exc)
        return None


async def _get_latest_prediction(
    lot_id: str,
    db: AsyncSession,
) -> Optional[LotUpsidePrediction]:
    """Fetch the latest prediction for a lot (from the active model). Returns None if not found."""
    try:
        result = await db.execute(
            select(LotUpsidePrediction)
            .join(
                UpsideModelVersion,
                LotUpsidePrediction.model_version_id == UpsideModelVersion.id,
            )
            .where(
                LotUpsidePrediction.lot_id == lot_id,
                UpsideModelVersion.is_active.is_(True),
            )
            .order_by(LotUpsidePrediction.predicted_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()
    except Exception as exc:
        log.warning("_get_latest_prediction failed lot_id=%s: %s", lot_id, exc)
        return None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/lot/{lot_id}", response_model=Optional[UpsidePredictionOut])
async def get_lot_prediction(
    lot_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get the latest upside prediction for a lot.

    Returns the prediction from the active model, or null if:
      - No active model exists
      - No prediction has been generated for this lot
      - Any error occurs

    Never returns 500. Predictions do NOT influence deal scores or rankings.
    """
    try:
        pred = await _get_latest_prediction(lot_id, db)
        if pred is None:
            return None
        return UpsidePredictionOut.model_validate(pred)
    except Exception as exc:
        log.error("get_lot_prediction error lot_id=%s: %s", lot_id, exc)
        return None


@router.get("/lot/{lot_id}/signal", response_model=UpsideSignalOut)
async def get_lot_signal(
    lot_id: str,
    lang: str = Query("en", description="Language: 'en' or 'fr'"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get a human-readable upside signal for a lot.

    Returns:
        signal_label:  "High upside signal" / "Moderate..." / "Limited..."
        explanation:   1–2 sentence explanation
        upside_prob:   Raw probability (0–1)

    Language supported: en (default), fr.
    Returns null fields if no prediction available. Never 500.
    """
    try:
        pred = await _get_latest_prediction(lot_id, db)
        if pred is None:
            return UpsideSignalOut(
                lot_id=lot_id,
                upside_prob=None,
                signal_label=None,
                explanation=None,
                lang=lang,
                predicted_at=None,
                model_version=None,
            )

        prob = pred.upside_prob
        label = upside_signal_label(prob, lang=lang)
        explanation = upside_signal_explanation(prob, lang=lang)

        # Fetch model version string for context
        model_version_str = None
        try:
            mv_result = await db.execute(
                select(UpsideModelVersion.version)
                .where(UpsideModelVersion.id == pred.model_version_id)
            )
            model_version_str = mv_result.scalar_one_or_none()
        except Exception:
            pass

        # Extract context stats from feature_snapshot for rich tooltip
        house_sold_above_pct = None
        house_sales_count = None
        artist_sold_above_pct = None
        artist_total_sales = None
        median_premium_pct = None
        try:
            snap = pred.feature_snapshot or {}
            if snap.get("house_sold_above_pct_before") is not None:
                house_sold_above_pct = round(float(snap["house_sold_above_pct_before"]), 3)
            if snap.get("house_sales_count_before") is not None:
                house_sales_count = int(snap["house_sales_count_before"])
            if snap.get("artist_sold_above_pct_before") is not None:
                artist_sold_above_pct = round(float(snap["artist_sold_above_pct_before"]), 3)
            if snap.get("artist_total_sales_before") is not None:
                artist_total_sales = int(snap["artist_total_sales_before"])
            if snap.get("artist_median_premium_before") is not None:
                raw = float(snap["artist_median_premium_before"])
                # raw is hammer/estimate_low ratio — convert to % above estimate
                median_premium_pct = round((raw - 1.0) * 100, 1)
        except Exception:
            pass

        return UpsideSignalOut(
            lot_id=lot_id,
            upside_prob=round(prob, 4),
            signal_label=label,
            explanation=explanation,
            lang=lang,
            predicted_at=pred.predicted_at,
            model_version=model_version_str,
            house_sold_above_pct=house_sold_above_pct,
            house_sales_count=house_sales_count,
            artist_sold_above_pct=artist_sold_above_pct,
            artist_total_sales=artist_total_sales,
            median_premium_pct=median_premium_pct,
        )

    except Exception as exc:
        log.error("get_lot_signal error lot_id=%s: %s", lot_id, exc)
        return UpsideSignalOut(
            lot_id=lot_id,
            upside_prob=None,
            signal_label=None,
            explanation=None,
            lang=lang,
            predicted_at=None,
            model_version=None,
        )


@router.get("/model/active", response_model=Optional[UpsideModelVersionOut])
async def get_active_model(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get active model metadata.

    Returns version string, metrics (roc_auc, precision_at_10, etc.),
    feature list, train/val/test split sizes and cutoffs.

    Returns null if no active model exists. Never 500.
    """
    try:
        mv = await _get_active_model(db)
        if mv is None:
            return None
        return UpsideModelVersionOut.model_validate(mv)
    except Exception as exc:
        log.error("get_active_model error: %s", exc)
        return None
