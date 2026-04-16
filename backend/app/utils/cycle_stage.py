"""
Cycle Stage Indicator — where is this artist in the market cycle?

Uses yearly avg hammer prices from hammer_prices table.
Compares recent 12 months vs prior 12 months to determine momentum,
then positions relative to all-time peak to determine stage.

Stages:
  EARLY RISE  — prices accelerating from a low base (< 70% of peak, +15%+ momentum)
  RISING      — sustained uptrend (< 90% of peak, +10%+ momentum)
  PEAK        — prices near all-time high (>= 85% of peak)
  CORRECTION  — falling from recent high (momentum < -15%)
  BOTTOM      — prices depressed AND momentum negative or flat (< 60% of peak)
  STABLE      — sideways movement, no clear trend
"""
from sqlalchemy import text
from app.utils.cache import get_cached, set_cached


async def get_cycle_stage(artist_name: str | None, db) -> dict | None:
    if not artist_name:
        return None

    cache_key = f"cycle:{artist_name.lower()[:60]}"
    cached = get_cached(cache_key, ttl=3600)
    if cached is not None:
        return cached if cached else None

    result = await db.execute(
        text("""
            WITH yearly AS (
                SELECT
                    EXTRACT(YEAR FROM sale_date)::int AS yr,
                    AVG(hammer_price_eur)::float       AS avg_price,
                    COUNT(*)::int                      AS cnt
                FROM hammer_prices
                WHERE artist_name ILIKE :name
                  AND hammer_price_eur > 0
                  AND sale_date IS NOT NULL
                GROUP BY yr
                HAVING COUNT(*) >= 2
                ORDER BY yr
            ),
            recent AS (
                SELECT AVG(hammer_price_eur)::float AS avg_price, COUNT(*)::int AS cnt
                FROM hammer_prices
                WHERE artist_name ILIKE :name
                  AND hammer_price_eur > 0
                  AND sale_date >= NOW() - INTERVAL '12 months'
            ),
            prior AS (
                SELECT AVG(hammer_price_eur)::float AS avg_price
                FROM hammer_prices
                WHERE artist_name ILIKE :name
                  AND hammer_price_eur > 0
                  AND sale_date >= NOW() - INTERVAL '24 months'
                  AND sale_date <  NOW() - INTERVAL '12 months'
            )
            SELECT
                (SELECT MAX(avg_price) FROM yearly)           AS peak_annual_avg,
                (SELECT MIN(yr)        FROM yearly)           AS first_year,
                (SELECT MAX(yr)        FROM yearly)           AS last_year,
                (SELECT SUM(cnt)       FROM yearly)           AS total_sales,
                (SELECT avg_price      FROM recent)           AS recent_avg,
                (SELECT cnt            FROM recent)           AS recent_cnt,
                (SELECT avg_price      FROM prior)            AS prior_avg
        """),
        {"name": f"%{artist_name}%"},
    )

    row = result.one_or_none()

    # Need at least some data to work with
    if (
        not row
        or not row.peak_annual_avg
        or not row.recent_avg
        or (row.recent_cnt or 0) < 2
    ):
        set_cached(cache_key, False)
        return None

    peak = row.peak_annual_avg
    recent = row.recent_avg
    prior = row.prior_avg

    # Momentum: recent 12m vs prior 12m (if prior exists, else vs peak)
    if prior and prior > 0:
        momentum_pct = round((recent - prior) / prior * 100, 1)
        has_prior = True
    else:
        momentum_pct = round((recent - peak) / peak * 100, 1)
        has_prior = False

    # Position relative to peak
    peak_ratio = recent / peak  # 1.0 = at peak, 0.5 = 50% below peak

    # Classify
    if peak_ratio >= 0.90:
        stage = "PEAK"
        color = "#f59e0b"
        icon = "▲"
        description = "Prices near all-time high — entry risk elevated"
    elif peak_ratio >= 0.70 and momentum_pct >= 10:
        stage = "RISING"
        color = "#4ade80"
        icon = "↑"
        description = f"Prices accelerating (+{abs(momentum_pct):.0f}% vs prior year)"
    elif peak_ratio < 0.65 and momentum_pct >= 15:
        stage = "EARLY RISE"
        color = "#34d399"
        icon = "↗"
        description = "Recovering from lows — potential entry window"
    elif momentum_pct <= -20:
        stage = "CORRECTION"
        color = "#f87171"
        icon = "↓"
        description = f"Prices falling ({momentum_pct:.0f}% vs prior year)"
    elif peak_ratio < 0.55 and (not has_prior or momentum_pct <= 5):
        stage = "BOTTOM"
        color = "#94a3b8"
        icon = "—"
        description = f"{round((1 - peak_ratio) * 100)}% below all-time high — contrarian opportunity"
    else:
        stage = "STABLE"
        color = "#94a3b8"
        icon = "→"
        description = "No clear trend — market in equilibrium"

    data = {
        "stage": stage,
        "color": color,
        "icon": icon,
        "description": description,
        "momentum_pct": momentum_pct,
        "peak_ratio": round(peak_ratio, 3),
        "recent_avg": round(recent),
        "peak_avg": round(peak),
        "total_sales": row.total_sales or 0,
        "first_year": row.first_year,
        "last_year": row.last_year,
    }
    set_cached(cache_key, data)
    return data
