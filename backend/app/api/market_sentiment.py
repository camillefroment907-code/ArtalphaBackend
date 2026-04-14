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
        ("Paintings", ["painting", "peinture", "oil", "acrylic", "huile"]),
        ("Prints & Multiples", ["print", "gravure", "lithograph", "etching", "sérigraphie"]),
        ("Photography", ["photo", "photograph"]),
        ("Sculpture", ["sculpture", "bronze", "ceramic"]),
        ("Drawings", ["drawing", "dessin", "crayon", "ink"]),
        ("Contemporary", ["contemporary", "contemporain"]),
    ]

    sentiments = []

    for segment_name, keywords in SEGMENTS:
        keyword_filters = or_(*[
            Lot.category.ilike(f"%{kw}%") for kw in keywords
        ])

        total_result = await db.execute(
            select(func.count(Lot.id)).where(
                and_(keyword_filters, Lot.created_at >= since_30d)
            )
        )
        total = total_result.scalar() or 0

        recent_result = await db.execute(
            select(func.count(Lot.id)).where(
                and_(keyword_filters, Lot.created_at >= since_7d)
            )
        )
        recent = recent_result.scalar() or 0

        score_result = await db.execute(
            select(func.avg(Lot.deal_score)).where(
                and_(keyword_filters, Lot.created_at >= since_30d, Lot.deal_score.isnot(None))
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
