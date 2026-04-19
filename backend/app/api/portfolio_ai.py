"""
Portfolio AI Optimizer — Nautilus
Analyzes user portfolio with per-artwork context and generates data-grounded recommendations.
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


def _holding_period(purchase_date) -> str:
    if not purchase_date:
        return "unknown"
    days = (datetime.utcnow().date() - purchase_date).days if hasattr(purchase_date, 'days') else (datetime.utcnow() - purchase_date).days
    if days < 90:
        return f"{days} days"
    elif days < 365:
        return f"{days // 30} months"
    else:
        return f"{days // 365} year(s) {(days % 365) // 30} months"


def _pnl(item: PortfolioItem) -> tuple[float | None, float | None]:
    """Returns (absolute_pnl_eur, pct_pnl)"""
    cost = item.purchase_price_eur
    current = item.estimated_current_value_eur
    if not cost or not current:
        return None, None
    pnl = current - cost
    pct = (pnl / cost) * 100
    return round(pnl, 0), round(pct, 1)


@router.post("/analyze")
async def analyze_portfolio(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """AI portfolio analysis — Investor+ only."""

    plan = await _get_user_plan(current_user, db)
    if plan in ("free", "starter"):
        raise HTTPException(403, "Portfolio AI analysis requires the Investor plan (€29/month).")

    cache_key = str(current_user.id)
    if cache_key in _analysis_cache:
        cached = _analysis_cache[cache_key]
        age_hours = (datetime.utcnow() - cached["generated_at"]).total_seconds() / 3600
        if age_hours < CACHE_HOURS:
            return cached["analysis"]

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

    # ── Portfolio-level metrics ──────────────────────────────────────────────

    total_invested = sum(i.purchase_price_eur or 0 for i in items)
    total_value = sum(i.estimated_current_value_eur or i.purchase_price_eur or 0 for i in items)
    total_pnl = total_value - total_invested
    total_pnl_pct = (total_pnl / total_invested * 100) if total_invested > 0 else 0

    artists: dict[str, list] = {}
    mediums: dict[str, int] = {}
    price_buckets = {"<5K": 0, "5K-25K": 0, "25K-100K": 0, ">100K": 0}

    for item in items:
        name = item.artist_name or "Unknown"
        artists.setdefault(name, []).append(item)
        if item.medium:
            mediums[item.medium] = mediums.get(item.medium, 0) + 1
        price = item.purchase_price_eur or 0
        if price < 5000:
            price_buckets["<5K"] += 1
        elif price < 25000:
            price_buckets["5K-25K"] += 1
        elif price < 100000:
            price_buckets["25K-100K"] += 1
        else:
            price_buckets[">100K"] += 1

    # Concentration: what % of total value is the largest artist holding
    artist_values = {
        name: sum(i.estimated_current_value_eur or i.purchase_price_eur or 0 for i in artist_items)
        for name, artist_items in artists.items()
    }
    top_artist = max(artist_values, key=lambda k: artist_values[k]) if artist_values else "Unknown"
    top_artist_pct = round(artist_values.get(top_artist, 0) / total_value * 100) if total_value > 0 else 0

    # ── Per-artwork context for the prompt ───────────────────────────────────

    artwork_lines = []
    for i, item in enumerate(items, 1):
        cost = item.purchase_price_eur
        current = item.estimated_current_value_eur or cost
        pnl_abs, pnl_pct = _pnl(item)

        pnl_str = ""
        if pnl_abs is not None:
            sign = "+" if pnl_abs >= 0 else ""
            pnl_str = f"  P&L: {sign}€{pnl_abs:,.0f} ({sign}{pnl_pct}%)"

        holding = _holding_period(item.purchase_date) if item.purchase_date else "unknown"

        line = (
            f"  {i}. Artist: {item.artist_name or 'Unknown'} | Title: {item.title or 'Untitled'}"
            f" | Medium: {item.medium or 'n/a'}"
            f" | Acquired: €{cost:,.0f}" if cost else f"  {i}. {item.artist_name or 'Unknown'} — {item.title or 'Untitled'}"
        )
        if cost:
            line += f" | Acquired: €{cost:,.0f}"
        if current and current != cost:
            line += f" | Est. current: €{current:,.0f}"
        if pnl_str:
            line += pnl_str
        if holding != "unknown":
            line += f" | Held: {holding}"
        artwork_lines.append(line)

    artworks_block = "\n".join(artwork_lines)

    # ── Build the prompt ─────────────────────────────────────────────────────

    prompt = f"""You are a senior art investment analyst at a Paris-based family office managing €50M+ in art assets.
Analyze this private collection and produce a precise, actionable investment report.

DO NOT be vague. Reference specific artworks and artists by name. Use your knowledge of the art market to assess each artist's market position, liquidity, and trajectory.

COLLECTION ({len(items)} works):
{artworks_block}

PORTFOLIO SUMMARY:
- Total invested: €{total_invested:,.0f}
- Current estimated value: €{total_value:,.0f}
- Overall P&L: {'+' if total_pnl >= 0 else ''}€{total_pnl:,.0f} ({'+' if total_pnl_pct >= 0 else ''}{total_pnl_pct:.1f}%)
- Unique artists: {len(artists)}
- Top concentration: {top_artist} = {top_artist_pct}% of total value
- Mediums: {json.dumps(mediums)}
- Price distribution: {json.dumps(price_buckets)}

INSTRUCTIONS:
For each artwork in the "artwork_insights" array, give:
- A specific verdict on the artist's current market standing (blue chip / emerging / declining / illiquid)
- Whether the acquisition price was good, fair, or expensive for the artist
- Current liquidity (how quickly could it sell at auction, and at what estimated range)
- A specific forward view (hold / sell / opportunistic sell)

For the portfolio-level analysis, be specific: mention artist names in strengths and risks.

Return STRICT JSON (no markdown):
{{
  "score": <0-100 portfolio quality score>,
  "verdict": "<EXCELLENT|GOOD|NEEDS_ATTENTION|AT_RISK>",
  "summary": "<3-4 sentences. Name specific artists. Be direct about what works and what doesn't.>",
  "strengths": ["<mention specific artists or works>", "<second strength>"],
  "risks": ["<specific risk — name the artist or concentration>", "<second risk>"],
  "artwork_insights": [
    {{
      "artist": "<artist name>",
      "title": "<title>",
      "market_standing": "<blue chip|established|emerging|declining|illiquid>",
      "acquisition_assessment": "<cheap|fair|expensive>",
      "liquidity": "<high|medium|low>",
      "estimated_auction_range": "<e.g. €3,000–8,000 or 'insufficient data'>",
      "outlook": "<hold|sell|opportunistic sell|accumulate>",
      "commentary": "<1-2 specific sentences about this artist's market right now>"
    }}
  ],
  "recommendations": [
    {{
      "priority": "<HIGH|MEDIUM|LOW>",
      "action": "<concrete action — name the artist or work>",
      "rationale": "<1-2 sentences with market context>"
    }}
  ],
  "diversification_score": <0-100>,
  "liquidity_score": <0-100>,
  "growth_potential": <0-100>,
  "risk_level": "<LOW|MODERATE|HIGH|VERY HIGH>"
}}"""

    try:
        from openai import AsyncOpenAI
        from app.utils.openai_guard import can_make_request, record_request

        if not can_make_request():
            raise HTTPException(503, "AI service temporarily at capacity. Try again in a few hours.")

        client = AsyncOpenAI(api_key=settings.openai_api_key)
        response = await client.chat.completions.create(
            model="gpt-4o",  # upgraded from mini — portfolio analysis warrants full model
            messages=[
                {
                    "role": "system",
                    "content": "You are a senior art investment analyst. Be specific, name-drop artists, reference market realities. Never be generic. Your analysis must be actionable."
                },
                {"role": "user", "content": prompt}
            ],
            max_tokens=1800,
            temperature=0.2,
            response_format={"type": "json_object"},
        )
        record_request()

        raw = response.choices[0].message.content.strip()
        analysis_data = json.loads(raw)

        analysis = {
            "locked": False,
            "insufficient_data": False,
            "items_count": len(items),
            "total_value": round(total_value),
            "total_invested": round(total_invested),
            "total_pnl": round(total_pnl),
            "total_pnl_pct": round(total_pnl_pct, 1),
            "generated_at": datetime.utcnow().isoformat(),
            **analysis_data,
        }

        _analysis_cache[cache_key] = {
            "analysis": analysis,
            "generated_at": datetime.utcnow(),
        }

        return analysis

    except json.JSONDecodeError:
        raise HTTPException(500, "Analysis generation failed — invalid JSON response.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Analysis failed: {str(e)}")
