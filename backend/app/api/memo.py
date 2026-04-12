"""
Investment Memo Generator — Nautilus
Generates a GPT-4o institutional investment memo for any lot.
Available on Investor+ plans. Cached per lot_id for 24h.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
import json

from app.database import get_db
from app.api.auth_utils import get_current_user
from app.models.db_models import User, Lot, Subscription, SubscriptionStatus
from app.config import get_settings

router = APIRouter(prefix="/memo", tags=["memo"])
settings = get_settings()

# In-memory cache: lot_id → {memo, generated_at}
_memo_cache: dict = {}
CACHE_HOURS = 24

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


@router.post("/{lot_id}")
async def generate_investment_memo(
    lot_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate institutional investment memo for a lot. Investor+ only."""

    # Plan check
    plan = await _get_user_plan(current_user, db)
    if plan not in ("investor", "pro", "institutional", "expert", "elite"):
        raise HTTPException(
            403,
            "Investment memos are available from the Investor plan (€29/month)."
        )

    if not settings.openai_api_key:
        raise HTTPException(503, "AI service temporarily unavailable.")

    # Check cache
    cache_key = str(lot_id)
    if cache_key in _memo_cache:
        cached = _memo_cache[cache_key]
        age_hours = (datetime.utcnow() - cached["generated_at"]).total_seconds() / 3600
        if age_hours < CACHE_HOURS:
            return cached["memo"]

    # Fetch lot
    result = await db.execute(select(Lot).where(Lot.id == lot_id))
    lot = result.scalar_one_or_none()
    if not lot:
        raise HTTPException(404, "Lot not found.")

    # Build context
    price    = lot.current_price or lot.estimate_low or 0
    est_low  = lot.estimate_low or 0
    est_high = lot.estimate_high or 0
    upside   = lot.pct_below_low_estimate or 0
    artist   = lot.artist_name_raw or "Unknown Artist"
    title    = lot.title or "Untitled"
    house    = lot.auction_house_name or "Unknown"
    category = lot.category or "Unknown"
    medium   = lot.medium or "Unknown"
    score    = lot.deal_score or 0

    def fmt(v):
        if not v: return "N/A"
        if v >= 1_000_000: return f"€{v/1_000_000:.1f}M"
        if v >= 1_000: return f"€{v/1_000:.0f}K"
        return f"€{v:,.0f}"

    prompt = f"""Tu es un analyste senior en investissement art pour un family office institutionnel.
Génère un mémo d'investissement professionnel et concis pour ce lot aux enchères.

DONNÉES DU LOT:
- Artiste: {artist}
- Titre: {title}
- Maison de vente: {house}
- Catégorie: {category}
- Médium: {medium}
- Prix actuel / mise de départ: {fmt(price)}
- Estimation basse: {fmt(est_low)}
- Estimation haute: {fmt(est_high)}
- Décote vs estimation: {upside:.0f}%
- Deal Score Nautilus: {score:.0f}/100

FORMAT DE RÉPONSE (JSON strict, pas de markdown):
{{
  "thesis": "2-3 phrases sur pourquoi cette œuvre présente un intérêt d'investissement",
  "artist_context": "1-2 phrases sur le positionnement marché de l'artiste",
  "pricing_analysis": "1-2 phrases sur l'analyse du prix vs marché",
  "risks": ["risque 1", "risque 2", "risque 3"],
  "target_price": {{"low": number_euros, "high": number_euros, "rationale": "1 phrase"}},
  "recommendation": "BUY" | "WATCH" | "PASS",
  "conviction": number_0_to_100,
  "time_horizon": "court terme (< 2 ans)" | "moyen terme (2-5 ans)" | "long terme (5 ans+)"
}}

Réponds UNIQUEMENT avec le JSON, aucun texte avant ou après."""

    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=settings.openai_api_key)

        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=800,
            temperature=0.3,
            response_format={"type": "json_object"},
        )

        raw = response.choices[0].message.content.strip()
        memo_data = json.loads(raw)

        memo = {
            "lot_id": str(lot_id),
            "artist": artist,
            "title": title,
            "auction_house": house,
            "current_price": price,
            "estimate_low": est_low,
            "estimate_high": est_high,
            "deal_score": score,
            "generated_at": datetime.utcnow().isoformat(),
            "generated_by": "Nautilus AI · GPT-4o",
            **memo_data,
        }

        # Cache it
        _memo_cache[cache_key] = {
            "memo": memo,
            "generated_at": datetime.utcnow(),
        }

        return memo

    except json.JSONDecodeError:
        raise HTTPException(500, "Memo generation failed: invalid JSON response")
    except Exception as e:
        raise HTTPException(500, f"Memo generation failed: {str(e)}")
