"""
ArtAlpha AI Investment Agent
Analyzes lots against a user's AgentAlert using GPT-4o.
Available for Investor plan and above.
"""
import json
from typing import Optional
import structlog
from openai import AsyncOpenAI
from app.config import get_settings
from app.models.db_models import Lot, AgentAlert, AgentRecommendation

logger = structlog.get_logger(__name__)
settings = get_settings()


def _format_price(v: Optional[float]) -> str:
    if not v:
        return "inconnu"
    if v >= 1_000_000:
        return f"€{v/1_000_000:.1f}M"
    if v >= 1_000:
        return f"€{v/1_000:.0f}K"
    return f"€{v:,.0f}"


def _build_prompt(lot: Lot, alert: AgentAlert, lang: str = "fr") -> str:
    price = lot.current_price or lot.estimate_low or 0
    upside = lot.pct_below_low_estimate or 0

    horizon_label = {
        "short": "court terme (< 2 ans)",
        "medium": "moyen terme (2-5 ans)",
        "long": "long terme (5 ans+)",
    }.get(alert.investment_horizon or "medium", "moyen terme")

    risk_label = {
        "low": "faible (privilégie la liquidité et les artistes établis)",
        "medium": "modéré (équilibre risque/rendement)",
        "high": "élevé (accepte niche et artistes émergents pour plus de rendement)",
    }.get(alert.risk_tolerance or "medium", "modéré")

    budget_str = f"{_format_price(alert.budget_min_eur)} à {_format_price(alert.budget_max_eur)}"
    keywords_str = ", ".join(alert.keywords[:10]) if alert.keywords else "aucun"

    return f"""Tu es un conseiller en investissement art expert. Analyse ce lot aux enchères pour une alerte d'investissement spécifique.

## ALERTE : "{alert.name}"
- Artiste ciblé : {alert.artist_name or 'non spécifié'}
- Catégorie ciblée : {alert.category or 'toutes'}
- Sous-catégorie : {alert.subcategory or 'toutes'}
- Mots-clés : {keywords_str}
- Budget par lot : {budget_str}
- Horizon d'investissement : {horizon_label}
- Tolérance au risque : {risk_label}

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
Analyse si ce lot correspond à cette alerte d'investissement. Sois direct et précis.

Réponds UNIQUEMENT en JSON valide, sans markdown, sans commentaires :
{{
  "verdict": "STRONG_BUY|BUY|WATCH|PASS",
  "conviction_score": <integer 0-100>,
  "reasoning": "<2-3 phrases en français expliquant le verdict par rapport à l'alerte>",
  "bull_case": "<la meilleure raison d'acheter, ou null si PASS>",
  "bear_case": "<le principal risque, toujours présent>",
  "suggested_max_price_eur": <float ou null>,
  "estimated_return_pct": <float ou null, projection sur l'horizon choisi>,
  "hold_period_months": <integer ou null>
}}

Critères de verdict :
- STRONG_BUY : correspond parfaitement à l'alerte, décote significative, forte conviction (80+)
- BUY : bonne opportunité pour cette alerte, conviction solide (65-79)
- WATCH : intéressant mais timing ou prix pas optimal (45-64)
- PASS : ne correspond pas à l'alerte ou risque trop élevé (<45)"""


async def analyze_lot_for_alert(
    lot: Lot,
    alert: AgentAlert,
    lang: str = "fr",
) -> Optional[dict]:
    """
    Call GPT-4o to analyze a lot against an AgentAlert.
    Returns parsed dict or None on failure.
    """
    if not settings.openai_api_key:
        logger.warning("OPENAI_API_KEY not set — agent disabled")
        return None

    client = AsyncOpenAI(api_key=settings.openai_api_key)
    prompt = _build_prompt(lot, alert, lang)

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

        required = ["verdict", "conviction_score", "reasoning", "bear_case"]
        if not all(k in result for k in required):
            logger.error("agent_response_missing_fields", raw=raw[:200])
            return None

        result["conviction_score"] = max(0, min(100, int(result["conviction_score"])))

        if result["verdict"] not in ("STRONG_BUY", "BUY", "WATCH", "PASS"):
            result["verdict"] = "WATCH"

        return result

    except json.JSONDecodeError as e:
        logger.warning(
            "agent_analyze_json_error",
            lot_id=str(lot.id),
            alert_id=str(alert.id),
            error=str(e),
        )
        return None
    except Exception as e:
        logger.warning(
            "agent_analyze_failed",
            lot_id=str(lot.id),
            alert_id=str(alert.id),
            error=str(e),
            error_type=type(e).__name__,
        )
        return None


async def run_agent_for_alert(
    alert: AgentAlert,
    new_lots: list,
    session,
    lang: str = "fr",
) -> int:
    """
    Run the agent for one alert against a list of new lots.
    Creates AgentRecommendation records for verdict != PASS and conviction >= alert.min_conviction_score.
    Returns count of recommendations created.
    """
    from sqlalchemy import select, and_
    from datetime import datetime

    if not alert.is_active:
        return 0

    # Pre-filter lots by alert criteria (Python-side, lots already loaded)
    candidates = []
    for lot in new_lots:
        price = lot.current_price or lot.estimate_low or 0

        # Budget filter
        if alert.budget_min_eur and price < alert.budget_min_eur:
            continue
        if alert.budget_max_eur and price > alert.budget_max_eur:
            continue

        # Artist filter
        if alert.artist_name:
            raw = (lot.artist_name_raw or "").lower()
            if alert.artist_name.lower() not in raw:
                continue

        # Category filter
        if alert.category:
            cat = (lot.category or "").lower()
            if alert.category.lower() not in cat:
                continue

        # Subcategory filter
        if alert.subcategory:
            sub = alert.subcategory.lower()
            cat_match = sub in (lot.category or "").lower()
            title_match = sub in (lot.title or "").lower()
            if not cat_match and not title_match:
                continue

        # Keywords filter
        if alert.keywords:
            title_lower = (lot.title or "").lower()
            if not any(kw.lower() in title_lower for kw in alert.keywords):
                continue

        # Skip already-recommended
        existing = await session.execute(
            select(AgentRecommendation).where(
                and_(
                    AgentRecommendation.alert_id == alert.id,
                    AgentRecommendation.lot_id == lot.id,
                )
            )
        )
        if existing.scalar_one_or_none():
            continue

        candidates.append(lot)

    # Sort by deal_score desc, cap at 5 OpenAI calls per alert per run
    candidates.sort(key=lambda l: l.deal_score or 0, reverse=True)
    candidates = candidates[:5]

    created = 0
    for lot in candidates:
        result = await analyze_lot_for_alert(lot, alert, lang)
        if not result:
            continue

        if result["verdict"] == "PASS":
            continue
        if result["conviction_score"] < (alert.min_conviction_score or 65):
            continue

        rec = AgentRecommendation(
            user_id=alert.user_id,
            alert_id=alert.id,
            lot_id=lot.id,
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
