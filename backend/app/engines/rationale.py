"""
Score rationale generator — GPT-4o-mini.
Generates a 1-2 sentence investment rationale per lot at scoring time.
Stored in lots.score_rationale. Cost: ~$0.001/lot.
Only called for lots with deal_score >= 45 AND confidence_score >= 40.
"""
import logging
from typing import Optional
from app.config import get_settings
from app.utils.openai_guard import can_make_request, record_request

logger = logging.getLogger(__name__)
settings = get_settings()

# Hard cap per backfill cycle — avoids burning quota on bulk runs
MAX_RATIONALES_PER_CYCLE = 20


def _fmt(v: Optional[float]) -> str:
    if not v:
        return "unknown"
    if v >= 1_000_000:
        return f"€{v/1_000_000:.1f}M"
    if v >= 1_000:
        return f"€{v/1_000:.0f}K"
    return f"€{v:,.0f}"


async def generate_rationale(
    title: str,
    artist_name: str,
    current_price: Optional[float],
    estimate_low: Optional[float],
    estimate_high: Optional[float],
    deal_score: float,
    pct_below_estimate: Optional[float],
    pct_below_market: Optional[float],
    artist_avg_price: Optional[float],
    artist_liquidity: Optional[float],
    auction_house: Optional[str],
    category: Optional[str],
    lang: str = "fr",
) -> Optional[str]:
    """
    Generate a concise investment rationale using GPT-4o-mini.
    Returns 1-2 sentences max. Returns None if OpenAI not configured.
    """
    if not settings.openai_api_key:
        return None

    if not can_make_request():
        logger.warning("rationale_skipped_quota_exceeded")
        return None

    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=settings.openai_api_key)

        price_str = _fmt(current_price or estimate_low)
        estimate_str = f"{_fmt(estimate_low)}–{_fmt(estimate_high)}" if estimate_low else "unknown"
        market_str = _fmt(artist_avg_price) if artist_avg_price else "unknown"

        signals = []
        if pct_below_estimate and pct_below_estimate > 10:
            signals.append(f"{pct_below_estimate:.0f}% below auction estimate")
        if pct_below_market and pct_below_market > 10:
            signals.append(f"{pct_below_market:.0f}% below artist's market average ({market_str})")
        if artist_liquidity and artist_liquidity > 70:
            signals.append("high-liquidity artist")
        if artist_liquidity and artist_liquidity < 30:
            signals.append("niche artist — higher risk, higher reward")

        if not signals:
            signals.append(f"deal score {deal_score:.0f}/100")

        if lang == "fr":
            prompt = f"""Tu es un expert en investissement art. Génère UNE phrase de justification concise (max 20 mots) pour cette opportunité d'enchère.

Lot: {artist_name} — {title}
Prix actuel: {price_str} | Estimation: {estimate_str}
Signaux: {', '.join(signals)}
Maison: {auction_house or 'unknown'} | Catégorie: {category or 'unknown'}

Réponds UNIQUEMENT avec la phrase de justification, sans guillemets, sans introduction.
Style: factuel, précis, vocabulaire financier. Ex: "Décote de 28% par rapport à la moyenne marché — artiste liquide avec forte demande institutionnelle."
"""
        else:
            prompt = f"""You are an art investment expert. Generate ONE concise justification sentence (max 20 words) for this auction opportunity.

Lot: {artist_name} — {title}
Current price: {price_str} | Estimate: {estimate_str}
Signals: {', '.join(signals)}
House: {auction_house or 'unknown'} | Category: {category or 'unknown'}

Reply with ONLY the justification sentence, no quotes, no introduction.
Style: factual, precise, financial vocabulary. Ex: "28% below market average — liquid artist with strong institutional demand."
"""

        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=60,
            temperature=0.3,
        )

        record_request()
        rationale = response.choices[0].message.content.strip()
        # Clean up any quotes
        rationale = rationale.strip('"\'')
        logger.debug("rationale_generated artist=%s rationale=%s", artist_name, rationale)
        return rationale

    except Exception as e:
        logger.warning("rationale_generation_failed error=%s", str(e))
        return None
