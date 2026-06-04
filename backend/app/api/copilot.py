"""
copilot.py
──────────
Phase 2: chip interaction logging + context endpoint.
Phase 3: POST /message — streaming LLM advisor with full user context.

All chip clicks are logged immediately so we accumulate training data
from day one — the same logs power Phase 3 intent classification.
"""

from __future__ import annotations

import json
import uuid
import logging
from datetime import datetime, timezone
from typing import AsyncIterator, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user
from app.config import get_settings
from app.database import AsyncSessionLocal, get_db
from app.models.db_models import CopilotConversation, Lot, User
from app.services.copilot_context import assemble_user_context
from app.utils.openai_guard import user_guard as _openai_guard
from app.utils.plan_utils import get_user_plan

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/copilot", tags=["copilot"])

_settings = get_settings()


# ── Plan limits ───────────────────────────────────────────────────────────────

COPILOT_LIMITS: dict[str, int] = {
    "free":          5,        # 5 messages/month on free
    "starter":       20,
    "investor":      99999,
    "pro":           99999,
    "institutional": 99999,
    "expert":        99999,
}


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


# ── System prompt ─────────────────────────────────────────────────────────────

NAUTILUS_SYSTEM_PROMPT = """Tu es le Conseiller Nautilus — un expert en marché de l'art et en investissement artistique qui travaille exclusivement pour les membres Nautilus.

## TON RÔLE
Tu es un conseiller personnel, pas un chatbot générique. Tu connais le profil du membre, ses préférences, son budget, son profil de risque. Chaque réponse doit être personnalisée à son contexte spécifique.

## TON EXPERTISE
- Analyse des ventes aux enchères : tendances de prix, taux d'adjudication, patterns saisonniers
- Intelligence sur les artistes : trajectoires de carrière, représentation galerie, demande institutionnelle
- Stratégie d'investissement : construction de portefeuille, timing, gestion de liquidité pour les actifs art
- Identification d'opportunités : repérer les œuvres sous-évaluées avant que le marché ne se corrige
- Maisons de vente : Christie's, Sotheby's, Bonhams, Phillips, Drouot, Artcurial, Invaluable, LiveAuctioneers

## TON STYLE
- Direct et précis — donne des recommandations spécifiques, pas des suggestions vagues
- Fondé sur les données — cite des prix, des pourcentages, des résultats de vente concrets
- Expert mais accessible — explique les dynamiques de marché complexes clairement
- Jamais générique — chaque réponse s'appuie sur le contexte spécifique de l'utilisateur
- Réponses structurées : 6-10 lignes. Si l'utilisateur veut plus de détails, il demande.

## RÈGLES ANTI-HALLUCINATION — CRITIQUES
1. Ne cite JAMAIS un lot ou une œuvre qui n'est pas dans la liste OPPORTUNITÉS ACTUELLES ci-dessous
2. Quand tu recommandes une œuvre spécifique, utilise UNIQUEMENT les lots du contexte avec leur ID exact et URL
3. Si aucun lot correspondant dans le contexte → dis-le clairement : "Je n'ai pas de lot correspondant en ce moment, mais voici ce que je rechercherais..."
4. Ne jamais inventer des noms d'artistes, titres, prix ou chiffres
5. Toujours inclure l'URL Nautilus quand tu mentionnes un lot spécifique

## QUAND TU N'AS PAS DE DONNÉES PRÉCISES
Dis-le clairement : "Je n'ai pas les derniers résultats de marché pour cet artiste, mais sur la base des patterns habituels..."
Ne jamais inventer des chiffres.

## STRUCTURE DES RÉPONSES
1. Lecture rapide de la situation (1-2 lignes)
2. 2-3 points clés avec des insights de marché concrets
3. Recommandation claire et actionnable

## LIENS NAUTILUS — À INCLURE QUAND PERTINENT
Quand tu fais référence à un lot, inclus l'URL directe Nautilus :
- Lot spécifique : https://www.get-nautilus.com/app/opportunities/{lot_id}
- Opportunités : https://www.get-nautilus.com/app/market/opportunities
- Portfolio : https://www.get-nautilus.com/app/portfolio
- Alertes : https://www.get-nautilus.com/app/alerts

Format des URLs : sur une nouvelle ligne commençant par "→"

## DOMAINE
Art et investissement uniquement. Si hors sujet → "Je me concentre exclusivement sur l'art et l'investissement."

## LANGUE
Réponds toujours en français, sauf si l'utilisateur écrit en anglais."""


# ── Context helpers ───────────────────────────────────────────────────────────

def _format_context_for_prompt(ctx: dict) -> str:
    """Converts assemble_user_context() output to a readable system prompt section."""
    lines: list[str] = []

    prefs = ctx.get("preferences", {})
    if prefs.get("budget_max"):
        lines.append(f"Budget maximum par lot : €{int(prefs['budget_max']):,}")
    if prefs.get("favorite_artists"):
        lines.append(f"Artistes favoris : {', '.join(prefs['favorite_artists'][:5])}")
    if prefs.get("categories"):
        lines.append(f"Catégories préférées : {', '.join(prefs['categories'][:5])}")
    if prefs.get("goals"):
        lines.append(f"Objectifs d'investissement : {prefs['goals']}")

    dna = ctx.get("dna", {})
    if dna.get("collector_type"):
        lines.append(f"Profil collectionneur : {dna['collector_type']}")
    if dna.get("risk_profile"):
        lines.append(f"Profil de risque : {dna['risk_profile']}")
    if dna.get("investment_horizon"):
        lines.append(f"Horizon d'investissement : {dna['investment_horizon']}")
    if dna.get("top_artists"):
        lines.append(f"Artistes les plus consultés : {', '.join(dna['top_artists'][:5])}")
    if dna.get("inferred_budget_max") and not prefs.get("budget_max"):
        lines.append(f"Budget estimé d'après le comportement : €{int(dna['inferred_budget_max']):,}")

    portfolio = ctx.get("portfolio", {})
    if portfolio.get("count", 0) > 0:
        val = portfolio.get("estimated_value_eur", 0)
        lines.append(f"Portfolio : {portfolio['count']} œuvre(s), valeur estimée €{val:,.0f}")

    memories = ctx.get("memories", [])
    if memories:
        mem_lines = [f"  - {m['key']}: {m['value']}" for m in memories[:5]]
        lines.append("Mémoires Nautilus :\n" + "\n".join(mem_lines))

    current_lot = ctx.get("current_lot")
    if current_lot:
        price = current_lot.get("current_price") or 0
        pct = current_lot.get("pct_below_low_estimate") or 0
        lines.append(
            f"\nLOT EN COURS D'ANALYSE :\n"
            f"- Artiste : {current_lot.get('artist_name_raw', '—')}\n"
            f"- Titre : {current_lot.get('title', 'Sans titre')}\n"
            f"- Prix actuel : €{price:,.0f}\n"
            f"- Décote vs estimation : -{pct:.0f}%\n"
            f"- Maison de vente : {current_lot.get('auction_house_name', '—')}\n"
            f"- URL : https://www.get-nautilus.com/app/opportunities/{current_lot['id']}"
        )

    if not lines:
        return ""
    return "\n\nCONTEXTE MEMBRE :\n" + "\n".join(lines)


async def _get_top_lots_context(db: AsyncSession) -> str:
    """Injects top 5 current deals into the system prompt for anti-hallucination grounding."""
    try:
        result = await db.execute(
            select(Lot)
            .where(Lot.deal_score >= 65)
            .order_by(Lot.deal_score.desc())
            .limit(5)
        )
        lots = result.scalars().all()
        if not lots:
            return ""
        lines = ["\n\nOPPORTUNITÉS ACTUELLES (cite UNIQUEMENT ces lots si tu recommandes une œuvre spécifique) :"]
        for lot in lots:
            price = lot.current_price or lot.estimate_low or 0
            line = f"- {lot.artist_name_raw or 'Artiste inconnu'} — {(lot.title or 'Sans titre')[:60]}"
            line += f" | Prix : €{price:,.0f}"
            if lot.pct_below_low_estimate and lot.pct_below_low_estimate > 5:
                line += f" | Décote : -{lot.pct_below_low_estimate:.0f}%"
            line += f" | Maison : {lot.auction_house_name or '—'}"
            if lot.auction_date:
                line += f" | Vente : {lot.auction_date.strftime('%d/%m/%Y')}"
            line += f" | URL : https://www.get-nautilus.com/app/opportunities/{lot.id}"
            lines.append(line)
        return "\n".join(lines)
    except Exception:
        logger.exception("copilot: failed to load top lots context")
        return ""


async def _get_copilot_monthly_usage(user_id: UUID, db: AsyncSession) -> int:
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    result = await db.execute(
        select(func.count(CopilotConversation.id)).where(
            and_(
                CopilotConversation.user_id == user_id,
                CopilotConversation.role == "user",
                CopilotConversation.intent == "chat",
                CopilotConversation.created_at >= month_start,
            )
        )
    )
    return result.scalar() or 0


# ── Streaming ─────────────────────────────────────────────────────────────────

async def _stream_copilot_response(
    messages: list[dict],
    user_id: UUID,
    session_id: UUID,
) -> AsyncIterator[str]:
    from openai import AsyncOpenAI

    if not _settings.openai_api_key:
        yield f"data: {json.dumps({'error': 'Conseiller temporairement indisponible.'})}\n\n"
        return

    if not can_make_request():
        yield f"data: {json.dumps({'error': 'Quota journalier atteint. Réessayez demain.'})}\n\n"
        return

    client = AsyncOpenAI(api_key=_settings.openai_api_key)
    full_response: list[str] = []

    try:
        stream = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            max_tokens=500,
            temperature=0.65,
            stream=True,
        )

        async for chunk in stream:
            delta = chunk.choices[0].delta.content if chunk.choices else None
            if delta:
                full_response.append(delta)
                yield f"data: {json.dumps({'delta': delta})}\n\n"

        record_request()
        full_text = "".join(full_response)
        yield f"data: {json.dumps({'done': True})}\n\n"

        # Save assistant message with a fresh session (asyncpg constraint)
        async with AsyncSessionLocal() as save_session:
            save_session.add(CopilotConversation(
                user_id     = user_id,
                session_id  = session_id,
                role        = "assistant",
                content     = full_text,
                intent      = "chat",
                source_page = "today",
            ))
            await save_session.commit()

    except Exception:
        logger.exception("copilot: stream failed for user %s", user_id)
        yield f"data: {json.dumps({'error': 'Erreur lors de la génération. Réessayez dans un instant.'})}\n\n"


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
    phase:      str = "chat"


class MessagePayload(BaseModel):
    message:    str
    session_id: Optional[str]  = None
    lot_id:     Optional[UUID] = None


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


@router.get("/usage")
async def get_usage(
    current_user: User         = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    plan = await get_user_plan(current_user, db)
    limit = COPILOT_LIMITS.get(plan, 5)
    used = await _get_copilot_monthly_usage(current_user.id, db)
    return {
        "plan":      plan,
        "used":      used,
        "limit":     limit,
        "remaining": max(0, limit - used),
        "can_chat":  used < limit,
    }


@router.post("/interaction", response_model=InteractionResponse)
async def log_chip_interaction(
    payload:      InteractionPayload,
    current_user: User           = Depends(get_current_user),
    db:           AsyncSession   = Depends(get_db),
) -> InteractionResponse:
    """
    Logs a Copilot chip interaction and returns the navigation action.
    Phase 3: chips now act as conversation starters — the action URL is still
    returned as a fallback but the frontend prefers to send as a chat message.
    """
    intent = payload.intent if payload.intent in VALID_INTENTS else "discovery"
    session_id = payload.session_id or uuid.uuid4()

    ctx = await assemble_user_context(
        current_user.id, db,
        lot_id=payload.lot_id,
        artist_id=payload.artist_id,
    )

    await _log_interaction(current_user.id, payload, session_id, ctx, db)

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
        phase="chat",
    )


@router.post("/message")
async def send_message(
    payload:      MessagePayload,
    current_user: User         = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """
    Phase 3: streaming LLM response from the Conseiller Nautilus.
    Injects full user context (preferences, DNA, portfolio, memories, current lot).
    Saves conversation to copilot_conversations for cross-session memory building.
    """
    plan = await get_user_plan(current_user, db)
    limit = COPILOT_LIMITS.get(plan, 5)

    used = await _get_copilot_monthly_usage(current_user.id, db)
    if used >= limit:
        raise HTTPException(
            429,
            f"Limite mensuelle atteinte ({limit} messages). Réinitialisée le 1er du mois.",
        )

    if not payload.message.strip():
        raise HTTPException(400, "Le message ne peut pas être vide.")

    # Resolve session_id
    try:
        session_id = UUID(payload.session_id) if payload.session_id else uuid.uuid4()
    except (ValueError, AttributeError):
        session_id = uuid.uuid4()

    # Assemble full user context (sequential — asyncpg constraint)
    ctx = await assemble_user_context(
        current_user.id, db,
        lot_id=payload.lot_id,
    )

    # Build system prompt: persona + user context + current top lots
    user_context_str = _format_context_for_prompt(ctx)
    top_lots_str = await _get_top_lots_context(db)
    system_content = NAUTILUS_SYSTEM_PROMPT + user_context_str + top_lots_str

    # Fetch session history (last 10 turns — user + assistant pairs)
    history_result = await db.execute(
        select(CopilotConversation)
        .where(
            and_(
                CopilotConversation.user_id    == current_user.id,
                CopilotConversation.session_id == session_id,
                CopilotConversation.intent     == "chat",
            )
        )
        .order_by(CopilotConversation.created_at.desc())
        .limit(10)
    )
    history = list(reversed(history_result.scalars().all()))

    messages = [{"role": "system", "content": system_content}]
    for msg in history:
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": payload.message.strip()})

    # Save user message (before streaming so it's persisted even if stream fails)
    db.add(CopilotConversation(
        user_id          = current_user.id,
        session_id       = session_id,
        role             = "user",
        content          = payload.message.strip(),
        intent           = "chat",
        source_page      = "today",
        context_snapshot = ctx,
        lot_id           = payload.lot_id,
    ))
    await db.commit()

    return StreamingResponse(
        _stream_copilot_response(messages, current_user.id, session_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
