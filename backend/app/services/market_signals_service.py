"""
Market Signals V1 — signal computation.

All signals are computed directly from hammer_prices.
ArtistSignal (artist_signals table) is not used anywhere in this module.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.services.market_signals_copy import render_price_premium, render_auction_volume

log = logging.getLogger(__name__)

# Signal 1 thresholds
_MIN_RESULTS = 8   # minimum total auction results across all months
_MIN_MONTHS  = 3   # minimum distinct months with at least one result


def _to_naive(dt: datetime) -> datetime:
    """Strip timezone from a datetime, if present. sale_date is stored naive."""
    return dt.replace(tzinfo=None) if dt.tzinfo is not None else dt


def _cutoff_4m() -> datetime:
    """Return the first day of the month 4 months ago (naive UTC)."""
    now = datetime.utcnow()
    month = now.month - 4
    year = now.year
    if month <= 0:
        month += 12
        year -= 1
    return datetime(year, month, 1)


async def is_excluded(artist_name_normalized: str, db: AsyncSession) -> bool:
    """Return True if the artist appears in excluded_entities."""
    result = await db.execute(
        text(
            "SELECT 1 FROM excluded_entities "
            "WHERE entity_name_normalized = :n LIMIT 1"
        ),
        {"n": artist_name_normalized},
    )
    return result.scalar_one_or_none() is not None


async def compute_signals(
    artist_name_normalized: str,
    db: AsyncSession,
) -> list[dict]:
    """
    Compute all qualifying signals for an artist.
    Returns an empty list when no signal qualifies — the router returns HTTP 204.
    """
    signals: list[dict] = []

    s1 = await _price_premium(artist_name_normalized, db)
    if s1 is not None:
        signals.append(s1)

    s2 = await _auction_volume(artist_name_normalized, db)
    if s2 is not None:
        signals.append(s2)

    return signals


async def _price_premium(
    artist_name_normalized: str,
    db: AsyncSession,
) -> Optional[dict]:
    """
    Signal 1 — Price Premium.

    Rolling monthly aggregation using a fixed 4-month calendar cutoff.
    Both a recent period (last 4 months) and a prior period must have data.
    Minimum: 8 total results, 3 distinct months.
    """
    try:
        rows = (
            await db.execute(
                text("""
                    SELECT
                        DATE_TRUNC('month', sale_date) AS month,
                        AVG(premium_ratio)             AS avg_premium,
                        COUNT(*)                       AS n
                    FROM hammer_prices
                    WHERE artist_name_normalized = :name
                      AND artist_name_normalized IS NOT NULL
                      AND premium_ratio IS NOT NULL
                      AND sale_date IS NOT NULL
                      AND sale_date >= NOW() - INTERVAL '12 months'
                      AND medium NOT IN ('Jewelry', 'Watches')
                    GROUP BY 1
                    ORDER BY 1 DESC
                """),
                {"name": artist_name_normalized},
            )
        ).mappings().all()
    except Exception as exc:
        log.warning("price_premium query failed artist=%s: %s", artist_name_normalized, exc)
        return None

    if not rows:
        return None

    cutoff = _cutoff_4m()
    recent_rows = [r for r in rows if _to_naive(r["month"]) >= cutoff]
    prior_rows  = [r for r in rows if _to_naive(r["month"]) < cutoff]

    n_total  = sum(r["n"] for r in rows)
    n_months = len(rows)  # distinct months with ≥1 result

    if n_total < _MIN_RESULTS:
        return None
    if n_months < _MIN_MONTHS:
        return None
    if not recent_rows or not prior_rows:
        return None

    # Signal 1 intentionally computes:
    #     mean(monthly average premium)
    # and NOT
    #     average(premium over all sales).
    #
    # Each calendar month contributes one observation regardless of the
    # number of lots sold. Volume is handled independently by Signal 2.
    #
    # The recent window starts on the first day of the month four months
    # before "today". This is a calendar-month comparison, not a rolling
    # day-based window.
    recent_avg = sum(r["avg_premium"] for r in recent_rows) / len(recent_rows)

    if recent_avg >= 1.05:
        direction = "above"
    elif recent_avg < 0.95:
        direction = "below"
    else:
        direction = "at"

    return render_price_premium(
        n_total=n_total,
        n_months=n_months,
        direction=direction,
    )


async def _auction_volume(
    artist_name_normalized: str,
    db: AsyncSession,
) -> Optional[dict]:
    """
    Signal 2 — Auction Volume.

    Compares last 12 months vs prior 12 months, directly from hammer_prices.
    Both periods must have at least one result for the signal to fire.
    """
    try:
        row = (
            await db.execute(
                text("""
                    SELECT
                        COUNT(*) FILTER (
                            WHERE sale_date >= NOW() - INTERVAL '12 months'
                        )                   AS vol_recent,
                        COUNT(*) FILTER (
                            WHERE sale_date >= NOW() - INTERVAL '24 months'
                              AND sale_date <  NOW() - INTERVAL '12 months'
                        )                   AS vol_prior
                    FROM hammer_prices
                    WHERE artist_name_normalized = :name
                      AND artist_name_normalized IS NOT NULL
                      AND sale_date IS NOT NULL
                      AND hammer_price_eur IS NOT NULL
                      AND medium NOT IN ('Jewelry', 'Watches')
                """),
                {"name": artist_name_normalized},
            )
        ).mappings().one_or_none()
    except Exception as exc:
        log.warning("auction_volume query failed artist=%s: %s", artist_name_normalized, exc)
        return None

    if row is None:
        return None

    vol_recent = int(row["vol_recent"] or 0)
    vol_prior  = int(row["vol_prior"] or 0)

    if vol_recent == 0 or vol_prior == 0:
        return None

    # Signal 2 only fires on meaningful volume growth. Flat or declining
    # volume returns no signal — same policy as Signal 1 (one state:
    # present or absent, no negative/declining framing in V1).
    #
    # This is a product decision, not a statistical limitation.
    # Revisit explicitly if V2 introduces negative market signals.
    #
    # V2 ticket: calibrate a shared magnitude threshold for both Signal 1
    # and Signal 2 (e.g. minimum delta, not just direction). Do not add a
    # threshold to Signal 2 alone — that would create an asymmetry with
    # Signal 1. Calibrate together once production data surfaces real
    # marginal cases to size the threshold against.
    if vol_recent <= vol_prior:
        return None

    return render_auction_volume(vol_recent=vol_recent, vol_prior=vol_prior)
