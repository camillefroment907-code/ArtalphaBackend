"""
Nautilus — Artist Cycle Intelligence API (Step 4).

Additive-only router. Does NOT modify any existing router or endpoint.

Endpoints:
    GET  /api/v1/cycle/artist/{artist_id}
         Artist cycle summary (eligibility + best configuration).

    GET  /api/v1/cycle/artist/{artist_id}/detail
         Full segment breakdown (medium_stats, house_stats, etc.)

    POST /api/v1/cycle/fit
         Compute cycle fit for a lot configuration.

    GET  /api/v1/cycle/artist/{artist_id}/fit
         GET alternative for cycle fit (query params).

All endpoints:
  - Require JWT authentication (existing get_current_user dependency).
  - Return null fields gracefully — never 500 on missing data.
  - Are wrapped in try/except → HTTP 200 with null payload on unexpected errors.
"""
from __future__ import annotations

import logging
from typing import Optional, Any
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text

from app.database import get_db
from app.models.db_models import ArtistCycleStats, Artist, User
from app.models.schemas import (
    ArtistCycleSummary,
    ArtistCycleDetail,
    CycleFitResult,
    CycleFitRequest,
)
from app.api.auth_utils import get_current_user
from app.engines.cycle_intelligence import (
    compute_cycle_fit,
    generate_cycle_reasons,
    month_to_season,
)
from app.utils.normalize import (
    normalize_auction_house,
    normalize_medium_category,
    parse_dimensions_cm,
    size_bucket,
)

log = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/cycle", tags=["cycle-intelligence"])


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_cycle_stats(
    artist_id: str,
    db: AsyncSession,
) -> Optional[ArtistCycleStats]:
    """Fetch ArtistCycleStats by artist_id. Returns None if not found."""
    try:
        result = await db.execute(
            select(ArtistCycleStats).where(
                ArtistCycleStats.artist_id == artist_id
            )
        )
        return result.scalar_one_or_none()
    except Exception as exc:
        log.warning("cycle_stats fetch failed artist=%s: %s", artist_id, exc)
        return None


def _orm_to_dict(row: ArtistCycleStats) -> dict:
    """Convert ORM row to a plain dict for the cycle intelligence engine."""
    return {
        "artist_id":          str(row.artist_id),
        "computed_at":        row.computed_at,
        "is_eligible":        row.is_eligible,
        "total_sales":        row.total_sales,
        "recent_sales_3y":    row.recent_sales_3y,
        "estimate_coverage":  row.estimate_coverage,
        "best_medium":        row.best_medium,
        "best_medium_wilson": row.best_medium_wilson,
        "best_size":          row.best_size,
        "best_size_wilson":   row.best_size_wilson,
        "best_house":         row.best_house,
        "best_house_wilson":  row.best_house_wilson,
        "best_month":         row.best_month,
        "best_month_wilson":  row.best_month_wilson,
        "best_season":        row.best_season,
        "best_season_wilson": row.best_season_wilson,
        "medium_stats":       row.medium_stats or {},
        "size_stats":         row.size_stats or {},
        "house_stats":        row.house_stats or {},
        "month_stats":        row.month_stats or {},
        "season_stats":       row.season_stats or {},
    }


def _null_fit_result(reason: str = "Insufficient historical data.") -> dict:
    return {
        "score": None,
        "components": {},
        "confidence": 0.0,
        "reasons": [reason],
        "data_quality": "insufficient",
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/artist/{artist_id}", response_model=ArtistCycleSummary)
async def get_artist_cycle_summary(
    artist_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get artist cycle summary: eligibility status and best auction configuration.

    Returns the artist's best-performing medium, auction house, season, size, and
    month based on historical sold-above-estimate rates (Wilson score lower bound).

    Returns null fields if no cycle data is available. Never 500.
    """
    try:
        row = await _get_cycle_stats(artist_id, db)
        if row is None:
            # Return a null-filled summary rather than 404
            return ArtistCycleSummary(
                artist_id=artist_id,  # type: ignore[arg-type]
                computed_at=None,
                is_eligible=False,
            )
        return ArtistCycleSummary.model_validate(row)
    except Exception as exc:
        log.error("get_artist_cycle_summary error artist=%s: %s", artist_id, exc)
        return ArtistCycleSummary(
            artist_id=artist_id,  # type: ignore[arg-type]
            computed_at=None,
            is_eligible=False,
        )


@router.get("/artist/{artist_id}/detail", response_model=ArtistCycleDetail)
async def get_artist_cycle_detail(
    artist_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get full artist cycle detail including per-segment stats.

    Returns all JSONB columns: medium_stats, size_stats, house_stats,
    month_stats, season_stats. Useful for building segment comparison charts.

    Returns null fields if no cycle data is available. Never 500.
    """
    try:
        row = await _get_cycle_stats(artist_id, db)
        if row is None:
            return ArtistCycleDetail(
                artist_id=artist_id,  # type: ignore[arg-type]
                computed_at=None,
                is_eligible=False,
            )
        return ArtistCycleDetail.model_validate(row)
    except Exception as exc:
        log.error("get_artist_cycle_detail error artist=%s: %s", artist_id, exc)
        return ArtistCycleDetail(
            artist_id=artist_id,  # type: ignore[arg-type]
            computed_at=None,
            is_eligible=False,
        )


@router.post("/fit", response_model=CycleFitResult)
async def compute_cycle_fit_post(
    body: CycleFitRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Compute cycle fit score for a specific lot configuration.

    Scores how well a lot's medium, auction house, sale season, and size
    align with this artist's historically best-performing configuration.

    Score range: 0–100. Returns null if artist has insufficient data.
    Includes bilingual human-readable explanations (lang='en' or 'fr').
    """
    try:
        return await _compute_fit(
            artist_id=str(body.artist_id),
            medium=body.medium,
            auction_house=body.auction_house,
            sale_date=body.sale_date,
            dimensions_cm=body.dimensions_cm,
            lang=body.lang or "en",
            db=db,
        )
    except Exception as exc:
        log.error("compute_cycle_fit_post error: %s", exc)
        return CycleFitResult(**_null_fit_result())


@router.get("/artist/{artist_id}/fit", response_model=CycleFitResult)
async def compute_cycle_fit_get(
    artist_id: str,
    medium: Optional[str] = Query(None, description="Lot medium category"),
    auction_house: Optional[str] = Query(None, description="Auction house (raw or normalized)"),
    sale_date: Optional[str] = Query(None, description="ISO date e.g. 2026-03-15"),
    width_cm: Optional[float] = Query(None, description="Artwork width in cm"),
    height_cm: Optional[float] = Query(None, description="Artwork height in cm"),
    lang: str = Query("en", description="Language for reasons: 'en' or 'fr'"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    GET alternative for cycle fit (query params version).

    Same logic as POST /fit but accessible via GET for simpler clients.
    """
    try:
        dims = None
        if width_cm is not None or height_cm is not None:
            dims = {"width_cm": width_cm, "height_cm": height_cm}

        return await _compute_fit(
            artist_id=artist_id,
            medium=medium,
            auction_house=auction_house,
            sale_date=sale_date,
            dimensions_cm=dims,
            lang=lang,
            db=db,
        )
    except Exception as exc:
        log.error("compute_cycle_fit_get error artist=%s: %s", artist_id, exc)
        return CycleFitResult(**_null_fit_result())


async def _compute_fit(
    artist_id: str,
    medium: Optional[str],
    auction_house: Optional[str],
    sale_date: Optional[str],
    dimensions_cm: Optional[dict],
    lang: str,
    db: AsyncSession,
) -> CycleFitResult:
    """Shared logic for both GET and POST cycle fit endpoints."""
    row = await _get_cycle_stats(artist_id, db)
    if row is None:
        return CycleFitResult(**_null_fit_result(
            "No cycle data found for this artist. Run compute_artist_cycle_stats to generate it."
        ))

    stats_dict = _orm_to_dict(row)

    # Normalize inputs
    norm_medium = normalize_medium_category(medium) if medium else None
    norm_house = normalize_auction_house(auction_house) if auction_house else None

    # Parse dimensions if provided
    dim_result = None
    lot_size_bucket = None
    if dimensions_cm:
        w = dimensions_cm.get("width_cm")
        h = dimensions_cm.get("height_cm")
        if w is not None or h is not None:
            dim_result = {"width_cm": w, "height_cm": h}
            sz = size_bucket(w, h)
            lot_size_bucket = sz if sz != "unknown" else None

    # Determine season from sale_date
    lot_season = None
    if sale_date:
        try:
            dt = datetime.fromisoformat(sale_date[:10])
            lot_season = month_to_season(dt.month)
        except (ValueError, TypeError):
            lot_season = None

    # Compute fit
    fit = compute_cycle_fit(
        artist_stats=stats_dict,
        medium=norm_medium,
        auction_house=norm_house,
        sale_date=sale_date,
        dimensions_cm=dim_result,
    )

    # Generate explanations
    reasons = generate_cycle_reasons(
        artist_stats=stats_dict,
        lot_medium=norm_medium,
        lot_house=norm_house,
        lot_season=lot_season,
        lot_size_bucket=lot_size_bucket,
        is_fr=(lang == "fr"),
    )
    fit["reasons"] = reasons

    return CycleFitResult(**fit)
