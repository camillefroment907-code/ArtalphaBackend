"""
Portfolio AI Optimizer — Nautilus
Analyzes user portfolio and generates AI recommendations.
Available for Investor+ plans.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
import json

from app.database import get_db
from app.api.auth_utils import get_current_user
from app.models.db_models import User, PortfolioItem, Subscription
from app.config import get_settings

router = APIRouter(prefix="/portfolio-ai", tags=["portfolio-ai"])
settings = get_settings()

# Cache per user
_analysis_cache: dict = {}
CACHE_HOURS = 6

ADMIN_EMAILS = frozenset({
    "camillefroment907@gmail.com",
    "demo@hono.art",
    "demo@balthus.art",
})

async def _get_user_plan(user: User, db: AsyncSession) -> str:
    if user.email.strip() in ADMIN_EMAILS:
        return "institutional"
    result = await db.execute(
        select(Subscription).where(Subscription.user_id == user.id)
    )
    sub = result.scalar_one_or_none()
    if sub and sub.status.value.lower() in ("active", "trialing"):
        return sub.plan.value.lower()
    return "free"

@router.post("/analyze")
async def analyze_portfolio(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """AI portfolio analysis — Investor+ only."""

    plan = await _get_user_plan(current_user, db)
    BLOCKED_PLANS = ("free", "starter")
    if plan in BLOCKED_PLANS:
        raise HTTPException(403, "Portfolio AI analysis requires the Investor plan (€29/month).")

    # Check cache
    cache_key = str(current_user.id)
    if cache_key in _analysis_cache:
        cached = _analysis_cache[cache_key]
        age_hours = (datetime.utcnow() - cached["generated_at"]).total_seconds() / 3600
        if age_hours < CACHE_HOURS:
            return cached["analysis"]

    # Fetch portfolio items
    result = await db.execute(
        select(PortfolioItem).where(PortfolioItem.user_id == current_user.id)
    )
    items = result.scalars().all()

    if len(items) < 2:
        return {
            "locked": False,
            "insufficient_data": True,
            "message": "Add at least 2 artworks to your portfolio to unlock AI analysis.",
            "insights": [],
        }

    # Build portfolio context
    total_value = sum(i.estimated_current_value_eur or i.purchase_price_eur or 0 for i in items)
    total_invested = sum(i.purchase_price_eur or 0 for i in items)

    artists: dict = {}
    mediums: dict = {}

    for item in items:
        if item.artist_name:
            artists[item.artist_name] = artists.get(item.artist_name, 0) + 1
        if item.medium:
            mediums[item.medium] = mediums.get(item.medium, 0) + 1

    top_artist = max(artists.items(), key=lambda x: x[1])[0] if artists else "Unknown"
    artist_concentration = round((artists.get(top_artist, 0) / len(items)) * 100) if items else 0

    prompt = f"""Tu es un analyste senior en investissement art pour un family office.
Analyse ce portfolio d'art et génère des recommandations stratégiques précises.

PORTFOLIO ({len(items)} œuvres):
- Valeur totale estimée: €{total_value:,.0f}
- Investissement total: €{total_invested:,.0f}
- Performance: {((total_value - total_invested) / total_invested * 100) if total_invested > 0 else 0:.1f}%
- Artiste dominant: {top_artist} ({artist_concentration}% du portfolio)
- Distribution médiums: {json.dumps(mediums)}
- Artistes uniques: {len(artists)}

FORMAT JSON STRICT (pas de markdown):
{{
  "score": <0-100 score global du portfolio>,
  "verdict": "<EXCELLENT|GOOD|NEEDS_ATTENTION|AT_RISK>",
  "summary": "<2 phrases sur l'état du portfolio>",
  "strengths": ["<point fort 1>", "<point fort 2>"],
  "risks": ["<risque 1>", "<risque 2>"],
  "recommendations": [
    {{
      "priority": "<HIGH|MEDIUM|LOW>",
      "action": "<action concrète>",
      "rationale": "<1 phrase explication>"
    }}
  ],
  "diversification_score": <0-100>,
  "liquidity_score": <0-100>,
  "growth_potential": <0-100>
}}"""

    try:
        from openai import AsyncOpenAI
        from app.utils.openai_guard import can_make_request, record_request

        if not can_make_request():
            raise HTTPException(503, "AI service temporarily at capacity. Try again in a few hours.")

        client = AsyncOpenAI(api_key=settings.openai_api_key)
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=800,
            temperature=0.3,
            response_format={"type": "json_object"},
        )
        record_request()

        raw = response.choices[0].message.content.strip()
        analysis_data = json.loads(raw)

        analysis = {
            "locked": False,
            "insufficient_data": False,
            "items_count": len(items),
            "total_value": total_value,
            "total_invested": total_invested,
            "generated_at": datetime.utcnow().isoformat(),
            **analysis_data,
        }

        _analysis_cache[cache_key] = {
            "analysis": analysis,
            "generated_at": datetime.utcnow(),
        }

        return analysis

    except json.JSONDecodeError:
        raise HTTPException(500, "Analysis generation failed.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Analysis failed: {str(e)}")
