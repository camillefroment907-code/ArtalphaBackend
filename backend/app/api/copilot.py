"""
copilot.py
──────────
Phase 2: chip interaction logging + context endpoint.
Phase 3: will add POST /message with LLM streaming.

All chip clicks are logged immediately so we accumulate training data
from day one — the same logs power Phase 3 intent classification.
"""

from __future__ import annotations

import uuid
import logging
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user
from app.database import get_db
from app.models.db_models import CopilotConversation, User
from app.services.copilot_context import assemble_user_context

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/copilot", tags=["copilot"])


# ── Intent taxonomy (Phase 2 chips → Phase 3 LLM classification) ─────────────

INTENT_ACTIONS: dict[str, dict] = {
    "conviction_explain":  {"type": "navigate", "url": "/app/today"},          # overridden below if lot_id
    "urgency_check":       {"type": "navigate", "url": "/app/urgent"},
    "artist_analysis":     {"type": "navigate", "url": "/app/market/artists-following"},
    "budget_guidance":     {"type": "navigate", "url": "/app/market/opportunities"},
    "agent_alerts":        {"type": "navigate", "url": "/app/alerts"},
    "portfolio_review":    {"type": "navigate", "url": "/app/portfolio"},
    "market_context":      {"type": "navigate", "url": "/app/market/opportunities"},
    "discovery":           {"type": "navigate", "url": "/app/market/opportunities"},
}

VALID_INTENTS = set(INTENT_ACTIONS.keys())


# ── Request / Response models ─────────────────────────────────────────────────

class InteractionPayload(BaseModel):
    intent:      str
    chip_label:  str
    source_page: str = "today"
    lot_id:      Optional[UUID] = None
    artist_id:   Optional[UUID] = None
    session_id:  Optional[UUID] = None


class InteractionResponse(BaseModel):
    session_id: str
    action:     dict
    phase:      str = "chips"   # "chips" | "chat" when Phase 3 is live


# ── Background logging helper ─────────────────────────────────────────────────

async def _log_interaction(
    user_id: UUID,
    payload: InteractionPayload,
    session_id: UUID,
    ctx: dict,
    db: AsyncSession,
) -> None:
    """Writes the interaction + context snapshot to copilot_conversations."""
    try:
        log = CopilotConversation(
            user_id          = user_id,
            session_id       = session_id,
            role             = "user",
            content          = payload.chip_label,
            intent           = payload.intent,
            source_page      = payload.source_page,
            context_snapshot = ctx,
            lot_id           = payload.lot_id,
            artist_id        = payload.artist_id,
        )
        db.add(log)
        await db.commit()
    except Exception:
        logger.exception("copilot: failed to log interaction for user %s", user_id)
        await db.rollback()


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/context")
async def get_context(
    lot_id:       Optional[UUID] = None,
    artist_id:    Optional[UUID] = None,
    current_user: User           = Depends(get_current_user),
    db:           AsyncSession   = Depends(get_db),
) -> dict:
    """
    Returns the assembled user context for this session.
    Used for debugging in Phase 2 and injected into the LLM in Phase 3.
    """
    return await assemble_user_context(
        current_user.id, db,
        lot_id=lot_id,
        artist_id=artist_id,
    )


@router.post("/interaction", response_model=InteractionResponse)
async def log_chip_interaction(
    payload:      InteractionPayload,
    current_user: User           = Depends(get_current_user),
    db:           AsyncSession   = Depends(get_db),
) -> InteractionResponse:
    """
    Logs a Copilot chip interaction and returns the navigation action.

    Phase 2: chips → logged immediately, returns deterministic navigation URL.
    Phase 3: will be extended to call the LLM and return a text response.

    Context is assembled and stored with every interaction so that Phase 3
    has rich training data from day one.
    """
    intent = payload.intent if payload.intent in VALID_INTENTS else "discovery"
    session_id = payload.session_id or uuid.uuid4()

    # Assemble context — always, even in Phase 2 (stored in context_snapshot)
    ctx = await assemble_user_context(
        current_user.id, db,
        lot_id=payload.lot_id,
        artist_id=payload.artist_id,
    )

    # Log the interaction
    await _log_interaction(current_user.id, payload, session_id, ctx, db)

    # Resolve navigation action
    action = dict(INTENT_ACTIONS.get(intent, {"type": "navigate", "url": "/app/today"}))

    if intent == "conviction_explain" and payload.lot_id:
        action = {"type": "navigate", "url": f"/app/opportunities/{payload.lot_id}"}

    if intent == "budget_guidance":
        budget_max = (
            ctx.get("preferences", {}).get("budget_max")
            or ctx.get("dna", {}).get("inferred_budget_max")
        )
        if budget_max:
            action = {"type": "navigate", "url": f"/app/market/opportunities?price_max={int(budget_max)}"}

    return InteractionResponse(
        session_id=str(session_id),
        action=action,
        phase="chips",
    )
