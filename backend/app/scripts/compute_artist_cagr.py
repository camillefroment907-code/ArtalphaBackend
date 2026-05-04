"""
Sprint 2 — Compute real CAGR per artist from hammer_prices.

Spec (locked by Camille):
- Window: 10-year rolling, fallback to all data if <10y available
- Winsorization: standard trim of top 5% and bottom 5% of prices
- CAGR formula: (P_end_median / P_start_median) ^ (1/n_years) - 1
  where P_end = median of most recent year's sales
  and   P_start = median of earliest year in the window
- Cap: 15% upper, 0% lower (store real value in cagr_raw)
- Confidence: HIGH (>=50 sales) / MEDIUM (20-49) / LOW (<20 fallback)
- Tier fallback for <20 sales, classified by avg_auction_price:
    >100k EUR → blue-chip  6.5%
    > 20k EUR → established 8.5%
    >  5k EUR → mid-career  7.0%
    else       → emerging   5.5%
"""
import os
import sys
import psycopg2
import psycopg2.extras
import numpy as np
from datetime import datetime, timedelta, date
from typing import Optional

CAP_UPPER = 0.15
CAP_LOWER = 0.0
MIN_SALES = 20
WINDOW_YEARS = 10


def classify_tier_by_price(avg_price: Optional[float]) -> str:
    if avg_price is None:
        return 'emerging'
    if avg_price > 100_000:
        return 'blue_chip'
    if avg_price > 20_000:
        return 'established'
    if avg_price > 5_000:
        return 'mid_career'
    return 'emerging'


TIER_FALLBACKS = {
    'emerging':    0.055,
    'mid_career':  0.070,
    'established': 0.085,
    'blue_chip':   0.065,
}


def winsorize(values: list, pct: float = 0.05) -> np.ndarray:
    """Standard trim: remove bottom pct% and top pct% of values."""
    if len(values) < 4:
        return np.array(values)
    arr = np.array(values, dtype=float)
    low = np.percentile(arr, pct * 100)
    high = np.percentile(arr, (1 - pct) * 100)
    return arr[(arr >= low) & (arr <= high)]


def compute_cagr(start_price: float, end_price: float, n_years: float) -> float:
    if n_years <= 0 or start_price <= 0 or end_price <= 0:
        return 0.0
    return (end_price / start_price) ** (1.0 / n_years) - 1.0


def cap_cagr(raw: float) -> float:
    return max(CAP_LOWER, min(CAP_UPPER, raw))


def confidence_label(n_sales: int) -> str:
    if n_sales >= 50:
        return 'HIGH'
    if n_sales >= 20:
        return 'MEDIUM'
    return 'LOW'


def tier_fallback_result(avg_price: Optional[float], n_sales: int) -> dict:
    tier = classify_tier_by_price(avg_price)
    val = TIER_FALLBACKS[tier]
    return {
        'cagr_calculated': val,
        'cagr_raw': val,
        'cagr_confidence': 'LOW',
        'cagr_source': 'TIER_FALLBACK',
        'cagr_n_sales': n_sales,
        'cagr_window_start': None,
        'cagr_window_end': None,
    }


def compute_cagr_for_artist(cur, artist_id, artist_name: str, avg_price: Optional[float]) -> dict:
    cutoff = (datetime.utcnow() - timedelta(days=365 * WINDOW_YEARS)).date()

    cur.execute("""
        SELECT hammer_price_eur, sale_date
        FROM hammer_prices
        WHERE artist_name = %s
          AND hammer_price_eur IS NOT NULL
          AND hammer_price_eur > 0
          AND sale_date IS NOT NULL
          AND sale_date >= %s
        ORDER BY sale_date ASC
    """, (artist_name, cutoff))
    rows = cur.fetchall()
    n_sales = len(rows)

    if n_sales < MIN_SALES:
        # Expand to full history
        cur.execute("""
            SELECT hammer_price_eur, sale_date
            FROM hammer_prices
            WHERE artist_name = %s
              AND hammer_price_eur IS NOT NULL
              AND hammer_price_eur > 0
              AND sale_date IS NOT NULL
            ORDER BY sale_date ASC
        """, (artist_name,))
        rows = cur.fetchall()
        n_sales = len(rows)

    if n_sales < MIN_SALES:
        return tier_fallback_result(avg_price, n_sales)

    prices_all = [float(r['hammer_price_eur']) for r in rows]
    dates_all = [r['sale_date'] for r in rows]

    # Winsorize prices (retain the mask for pairing with dates)
    arr = np.array(prices_all, dtype=float)
    low = np.percentile(arr, 5)
    high = np.percentile(arr, 95)
    mask = (arr >= low) & (arr <= high)

    prices_w = arr[mask]
    dates_w = [d for d, m in zip(dates_all, mask) if m]

    if len(prices_w) < 4:
        return tier_fallback_result(avg_price, n_sales)

    # Group by year → median per year
    yearly: dict = {}
    for price, dt in zip(prices_w, dates_w):
        yearly.setdefault(dt.year, []).append(float(price))

    if len(yearly) < 2:
        return tier_fallback_result(avg_price, n_sales)

    years_sorted = sorted(yearly.keys())
    start_year = years_sorted[0]
    end_year = years_sorted[-1]
    n_years = end_year - start_year

    if n_years < 1:
        return tier_fallback_result(avg_price, n_sales)

    p_start = float(np.median(yearly[start_year]))
    p_end = float(np.median(yearly[end_year]))

    raw = compute_cagr(p_start, p_end, n_years)
    capped = cap_cagr(raw)

    return {
        'cagr_calculated': capped,
        'cagr_raw': raw,
        'cagr_confidence': confidence_label(n_sales),
        'cagr_source': 'COMPUTED',
        'cagr_n_sales': n_sales,
        'cagr_window_start': date(start_year, 1, 1),
        'cagr_window_end': date(end_year, 12, 31),
    }


def main():
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

    cur.execute("SELECT id, name, avg_auction_price FROM artists ORDER BY name")
    artists = cur.fetchall()
    total = len(artists)
    print(f"Computing CAGR for {total} artists...")

    update_cur = conn.cursor()
    now = datetime.utcnow()
    stats = {'computed': 0, 'fallback': 0, 'errors': 0}

    for i, artist in enumerate(artists):
        try:
            result = compute_cagr_for_artist(
                cur,
                artist['id'],
                artist['name'],
                artist.get('avg_auction_price'),
            )
            update_cur.execute("""
                UPDATE artists SET
                    cagr_calculated   = %s,
                    cagr_raw          = %s,
                    cagr_confidence   = %s,
                    cagr_source       = %s,
                    cagr_n_sales      = %s,
                    cagr_window_start = %s,
                    cagr_window_end   = %s,
                    cagr_computed_at  = %s
                WHERE id = %s
            """, (
                result['cagr_calculated'],
                result['cagr_raw'],
                result['cagr_confidence'],
                result['cagr_source'],
                result['cagr_n_sales'],
                result['cagr_window_start'],
                result['cagr_window_end'],
                now,
                artist['id'],
            ))
            if result['cagr_source'] == 'COMPUTED':
                stats['computed'] += 1
            else:
                stats['fallback'] += 1

            if (i + 1) % 200 == 0:
                conn.commit()
                pct = (i + 1) / total * 100
                print(f"  {i+1}/{total} ({pct:.0f}%) — computed={stats['computed']} fallback={stats['fallback']}")

        except Exception as e:
            stats['errors'] += 1
            print(f"  ERROR on {artist['name']}: {e}")

    conn.commit()
    print(f"\nDone:")
    print(f"  Computed (real CAGR): {stats['computed']}")
    print(f"  Tier fallback:        {stats['fallback']}")
    print(f"  Errors:               {stats['errors']}")

    cur.execute("""
        SELECT cagr_source, cagr_confidence, COUNT(*),
               MIN(cagr_calculated), AVG(cagr_calculated), MAX(cagr_calculated)
        FROM artists
        WHERE cagr_calculated IS NOT NULL
        GROUP BY cagr_source, cagr_confidence
        ORDER BY cagr_source, cagr_confidence
    """)
    print(f"\n  {'Source':<16} {'Conf':<8} {'N':<7} {'Min':>7} {'Avg':>7} {'Max':>7}")
    for r in cur.fetchall():
        print(f"  {r[0]:<16} {r[1]:<8} {r[2]:<7} {r[3]:>7.3f} {r[4]:>7.3f} {r[5]:>7.3f}")


if __name__ == '__main__':
    main()
