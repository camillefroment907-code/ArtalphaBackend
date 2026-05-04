"""
Sprint 2.5 — Per-medium CAGR computation.

For each artist with >= 20 sales in any canonical medium group, compute
CAGR for that (artist, medium) pair using the same logic as Sprint 2:
  - 10-year rolling window (expand to all history if <10y)
  - Winsorize 5% standard trim
  - CAGR = (P_end_median / P_start_median) ^ (1/n_years) - 1
  - Cap 0-15%

Result stored as JSON on artists.cagr_by_medium:
{
  "oil_on_canvas": {"cagr": 0.042, "cagr_raw": 0.038, "n_sales": 296, "confidence": "MEDIUM"},
  "prints":        {"cagr": 0.018, "cagr_raw": 0.021, "n_sales": 1560, "confidence": "HIGH"}
}
"""
import os
import sys
import json
import psycopg2
import psycopg2.extras
import numpy as np
from datetime import datetime, timedelta

# Allow import of sibling module when run directly
sys.path.insert(0, os.path.dirname(__file__))
from medium_taxonomy import canonicalize_medium, is_dept_name

CAP_UPPER = 0.15
CAP_LOWER = 0.0
MIN_SALES = 20
WINDOW_YEARS = 10


def winsorize(values: list, pct: float = 0.05):
    """Standard trim: remove bottom pct% and top pct% of values."""
    if len(values) < 4:
        return np.array(values, dtype=float)
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


def compute_for_group(rows: list) -> dict | None:
    """
    Given rows (DictRow with hammer_price_eur, sale_date) for one
    (artist, canonical_medium) pair, compute CAGR. Returns None if insufficient.
    """
    if len(rows) < MIN_SALES:
        return None

    prices_all = [float(r['hammer_price_eur']) for r in rows]
    dates_all = [r['sale_date'] for r in rows]
    n_sales = len(rows)

    # Winsorize and pair with dates
    arr = np.array(prices_all, dtype=float)
    low = np.percentile(arr, 5)
    high = np.percentile(arr, 95)
    mask = (arr >= low) & (arr <= high)
    prices_w = arr[mask]
    dates_w = [d for d, m in zip(dates_all, mask) if m]

    if len(prices_w) < 4:
        return None

    # Group by year → median per year
    yearly: dict = {}
    for price, dt in zip(prices_w, dates_w):
        yearly.setdefault(dt.year, []).append(float(price))

    if len(yearly) < 2:
        return None

    years_sorted = sorted(yearly.keys())
    n_years = years_sorted[-1] - years_sorted[0]
    if n_years < 1:
        return None

    p_start = float(np.median(yearly[years_sorted[0]]))
    p_end = float(np.median(yearly[years_sorted[-1]]))

    raw = compute_cagr(p_start, p_end, n_years)
    capped = cap_cagr(raw)

    return {
        'cagr':       round(capped, 4),
        'cagr_raw':   round(raw, 4),
        'n_sales':    n_sales,
        'confidence': confidence_label(n_sales),
    }


def main():
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

    cur.execute("SELECT id, name FROM artists ORDER BY name")
    artists = cur.fetchall()
    total = len(artists)
    print(f"Computing per-medium CAGR for {total} artists...")

    cutoff = (datetime.utcnow() - timedelta(days=365 * WINDOW_YEARS)).date()
    update_cur = conn.cursor()
    stats = {'with_segmented': 0, 'no_segmentation': 0, 'errors': 0}

    for i, artist in enumerate(artists):
        try:
            # Fetch 10-year window first
            cur.execute("""
                SELECT hammer_price_eur, sale_date, medium
                FROM hammer_prices
                WHERE artist_name = %s
                  AND hammer_price_eur IS NOT NULL
                  AND hammer_price_eur > 0
                  AND sale_date IS NOT NULL
                  AND medium IS NOT NULL
                  AND medium != ''
                  AND sale_date >= %s
                ORDER BY sale_date ASC
            """, (artist['name'], cutoff))
            rows = cur.fetchall()

            # If too few for any meaningful split, fall back to full history
            if len(rows) < MIN_SALES * 2:
                cur.execute("""
                    SELECT hammer_price_eur, sale_date, medium
                    FROM hammer_prices
                    WHERE artist_name = %s
                      AND hammer_price_eur IS NOT NULL
                      AND hammer_price_eur > 0
                      AND sale_date IS NOT NULL
                      AND medium IS NOT NULL
                      AND medium != ''
                    ORDER BY sale_date ASC
                """, (artist['name'],))
                rows = cur.fetchall()

            # Bucket by canonical medium (skip dept names + unmatched)
            by_medium: dict = {}
            for row in rows:
                if is_dept_name(row['medium']):
                    continue
                canonical = canonicalize_medium(row['medium'])
                if canonical is None:
                    continue
                by_medium.setdefault(canonical, []).append(row)

            # Compute CAGR for each bucket with >= MIN_SALES
            cagr_by_medium = {}
            for canonical, group in by_medium.items():
                result = compute_for_group(group)
                if result:
                    cagr_by_medium[canonical] = result

            if cagr_by_medium:
                update_cur.execute(
                    "UPDATE artists SET cagr_by_medium = %s WHERE id = %s",
                    (json.dumps(cagr_by_medium), artist['id']),
                )
                stats['with_segmented'] += 1
            else:
                stats['no_segmentation'] += 1

            if (i + 1) % 200 == 0:
                conn.commit()
                pct = (i + 1) / total * 100
                print(f"  {i+1}/{total} ({pct:.0f}%) — segmented={stats['with_segmented']}")

        except Exception as e:
            stats['errors'] += 1
            print(f"  ERROR on {artist['name']}: {e}")

    conn.commit()
    print(f"\nDone:")
    print(f"  With per-medium CAGR: {stats['with_segmented']}")
    print(f"  No segmentation:      {stats['no_segmentation']}")
    print(f"  Errors:               {stats['errors']}")

    # Distribution
    cur.execute("""
        SELECT
          jsonb_object_keys(cagr_by_medium::jsonb) AS medium,
          COUNT(*) AS artists,
          AVG((cagr_by_medium::jsonb -> jsonb_object_keys(cagr_by_medium::jsonb) ->> 'cagr')::float) AS avg_cagr
        FROM artists
        WHERE cagr_by_medium IS NOT NULL
        GROUP BY medium
        ORDER BY artists DESC
    """)
    print(f"\n  {'Medium':<18} {'Artists':<9} {'Avg CAGR':>9}")
    for r in cur.fetchall():
        print(f"  {r[0]:<18} {r[1]:<9} {r[2]*100:>8.2f}%")


if __name__ == '__main__':
    main()
