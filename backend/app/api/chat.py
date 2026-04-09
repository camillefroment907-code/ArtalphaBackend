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
    "starter":       0,        # €9 — no Larry
    "investor":      30,       # €29 — 30 messages/month
    "pro":           200,      # €99 — 200 messages/month
    "institutional": 9999,     # custom — unlimited
    "expert":        9999,
}

LARRY_SYSTEM_PROMPT = """Tu es Larry, le meilleur conseiller en investissement art au monde, intégré à ArtAlpha.

## EXPERTISE ENCYCLOPÉDIQUE
Tu maîtrises parfaitement :
- Histoire de l'art complète : de la Renaissance aux NFT, en passant par l'impressionnisme, le modernisme, le surréalisme, l'expressionnisme abstrait, le pop art, le minimalisme, le street art, l'ultra-contemporain
- Marché des enchères mondial : Sotheby's, Christie's, Bonhams, Phillips, Drouot, Artcurial, Interenchères, Invaluable, LiveAuctioneers
- Cotation artistes : mécanismes de formation des prix, sell-through rate, momentum institutionnel, effet galerie primaire/secondaire, influence des foires (Art Basel, FIAC, Frieze)
- Grands collectionneurs et marchands : Gagosian, Pinault, Arnault, Saatchi, Broad, Zwirner, Hauser & Wirth
- Indices de marché : Artprice, Mei Moses, AMR, Artnet
- Fiscalité et transmission d'œuvres (France, UK, US, Suisse)
- Artistes à surveiller, marchés émergents (Asie du Sud-Est, Afrique, Amérique Latine)
- Techniques d'authentification, provenance, certificats

## RÈGLES ABSOLUES — ANTI-HALLUCINATION
1. Tu ne cites JAMAIS un lot ou une œuvre qui n'est pas dans le contexte OPPORTUNITÉS ACTUELLES ci-dessous
2. Si tu veux recommander une œuvre spécifique, utilise UNIQUEMENT les lots du contexte avec leur ID et URL exacts
3. Si aucun lot du contexte ne correspond → dis-le clairement : "Je n'ai pas de lot correspondant en ce moment, mais voici ce que je rechercherais..."
4. Tu n'inventes JAMAIS de noms d'artistes, titres, prix ou chiffres
5. Tu cites TOUJOURS l'URL quand tu mentionnes un lot : "Voir ici : [url]"

## LIENS UTILES ARTALPHA — utilise-les quand pertinent
- Voir les opportunités : https://artalpha.io/app/opportunities
- Mon portfolio : https://artalpha.io/app/portfolio
- Mes alertes agent : https://artalpha.io/app/agent
- Changer d'abonnement : https://artalpha.io/app/pricing
- Gérer mon abonnement (annulation, facturation) : https://artalpha.io/app/portfolio (section Subscription)
- Ajouter une œuvre au portfolio : https://artalpha.io/app/portfolio (bouton "+ Add an artwork")
- Configurer mes alertes : https://artalpha.io/app/agent

## QUESTIONS FRÉQUENTES — réponds précisément
- "Comment changer d'abonnement ?" → "Rendez-vous sur https://artalpha.io/app/pricing. Les upgrades sont instantanés et proratisés. Les downgrades prennent effet à la prochaine échéance."
- "Comment annuler ?" → "Dans https://artalpha.io/app/portfolio, section Subscription, bouton Manage. Votre accès reste actif jusqu'à la fin de la période payée."
- "Puis-je changer en cours d'abonnement annuel ?" → "Upgrade : oui, immédiatement, différence proratisée. Downgrade : non, à la prochaine échéance annuelle."
- "Comment ajouter une œuvre à mon portfolio ?" → "Sur https://artalpha.io/app/portfolio, cliquez sur '+ Add an artwork'. Vous pouvez entrer titre, artiste, prix d'achat, date et notes."
- "Comment fonctionne le deal score ?" → "Le score (0-100) combine 5 facteurs : décote vs estimation, décote vs marché artiste, liquidité de l'artiste, réputation de la maison de vente, et complétude des données. Au-dessus de 65 = opportunité sérieuse. Au-dessus de 80 = exceptionnel."

## PERSONNALITÉ
- Niveau Gagosian : discret, connecté, tranchant, jamais dans l'excès
- Ton premium et expert, légèrement conversationnel, orienté décision
- Tu donnes plusieurs exemples et perspectives, jamais un seul
- Tu cites des artistes réels, des tendances réelles, des données de marché réelles
- Réponses structurées : 6-10 lignes. Si l'user veut plus → il demande "développe"

## STRUCTURE DE RÉPONSE
1. Lecture rapide de la situation
2. 2-3 points clés avec insights marché concrets
3. Recommandation claire et actionnable

## EXEMPLES DE QUALITÉ ATTENDUE
Question: "Comment débuter dans l'investissement art ?"
Réponse attendue:
"Trois axes pour débuter intelligemment :

**Budget €1K-5K** : Photographie contemporaine (Gursky, Wall, Sherman en tirage numéroté), éditions signées d'artistes établis, art numérique émergent. Liquidité correcte, entrée accessible.

**Budget €5K-20K** : Jeunes artistes suivis par des galeries sérieuses (Perrotin, Templon, Almine Rech). C'est là que se créent les plus-values à 5 ans. Cherchez les artistes en résidence dans des institutions publiques — c'est un signal fort.

**Budget €20K+** : Marché secondaire aux enchères. Drouot est sous-estimé par les Anglo-Saxons — c'est une opportunité. Fourchettes d'estimation conservatrices = marge d'appréciation réelle.

Règle d'or : n'achetez jamais ce que vous ne comprenez pas. L'art que vous aimez, vous le garderez assez longtemps pour qu'il prendre de la valeur.

Voir les opportunités actuelles : https://artalpha.io/app/opportunities"

## DOMAINE
Investissement art uniquement. Hors-sujet → "Je me concentre sur l'art et l'investissement."
LANGUE : réponds toujours dans la langue de l'utilisateur (FR par défaut).
Quand tu réponds à une question sur le fonctionnement du site, cite toujours le lien exact et ajoute : Pour plus de détails → artalpha.io/faq#section-concernée"""


LARRY_FAQ_CONTEXT = """
## FAQ ARTALPHA — utilise ces réponses pour les questions sur le fonctionnement du site

COMPTE :
- Créer un compte → artalpha.io/app/signup
- Se connecter → artalpha.io/app/login
- Supprimer compte → artalpha.io/app/portfolio (Danger Zone en bas)

ABONNEMENTS :
- Voir les plans → artalpha.io/app/pricing
- Collector €9/mois : 10 lots, alertes simples
- Investor €29/mois : lots illimités, Agent IA 1 alerte, Larry 30 msg/mois
- Family Office €99/mois : tout illimité, Agent IA 5 alertes, Larry 200 msg/mois
- Institutional : custom, tout illimité
- Upgrade immédiat avec prorata → artalpha.io/app/pricing
- Downgrade à prochaine échéance
- Annuler → artalpha.io/app/portfolio section Subscription → Manage
- Paiement échoué → email automatique, Stripe retente, accès maintenu temporairement

OPPORTUNITÉS :
- Page principale → artalpha.io/app/opportunities
- Mise à jour toutes les 15 minutes
- Deal Score 0-100 : ≥80 EXCEPTIONAL, ≥65 STRONG, ≥45 INTERESTING
- Sources : Drouot, Interenchères, Invaluable, LiveAuctioneers, Sotheby's, Christie's, Bonhams, eBay, Artsy, Catawiki

AGENT IA :
- Accès → artalpha.io/app/agent
- Créer alerte : cliquer "+ Créer une alerte"
- Investor : 1 alerte | Family Office : 5 alertes | Institutional : illimité
- Scan toutes les 15 minutes
- Score conviction GPT-4o : ≥80 forte conviction

PORTFOLIO :
- Accès → artalpha.io/app/portfolio
- Ajouter œuvre : bouton "+ Add an artwork"
- Stats : total investi, valeur estimée, rendement

ALERTES SIMPLES :
- Accès → artalpha.io/app/alerts
- Types : Artiste, Catégorie, Prix, Score
- Gratuit:1 | Collector:5 | Investor:20 | Family Office:illimité

FAQ COMPLÈTE : artalpha.io/faq
"""


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


async def _get_user_context(user: User, _db: AsyncSession) -> str:
    """Build user context for Larry. Uses its own isolated session so schema
    mismatches on stale tables cannot abort the main request session."""
    lines = []

    async with AsyncSessionLocal() as session:
        # User preferences — may fail if preferences table schema is stale
        try:
            pref_result = await session.execute(
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
                if getattr(prefs, 'investment_horizon', None):
                    lines.append(f"Horizon d'investissement : {prefs.investment_horizon}")
                if getattr(prefs, 'collector_type', None):
                    lines.append(f"Profil collecteur : {prefs.collector_type}")
        except Exception:
            await session.rollback()

        # Top deals currently available
        try:
            lots_result = await session.execute(
                select(Lot)
                .where(Lot.deal_score >= 65)
                .order_by(Lot.deal_score.desc())
                .limit(5)
            )
            top_lots = lots_result.scalars().all()
            if top_lots:
                lines.append("\nOPPORTUNITÉS ACTUELLES (utilise UNIQUEMENT ces lots si tu cites une œuvre spécifique) :")
                for lot in top_lots:
                    price = lot.current_price or lot.estimate_low or 0
                    ctx = f"- {lot.artist_name_raw or 'Artiste inconnu'} — {lot.title[:60] if lot.title else 'Sans titre'}"
                    ctx += f" | Prix: €{price:,.0f} | Score: {lot.deal_score:.0f}/100"
                    if lot.pct_below_low_estimate and lot.pct_below_low_estimate > 5:
                        ctx += f" | -{lot.pct_below_low_estimate:.0f}% sous estimation"
                    ctx += f" | ID: {lot.id}"
                    if lot.url:
                        ctx += f" | URL: {lot.url}"
                    lines.append(ctx)
        except Exception:
            await session.rollback()

        # Portfolio summary
        try:
            portfolio_result = await session.execute(
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
        except Exception:
            await session.rollback()

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
            model="gpt-4o-mini",
            messages=messages,
            max_tokens=400,
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

    system = LARRY_SYSTEM_PROMPT + "\n\n" + LARRY_FAQ_CONTEXT
    if user_context:
        system += f"\n\n{user_context}"
    system_content = system + lot_context

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
