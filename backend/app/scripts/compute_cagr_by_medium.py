"""
Sprint 2.5 + 2.6 — Per-medium CAGR computation with signal classification
and cross-medium recommendations.

Sprint 2.5:
  For each artist with >= 20 sales in any canonical medium group, compute
  CAGR using: 10-year rolling, winsorize 5%, cap 0–15%.

Sprint 2.6 additions:
  - Signal: AVOID (<0%) / WATCH (0–3%) / NEUTRAL (3–7%) / BUY (>=7%)
    Uses cagr_raw (not capped).
  - Alternatives: top 2 other mediums with delta >= +3% in cagr_raw.
  - Template-based rationale (no GPT).

Result stored as JSON on artists.cagr_by_medium:
{
  "oil_on_canvas": {
    "cagr": 0.0, "cagr_raw": -0.072, "n_sales": 143, "confidence": "HIGH",
    "signal": "AVOID",
    "alternatives": [
      {"medium": "prints", "cagr": 0.039, "cagr_raw": 0.039, "n_sales": 1578,
       "delta": 0.111, "signal": "NEUTRAL", "rationale": "Stable demand for Matisse Prints"}
    ]
  }
}
"""
import os
import sys
import json
import psycopg2
import psycopg2.extras
import numpy as np
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(__file__))
from medium_taxonomy import canonicalize_medium, is_dept_name, MEDIUM_DISPLAY

# ── CAGR computation constants ────────────────────────────────────────────────
CAP_UPPER = 0.15
CAP_LOWER = 0.0
MIN_SALES = 20
WINDOW_YEARS = 10

# ── Sprint 2.6 signal constants ───────────────────────────────────────────────
SIGNAL_BUY_THRESHOLD     = 0.07
SIGNAL_NEUTRAL_THRESHOLD = 0.03
SIGNAL_WATCH_THRESHOLD   = 0.0
ALTERNATIVE_DELTA        = 0.03   # alternative must be >= +3% better in cagr_raw
MAX_ALTERNATIVES         = 2


def classify_signal(cagr_raw: float) -> str:
    """Signal based on raw (uncapped) CAGR."""
    if cagr_raw < SIGNAL_WATCH_THRESHOLD:
        return 'AVOID'
    if cagr_raw < SIGNAL_NEUTRAL_THRESHOLD:
        return 'WATCH'
    if cagr_raw < SIGNAL_BUY_THRESHOLD:
        return 'NEUTRAL'
    return 'BUY'


def artist_lastname(full_name: str) -> str:
    parts = full_name.strip().split()
    return parts[-1] if parts else full_name


def generate_rationale(artist_name: str, medium: str, signal: str) -> str:
    display = MEDIUM_DISPLAY.get(medium, medium.replace('_', ' ').title())
    name = artist_lastname(artist_name)
    if signal == 'BUY':
        return f"Strong demand for {name} {display}"
    elif signal == 'NEUTRAL':
        return f"Stable demand for {name} {display}"
    elif signal == 'WATCH':
        return f"Modest growth for {name} {display}"
    return f"Limited momentum for {name} {display}"


def find_alternatives(
    current_medium: str,
    current_cagr_raw: float,
    artist_name: str,
    all_mediums: dict,
) -> list:
    """
    Return up to MAX_ALTERNATIVES mediums where cagr_raw >= current + ALTERNATIVE_DELTA.
    Filters out AVOID alternatives. Sorted by cagr_raw DESC.
    """
    candidates = []
    for medium, data in all_mediums.items():
        if medium == current_medium:
            continue
        delta = data['cagr_raw'] - current_cagr_raw
        if delta < ALTERNATIVE_DELTA:
            continue
        signal = classify_signal(data['cagr_raw'])
        if signal == 'AVOID':
            continue
        candidates.append({
            'medium':    medium,
            'cagr':      data['cagr'],
            'cagr_raw':  data['cagr_raw'],
            'n_sales':   data['n_sales'],
            'delta':     round(delta, 4),
            'signal':    signal,
            'rationale': generate_rationale(artist_name, medium, signal),
        })
    candidates.sort(key=lambda x: x['cagr_raw'], reverse=True)
    return candidates[:MAX_ALTERNATIVES]


# ── CAGR computation helpers ──────────────────────────────────────────────────

def winsorize(values: list, pct: float = 0.05):
    if len(values) < 4:
        return np.array(values, dtype=float)
    arr = np.array(values, dtype=float)
    low  = np.percentile(arr, pct * 100)
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


def compute_for_group(rows: list):
    """Compute CAGR for one (artist, canonical_medium) group. Returns None if insufficient."""
    if len(rows) < MIN_SALES:
        return None

    prices_all = [float(r['hammer_price_eur']) for r in rows]
    dates_all  = [r['sale_date'] for r in rows]
    n_sales    = len(rows)

    arr  = np.array(prices_all, dtype=float)
    low  = np.percentile(arr, 5)
    high = np.percentile(arr, 95)
    mask = (arr >= low) & (arr <= high)
    prices_w = arr[mask]
    dates_w  = [d for d, m in zip(dates_all, mask) if m]

    if len(prices_w) < 4:
        return None

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
    p_end   = float(np.median(yearly[years_sorted[-1]]))

    raw    = compute_cagr(p_start, p_end, n_years)
    capped = cap_cagr(raw)

    return {
        'cagr':       round(capped, 4),
        'cagr_raw':   round(raw, 4),
        'n_sales':    n_sales,
        'confidence': confidence_label(n_sales),
    }


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur  = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

    cur.execute("SELECT id, name FROM artists ORDER BY name")
    artists = cur.fetchall()
    total   = len(artists)
    print(f"Computing per-medium CAGR + signals for {total} artists...")

    cutoff     = (datetime.utcnow() - timedelta(days=365 * WINDOW_YEARS)).date()
    update_cur = conn.cursor()
    stats = {'with_segmented': 0, 'no_segmentation': 0, 'errors': 0}

    for i, artist in enumerate(artists):
        try:
            # ── Fetch sales (10y window, expand if sparse) ────────────────────
            cur.execute("""
                SELECT hammer_price_eur, sale_date, medium
                FROM hammer_prices
                WHERE artist_name = %s
                  AND hammer_price_eur IS NOT NULL AND hammer_price_eur > 0
                  AND sale_date IS NOT NULL
                  AND medium IS NOT NULL AND medium != ''
                  AND sale_date >= %s
                ORDER BY sale_date ASC
            """, (artist['name'], cutoff))
            rows = cur.fetchall()

            if len(rows) < MIN_SALES * 2:
                cur.execute("""
                    SELECT hammer_price_eur, sale_date, medium
                    FROM hammer_prices
                    WHERE artist_name = %s
                      AND hammer_price_eur IS NOT NULL AND hammer_price_eur > 0
                      AND sale_date IS NOT NULL
                      AND medium IS NOT NULL AND medium != ''
                    ORDER BY sale_date ASC
                """, (artist['name'],))
                rows = cur.fetchall()

            # ── Bucket by canonical medium ────────────────────────────────────
            by_medium: dict = {}
            for row in rows:
                if is_dept_name(row['medium']):
                    continue
                canonical = canonicalize_medium(row['medium'])
                if canonical:
                    by_medium.setdefault(canonical, []).append(row)

            # ── Compute CAGR per bucket ───────────────────────────────────────
            cagr_by_medium: dict = {}
            for canonical, group in by_medium.items():
                result = compute_for_group(group)
                if result:
                    cagr_by_medium[canonical] = result

            # ── Sprint 2.6: enrich with signals + alternatives ────────────────
            if cagr_by_medium:
                enriched = {}
                for medium, data in cagr_by_medium.items():
                    signal = classify_signal(data['cagr_raw'])
                    alts   = find_alternatives(
                        current_medium=medium,
                        current_cagr_raw=data['cagr_raw'],
                        artist_name=artist['name'],
                        all_mediums=cagr_by_medium,
                    )
                    enriched[medium] = {
                        **data,
                        'signal':       signal,
                        'alternatives': alts,
                    }
                cagr_by_medium = enriched

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

    # ── Distribution ──────────────────────────────────────────────────────────
    cur.execute("""
        SELECT med, COUNT(*) AS artists, AVG(cagr_val) AS avg_cagr
        FROM (
          SELECT key AS med, (value->>'cagr')::float AS cagr_val
          FROM artists, jsonb_each(cagr_by_medium::jsonb)
          WHERE cagr_by_medium IS NOT NULL
        ) t
        GROUP BY med ORDER BY artists DESC
    """)
    print(f"\n  {'Medium':<18} {'Artists':<9} {'Avg CAGR':>9}")
    for r in cur.fetchall():
        print(f"  {r[0]:<18} {r[1]:<9} {r[2]*100:>8.2f}%")

    cur.execute("""
        SELECT signal, COUNT(*) AS pairs
        FROM (
          SELECT value->>'signal' AS signal
          FROM artists, jsonb_each(cagr_by_medium::jsonb)
          WHERE cagr_by_medium IS NOT NULL
        ) t
        GROUP BY signal ORDER BY pairs DESC
    """)
    print(f"\n  Signal distribution:")
    for r in cur.fetchall():
        print(f"  {r[0]:<10} {r[1]}")


if __name__ == '__main__':
    main()
