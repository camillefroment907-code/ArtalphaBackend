"""Market Sentiment — Bull/Bear/Neutral by segment."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from datetime import datetime, timedelta

from app.database import get_db
from app.models.db_models import Lot

router = APIRouter(prefix="/market", tags=["market"])

_sentiment_cache: dict = {"data": None, "generated_at": None}
CACHE_MINUTES = 30

@router.get("/sentiment")
async def get_market_sentiment(db: AsyncSession = Depends(get_db)):
    """Market sentiment by category — cached 30 min."""

    now = datetime.utcnow()
    if _sentiment_cache["data"] and _sentiment_cache["generated_at"]:
        age = (now - _sentiment_cache["generated_at"]).total_seconds() / 60
        if age < CACHE_MINUTES:
            return _sentiment_cache["data"]

    since_30d = now - timedelta(days=30)
    since_7d = now - timedelta(days=7)

    SEGMENTS = [
        ("Paintings", ["painting", "peinture", "oil", "acrylic", "huile", "canvas", "toile"]),
        ("Prints & Multiples", ["print", "gravure", "lithograph", "etching", "sérigraphie", "edition", "multiple"]),
        ("Photography", ["photo", "photograph", "tirage"]),
        ("Sculpture", ["sculpture", "bronze", "ceramic", "céramique", "statue"]),
        ("Drawings", ["drawing", "dessin", "crayon", "ink", "encre", "pastel"]),
        ("Contemporary", ["contemporary", "contemporain", "modern", "moderne"]),
    ]

    sentiments = []

    for segment_name, keywords in SEGMENTS:
        # Match against both category and medium to handle null category
        keyword_filters = or_(
            *[Lot.category.ilike(f"%{kw}%") for kw in keywords],
            *[Lot.medium.ilike(f"%{kw}%") for kw in keywords],
        )

        # Include lots with null created_at (treat as recent)
        date_filter_30d = or_(
            Lot.created_at >= since_30d,
            Lot.created_at.is_(None),
        )
        date_filter_7d = or_(
            Lot.created_at >= since_7d,
            Lot.created_at.is_(None),
        )

        total_result = await db.execute(
            select(func.count(Lot.id)).where(
                and_(keyword_filters, date_filter_30d)
            )
        )
        total = total_result.scalar() or 0

        recent_result = await db.execute(
            select(func.count(Lot.id)).where(
                and_(keyword_filters, date_filter_7d)
            )
        )
        recent = recent_result.scalar() or 0

        score_result = await db.execute(
            select(func.avg(Lot.deal_score)).where(
                and_(keyword_filters, date_filter_30d, Lot.deal_score.isnot(None))
            )
        )
        avg_score = round(score_result.scalar() or 0, 1)

        if total == 0:
            sentiment = "NEUTRAL"
            change = 0.0
        else:
            weekly_rate = recent / 7
            monthly_rate = total / 30
            change = round(((weekly_rate - monthly_rate) / monthly_rate * 100) if monthly_rate > 0 else 0, 1)

            if avg_score >= 70 and change > 5:
                sentiment = "BULLISH"
            elif avg_score < 50 or change < -10:
                sentiment = "BEARISH"
            else:
                sentiment = "NEUTRAL"

        if total > 0:
            sentiments.append({
                "segment": segment_name,
                "sentiment": sentiment,
                "avg_score": avg_score,
                "total_lots_30d": total,
                "new_lots_7d": recent,
                "momentum_change": change,
            })

    if sentiments:
        bullish = sum(1 for s in sentiments if s["sentiment"] == "BULLISH")
        bearish = sum(1 for s in sentiments if s["sentiment"] == "BEARISH")
        overall = "BULLISH" if bullish > bearish + 1 else "BEARISH" if bearish > bullish + 1 else "NEUTRAL"
        overall_score = round(sum(s["avg_score"] for s in sentiments) / len(sentiments), 1)
    else:
        overall = "NEUTRAL"
        overall_score = 0.0

    result = {
        "overall": overall,
        "overall_score": overall_score,
        "segments": sorted(sentiments, key=lambda x: x["avg_score"], reverse=True),
        "generated_at": now.isoformat(),
        "next_update": (now + timedelta(minutes=CACHE_MINUTES)).isoformat(),
    }

    _sentiment_cache["data"] = result
    _sentiment_cache["generated_at"] = now

    return result


@router.get("/index")
async def get_market_index(db: AsyncSession = Depends(get_db)):
    """
    The Nautilus Art Market Index — weekly publication.
    A single number 0-100 representing overall art market health.
    Cached 30 minutes.
    """
    from app.utils.cache import get_cached, set_cached
    from app.api.lots import lot_to_list_dict

    cache_key = "nautilus_market_index"
    cached = get_cached(cache_key, ttl=1800)
    if cached:
        return cached

    now = datetime.utcnow()
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)
    prev_month = now - timedelta(days=60)

    # Current month stats
    curr = await db.execute(
        select(
            func.count(Lot.id).label("total"),
            func.avg(Lot.deal_score).label("avg_score"),
            func.count(Lot.id).filter(Lot.deal_score >= 80).label("exceptional"),
            func.avg(Lot.current_price).label("avg_price"),
        ).where(Lot.created_at >= month_ago)
    )
    curr_stats = curr.first()

    # Previous month stats (for trend)
    prev = await db.execute(
        select(
            func.count(Lot.id).label("total"),
            func.avg(Lot.deal_score).label("avg_score"),
        ).where(
            and_(Lot.created_at >= prev_month, Lot.created_at < month_ago)
        )
    )
    prev_stats = prev.first()

    # Weekly stats
    week = await db.execute(
        select(
            func.count(Lot.id).label("total"),
            func.avg(Lot.deal_score).label("avg_score"),
            func.count(Lot.id).filter(Lot.deal_score >= 80).label("exceptional"),
        ).where(Lot.created_at >= week_ago)
    )
    week_stats = week.first()

    # Calculate index score 0-100
    curr_score = float(curr_stats.avg_score or 0)
    prev_score = float(prev_stats.avg_score or 0)
    trend = ((curr_score - prev_score) / prev_score * 100) if prev_score > 0 else 0

    index_score = round(
        (curr_score * 0.6) +
        (min(float(curr_stats.exceptional or 0) / max(float(curr_stats.total or 1), 1) * 100, 100) * 0.2) +
        (min(50 + trend, 100) * 0.2)
    , 1)

    if index_score >= 70:
        sentiment = "BULLISH"
        sentiment_label = "Strong buying conditions"
        color = "#2563EB"
    elif index_score >= 55:
        sentiment = "NEUTRAL"
        sentiment_label = "Stable market conditions"
        color = "#64748B"
    else:
        sentiment = "BEARISH"
        sentiment_label = "Cautious market conditions"
        color = "#EF4444"

    # Top 5 lots of the week
    top_lots_result = await db.execute(
        select(Lot)
        .where(and_(Lot.deal_score >= 75, Lot.created_at >= week_ago))
        .order_by(Lot.deal_score.desc())
        .limit(5)
    )
    top_lots = top_lots_result.scalars().all()

    commentary = await _generate_index_commentary(
        index_score, sentiment, curr_stats, trend, top_lots
    )

    response = {
        "index": {
            "score": index_score,
            "sentiment": sentiment,
            "sentiment_label": sentiment_label,
            "color": color,
            "trend": round(trend, 1),
            "trend_direction": "up" if trend > 0 else "down" if trend < 0 else "stable",
        },
        "week": {
            "lots_analyzed": int(week_stats.total or 0),
            "avg_score": round(float(week_stats.avg_score or 0), 1),
            "exceptional_count": int(week_stats.exceptional or 0),
            "week_of": now.strftime("%B %d, %Y"),
        },
        "month": {
            "lots_analyzed": int(curr_stats.total or 0),
            "avg_score": round(float(curr_stats.avg_score or 0), 1),
            "exceptional_count": int(curr_stats.exceptional or 0),
        },
        "top_lots": [lot_to_list_dict(l) for l in top_lots],
        "commentary": commentary,
        "generated_at": now.isoformat(),
        "next_update": (now + timedelta(minutes=30)).isoformat(),
    }

    set_cached(cache_key, response)
    return response


async def _generate_index_commentary(
    index_score: float,
    sentiment: str,
    stats,
    trend: float,
    top_lots: list,
) -> str:
    """Generate weekly AI commentary for the index."""
    try:
        from openai import AsyncOpenAI
        from app.utils.openai_guard import can_make_request, record_request
        from app.config import get_settings
        settings = get_settings()

        if not settings.openai_api_key or not can_make_request():
            return _fallback_commentary(index_score, sentiment, stats)

        top_artists = list(set(
            l.artist_name_raw for l in top_lots if l.artist_name_raw
        ))[:3]

        client = AsyncOpenAI(api_key=settings.openai_api_key)
        prompt = f"""You are the chief market analyst at Nautilus, an art investment intelligence platform.

Write a 2-sentence weekly market commentary for the Nautilus Art Market Index.

DATA:
- Index score: {index_score}/100 ({sentiment})
- Monthly trend: {'+' if trend >= 0 else ''}{trend:.1f}%
- Lots analyzed: {int(stats.total or 0)}
- Exceptional opportunities: {int(stats.exceptional or 0)}
- Top artists: {', '.join(top_artists) if top_artists else 'Various'}

Style: Bloomberg Terminal meets luxury art. Precise, authoritative, data-driven. No fluff.
End with one actionable insight for collectors."""

        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=150,
            temperature=0.3,
        )
        record_request()
        return response.choices[0].message.content.strip()
    except Exception:
        return _fallback_commentary(index_score, sentiment, stats)


def _fallback_commentary(index_score: float, sentiment: str, stats) -> str:
    trend_word = "rising" if index_score >= 65 else "stable" if index_score >= 50 else "cautious"
    return f"The Nautilus Art Market Index registers {index_score}/100 this week, reflecting {trend_word} market conditions across {int(stats.total or 0)} analyzed lots. Collectors should focus on high-conviction opportunities scoring above 75."
