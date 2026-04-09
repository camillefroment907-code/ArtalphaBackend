"""
ArtAlpha AI Investment Agent
Analyzes lots against a user's investment profile using GPT-4o.
Available for Pro (Family Office) plan and above.
"""
import json
from typing import Optional
import structlog
from openai import AsyncOpenAI
from app.config import get_settings
from app.models.db_models import Lot, AgentConfig, AgentRecommendation

logger = structlog.get_logger(__name__)
settings = get_settings()


def _format_price(v: Optional[float]) -> str:
    if not v:
        return "unknown"
    if v >= 1_000_000:
        return f"€{v/1_000_000:.1f}M"
    if v >= 1_000:
        return f"€{v/1_000:.0f}K"
    return f"€{v:,.0f}"


def _build_prompt(lot: Lot, config: AgentConfig, lang: str = "fr") -> str:
    price = lot.current_price or lot.estimate_low or 0
    upside = lot.pct_below_low_estimate or 0

    horizon_label = {
        "short": "court terme (< 2 ans)",
        "medium": "moyen terme (2-5 ans)",
        "long": "long terme (5 ans+)",
    }.get(config.investment_horizon or "medium", "moyen terme")

    profile_label = {
        "first_time": "première acquisition",
        "collector": "collectionneur actif",
        "investor": "investisseur pur rendement",
    }.get(config.collector_type or "collector", "collectionneur")

    risk_label = {
        "low": "faible (privilégie la liquidité et les artistes établis)",
        "medium": "modéré (équilibre risque/rendement)",
        "high": "élevé (accepte niche et artistes émergents pour plus de rendement)",
    }.get(config.risk_tolerance or "medium", "modéré")

    budget_str = f"{_format_price(config.budget_min_eur)} à {_format_price(config.budget_max_eur)}"
    artists_str = ", ".join(config.favorite_artists[:5]) if config.favorite_artists else "aucune préférence spécifique"
    categories_str = ", ".join(config.preferred_categories[:5]) if config.preferred_categories else "toutes catégories"

    return f"""Tu es un conseiller en investissement art expert. Analyse ce lot aux enchères pour un investisseur spécifique.

## PROFIL INVESTISSEUR
- Budget par lot : {budget_str}
- Horizon d'investissement : {horizon_label}
- Profil : {profile_label}
- Tolérance au risque : {risk_label}
- Artistes favoris : {artists_str}
- Catégories préférées : {categories_str}

## LOT À ANALYSER
- Artiste : {lot.artist_name_raw or 'Inconnu'}
- Titre : {lot.title or 'Sans titre'}
- Catégorie : {lot.category or 'Non renseignée'}
- Prix actuel : {_format_price(price)}
- Estimation basse : {_format_price(lot.estimate_low)}
- Estimation haute : {_format_price(lot.estimate_high)}
- Décote par rapport à l'estimation : {upside:.0f}%
- Score deal ArtAlpha : {lot.deal_score:.0f}/100
- Maison de vente : {lot.auction_house_name or (lot.source.value if lot.source else 'Inconnue')}
- Date de vente : {lot.auction_date.strftime('%d/%m/%Y') if lot.auction_date else 'Non renseignée'}

## INSTRUCTIONS
Analyse si ce lot correspond au profil de cet investisseur. Sois direct et précis.

Réponds UNIQUEMENT en JSON valide, sans markdown, sans commentaires :
{{
  "verdict": "STRONG_BUY|BUY|WATCH|PASS",
  "conviction_score": <integer 0-100>,
  "reasoning": "<2-3 phrases expliquant le verdict en français, mentionnant le profil>",
  "bull_case": "<la meilleure raison d'acheter, ou null si PASS>",
  "bear_case": "<le principal risque, toujours présent>",
  "suggested_max_price_eur": <float ou null>,
  "estimated_return_pct": <float ou null, projection sur l'horizon choisi>,
  "hold_period_months": <integer ou null>
}}

Critères de verdict :
- STRONG_BUY : correspond parfaitement au profil, décote significative, forte conviction (80+)
- BUY : bonne opportunité pour ce profil, conviction solide (65-79)
- WATCH : intéressant mais timing ou prix pas optimal (45-64)
- PASS : ne correspond pas au profil ou risque trop élevé (<45)"""


async def analyze_lot_for_user(
    lot: Lot,
    config: AgentConfig,
    lang: str = "fr",
) -> Optional[dict]:
    """
    Call GPT-4o to analyze a lot against a user's agent config.
    Returns parsed dict or None on failure.
    """
    if not settings.openai_api_key:
        logger.warning("OPENAI_API_KEY not set — agent disabled")
        return None

    client = AsyncOpenAI(api_key=settings.openai_api_key)
    prompt = _build_prompt(lot, config, lang)

    try:
        response = await client.chat.completions.create(
            model=settings.openai_model or "gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=600,
            temperature=0.3,
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content
        result = json.loads(raw)

        # Validate required fields
        required = ["verdict", "conviction_score", "reasoning", "bear_case"]
        if not all(k in result for k in required):
            logger.error("agent_response_missing_fields", raw=raw[:200])
            return None

        result["conviction_score"] = max(0, min(100, int(result["conviction_score"])))

        if result["verdict"] not in ("STRONG_BUY", "BUY", "WATCH", "PASS"):
            result["verdict"] = "WATCH"

        return result

    except Exception as e:
        logger.error("agent_analyze_failed", lot_id=str(lot.id), error=str(e))
        return None


async def run_agent_for_user(
    user_id,
    config: AgentConfig,
    new_lots: list,
    session,
    lang: str = "fr",
) -> int:
    """
    Run the agent for one user against a list of new lots.
    Creates AgentRecommendation records for verdict != PASS and conviction >= config.min_conviction_score.
    Returns count of recommendations created.
    """
    from sqlalchemy import select, and_
    from datetime import datetime

    if not config.is_active:
        return 0

    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    existing_today = await session.execute(
        select(AgentRecommendation).where(
            and_(
                AgentRecommendation.user_id == user_id,
                AgentRecommendation.created_at >= today_start,
            )
        )
    )
    today_count = len(existing_today.scalars().all())
    if today_count >= config.max_recommendations_per_day:
        return 0

    budget_filtered = []
    for lot in new_lots:
        price = lot.current_price or lot.estimate_low or 0
        if config.budget_min_eur and price < config.budget_min_eur:
            continue
        if config.budget_max_eur and price > config.budget_max_eur:
            continue
        if lot.deal_score and lot.deal_score < 45:
            continue
        existing = await session.execute(
            select(AgentRecommendation).where(
                and_(
                    AgentRecommendation.user_id == user_id,
                    AgentRecommendation.lot_id == lot.id,
                )
            )
        )
        if existing.scalar_one_or_none():
            continue
        budget_filtered.append(lot)

    budget_filtered.sort(key=lambda l: l.deal_score or 0, reverse=True)
    candidates = budget_filtered[:5]

    created = 0
    for lot in candidates:
        if today_count + created >= config.max_recommendations_per_day:
            break

        result = await analyze_lot_for_user(lot, config, lang)
        if not result:
            continue

        if result["verdict"] == "PASS":
            continue
        if result["conviction_score"] < config.min_conviction_score:
            continue

        rec = AgentRecommendation(
            user_id=user_id,
            lot_id=lot.id,
            agent_config_id=config.id,
            verdict=result["verdict"],
            conviction_score=result["conviction_score"],
            reasoning=result["reasoning"],
            bull_case=result.get("bull_case"),
            bear_case=result.get("bear_case"),
            suggested_max_price_eur=result.get("suggested_max_price_eur"),
            estimated_return_pct=result.get("estimated_return_pct"),
            hold_period_months=result.get("hold_period_months"),
            notified_at=datetime.utcnow(),
        )
        session.add(rec)
        created += 1

    if created > 0:
        await session.flush()

    return created
