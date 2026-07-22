"""
Market Signals V1 — thin router.

Additive-only. Does NOT modify any existing router or endpoint.

Endpoint:
    GET /api/v1/market-signals/{artist_name_normalized}

Auth:   JWT required. Gated to investment_memo-tier plans (Investor / Pro /
        Institutional) via the existing _get_user_plan + PLAN_LIMITS mechanism.
        Returns HTTP 403 for Free and Explorer (Starter) plans.

204:    Artist is in excluded_entities, or no signal qualifies.
200:    {"signals": [...]} with at least one signal.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.db_models import User
from app.api.auth_utils import get_current_user
from app.api.billing import _get_user_plan, PLAN_LIMITS
from app.services.market_signals_service import is_excluded, compute_signals

log = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/market-signals", tags=["market-signals"])


@router.get("/{artist_name_normalized}")
async def get_market_signals(
    artist_name_normalized: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return market signals for an artist.

    Responses:
      403 — plan does not include investment_memo access.
      204 — artist is excluded or no signal qualifies (frontend hides section).
      200 — {"signals": [{"type", "headline", "detail", "meaning", "basis"}, ...]}
    """
    plan = await _get_user_plan(current_user, db)
    if not PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])["investment_memo"]:
        raise HTTPException(
            status_code=403,
            detail="Market Signals require an Investor plan or above.",
        )

    try:
        if await is_excluded(artist_name_normalized, db):
            return Response(status_code=204)

        signals = await compute_signals(artist_name_normalized, db)

        if not signals:
            return Response(status_code=204)

        return {"signals": signals}

    except Exception as exc:
        log.error(
            "market_signals error artist=%s: %s",
            artist_name_normalized,
            exc,
        )
        return Response(status_code=204)
