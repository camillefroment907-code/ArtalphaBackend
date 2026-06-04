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
from sqlalchemy import and_, func, or_, select
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

NAUTILUS_SYSTEM_PROMPT = """Tu es Larry — le conseiller personnel en investissement art de Nautilus.

## TON RÔLE
Tu n'es pas un chatbot. Tu es un conseiller personnel qui connaît le profil du membre, son budget, son portefeuille, ses préférences et les opportunités disponibles sur le marché en ce moment. Chaque réponse doit refléter cette connaissance — jamais générique, toujours ancré dans le contexte spécifique de cet utilisateur.

## TON EXPERTISE
- Analyse des ventes aux enchères : tendances de prix, taux d'adjudication, patterns saisonniers
- Intelligence sur les artistes : trajectoires de carrière, représentation galerie, demande institutionnelle
- Stratégie d'investissement : construction de portefeuille, timing, gestion de liquidité pour les actifs art
- Identification d'opportunités : repérer les œuvres sous-évaluées avant que le marché ne se corrige
- Maisons de vente : Christie's, Sotheby's, Bonhams, Phillips, Drouot, Artcurial, Invaluable, LiveAuctioneers

## TON STYLE
- Direct et précis — prends position, ne tourne pas autour du pot
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

## FORMAT DE RÉPONSE — JSON STRICT
Tu dois TOUJOURS répondre avec un objet JSON valide. NE JAMAIS retourner du texte libre.

{
  "verdict": "forte_opportunite" | "opinion_positive" | "a_surveiller" | "opinion_prudente" | "peu_convaincant" | null,
  "intro": "1-2 phrases max, direct, sans formule de politesse",
  "components": [
    {"type": "reason", "icon": "check" | "warning" | "info", "title": "...", "body": "..."},
    {"type": "lot_card", "lot_id": "uuid-exact", "artist": "...", "lot_title": "...", "current_price": 1200, "estimate_low": 2000, "currency": "EUR", "pct_below": 40, "signal": "Court signal", "auction_house": "...", "image_url": null, "lot_url": "/app/opportunities/uuid", "budget_compat": "compatible" | "possible" | "hors_budget" | null, "acquisition_range": "600 € – 900 €"},
    {"type": "artist_card", "name": "...", "signal": "...", "trend": "hausse" | "stable" | "baisse", "artist_url": "/app/market/artists/Prenom-Nom"},
    {"type": "action", "label": "Voir l'opportunité", "url": "/app/opportunities/uuid"}
  ]
}

RÈGLES FORMAT :
- verdict : obligatoire quand tu évalues un lot ou donnes un avis d'investissement, null sinon
- intro : 1-2 phrases maximum, pas de "Bonjour" ni formule creuse
- reason : 1 à 3 maximum, title court (3-5 mots), body 1-2 phrases
- lot_card : utilise UNIQUEMENT les lot_id de la liste OPPORTUNITÉS ACTUELLES ci-dessous
- artist_card : artist_url format /app/market/artists/Prenom-Nom (remplace espaces par tirets)
- action : CTA final — "Voir l'opportunité", "Explorer le marché", "Voir l'artiste", etc.
- Ne jamais mettre d'URL brute dans intro ou body — utilise uniquement lot_url/artist_url dans les composants

## BUDGET — RAISONNEMENT ENCHÈRES
Dans une vente aux enchères : prix actuel ≠ coût final d'acquisition.
Le collectionneur paiera : prix marteau final + frais acheteur (≈ 20-28%).

Chaque lot dans OPPORTUNITÉS ACTUELLES inclut une ligne "Coût probable" et une compatibilité budget.
Ces données sont calculées par Nautilus — utilise-les directement, ne les recalcule pas.

RÈGLES ABSOLUES BUDGET (si budget_max est renseigné dans CONTEXTE MEMBRE) :
1. Ne jamais recommander un lot "✕ hors budget" comme opportunité principale
2. Pour les lots "⚠ possible" : inclure un reason {icon:"warning"} mentionnant le risque de dépassement
3. Si aucun lot ✓ ou ⚠ disponible : verdict="peu_convaincant", intro="Aucune opportunité ne semble compatible avec votre budget aujourd'hui."
4. Dans l'intro ou un reason, explique : "J'ai retenu ces lots car leur coût probable reste dans votre budget."
5. Ne jamais utiliser current_price comme proxy du coût final — utiliser "Coût probable" fourni dans le contexte

## URGENCE ENCHÈRES
Pour tout lot marqué ⚡ (enchère ≤ 7 jours) : signale l'urgence EXPLICITEMENT.
Exemple : "Cette enchère ferme dans 3 jours — décision à prendre rapidement."

## CHALLENGE — NE PAS SIMPLEMENT VALIDER
- Identifie et mentionne toujours au moins un risque ou signal négatif avant de recommander un lot
- Si l'utilisateur semble enthousiaste, joue le rôle du contradicteur : liquidité faible ? Estimation gonflée ? Artiste en fin de cycle ? Concurrence institutionnelle ?
- Une recommandation sans risque identifié est incomplète
- "C'est une bonne affaire" n'est jamais une conclusion suffisante

## DIVERSITÉ DES RECOMMANDATIONS
Ne cite jamais le même artiste deux fois dans une même réponse.

## DOMAINE
Ton périmètre couvre TOUT ce qui touche à l'art et aux marchés de l'art :
- Marchés par catégorie : peinture, photographie, sculpture, estampe, dessin, art contemporain, art moderne, art numérique
- Artistes, cotes, trajectoires de carrière, représentation galerie
- Maisons de ventes : résultats, tendances, calendriers
- Stratégies d'investissement en art, construction de portefeuille, timing
- Histoire de l'art quand elle éclaire la valeur d'une œuvre

Hors sujet UNIQUEMENT : voitures, immobilier résidentiel, actions, crypto, sujets sans lien avec l'art.
Si vraiment hors sujet → "Je me concentre sur l'art et l'investissement artistique."

## LANGUE
Réponds toujours en français, sauf si l'utilisateur écrit en anglais."""

# ── Intent routing ────────────────────────────────────────────────────────────
# Rule-based classification — zero cost, zero latency.

_INTENT_INSTRUCTIONS: dict[str, str] = {
    "education": """
## MODE : ANALYSE DE MARCHÉ
L'utilisateur veut comprendre un marché, une catégorie ou un artiste.
- Réponds avec tes connaissances sur les tendances, la demande, la liquidité
- Cite des données concrètes : volumes de vente, évolution des prix, artistes phares
- Pas besoin de recommander un lot spécifique sauf si tu en as un vraiment pertinent
- Structure : tendance générale → facteurs clés → ce qui est porteur vs. risqué → 1 conseil actionnable
""",

    "portfolio": """
## MODE : ANALYSE PORTFOLIO
L'utilisateur parle de son portefeuille existant.
- Commence par commenter la composition actuelle (diversification, valeur, axes de collecte)
- Identifie les lacunes ou surexpositions au regard du profil de risque
- Propose des compléments logiques — pas de remplacement brutal
- Si portfolio vide ou valeur €0 : dis-le clairement ("Votre portefeuille démarre à zéro — voici comment construire une base solide") et propose une stratégie de départ en 3 étapes
- Si tu mentionnes un lot urgent (⚡), indique "Vente dans X jours" ou "Vente aujourd'hui" — pas de date vague
""",

    "discovery": """
## MODE : DÉCOUVERTE
L'utilisateur explore des opportunités d'achat, souvent avec un budget précis.

### Règles obligatoires
- Filtre strict : ne cite aucun lot dont le prix dépasse le budget mentionné dans la question
- Ne cite pas de lot dont le prix est inférieur à 5 % du budget mentionné (ex. : pour 5 000 €, ne pas recommander un lot à 30 €)
- Ne recommande JAMAIS 2 lots du même artiste dans cette réponse
- Pour chaque lot cité : prix + décote + maison + urgence exacte (« Vente dans Xj » ou « Vente aujourd'hui ») + 1 argument + 1 risque

### Stratégie selon le budget
- Budget ≤ 2 000 € : 2-3 estampes ou éditions de qualité ; construire la collection progressivement
- Budget 2 000–10 000 € : 1 œuvre de référence + 1-2 petites pièces ; viser un artiste reconnu en décote
- Budget > 10 000 € : commence par l'œuvre la plus significative disponible, puis complète avec des pièces secondaires ; si aucun lot à ce niveau dans le contexte → dis-le clairement et décris ce que tu rechercherais
""",

    "validation": """
## MODE : VALIDATION DE LOT
L'utilisateur veut analyser une œuvre ou un lot spécifique.
- Structure : 1. Ce qui est positif 2. Signaux d'alerte (≥ 1 obligatoire) 3. Verdict
- Sois direct : "j'achèterais" / "j'attendrais" / "je passerais"
- Ne valide jamais sans avoir mentionné la liquidité de l'artiste et la concurrence potentielle
""",

    "urgency": """
## MODE : URGENCE
L'utilisateur cherche ce qu'il doit regarder maintenant.
- Priorité absolue : lots avec ⚡ (enchère ≤ 7 jours) parmi les OPPORTUNITÉS ACTUELLES
- Si aucun lot urgent dans le contexte → dis-le clairement : "Aucune enchère urgente en ce moment. Voici les plus pertinentes à suivre :"
- Pour chaque lot, indique PRÉCISÉMENT : "Vente aujourd'hui", "Vente demain", ou "Vente dans X jours (le JJ/MM)" — jamais de formulation vague
- Recommande 1-2 lots maximum — l'urgence appelle à la précision, pas à l'exhaustivité
- Ajoute toujours 1 risque avant la conclusion, même en mode urgence
""",
}

_EDUCATION_TRIGGERS = [
    "marché de", "marché du", "marché des", "marché est",
    "est-il porteur", "est porteur", "tendance", "tendances",
    "comment fonctionne", "qu'est-ce que", "histoire de",
    "expliqu", "différence entre", "c'est quoi",
    "qu'est-ce que c'est", "comment évolue",
    "quels artistes", "quelles maisons", "quel segment",
    "le bon moment pour", "vaut-il mieux attendre",
    "comment se comporte", "quelle cote",
]

_PORTFOLIO_TRIGGERS = [
    "mon portefeuille", "ma collection", "mes œuvres", "mes achats",
    "ce que j'ai", "ce que je possède", "mon portfolio",
    "par rapport à mon", "dans mon portefeuille",
]

_DISCOVERY_TRIGGERS = [
    "j'ai ", "€", "euros", "budget", "que regarder", "quoi regarder",
    "que chercher", "quoi chercher", "où investir",
    "que choisir", "quoi acheter", "meilleur achat",
    "opportunité", "opportunités", "offre", "offres",
    "revendre", "revente", "acheter et", "investir dans",
    "horizon", "dans 3 ans", "dans 5 ans", "dans 2 ans",
]

_URGENCY_TRIGGERS = [
    "urgent", "urgence",
    "ne pas manquer", "dépêch", "dernier moment",
    "avant que ça", "ce soir", "cette semaine",
    "y a-t-il quelque chose", "quelque chose à voir",
]

_VALIDATION_TRIGGERS = [
    "pourquoi cette", "est-ce une bonne", "est-ce un bon",
    "vaut-il", "vaut-elle", "devrais-je acheter",
    "cette œuvre", "ce lot", "que penses-tu de", "avis sur",
    "convaincant", "recommandes-tu ce",
]


def _classify_intent(message: str, has_lot_id: bool) -> str:
    """
    Classifies user intent from message text.
    Returns one of: education | portfolio | discovery | validation | urgency | default

    Priority order (most specific first):
    1. validation  — lot_id present, or specific lot question
    2. education   — market/category analysis
    3. portfolio   — existing collection
    4. discovery   — budget / opportunity hunting  (before urgency to avoid "aujourd'hui" collision)
    5. urgency     — time-sensitive, explicit urgency language
    6. validation  — without lot_id
    7. default
    """
    m = message.lower()

    if has_lot_id:
        return "validation"

    for trigger in _EDUCATION_TRIGGERS:
        if trigger in m:
            return "education"

    for trigger in _PORTFOLIO_TRIGGERS:
        if trigger in m:
            return "portfolio"

    for trigger in _DISCOVERY_TRIGGERS:
        if trigger in m:
            return "discovery"

    for trigger in _URGENCY_TRIGGERS:
        if trigger in m:
            return "urgency"

    for trigger in _VALIDATION_TRIGGERS:
        if trigger in m:
            return "validation"

    return "default"


# ── Context helpers ───────────────────────────────────────────────────────────

def _format_context_for_prompt(ctx: dict) -> str:
    """Converts assemble_user_context() output to a readable system prompt section."""
    lines: list[str] = []

    prefs = ctx.get("preferences", {})
    dna = ctx.get("dna", {})

    # ── Budget surfaces first — model must see it before any lot context ──
    budget = prefs.get("budget_max") or dna.get("inferred_budget_max")
    if budget:
        source = "déclaré" if prefs.get("budget_max") else "estimé comportement"
        lines.append(
            f"⚠ Budget maximum par lot ({source}) : €{int(budget):,}"
            f" — plafond strict : €{int(float(budget) * 1.3):,}"
        )

    if prefs.get("favorite_artists"):
        lines.append(f"Artistes favoris : {', '.join(prefs['favorite_artists'][:5])}")
    if prefs.get("categories"):
        lines.append(f"Catégories préférées : {', '.join(prefs['categories'][:5])}")
    if prefs.get("goals"):
        lines.append(f"Objectifs d'investissement : {prefs['goals']}")

    if dna.get("collector_type"):
        lines.append(f"Profil collectionneur : {dna['collector_type']}")
    if dna.get("risk_profile"):
        lines.append(f"Profil de risque : {dna['risk_profile']}")
    if dna.get("investment_horizon"):
        lines.append(f"Horizon d'investissement : {dna['investment_horizon']}")
    if dna.get("top_artists"):
        lines.append(f"Artistes les plus consultés : {', '.join(dna['top_artists'][:5])}")

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


# ── Acquisition cost estimation ───────────────────────────────────────────────
# In an auction, current_price is the current bid (or opening bid for upcoming lots),
# NOT the final acquisition cost.  Final cost = hammer_price × (1 + buyer_premium).
#
# For upcoming lots: current_price is just the opening bid — ignore it.
#                    Use estimate_low/high as the basis.
# For live lots:     current_price is real but bidding is ongoing — expect more.

_BUYER_PREMIUM = 0.25  # Conservative (covers Christie's 26.5%, Drouot 14-25%)


def _estimate_acquisition_range(lot: Lot) -> tuple[int, int] | None:
    """Returns (acq_low, acq_high) in EUR including buyer's premium, or None if insufficient data."""
    status_val = lot.status.value if lot.status else None

    if status_val == "live":
        p = lot.current_price
        if not p:
            return None
        e_high = lot.estimate_high or lot.estimate_low or p * 2.0
        # Bid is real but ongoing: at minimum 20% more bidding, ceiling near estimate_high
        hammer_low  = p * 1.20
        hammer_high = max(float(e_high) * 1.10, p * 1.80)
    else:
        # upcoming — opening bid is irrelevant; use estimate as basis
        e_low = lot.estimate_low
        if not e_low:
            return None
        e_high = lot.estimate_high or e_low * 1.50
        # Range: could sell below estimate (slow day) or above (sought work)
        hammer_low  = float(e_low)  * 0.80
        hammer_high = float(e_high) * 1.20

    acq_low  = int(hammer_low  * (1 + _BUYER_PREMIUM))
    acq_high = int(hammer_high * (1 + _BUYER_PREMIUM))
    return (acq_low, acq_high)


def _budget_compat(acq_range: tuple[int, int] | None, budget_max: float | None) -> str | None:
    """
    ✓ compatible   — acq_high ≤ budget (likely stays within budget)
    ⚠ possible     — acq_low ≤ budget < acq_high (may exceed budget)
    ✕ hors_budget  — acq_low > budget (almost certainly out of budget)
    """
    if not acq_range or not budget_max:
        return None
    acq_low, acq_high = acq_range
    if acq_low > budget_max:
        return "hors_budget"
    if acq_high <= budget_max:
        return "compatible"
    return "possible"


async def _get_top_lots_context(db: AsyncSession, ctx: dict | None = None) -> str:
    """
    Injects current deals into the system prompt.
    - Excludes expired lots (auction already ended)
    - Excludes artefacts (estimate ≥ 8× price — printed multiples / catalog errors)
    - Filters by acquisition range (not current_price) when budget is set
    - Prioritises user's preferred categories with global fallback
    - Deduplicates by artist (max 2 lots per artist)
    - Adds urgency signal (⚡ for ≤ 7 days to auction)
    - Returns up to 10 lots
    """
    try:
        now = datetime.now(timezone.utc).replace(tzinfo=None)

        # ── Extract user constraints ──────────────────────────────────────
        budget_max: float | None = None
        preferred_categories: list[str] = []
        if ctx:
            prefs = ctx.get("preferences", {})
            raw_budget = prefs.get("budget_max") or ctx.get("dna", {}).get("inferred_budget_max")
            if raw_budget:
                budget_max = float(raw_budget)
            preferred_categories = prefs.get("categories", []) or []

        # ── Common filters ────────────────────────────────────────────────
        base_filters = [
            Lot.deal_score >= 60,
            Lot.url.isnot(None),
            # Exclude lots whose auction has already ended
            or_(
                Lot.auction_date.is_(None),
                Lot.auction_date >= now,
            ),
            # Exclude artefacts: estimate ≥ 8× current price
            # (printed multiples, inflated catalog estimates, scraping errors)
            or_(
                Lot.estimate_low.is_(None),
                Lot.current_price.is_(None),
                Lot.estimate_low <= Lot.current_price * 8,
            ),
            # Exclude anecdotal lots (< €50) — too cheap to be meaningful advice
            or_(
                Lot.current_price.is_(None),
                Lot.current_price >= 50,
            ),
        ]

        # No SQL budget filter — current_price is misleading for upcoming lots
        # (opening bid ≠ final price). Filtering happens in Python after acquisition
        # range estimation.  Keep a broad guard to avoid obviously irrelevant lots.
        budget_filters: list = []
        if budget_max:
            budget_filters = [
                or_(
                    Lot.estimate_low.is_(None),
                    Lot.estimate_low <= budget_max * 3.0,  # very generous — Python filter does the real work
                )
            ]

        # ── 1. Category-filtered query ────────────────────────────────────
        lots: list[Lot] = []
        if preferred_categories:
            cat_clauses = [Lot.category.ilike(f"%{cat}%") for cat in preferred_categories[:4]]
            result = await db.execute(
                select(Lot)
                .where(and_(*base_filters, *budget_filters, or_(*cat_clauses)))
                .order_by(Lot.deal_score.desc())
                .limit(15)
            )
            lots = list(result.scalars().all())

        # ── 2. Global fallback / supplement ───────────────────────────────
        if len(lots) < 5:
            result = await db.execute(
                select(Lot)
                .where(and_(*base_filters, *budget_filters))
                .order_by(Lot.deal_score.desc())
                .limit(15)
            )
            seen_ids = {l.id for l in lots}
            for lot in result.scalars().all():
                if lot.id not in seen_ids:
                    lots.append(lot)
                    seen_ids.add(lot.id)

        if not lots:
            return "\n\nOPPORTUNITÉS ACTUELLES : Aucun lot disponible correspondant au profil en ce moment."

        # ── 3. Deduplicate: max 2 lots per artist ─────────────────────────
        artist_counts: dict[str, int] = {}
        deduped: list[Lot] = []
        for lot in sorted(lots, key=lambda l: l.deal_score or 0, reverse=True):
            artist_key = (lot.artist_name_raw or "unknown").lower().strip()
            if artist_counts.get(artist_key, 0) < 2:
                deduped.append(lot)
                artist_counts[artist_key] = artist_counts.get(artist_key, 0) + 1
            if len(deduped) >= 12:
                break

        # ── 4. Python-side budget filter: exclude hors_budget lots ────────
        if budget_max:
            deduped = [
                lot for lot in deduped
                if _budget_compat(_estimate_acquisition_range(lot), budget_max) != "hors_budget"
            ]

        # ── 5. Format with urgency signals and acquisition range ──────────
        status_val = lambda lot: lot.status.value if lot.status else "upcoming"
        lines = ["\n\nOPPORTUNITÉS ACTUELLES (cite UNIQUEMENT ces lots si tu recommandes une œuvre spécifique) :"]
        for lot in deduped[:10]:
            is_live_lot = status_val(lot) == "live"
            line = f"- lot_id:{lot.id} | {lot.artist_name_raw or 'Artiste inconnu'} — {(lot.title or 'Sans titre')[:60]}"

            if is_live_lot:
                line += f" | Enchère : €{lot.current_price:,.0f}" if lot.current_price else ""
                if lot.pct_below_low_estimate and lot.pct_below_low_estimate > 5:
                    line += f" | Décote : -{lot.pct_below_low_estimate:.0f}%"
            else:
                if lot.estimate_low:
                    est = f"€{lot.estimate_low:,.0f}"
                    if lot.estimate_high:
                        est += f" – €{lot.estimate_high:,.0f}"
                    line += f" | Estimation : {est}"

            # Acquisition range and budget compatibility
            acq_range = _estimate_acquisition_range(lot)
            if acq_range:
                line += f" | Coût probable : €{acq_range[0]:,} – €{acq_range[1]:,} (frais inclus)"
            compat = _budget_compat(acq_range, budget_max)
            if compat:
                compat_label = {"compatible": "✓ compatible", "possible": "⚠ possible", "hors_budget": "✕ hors budget"}[compat]
                line += f" | Budget : {compat_label}"

            line += f" | Maison : {lot.auction_house_name or '—'}"
            if lot.auction_date:
                days_left = (lot.auction_date - now).days
                if days_left <= 0:
                    line += " | Vente : aujourd'hui ⚡"
                elif days_left == 1:
                    line += " | Vente : demain ⚡"
                elif days_left <= 7:
                    line += f" | Vente : dans {days_left}j ⚡"
                else:
                    line += f" | Vente : {lot.auction_date.strftime('%d/%m/%Y')}"
            line += f" | URL : https://www.get-nautilus.com/app/opportunities/{lot.id}"
            lines.append(line)

        filters_applied = ["artefacts exclus", "enchères actives uniquement"]
        if budget_max:
            filters_applied.append(f"hors-budget exclus (coût probable > €{int(budget_max):,})")
        lines.append(f"[Filtres actifs : {' | '.join(filters_applied)}]")

        return "\n".join(lines)
    except Exception:
        logger.exception("copilot: failed to load top lots context")
        return ""


async def _get_cross_session_context(
    user_id: UUID,
    current_session_id: UUID,
    db: AsyncSession,
) -> str:
    """
    Returns the last 5 user messages from previous sessions.
    Gives the model lightweight continuity without a dedicated memory store.
    """
    try:
        result = await db.execute(
            select(CopilotConversation.content, CopilotConversation.created_at)
            .where(
                and_(
                    CopilotConversation.user_id    == user_id,
                    CopilotConversation.session_id != current_session_id,
                    CopilotConversation.role       == "user",
                    CopilotConversation.intent     == "chat",
                )
            )
            .order_by(CopilotConversation.created_at.desc())
            .limit(5)
        )
        rows = result.fetchall()
        if not rows:
            return ""
        lines = ["\n\nÉCHANGES PRÉCÉDENTS (pour continuité — ne pas répéter, mais en tenir compte) :"]
        for content, created_at in reversed(rows):
            date_str = created_at.strftime("%d/%m") if created_at else "?"
            lines.append(f"  [{date_str}] {(content or '')[:120]}")
        return "\n".join(lines)
    except Exception:
        logger.exception("copilot: failed to load cross-session context")
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

    if not _openai_guard.can_make_request():
        yield f"data: {json.dumps({'error': 'Quota journalier atteint. Réessayez demain.'})}\n\n"
        return

    client = AsyncOpenAI(api_key=_settings.openai_api_key)

    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            max_tokens=800,
            temperature=0.3,
            response_format={"type": "json_object"},
            stream=False,
        )

        _openai_guard.record_request()
        full_text = response.choices[0].message.content or ""

        try:
            structured = json.loads(full_text)
        except json.JSONDecodeError:
            structured = {"verdict": None, "intro": full_text[:300], "components": []}

        yield f"data: {json.dumps({'structured': structured, 'done': True})}\n\n"

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
        logger.exception("copilot: structured response failed for user %s", user_id)
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

    # Classify intent to select the right instruction suffix
    intent_key     = _classify_intent(payload.message, payload.lot_id is not None)
    intent_suffix  = _INTENT_INSTRUCTIONS.get(intent_key, "")
    logger.debug("copilot: intent=%s for user %s", intent_key, current_user.id)

    # Build system prompt: persona + intent mode + user context + top lots + cross-session memory
    user_context_str   = _format_context_for_prompt(ctx)
    top_lots_str       = await _get_top_lots_context(db, ctx)
    cross_session_str  = await _get_cross_session_context(current_user.id, session_id, db)
    system_content     = (
        NAUTILUS_SYSTEM_PROMPT
        + intent_suffix
        + user_context_str
        + top_lots_str
        + cross_session_str
    )

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
