"""
Larry — AI Art Investment Advisor
SSE streaming chat, available from Investor plan and above.
"""
import json
from typing import AsyncIterator, Optional
from datetime import datetime, timezone
import structlog
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from pydantic import BaseModel

from app.database import get_db, AsyncSessionLocal
from app.api.auth_utils import get_current_user
from app.config import get_settings
from app.models.db_models import (
    User, ChatMessage, Lot, PortfolioItem,
    UserPreference, Subscription, SubscriptionStatus,
)

router = APIRouter(prefix="/chat", tags=["chat"])
logger = structlog.get_logger(__name__)
_settings = get_settings()
_ADMIN_EMAILS = {e.strip() for e in _settings.admin_emails.split(",")}

CHAT_LIMITS: dict[str, int] = {
    "free":          0,
    "starter":       0,
    "investor":      20,
    "pro":           100,
    "institutional": 9999,
    "expert":        9999,
}

LARRY_SYSTEM_PROMPT = """Tu es Larry, conseiller privé en investissement art pour ArtAlpha.

PERSONNALITÉ :
- Tu incarnes un advisor de niveau Gagosian : discret, connecté, tranchant
- Ton ton : premium et expert, jamais froid ni prétentieux, légèrement conversationnel
- Tu donnes des avis clairs. Jamais de "ça dépend" sans raison précise
- Tu es direct : si une œuvre est surcotée, tu le dis. Si c'est une opportunité rare, tu l'affirmes
- Tu parles comme un insider : références aux maisons de vente, aux tendances marché, aux artistes qui montent

COMPÉTENCES :
- Analyse de lots aux enchères (deal score, estimation vs marché, timing)
- Stratégie d'investissement art (horizon, risque, diversification)
- Artistes émergents vs établis, liquidité, cotes historiques
- Joaillerie, art contemporain, art moderne, photographie, mobilier design
- Connaissance des maisons : Sotheby's, Christie's, Drouot, Bonhams, Invaluable

RÈGLES :
- Réponds toujours en français sauf si l'utilisateur écrit en anglais
- Sois concis : 3-5 phrases max sauf si une analyse détaillée est demandée
- Jamais de bullet points inutiles — privilégie des phrases construites
- Si tu analyses un lot spécifique, cite les chiffres (prix, deal score, décote)
- Ne promets pas de rendements garantis — utilise "potentiel de hausse", "historiquement"

À la fin de chaque recommandation d'achat/vente, ajoute une ligne de conviction :
— Larry  [FORTE | MODÉRÉE | FAIBLE]"""


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_user_plan(user: User, db: AsyncSession) -> str:
    if user.email.strip() in _ADMIN_EMAILS:
        return "institutional"
    result = await db.execute(
        select(Subscription).where(Subscription.user_id == user.id)
    )
    sub = result.scalar_one_or_none()
    if sub and sub.status.value.lower() in ("active", "trialing"):
        return sub.plan.value.lower()
    return "free"


async def _get_monthly_usage(user_id, db: AsyncSession) -> int:
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    result = await db.execute(
        select(func.count(ChatMessage.id)).where(
            and_(
                ChatMessage.user_id == user_id,
                ChatMessage.role == "user",
                ChatMessage.created_at >= month_start,
            )
        )
    )
    return result.scalar() or 0


async def _get_user_context(user: User, db: AsyncSession) -> str:
    lines = []

    # User preferences
    pref_result = await db.execute(
        select(UserPreference).where(UserPreference.user_id == user.id)
    )
    prefs = pref_result.scalar_one_or_none()
    if prefs:
        if prefs.favorite_artists:
            lines.append(f"Artistes favoris : {', '.join(prefs.favorite_artists[:5])}")
        if prefs.categories:
            lines.append(f"Catégories préférées : {', '.join(prefs.categories[:5])}")
        if prefs.budget_max:
            lines.append(f"Budget max par lot : €{prefs.budget_max:,.0f}")
        if prefs.investment_horizon:
            lines.append(f"Horizon d'investissement : {prefs.investment_horizon}")
        if prefs.collector_type:
            lines.append(f"Profil collecteur : {prefs.collector_type}")

    # Top deals currently available
    lots_result = await db.execute(
        select(Lot)
        .where(Lot.deal_score >= 65)
        .order_by(Lot.deal_score.desc())
        .limit(5)
    )
    top_lots = lots_result.scalars().all()
    if top_lots:
        lines.append("\nMeilleures opportunités actuelles :")
        for lot in top_lots:
            price = lot.current_price or lot.estimate_low or 0
            lines.append(
                f"- {lot.artist_name_raw or 'Artiste inconnu'} — {lot.title or 'Sans titre'} "
                f"(Score: {lot.deal_score:.0f}/100, Prix: €{price:,.0f})"
            )

    # Portfolio summary
    portfolio_result = await db.execute(
        select(PortfolioItem).where(PortfolioItem.user_id == user.id).limit(10)
    )
    portfolio = portfolio_result.scalars().all()
    if portfolio:
        total_value = sum(
            (p.estimated_current_value_eur or p.purchase_price_eur) for p in portfolio
        )
        lines.append(f"\nPortfolio : {len(portfolio)} œuvre(s), valeur estimée €{total_value:,.0f}")
        artists_in_portfolio = list({p.artist_name for p in portfolio if p.artist_name})[:5]
        if artists_in_portfolio:
            lines.append(f"Artistes en portefeuille : {', '.join(artists_in_portfolio)}")

    if not lines:
        return ""
    return "\n\nCONTEXTE UTILISATEUR :\n" + "\n".join(lines)


async def _get_lot_context(lot_id: str, db: AsyncSession) -> str:
    result = await db.execute(select(Lot).where(Lot.id == lot_id))
    lot = result.scalar_one_or_none()
    if not lot:
        return ""
    price = lot.current_price or lot.estimate_low or 0
    upside = lot.pct_below_low_estimate or 0
    est_low = f"€{lot.estimate_low:,.0f}" if lot.estimate_low else "inconnue"
    est_high = f"€{lot.estimate_high:,.0f}" if lot.estimate_high else "inconnue"
    sale_date = lot.auction_date.strftime('%d/%m/%Y') if lot.auction_date else "Non renseignée"
    deal_score = f"{lot.deal_score:.0f}/100" if lot.deal_score is not None else "N/A"
    return (
        f"\n\nLOT ANALYSÉ :\n"
        f"- Artiste : {lot.artist_name_raw or 'Inconnu'}\n"
        f"- Titre : {lot.title or 'Sans titre'}\n"
        f"- Catégorie : {lot.category or 'Non renseignée'}\n"
        f"- Prix actuel : €{price:,.0f}\n"
        f"- Estimation basse : {est_low}\n"
        f"- Estimation haute : {est_high}\n"
        f"- Décote vs estimation : {upside:.0f}%\n"
        f"- Deal score ArtAlpha : {deal_score}\n"
        f"- Maison : {lot.auction_house_name or 'Inconnue'}\n"
        f"- Date de vente : {sale_date}"
    )


async def _stream_larry_response(
    messages: list,
    user_id,
    db_for_save,
) -> AsyncIterator[str]:
    from openai import AsyncOpenAI

    if not _settings.openai_api_key:
        yield f"data: {json.dumps({'error': 'Service Larry temporairement indisponible.'})}\n\n"
        return

    client = AsyncOpenAI(api_key=_settings.openai_api_key)
    full_response = []

    try:
        stream = await client.chat.completions.create(
            model=_settings.openai_model or "gpt-4o",
            messages=messages,
            max_tokens=600,
            temperature=0.7,
            stream=True,
        )

        async for chunk in stream:
            delta = chunk.choices[0].delta.content if chunk.choices else None
            if delta:
                full_response.append(delta)
                yield f"data: {json.dumps({'delta': delta})}\n\n"

        full_text = "".join(full_response)
        yield f"data: {json.dumps({'done': True, 'full': full_text})}\n\n"

        # Save assistant message with a fresh session
        async with AsyncSessionLocal() as save_session:
            save_session.add(ChatMessage(
                user_id=user_id,
                role="assistant",
                content=full_text,
            ))
            await save_session.commit()

    except Exception as e:
        logger.error("larry_stream_failed", user_id=str(user_id), error=str(e))
        yield f"data: {json.dumps({'error': 'Erreur lors de la génération de la réponse.'})}\n\n"


# ── Schemas ───────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str
    lot_id: Optional[str] = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/usage")
async def get_usage(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await _get_user_plan(current_user, db)
    limit = CHAT_LIMITS.get(plan, 0)
    used = await _get_monthly_usage(current_user.id, db)
    return {
        "plan": plan,
        "used": used,
        "limit": limit,
        "can_chat": limit > 0 and used < limit,
    }


@router.get("/history")
async def get_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await _get_user_plan(current_user, db)
    if CHAT_LIMITS.get(plan, 0) == 0:
        raise HTTPException(403, "Larry est disponible à partir du plan Investor.")

    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.user_id == current_user.id)
        .order_by(ChatMessage.created_at.desc())
        .limit(50)
    )
    messages = result.scalars().all()
    return [
        {
            "id": str(m.id),
            "role": m.role,
            "content": m.content,
            "created_at": m.created_at.isoformat(),
        }
        for m in reversed(messages)
    ]


@router.post("/message")
async def send_message(
    body: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await _get_user_plan(current_user, db)
    limit = CHAT_LIMITS.get(plan, 0)

    if limit == 0:
        raise HTTPException(403, "Larry est disponible à partir du plan Investor (€29/mois).")

    used = await _get_monthly_usage(current_user.id, db)
    if used >= limit:
        raise HTTPException(
            429,
            f"Limite mensuelle atteinte ({limit} messages). Renouvellement le 1er du mois.",
        )

    if not body.message.strip():
        raise HTTPException(400, "Message vide.")

    # Build system prompt with context
    user_context = await _get_user_context(current_user, db)
    lot_context = ""
    if body.lot_id:
        lot_context = await _get_lot_context(body.lot_id, db)

    system_content = LARRY_SYSTEM_PROMPT + user_context + lot_context

    # Fetch last 10 messages for conversation history
    history_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.user_id == current_user.id)
        .order_by(ChatMessage.created_at.desc())
        .limit(10)
    )
    history = list(reversed(history_result.scalars().all()))

    messages = [{"role": "system", "content": system_content}]
    for msg in history:
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": body.message.strip()})

    # Save user message
    db.add(ChatMessage(
        user_id=current_user.id,
        role="user",
        content=body.message.strip(),
    ))
    await db.commit()

    return StreamingResponse(
        _stream_larry_response(messages, current_user.id, db),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
