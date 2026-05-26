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
from app.models.db_models import User, Lot
from app.config import get_settings
from app.utils.plan_utils import get_user_plan

router = APIRouter(prefix="/memo", tags=["memo"])
settings = get_settings()

# In-memory cache: lot_id → {memo, generated_at}
_memo_cache: dict = {}
CACHE_HOURS = 24


@router.post("/{lot_id}")
async def generate_investment_memo(
    lot_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate institutional investment memo for a lot. Investor+ only."""

    # Plan check
    plan = await get_user_plan(current_user, db)
    BLOCKED_PLANS = ("free", "starter")
    if plan in BLOCKED_PLANS:
        raise HTTPException(
            403,
            "Investment memos are available from the Investor plan (€19/month)."
        )

    if not settings.anthropic_api_key:
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

    prompt = f"""Tu es un conseiller en art senior — pas un banquier,
un vrai advisor qui protège son client et réduit l'incertitude.
Tu génères un mémo d'investissement clair, honnête et premium
pour un collectionneur intelligent non-expert.

Ton style : éditorial, nuancé, jamais "to the moon".
Tu donnes un jugement humain, pas une analyse machine.
Tu dis aussi pourquoi NE PAS acheter. Tout en français.

DONNÉES DU LOT:
- Artiste: {artist}
- Titre: {title}
- Maison de vente: {house}
- Médium: {medium}
- Mise à prix: {fmt(price)}
- Estimation basse: {fmt(est_low)}
- Estimation haute: {fmt(est_high)}
- Décote vs estimation: {upside:.0f}%
- Score Nautilus: {score:.0f}/100

RÈGLES STRICTES:
- target_price.low et target_price.high différents (écart min 20%)
- Pas de CAGR, IRR, projections sur 10+ ans
- Pas de pourcentages de revalorisation > 100%
- conviction max 70 si upside > 80%
- recommendation "ACHETER" seulement si conviction >= 65
- hook : phrase éditoriale, pas analytique.
  Exemples corrects :
  "Rare à ce niveau de prix pour cet artiste."
  "Point d'entrée inhabituellement attractif sur ce format."
  Exemples incorrects :
  "Prix inférieur de 34% à la moyenne."
  "Décote de 62% observée."
- Tous les textes en français

FORMAT JSON strict, aucun markdown:
{{
  "hook": "1 phrase éditoriale — pourquoi CE lot mérite attention",
  "prix_justifie": "1-2 phrases — prix justifié par le marché ?",
  "liquidite": "1-2 phrases — pourra-t-on revendre ?",
  "timing": "1 phrase — est-ce le bon moment ?",
  "prudence": ["vigilance 1", "vigilance 2", "vigilance 3"],
  "advisor_verdict": {{
    "action": "Acheter si prix final ≤ X€ / Passer au-dessus de Y€",
    "horizon": "X-Y ans",
    "rationale": "1 phrase de conclusion"
  }},
  "recommendation": "ACHETER" | "INTÉRESSANT" | "PASSER",
  "conviction": number_0_to_100,
  "target_price": {{"low": number_euros, "high": number_euros}}
}}

Réponds UNIQUEMENT avec le JSON, aucun texte avant ou après."""

    try:
        from anthropic import AsyncAnthropic
        client = AsyncAnthropic(api_key=settings.anthropic_api_key)

        message = await client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=1024,
            temperature=0.3,
            messages=[{"role": "user", "content": prompt}],
        )

        raw = message.content[0].text.strip()
        # Strip markdown code fences if Claude wraps JSON in them
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()
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
            "generated_by": "Nautilus Intelligence",
            "hook":           memo_data.get("hook"),
            "prix_justifie":  memo_data.get("prix_justifie"),
            "liquidite":      memo_data.get("liquidite"),
            "timing":         memo_data.get("timing"),
            "prudence":       memo_data.get("prudence"),
            "advisor_verdict": memo_data.get("advisor_verdict"),
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
