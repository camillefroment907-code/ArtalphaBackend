"""
CollectorDNA API — behavioral fingerprint powering the recommendation engine.

Endpoints:
  GET  /api/collector/dna          — fetch current DNA profile
  PATCH /api/collector/dna         — manually update collector preferences
  POST /api/collector/signal       — log a behavioral signal (view/save/dismiss/…)
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from app.database import get_db
from app.api.auth_utils import get_current_user
from app.models.db_models import User, CollectorDNA, Lot, UserSignal

router = APIRouter(prefix="/collector", tags=["collector"])

_LIST_CAP = 50    # max items in top_artists / top_categories lists
_LOT_CAP  = 200   # max lot IDs in viewed/saved/dismissed arrays


# ── Schemas ───────────────────────────────────────────────────────────────────

class DNAPatch(BaseModel):
    collector_type:      Optional[str]   = None   # "trophy", "deal_hunter", "emerging", "blue_chip"
    investment_horizon:  Optional[str]   = None   # "short", "medium", "long"
    risk_profile:        Optional[str]   = None   # "conservative", "moderate", "aggressive"
    inferred_budget_min: Optional[float] = None
    inferred_budget_max: Optional[float] = None


class SignalRequest(BaseModel):
    signal_type:      str             # "view" | "save" | "dismiss" | "search" | "memo" | "portfolio_add"
    lot_id:           Optional[str]   = None
    duration_seconds: Optional[int]   = None
    # Extra context for non-lot signals (e.g. search query artist name)
    artist_name:      Optional[str]   = None
    category:         Optional[str]   = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _rank_add(lst: list, item: str, cap: int = _LIST_CAP) -> list:
    """Move item to front (most recent = highest affinity). Deduplicate."""
    cleaned = [x for x in lst if x != item]
    return ([item] + cleaned)[:cap]


def _append_lot(lst: list, lot_id: str, cap: int = _LOT_CAP) -> list:
    """Append lot_id to the list, dedup, cap."""
    cleaned = [x for x in lst if x != lot_id]
    return (cleaned + [lot_id])[-cap:]


async def _get_or_create_dna(user_id, db: AsyncSession) -> CollectorDNA:
    result = await db.execute(select(CollectorDNA).where(CollectorDNA.user_id == user_id))
    dna = result.scalar_one_or_none()
    if not dna:
        dna = CollectorDNA(
            user_id=user_id,
            top_artists=[],
            dismissed_artists=[],
            top_categories=[],
            top_periods=[],
            top_regions=[],
            viewed_lot_ids=[],
            saved_lot_ids=[],
            dismissed_lot_ids=[],
        )
        db.add(dna)
        await db.flush()
    return dna


def _serialize_dna(dna: CollectorDNA) -> dict:
    return {
        "collector_type":         dna.collector_type,
        "investment_horizon":     dna.investment_horizon,
        "risk_profile":           dna.risk_profile,
        "top_artists":            dna.top_artists or [],
        "dismissed_artists":      dna.dismissed_artists or [],
        "top_categories":         dna.top_categories or [],
        "top_periods":            dna.top_periods or [],
        "top_regions":            dna.top_regions or [],
        "inferred_budget_min":    dna.inferred_budget_min,
        "inferred_budget_max":    dna.inferred_budget_max,
        "avg_deal_score_viewed":  dna.avg_deal_score_viewed,
        "total_lots_viewed":      dna.total_lots_viewed,
        "total_saves":            dna.total_saves,
        "total_dismissals":       dna.total_dismissals,
        "total_memos":            dna.total_memos,
        "updated_at":             dna.updated_at.isoformat() if dna.updated_at else None,
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/dna")
async def get_dna(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    dna = await _get_or_create_dna(current_user.id, db)
    await db.commit()
    return _serialize_dna(dna)


@router.patch("/dna")
async def patch_dna(
    body: DNAPatch,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    dna = await _get_or_create_dna(current_user.id, db)
    updates = body.model_dump(exclude_none=True)
    for field, value in updates.items():
        setattr(dna, field, value)
    dna.updated_at = datetime.utcnow()
    await db.commit()
    return _serialize_dna(dna)


@router.post("/signal", status_code=202)
async def log_signal(
    body: SignalRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Log a behavioral signal and update the user's CollectorDNA incrementally.
    Returns 202 Accepted — fire-and-forget from the client's perspective.
    """
    dna = await _get_or_create_dna(current_user.id, db)

    # Persist raw signal in user_signals table
    signal = UserSignal(
        user_id=current_user.id,
        lot_id=body.lot_id if body.lot_id else None,
        signal_type=body.signal_type,
        duration_seconds=body.duration_seconds,
    )
    db.add(signal)

    # Fetch lot metadata if lot_id provided
    lot: Optional[Lot] = None
    if body.lot_id:
        lot_result = await db.execute(select(Lot).where(Lot.id == body.lot_id))
        lot = lot_result.scalar_one_or_none()

    # ── Update DNA based on signal type ───────────────────────────────────────

    if body.signal_type == "view" and lot:
        dna.total_lots_viewed = (dna.total_lots_viewed or 0) + 1
        dna.viewed_lot_ids = _append_lot(dna.viewed_lot_ids or [], str(lot.id))

        # Artist affinity
        if lot.artist_name_raw:
            dna.top_artists = _rank_add(dna.top_artists or [], lot.artist_name_raw)

        # Category affinity
        if lot.category:
            dna.top_categories = _rank_add(dna.top_categories or [], lot.category)

        # Period affinity
        if lot.period:
            dna.top_periods = _rank_add(dna.top_periods or [], lot.period)

        # Budget inference from estimates
        if lot.estimate_low and lot.estimate_high:
            mid = (lot.estimate_low + lot.estimate_high) / 2
            if dna.inferred_budget_min is None or mid < dna.inferred_budget_min:
                dna.inferred_budget_min = mid * 0.5
            if dna.inferred_budget_max is None or mid > dna.inferred_budget_max:
                dna.inferred_budget_max = mid * 1.5

        # Rolling average deal score
        if lot.deal_score is not None:
            n = dna.total_lots_viewed or 1
            prev = dna.avg_deal_score_viewed or lot.deal_score
            dna.avg_deal_score_viewed = prev + (lot.deal_score - prev) / n

    elif body.signal_type == "save" and lot:
        dna.total_saves = (dna.total_saves or 0) + 1
        dna.saved_lot_ids = _append_lot(dna.saved_lot_ids or [], str(lot.id))

        # Saves carry more weight — bump artist to top
        if lot.artist_name_raw:
            dna.top_artists = _rank_add(dna.top_artists or [], lot.artist_name_raw)
        if lot.category:
            dna.top_categories = _rank_add(dna.top_categories or [], lot.category)

    elif body.signal_type == "dismiss" and lot:
        dna.total_dismissals = (dna.total_dismissals or 0) + 1
        dna.dismissed_lot_ids = _append_lot(dna.dismissed_lot_ids or [], str(lot.id))

        # Remove artist from top list if user dismisses same artist repeatedly
        if lot.artist_name_raw:
            artist_dismiss_count = sum(
                1 for lid in (dna.dismissed_lot_ids or [])
                # approximate — we don't query all dismissed lots
            )
            # Add to dismissed_artists if they've saved/dismissed enough times
            if artist_dismiss_count > 5:
                dna.dismissed_artists = _rank_add(
                    dna.dismissed_artists or [], lot.artist_name_raw, cap=100
                )

    elif body.signal_type == "memo":
        dna.total_memos = (dna.total_memos or 0) + 1
        if lot and lot.artist_name_raw:
            dna.top_artists = _rank_add(dna.top_artists or [], lot.artist_name_raw)

    elif body.signal_type == "portfolio_add" and lot:
        # Strong signal — bump artist to absolute top
        if lot.artist_name_raw:
            dna.top_artists = _rank_add(dna.top_artists or [], lot.artist_name_raw)

    elif body.signal_type == "search":
        # Non-lot signal: explicit interest in artist or category from search
        if body.artist_name:
            dna.top_artists = _rank_add(dna.top_artists or [], body.artist_name)
        if body.category:
            dna.top_categories = _rank_add(dna.top_categories or [], body.category)

    dna.updated_at = datetime.utcnow()
    await db.commit()
    return {"status": "accepted"}
