"""
copilot_context.py
──────────────────
Central context assembly for the Copilot advisor.

assemble_user_context() is the single function called before every
Copilot interaction. In Phase 2 its output is logged alongside each
chip click. In Phase 3 it becomes the system-prompt context injected
before every LLM call. In Phase 4 it drives proactive suggestions.

Never call asyncio.gather here — asyncpg uses a single connection
per AsyncSession and will deadlock under concurrent queries.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db_models import (
    CollectorDNA,
    CopilotMemory,
    Lot,
    PortfolioItem,
    UserPreference,
)

logger = logging.getLogger(__name__)


async def assemble_user_context(
    user_id: UUID,
    db: AsyncSession,
    lot_id: Optional[UUID] = None,
    artist_id: Optional[UUID] = None,
) -> dict:
    """
    Returns a structured dict containing all context layers for the user.

    Layers:
      1. preferences  — static profile (budget, categories, periods)
      2. dna          — behavioral fingerprint (collector_type, top artists, risk)
      3. portfolio    — collection summary (count, estimated value)
      4. memories     — episodic memories written by the Copilot over time
      5. current_lot  — lot detail if interaction is on a specific lot
    """
    ctx: dict = {
        "user_id":      str(user_id),
        "assembled_at": datetime.utcnow().isoformat(),
        "preferences":  {},
        "dna":          {},
        "portfolio":    {"count": 0, "estimated_value_eur": 0.0},
        "memories":     [],
        "current_lot":  None,
    }

    # ── 1. User preferences ───────────────────────────────────────────────────
    try:
        prefs_res = await db.execute(
            select(UserPreference).where(UserPreference.user_id == user_id)
        )
        prefs = prefs_res.scalar_one_or_none()
        if prefs:
            ctx["preferences"] = {
                "budget_min":         prefs.min_lot_budget_eur,
                "budget_max":         prefs.max_lot_budget_eur or prefs.budget_max,
                "categories":         prefs.categories or [],
                "favorite_artists":   prefs.favorite_artists or [],
                "preferred_periods":  prefs.preferred_periods or [],
                "preferred_regions":  prefs.preferred_regions or [],
                "goals":              prefs.goals,
                "expected_return_pct": prefs.expected_return_pct,
            }
    except Exception:
        logger.exception("copilot_context: failed to load preferences for %s", user_id)

    # ── 2. Collector DNA ──────────────────────────────────────────────────────
    try:
        dna_res = await db.execute(
            select(CollectorDNA).where(CollectorDNA.user_id == user_id)
        )
        dna = dna_res.scalar_one_or_none()
        if dna:
            ctx["dna"] = {
                "collector_type":        dna.collector_type,
                "investment_horizon":    dna.investment_horizon,
                "risk_profile":          dna.risk_profile,
                "top_artists":           (dna.top_artists or [])[:5],
                "top_categories":        (dna.top_categories or [])[:5],
                "top_periods":           (dna.top_periods or [])[:3],
                "inferred_budget_min":   dna.inferred_budget_min,
                "inferred_budget_max":   dna.inferred_budget_max,
                "total_lots_viewed":     dna.total_lots_viewed or 0,
                "total_saves":           dna.total_saves or 0,
                "annual_art_budget_eur": dna.annual_art_budget_eur,
            }
    except Exception:
        logger.exception("copilot_context: failed to load DNA for %s", user_id)

    # ── 3. Portfolio summary ──────────────────────────────────────────────────
    try:
        portfolio_res = await db.execute(
            select(
                func.count(PortfolioItem.id),
                func.sum(PortfolioItem.estimated_current_value_eur),
            ).where(PortfolioItem.user_id == user_id)
        )
        count, value = portfolio_res.one()
        ctx["portfolio"] = {
            "count":                count or 0,
            "estimated_value_eur":  float(value) if value else 0.0,
        }
    except Exception:
        logger.exception("copilot_context: failed to load portfolio for %s", user_id)

    # ── 4. Episodic memories ──────────────────────────────────────────────────
    try:
        mem_res = await db.execute(
            select(CopilotMemory)
            .where(CopilotMemory.user_id == user_id)
            .order_by(CopilotMemory.last_reinforced.desc())
            .limit(20)
        )
        ctx["memories"] = [
            {
                "key":        m.memory_key,
                "value":      m.memory_value,
                "confidence": m.confidence,
                "source":     m.source,
            }
            for m in mem_res.scalars().all()
        ]
    except Exception:
        logger.exception("copilot_context: failed to load memories for %s", user_id)

    # ── 5. Current lot context ────────────────────────────────────────────────
    if lot_id:
        try:
            lot_res = await db.execute(
                select(Lot).where(Lot.id == lot_id)
            )
            lot = lot_res.scalar_one_or_none()
            if lot:
                ctx["current_lot"] = {
                    "id":                   str(lot.id),
                    "title":                lot.title,
                    "artist_name_raw":      lot.artist_name_raw,
                    "deal_score":           lot.deal_score,
                    "pct_below_low_estimate": lot.pct_below_low_estimate,
                    "current_price":        lot.current_price,
                    "estimate_low":         lot.estimate_low,
                    "estimate_high":        lot.estimate_high,
                    "auction_date":         lot.auction_date.isoformat() if lot.auction_date else None,
                    "auction_house_name":   lot.auction_house_name,
                }
        except Exception:
            logger.exception("copilot_context: failed to load lot %s", lot_id)

    return ctx
