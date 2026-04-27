"""
Nautilus Oracle — predictive artist intelligence engine.

Computes oracle_score_6m / oracle_score_18m from market signals
extracted from the lots table, then generates an AI narrative
via OpenAI and upserts the result into artist_signals.
"""
import statistics
from datetime import datetime, timedelta
from typing import Optional
import structlog

logger = structlog.get_logger(__name__)

_NARRATIVE_PROMPT = """You are Nautilus Oracle, an elite art investment AI.
Given the following market signals for an artist, write 2-3 sentences of investment
intelligence for a serious collector. Be data-driven, specific, and precise.
Max 60 words. Formal tone.

Artist: {artist_name}
Oracle signal: {signal}
6-month score: {score_6m}/100
Active market signals:
{signals_text}

Write the narrative now:"""


def _median(values: list[float]) -> Optional[float]:
    if not values:
        return None
    return statistics.median(values)


def _compute_buyer_concentration(lots: list) -> float:
    """
    Proxy buyer concentration using auction-house repeat occurrence.
    (True buyer data not available — source is a reasonable proxy.)
    ratio = repeat sources / total lots
    """
    if not lots:
        return 0.0
    source_counts: dict = {}
    for lot in lots:
        src = str(lot.source.value if hasattr(lot.source, "value") else lot.source)
        source_counts[src] = source_counts.get(src, 0) + 1
    repeat_sources = sum(1 for c in source_counts.values() if c > 1)
    return repeat_sources / max(len(source_counts), 1)


async def _generate_narrative(
    artist_name: str,
    signal: str,
    score_6m: float,
    active_signals: list[str],
    settings,
) -> Optional[str]:
    if not settings.openai_api_key:
        return None
    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=settings.openai_api_key)
        signals_text = "\n".join(f"- {s}" for s in active_signals) or "- No strong signals"
        prompt = _NARRATIVE_PROMPT.format(
            artist_name=artist_name,
            signal=signal,
            score_6m=round(score_6m, 1),
            signals_text=signals_text,
        )
        resp = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=120,
            temperature=0.4,
        )
        text = resp.choices[0].message.content or ""
        return text.strip() or None
    except Exception as exc:
        logger.warning("oracle.narrative_failed", error=str(exc))
        return None


async def compute_oracle(artist_id: str, db) -> Optional[dict]:
    """
    Compute Oracle signals for a single artist and upsert into artist_signals.
    Returns the result dict, or None if insufficient data.
    """
    from sqlalchemy import select, and_
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    from app.models.db_models import Artist, Lot, LotStatus, ArtistSignal
    from app.config import get_settings

    settings = get_settings()
    now = datetime.utcnow()
    cutoff_90d  = now - timedelta(days=90)
    cutoff_180d = now - timedelta(days=180)
    cutoff_30d  = now - timedelta(days=30)

    # 1. Fetch artist name
    artist_result = await db.execute(select(Artist).where(Artist.id == artist_id))
    artist = artist_result.scalars().first()
    if not artist:
        return None

    # 2. Fetch lots for this artist last 180 days
    lots_result = await db.execute(
        select(Lot).where(
            and_(
                Lot.artist_id == artist_id,
                Lot.auction_date >= cutoff_180d,
            )
        )
    )
    all_lots = lots_result.scalars().all()

    if len(all_lots) < 3:
        logger.debug("oracle.skipped_insufficient_data", artist_id=artist_id, lots=len(all_lots))
        return None

    # Split into periods
    recent_lots = [l for l in all_lots if l.auction_date and l.auction_date >= cutoff_90d]
    prior_lots  = [l for l in all_lots if l.auction_date and l.auction_date < cutoff_90d]
    lots_30d    = [l for l in all_lots if l.auction_date and l.auction_date >= cutoff_30d]

    # 3. Compute market signals
    vol_30d  = len(lots_30d)
    vol_90d  = len(recent_lots)
    vol_180d = len(all_lots)

    vol_growth_ratio = vol_90d / max(len(prior_lots), 1)

    recent_prices = [l.current_price or l.estimate_low for l in recent_lots if (l.current_price or l.estimate_low)]
    prior_prices  = [l.current_price or l.estimate_low for l in prior_lots  if (l.current_price or l.estimate_low)]

    price_median_90d  = _median(recent_prices)
    price_median_180d = _median([l.current_price or l.estimate_low for l in all_lots if (l.current_price or l.estimate_low)])

    if price_median_90d and prior_prices:
        price_growth_ratio = price_median_90d / max(_median(prior_prices) or 1, 1)
    else:
        price_growth_ratio = 1.0

    unsold_recent = [l for l in recent_lots if l.status == LotStatus.UNSOLD]
    unsold_rate_90d = len(unsold_recent) / max(len(recent_lots), 1)

    buyer_concentration = _compute_buyer_concentration(recent_lots)
    repeat_buyer = buyer_concentration > 0.4

    # 4. Oracle score
    base_score = (
        min(vol_growth_ratio, 3.0) / 3.0 * 30 +
        min(price_growth_ratio, 2.0) / 2.0 * 25 +
        (1 - unsold_rate_90d) * 20 +
        (10 if repeat_buyer else 0) +
        (buyer_concentration * 15)
    )
    oracle_score_6m  = min(base_score, 100.0)
    oracle_score_18m = min(base_score * 1.2, 100.0)
    confidence       = min(len(all_lots) / 20, 1.0)

    # 5. Signal
    if oracle_score_6m >= 75:
        signal = "BUY_NOW"
        window = "0-3 months"
        upside = "+40 to +90%"
    elif oracle_score_6m >= 55:
        signal = "WATCH"
        window = "3-6 months"
        upside = "+20 to +45%"
    elif oracle_score_6m >= 35:
        signal = "HOLD"
        window = "6-12 months"
        upside = "+10 to +25%"
    else:
        signal = "AVOID"
        window = "N/A"
        upside = "N/A"

    # 6. Active signals
    active_signals: list[str] = []
    if vol_growth_ratio > 1.5:
        active_signals.append(f"Volume +{int((vol_growth_ratio - 1) * 100)}% over 90 days")
    if price_growth_ratio > 1.2:
        active_signals.append(f"Price trend +{int((price_growth_ratio - 1) * 100)}% over 90 days")
    if repeat_buyer:
        active_signals.append("Repeat buyer detected — possible accumulation")
    if unsold_rate_90d < 0.1:
        active_signals.append("Near-zero unsold rate — strong demand")
    if buyer_concentration > 0.5:
        active_signals.append("High buyer concentration — market maker signal")
    if vol_30d >= 3:
        active_signals.append(f"{vol_30d} lots in the past 30 days — accelerating activity")

    # 7. AI narrative (non-blocking)
    narrative = await _generate_narrative(
        artist_name=artist.name,
        signal=signal,
        score_6m=oracle_score_6m,
        active_signals=active_signals,
        settings=settings,
    )

    result = {
        "artist_id": str(artist_id),
        "artist_name": artist.name,
        "computed_at": now.isoformat(),
        "vol_30d": vol_30d,
        "vol_90d": vol_90d,
        "vol_180d": vol_180d,
        "vol_growth_ratio": round(vol_growth_ratio, 3),
        "price_median_90d": price_median_90d,
        "price_median_180d": price_median_180d,
        "price_growth_ratio": round(price_growth_ratio, 3),
        "unsold_rate_90d": round(unsold_rate_90d, 3),
        "buyer_concentration": round(buyer_concentration, 3),
        "repeat_buyer_detected": repeat_buyer,
        "repeat_buyer_count": int(buyer_concentration * len(recent_lots)),
        "supply_compression": round(max(0.0, 1.0 - vol_growth_ratio / 2), 3),
        "oracle_score_6m": round(oracle_score_6m, 1),
        "oracle_score_18m": round(oracle_score_18m, 1),
        "oracle_signal": signal,
        "oracle_window": window,
        "oracle_target_upside": upside,
        "active_signals": active_signals,
        "oracle_narrative": narrative,
        "confidence": round(confidence, 3),
    }

    # 8. Upsert into artist_signals
    try:
        # Read previous signal before overwriting (for momentum change detection)
        from sqlalchemy import delete
        prev_signal_result = await db.execute(
            select(ArtistSignal.oracle_signal).where(ArtistSignal.artist_id == artist_id)
        )
        prev_signal: Optional[str] = prev_signal_result.scalar_one_or_none()

        # Delete existing row for this artist and reinsert (simple upsert)
        await db.execute(
            delete(ArtistSignal).where(ArtistSignal.artist_id == artist_id)
        )
        row = ArtistSignal(
            artist_id=artist_id,
            computed_at=now,
            vol_30d=vol_30d,
            vol_90d=vol_90d,
            vol_180d=vol_180d,
            vol_growth_ratio=result["vol_growth_ratio"],
            price_median_90d=price_median_90d,
            price_median_180d=price_median_180d,
            price_growth_ratio=result["price_growth_ratio"],
            unsold_rate_90d=result["unsold_rate_90d"],
            buyer_concentration=result["buyer_concentration"],
            repeat_buyer_detected=repeat_buyer,
            repeat_buyer_count=result["repeat_buyer_count"],
            supply_compression=result["supply_compression"],
            oracle_score_6m=result["oracle_score_6m"],
            oracle_score_18m=result["oracle_score_18m"],
            oracle_signal=signal,
            oracle_window=window,
            oracle_target_upside=upside,
            active_signals=active_signals,
            oracle_narrative=narrative,
            confidence=result["confidence"],
        )
        db.add(row)
        await db.commit()
        logger.info("oracle.computed", artist=artist.name, signal=signal, score_6m=oracle_score_6m)

        # Fire momentum alert if signal improved (e.g. AVOID → BUY_NOW)
        if prev_signal != signal:
            try:
                from app.services.alert_triggers import send_artist_momentum_alerts
                await send_artist_momentum_alerts(
                    artist_id=str(artist_id),
                    artist_name=artist.name,
                    new_signal=signal,
                    prev_signal=prev_signal,
                )
            except Exception as alert_exc:
                logger.warning("oracle.momentum_alert_failed", artist=artist.name, error=str(alert_exc))

    except Exception as exc:
        logger.error("oracle.upsert_failed", artist_id=artist_id, error=str(exc))
        await db.rollback()

    return result


async def compute_oracle_for_all_artists(min_lots: int = 3) -> dict:
    """
    Compute Oracle for every artist with >= min_lots in the last 180 days.
    Entry point for the Celery weekly job.
    """
    from sqlalchemy import select, func, and_
    from app.database import BgSessionLocal
    from app.models.db_models import Artist, Lot
    from datetime import datetime, timedelta

    cutoff = datetime.utcnow() - timedelta(days=180)
    computed = 0
    skipped  = 0

    async with BgSessionLocal() as db:
        # Find artists with enough recent lots
        stmt = (
            select(Lot.artist_id)
            .where(
                and_(
                    Lot.artist_id.isnot(None),
                    Lot.auction_date >= cutoff,
                )
            )
            .group_by(Lot.artist_id)
            .having(func.count(Lot.id) >= min_lots)
        )
        result = await db.execute(stmt)
        artist_ids = [str(row[0]) for row in result.fetchall()]

        logger.info("oracle.weekly_run_start", eligible_artists=len(artist_ids))

        for artist_id in artist_ids:
            try:
                r = await compute_oracle(artist_id, db)
                if r:
                    computed += 1
                else:
                    skipped += 1
            except Exception as exc:
                logger.error("oracle.artist_failed", artist_id=artist_id, error=str(exc))
                skipped += 1

    logger.info("oracle.weekly_run_complete", computed=computed, skipped=skipped)
    return {"computed": computed, "skipped": skipped}
