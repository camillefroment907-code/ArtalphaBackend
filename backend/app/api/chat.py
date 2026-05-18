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
from app.utils.openai_guard import can_make_request, record_request
from app.utils.plan_utils import get_user_plan
from app.models.db_models import (
    User, ChatMessage, Lot, PortfolioItem,
    UserPreference, Subscription, SubscriptionStatus,
)
from app.services.web_intelligence import query_web_intelligence, needs_web_search

router = APIRouter(prefix="/chat", tags=["chat"])
logger = structlog.get_logger(__name__)
_settings = get_settings()

CHAT_LIMITS: dict[str, int] = {
    "free":          3,        # 3 lifetime messages (trial)
    "starter":       10,       # Collector €9 — 10/month
    "investor":      20,       # €29 — 20/month
    "pro":           99999,    # Family Office — unlimited
    "institutional": 99999,    # unlimited
    "expert":        99999,
}

LARRY_SYSTEM_PROMPT = """You are Larry, a senior art market analyst with 25 years of experience across Christie's, Sotheby's, Phillips, and Drouot. You work exclusively for Nautilus members.

## YOUR EXPERTISE
- Auction market analysis: price trends, hammer rates, buy-in rates, seasonal patterns
- Artist market intelligence: career trajectories, gallery representation, institutional demand
- Investment strategy: portfolio construction, timing, liquidity management for art assets
- Deal identification: spotting undervalued works before the market corrects
- Art history: Renaissance to NFT, Impressionism, Modernism, Surrealism, Abstract Expressionism, Pop Art, Street Art, Ultra-contemporary
- Major auction houses: Christie's, Sotheby's, Bonhams, Phillips, Drouot, Artcurial, Invaluable, LiveAuctioneers
- Market indices: Artprice, Mei Moses, AMR, Artnet
- Major collectors and dealers: Gagosian, Pinault, Arnault, Saatchi, Zwirner, Hauser & Wirth
- Emerging markets: Southeast Asia, Africa, Latin America

## YOUR PERSONALITY
- Direct and confident — you give specific recommendations, not vague suggestions
- Data-driven — you cite specific prices, percentages, auction results when relevant
- Expert but accessible — you explain complex market dynamics clearly
- Never generic — every answer references specific artists, auction houses, or market data
- Structured responses: 6-10 lines. If the user wants more, they ask "tell me more"

## WHEN A USER ASKS ABOUT A LOT OR ARTIST
- Always mention the current market context
- Give a specific verdict (buy / watch / pass) when appropriate
- Reference comparable sales if relevant
- Mention timing considerations (upcoming sales, seasonal patterns)

## ANTI-HALLUCINATION RULES
1. Never cite a lot or artwork that is not in the CURRENT OPPORTUNITIES context below
2. When recommending a specific work, use ONLY lots from the context with their exact ID and URL
3. If no matching lot in context → say so clearly: "I don't have a matching lot right now, but here's what I'd look for..."
4. Never invent artist names, titles, prices, or figures
5. Always include the URL when mentioning a lot: "See here: [url]"

## WHEN YOU DON'T HAVE SPECIFIC DATA
Say so clearly: "I don't have the latest hammer prices for this artist, but based on market patterns..."
Never invent specific numbers.

## RESPONSE STRUCTURE
1. Quick read of the situation
2. 2-3 key points with concrete market insights
3. Clear, actionable recommendation

## EXAMPLE OF EXPECTED QUALITY
Question: "How to start investing in art with €20,000?"
Expected answer:
"Three smart entry points at that budget:

**€5K-10K per work**: Photography by established names in numbered editions — Gursky, Wall, Sherman. Correct liquidity, accessible entry. Signed prints from artists with gallery representation at Perrotin or Templon.

**€10K-20K per work**: Young artists in serious gallery programs (not just online). Look for institutional residencies — that's a strong signal. Drouot regularly surfaces these at conservative estimates.

**Timing**: Spring sales (May) and autumn (November) are peak seasons. Buy in the quieter windows — July and January — when competition drops.

Golden rule: never buy what you don't understand. The art you love, you'll hold long enough for it to appreciate.

Current opportunities → https://get-nautilus.com/app/explore?tab=best"

## NAUTILUS LINKS — ALWAYS INCLUDE
When you reference a specific lot, artist, or platform page, always include the direct Nautilus URL as a clickable link.

URL patterns:
- Specific lot: https://www.get-nautilus.com/app/lot/{lot_id}
- Artist search: https://www.get-nautilus.com/app/artists?search={artist_name_url_encoded}
- Best lots: https://www.get-nautilus.com/app/explore?tab=best
- Opportunities for user: https://www.get-nautilus.com/app/explore?tab=for-you
- Primary market: https://www.get-nautilus.com/app/explore?tab=primary
- My agent: https://www.get-nautilus.com/app/agent
- My portfolio: https://www.get-nautilus.com/app/portfolio
- Pricing: https://www.get-nautilus.com/app/pricing

URL formatting rules:
- Always put the URL on a new line starting with "→"
- If referencing multiple lots: list each with its own "→" URL line
- If no specific lot ID is available: link to the Explorer filtered by artist
- For platform questions: link to the relevant page

Examples:
"This Chagall is priced 34% below comparable sales. Score 84/100. My recommendation: buy.
→ View this lot: https://www.get-nautilus.com/app/lot/12345"

"Zao Wou-Ki has strong momentum right now — 3 lots available above score 70.
→ See all Wou-Ki lots: https://www.get-nautilus.com/app/artists?search=Zao+Wou-Ki"

## PROACTIVE BEHAVIOR
When the user opens without a specific question, or says "hi", "hello", "what's new":
→ Don't respond generically
→ Open directly with a market opportunity or signal
→ Example: "I spotted a Zao Wou-Ki this morning at 28% below estimate at Drouot. 72 hours left. Want the analysis?"

## DOMAIN
Art investment only. Off-topic → "I focus exclusively on art and investment."

## LANGUAGE
Always respond in the language the user writes in. Default to English."""


LARRY_FAQ_CONTEXT = """
## NAUTILUS FAQ — use these answers for questions about how the platform works

ACCOUNT:
- Create account → get-nautilus.com/app/signup
- Sign in → get-nautilus.com/app/login
- Delete account → get-nautilus.com/app/portfolio (Danger Zone at the bottom)

SUBSCRIPTIONS:
- View plans → get-nautilus.com/app/pricing
- Collector €9/mo: 10 lots, basic alerts
- Investor €29/mo: unlimited lots, AI Agent 1 alert, Larry 30 msg/mo
- Family Office €99/mo: everything unlimited, AI Agent 5 alerts, Larry 200 msg/mo
- Institutional: custom, everything unlimited
- Upgrade: immediate with prorata → get-nautilus.com/app/pricing
- Downgrade: takes effect at next billing cycle
- Cancel → get-nautilus.com/app/portfolio section Subscription → Manage
- Failed payment → automatic email, Stripe retries, access temporarily maintained

OPPORTUNITIES:
- Main page → get-nautilus.com/app/explore?tab=best
- Updated every 15 minutes
- Deal Score 0-100: ≥80 EXCEPTIONAL, ≥65 STRONG, ≥45 INTERESTING
- Sources: Drouot, Invaluable, LiveAuctioneers, Sotheby's, Christie's, Bonhams, eBay, Artsy, Phillips, Artcurial

AI AGENT:
- Access → get-nautilus.com/app/agent
- Create alert: click "+ New Strategy"
- Investor: 1 alert | Family Office: 5 alerts | Institutional: unlimited
- Scans every 15 minutes
- Conviction score: ≥80 = high conviction

PORTFOLIO:
- Access → get-nautilus.com/app/portfolio
- Add artwork: click "+ Add an artwork"
- Stats: total invested, estimated value, return

ALERTS:
- Access → get-nautilus.com/app/alerts
- Types: Artist, Category, Price, Score
- Free: 1 | Collector: 5 | Investor: 20 | Family Office: unlimited

HOW THE DEAL SCORE WORKS:
The score (0-100) combines 5 factors: discount vs estimate, discount vs artist market average, artist liquidity, auction house reputation, and data completeness.
Above 65 = serious opportunity. Above 80 = exceptional.
"""


# ── Helpers ───────────────────────────────────────────────────────────────────


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
                    lines.append(f"Favorite artists: {', '.join(prefs.favorite_artists[:5])}")
                if prefs.categories:
                    lines.append(f"Preferred categories: {', '.join(prefs.categories[:5])}")
                if prefs.budget_max:
                    lines.append(f"Max budget per lot: €{prefs.budget_max:,.0f}")
                if getattr(prefs, 'investment_horizon', None):
                    lines.append(f"Investment horizon: {prefs.investment_horizon}")
                if getattr(prefs, 'collector_type', None):
                    lines.append(f"Collector profile: {prefs.collector_type}")
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
                lines.append("\nCURRENT OPPORTUNITIES (use ONLY these lots if you cite a specific work):")
                for lot in top_lots:
                    price = lot.current_price or lot.estimate_low or 0
                    ctx = f"- {lot.artist_name_raw or 'Unknown artist'} — {lot.title[:60] if lot.title else 'Untitled'}"
                    ctx += f" | Price: €{price:,.0f} | Score: {lot.deal_score:.0f}/100"
                    if lot.pct_below_low_estimate and lot.pct_below_low_estimate > 5:
                        ctx += f" | -{lot.pct_below_low_estimate:.0f}% below estimate"
                    ctx += f" | lot_id: {lot.id} | URL: https://www.get-nautilus.com/app/lot/{lot.id}"
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
                lines.append(f"\nPortfolio: {len(portfolio)} work(s), estimated value €{total_value:,.0f}")
                artists_in_portfolio = list({p.artist_name for p in portfolio if p.artist_name})[:5]
                if artists_in_portfolio:
                    lines.append(f"Artists in portfolio: {', '.join(artists_in_portfolio)}")
        except Exception:
            await session.rollback()

    if not lines:
        return ""
    return "\n\nUSER CONTEXT:\n" + "\n".join(lines)


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
        f"\n\nLOT BEING ANALYSED:\n"
        f"- Artist: {lot.artist_name_raw or 'Unknown'}\n"
        f"- Title: {lot.title or 'Untitled'}\n"
        f"- Category: {lot.category or 'Not specified'}\n"
        f"- Current price: €{price:,.0f}\n"
        f"- Low estimate: {est_low}\n"
        f"- High estimate: {est_high}\n"
        f"- Discount vs estimate: {upside:.0f}%\n"
        f"- Nautilus deal score: {deal_score}\n"
        f"- Auction house: {lot.auction_house_name or 'Unknown'}\n"
        f"- Sale date: {sale_date}\n"
        f"- Nautilus URL: https://www.get-nautilus.com/app/lot/{lot.id}"
    )


async def _stream_larry_response(
    messages: list,
    user_id,
    db_for_save,
) -> AsyncIterator[str]:
    from openai import AsyncOpenAI

    if not _settings.openai_api_key:
        yield f"data: {json.dumps({'error': 'Larry service temporarily unavailable.'})}\n\n"
        return

    if not can_make_request():
        yield f"data: {json.dumps({'error': 'Service temporarily unavailable — daily quota reached. Try again tomorrow.'})}\n\n"
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

        record_request()
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
        yield f"data: {json.dumps({'error': 'Error generating response. Please try again.'})}\n\n"


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
    plan = await get_user_plan(current_user, db)
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
    plan = await get_user_plan(current_user, db)
    if CHAT_LIMITS.get(plan, 3) == 0:
        raise HTTPException(403, "Larry is not available on your current plan.")

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
    plan = await get_user_plan(current_user, db)
    limit = CHAT_LIMITS.get(plan, 3)

    used = await _get_monthly_usage(current_user.id, db)
    if used >= limit:
        raise HTTPException(
            429,
            f"Monthly limit reached ({limit} messages). Resets on the 1st of each month.",
        )

    if not body.message.strip():
        raise HTTPException(400, "Message cannot be empty.")

    # Build system prompt with context
    user_context = await _get_user_context(current_user, db)
    lot_context = ""
    if body.lot_id:
        lot_context = await _get_lot_context(body.lot_id, db)

    system = LARRY_SYSTEM_PROMPT + "\n\n" + LARRY_FAQ_CONTEXT
    if user_context:
        system += f"\n\n{user_context}"
    system_content = system + lot_context

    # Inject real-time web intelligence when the question warrants it
    if needs_web_search(body.message):
        try:
            web_data = await query_web_intelligence(body.message)
            if web_data:
                system_content = (
                    f"REAL-TIME MARKET DATA (from web, as of today):\n{web_data}\n\n"
                    + system_content
                )
                logger.info("larry.web_intelligence_injected", user_id=str(current_user.id))
        except Exception as exc:
            logger.warning("larry.web_intelligence_error", error=str(exc))

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


@router.post("/dashboard-brief")
async def dashboard_brief(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Dashboard AI market brief — Collector+ only. Free users get a locked response."""
    plan = await get_user_plan(current_user, db)

    if plan == "free":
        return {
            "brief": None,
            "locked": True,
            "message": "Upgrade to Collector to unlock the AI Market Brief",
        }

    if not _settings.openai_api_key or not can_make_request():
        return {"brief": None, "locked": False, "message": "Brief temporarily unavailable"}

    try:
        from openai import AsyncOpenAI
        user_context = await _get_user_context(current_user, db)

        prompt = f"""Tu es Larry, expert en investissement art. Génère un brief de marché ultra-concis (3-4 phrases max) pour un investisseur qui ouvre son dashboard.

{user_context}

Format : 1 signal de marché fort + 1 opportunité concrète si disponible + 1 recommandation d'action.
Style : factuel, précis, ton premium. Commence directement sans introduction."""

        client = AsyncOpenAI(api_key=_settings.openai_api_key)
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=150,
            temperature=0.5,
        )
        record_request()
        brief = response.choices[0].message.content.strip()
        return {"brief": brief, "locked": False}

    except Exception as e:
        logger.warning("dashboard_brief_failed", error=str(e))
        return {"brief": None, "locked": False, "message": "Brief temporarily unavailable"}
