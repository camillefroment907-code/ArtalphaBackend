"""
Pricing Safety — Business Impact Analysis Script

Quantifies the real-world effect of the SQL price-band filter introduced
in the HOTFIX PRICING SAFETY branch:

    hammer_price_eur BETWEEN estimate_low × 0.15 AND estimate_high × 4.0

Questions answered:
  1. What % of historical comps fall outside the price band? (false-negative risk)
  2. How common are artists whose p50 sale price exceeds 4× their typical estimate?
  3. For current live/upcoming lots: how many lose ≥3 comps due to the filter?
  4. For those lots: what does the unfiltered vs. filtered pool look like?
  5. Is the estimate-high × 0.85 fallback defensible vs. real outcomes?

Usage:
    DATABASE_URL="postgresql://..." python3 -m app.scripts.pricing_impact_analysis
"""
from __future__ import annotations

import asyncio
import logging
import os
import sys
from pathlib import Path

log = logging.getLogger("pricing_impact")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

BAND_FLOOR_RATIO = 0.15   # estimate_low × 0.15
BAND_CEIL_RATIO  = 4.0    # estimate_high × 4.0


async def run():
    backend_dir = Path(__file__).resolve().parents[2]
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))

    env_path = backend_dir.parent / ".env"
    if env_path.exists():
        from dotenv import load_dotenv
        load_dotenv(env_path)

    db_url = os.environ.get("DATABASE_URL", "")
    if not db_url:
        print("\n❌  DATABASE_URL not set. Run with:\n"
              '   DATABASE_URL="postgresql://..." python3 -m app.scripts.pricing_impact_analysis\n')
        sys.exit(1)

    # Sanitise URL for asyncpg
    from urllib.parse import urlparse, urlencode, parse_qs, urlunparse
    _p = urlparse(db_url)
    _qs = parse_qs(_p.query, keep_blank_values=True)
    _needs_ssl = _qs.pop("sslmode", [""])[0] in ("require", "verify-ca", "verify-full")
    _qs.pop("channel_binding", None)
    db_url_clean = urlunparse(_p._replace(query=urlencode({k: v[0] for k, v in _qs.items()})))
    connect_kwargs = {"ssl": "require"} if _needs_ssl else {}

    import sqlalchemy as sa
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
    from sqlalchemy.orm import sessionmaker

    async_url = db_url_clean.replace("postgresql://", "postgresql+asyncpg://", 1)
    engine = create_async_engine(async_url, connect_args=connect_kwargs, pool_pre_ping=True)
    SessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with SessionLocal() as db:
        await _run_analysis(db)

    await engine.dispose()


async def _run_analysis(db):
    from sqlalchemy import text

    sep = "─" * 72

    # ── Q1: Distribution of hammer_price / estimate_high ─────────────────────
    print(f"\n{sep}")
    print("Q1 — DISTRIBUTION OF HAMMER/ESTIMATE RATIO (full historical DB)")
    print(sep)
    r = await db.execute(text("""
        SELECT
            CASE
                WHEN hammer_price_eur / NULLIF(estimate_high, 0) < :floor
                    THEN '① below floor  (<0.15×)'
                WHEN hammer_price_eur / NULLIF(estimate_high, 0) <= :ceil
                    THEN '② in band       (0.15×–4.0×)'
                WHEN hammer_price_eur / NULLIF(estimate_high, 0) <= 6.0
                    THEN '③ slightly above (4.0×–6.0×)'
                WHEN hammer_price_eur / NULLIF(estimate_high, 0) <= 10.0
                    THEN '④ well above     (6.0×–10.0×)'
                ELSE '⑤ extreme        (>10×)'
            END AS bucket,
            COUNT(*)                                               AS cnt,
            ROUND(COUNT(*)::numeric /
                  SUM(COUNT(*)) OVER () * 100, 1)                 AS pct
        FROM hammer_prices
        WHERE hammer_price_eur IS NOT NULL
          AND estimate_high    IS NOT NULL
          AND estimate_high    > 0
        GROUP BY 1
        ORDER BY 1
    """), {"floor": BAND_FLOOR_RATIO, "ceil": BAND_CEIL_RATIO})
    rows = r.mappings().all()
    for row in rows:
        bar = "█" * int(float(row["pct"]) / 2)
        print(f"  {row['bucket']}   {row['cnt']:>8,}  ({row['pct']:>5}%)  {bar}")

    # ── Q2: Artists whose p50 sale > 4× estimate (filter would hurt them) ────
    print(f"\n{sep}")
    print("Q2 — ARTISTS SYSTEMATICALLY ABOVE THE 4× CEILING (p50 > 4× estimate_high)")
    print(sep)
    r2 = await db.execute(text("""
        WITH artist_stats AS (
            SELECT
                artist_name_normalized,
                PERCENTILE_CONT(0.5) WITHIN GROUP
                    (ORDER BY hammer_price_eur / NULLIF(estimate_high, 0)) AS median_ratio,
                COUNT(*)                                                    AS sales_count,
                MIN(hammer_price_eur)                                       AS min_hp,
                MAX(hammer_price_eur)                                       AS max_hp
            FROM hammer_prices
            WHERE hammer_price_eur IS NOT NULL
              AND estimate_high    IS NOT NULL
              AND estimate_high    > 0
              AND hammer_price_eur > 0
            GROUP BY artist_name_normalized
            HAVING COUNT(*) >= 5
        )
        SELECT
            SUM(CASE WHEN median_ratio > :ceil THEN 1 ELSE 0 END)          AS artists_above_ceil,
            COUNT(*)                                                         AS total_artists_with_5_sales,
            ROUND(SUM(CASE WHEN median_ratio > :ceil THEN 1 ELSE 0 END)
                  ::numeric / COUNT(*) * 100, 1)                            AS pct_above_ceil,
            ROUND(AVG(median_ratio), 2)                                     AS avg_median_ratio,
            ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP
                  (ORDER BY median_ratio)::numeric, 2)                      AS p50_median_ratio
        FROM artist_stats
    """), {"ceil": BAND_CEIL_RATIO})
    row = r2.mappings().first()
    print(f"  Artists with ≥5 sales:              {row['total_artists_with_5_sales']:,}")
    print(f"  Artists where p50 > 4× estimate:    {row['artists_above_ceil']:,}  ({row['pct_above_ceil']}%)")
    print(f"  Average median ratio (all artists): {row['avg_median_ratio']}×")
    print(f"  p50 of median ratios:               {row['p50_median_ratio']}×")

    # Top 10 most affected artists
    r2b = await db.execute(text("""
        SELECT
            artist_name_normalized,
            ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP
                  (ORDER BY hammer_price_eur / NULLIF(estimate_high, 0))::numeric, 2) AS median_ratio,
            COUNT(*)                                                                    AS sales_count
        FROM hammer_prices
        WHERE hammer_price_eur IS NOT NULL
          AND estimate_high    IS NOT NULL
          AND estimate_high    > 0
        GROUP BY artist_name_normalized
        HAVING COUNT(*) >= 5
           AND PERCENTILE_CONT(0.5) WITHIN GROUP
               (ORDER BY hammer_price_eur / NULLIF(estimate_high, 0)) > :ceil
        ORDER BY median_ratio DESC
        LIMIT 10
    """), {"ceil": BAND_CEIL_RATIO})
    rows = r2b.mappings().all()
    if rows:
        print(f"\n  Top artists where filter most distorts (median ratio > {BAND_CEIL_RATIO}×):")
        for row in rows:
            print(f"    {row['artist_name_normalized']:<40}  p50={row['median_ratio']}×  n={row['sales_count']}")

    # ── Q3: Impact on current live/upcoming lots ──────────────────────────────
    print(f"\n{sep}")
    print("Q3 — CURRENT LIVE/UPCOMING LOTS: COMP COVERAGE WITH vs. WITHOUT FILTER")
    print(sep)
    r3 = await db.execute(text("""
        WITH lot_coverage AS (
            SELECT
                l.id,
                COUNT(hp.id)                                                        AS total_comps,
                COUNT(hp.id) FILTER (
                    WHERE hp.hammer_price_eur
                          BETWEEN l.estimate_low  * :floor
                              AND l.estimate_high * :ceil
                )                                                                   AS comps_in_band,
                -- would reach Level 1/2/3 with filter?
                COUNT(hp.id) FILTER (
                    WHERE hp.hammer_price_eur
                          BETWEEN l.estimate_low  * :floor
                              AND l.estimate_high * :ceil
                ) >= 3                                                              AS has_3_in_band,
                -- would reach Level 1/2/3 without filter?
                COUNT(hp.id) >= 3                                                   AS has_3_unfiltered
            FROM lots l
            LEFT JOIN hammer_prices hp
                   ON hp.artist_name_normalized = l.artist_name_normalized
            WHERE l.status       IN ('upcoming', 'live')
              AND l.estimate_low  IS NOT NULL
              AND l.estimate_high IS NOT NULL
              AND l.estimate_low  > 0
              AND l.estimate_high > 0
            GROUP BY l.id, l.estimate_low, l.estimate_high
        )
        SELECT
            COUNT(*)                                           AS total_lots,
            SUM(CASE WHEN total_comps = 0      THEN 1 ELSE 0 END) AS no_artist_history,
            SUM(CASE WHEN has_3_unfiltered
                     AND has_3_in_band         THEN 1 ELSE 0 END) AS good_in_both,
            SUM(CASE WHEN has_3_unfiltered
                     AND NOT has_3_in_band     THEN 1 ELSE 0 END) AS lost_comps_due_to_filter,
            SUM(CASE WHEN NOT has_3_unfiltered
                     AND has_3_in_band         THEN 1 ELSE 0 END) AS gained_comps_with_filter,
            SUM(CASE WHEN NOT has_3_unfiltered
                     AND NOT has_3_in_band     THEN 1 ELSE 0 END) AS sparse_in_both
        FROM lot_coverage
    """), {"floor": BAND_FLOOR_RATIO, "ceil": BAND_CEIL_RATIO})
    row = r3.mappings().first()
    total = row["total_lots"]
    print(f"  Total live/upcoming lots:           {total:,}")
    print(f"  No artist history at all:           {row['no_artist_history']:,}  "
          f"({round(row['no_artist_history']/total*100,1)}%)")
    print(f"  ≥3 comps in both (unchanged):       {row['good_in_both']:,}  "
          f"({round(row['good_in_both']/total*100,1)}%)")
    print(f"  ≥3 comps unfiltered → <3 filtered:  {row['lost_comps_due_to_filter']:,}  "
          f"({round(row['lost_comps_due_to_filter']/total*100,1)}%)  ← FALSE NEGATIVES")
    print(f"  <3 unfiltered → ≥3 filtered (rare): {row['gained_comps_with_filter']:,}  "
          f"({round(row['gained_comps_with_filter']/total*100,1)}%)")
    print(f"  Sparse in both (<3 either way):     {row['sparse_in_both']:,}  "
          f"({round(row['sparse_in_both']/total*100,1)}%)")

    # ── Q4: False-negative deep dive ─────────────────────────────────────────
    print(f"\n{sep}")
    print("Q4 — FALSE NEGATIVES: ARE THEY GENUINE OPPORTUNITIES OR TIER-MISMATCH?")
    print(sep)
    r4 = await db.execute(text("""
        WITH fn_lots AS (
            -- Lots that LOSE ≥3 comps due to the filter
            SELECT
                l.id::TEXT AS lot_id,
                l.estimate_low,
                l.estimate_high,
                l.artist_name_normalized,
                l.status,
                COUNT(hp.id)                                                    AS total_comps,
                COUNT(hp.id) FILTER (
                    WHERE hp.hammer_price_eur
                          BETWEEN l.estimate_low  * :floor
                              AND l.estimate_high * :ceil
                )                                                               AS comps_in_band,
                ROUND(AVG(hp.hammer_price_eur / NULLIF(l.estimate_high, 0)), 2) AS avg_hp_to_est_ratio,
                ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP
                    (ORDER BY hp.hammer_price_eur / NULLIF(l.estimate_high, 0))::numeric, 2)
                                                                                AS median_hp_to_est_ratio
            FROM lots l
            JOIN hammer_prices hp
              ON hp.artist_name_normalized = l.artist_name_normalized
            WHERE l.status       IN ('upcoming', 'live')
              AND l.estimate_low  IS NOT NULL
              AND l.estimate_high IS NOT NULL
              AND l.estimate_low  > 0
              AND l.estimate_high > 0
            GROUP BY l.id, l.estimate_low, l.estimate_high, l.artist_name_normalized, l.status
            HAVING COUNT(hp.id) >= 3
               AND COUNT(hp.id) FILTER (
                       WHERE hp.hammer_price_eur
                             BETWEEN l.estimate_low  * :floor
                                 AND l.estimate_high * :ceil
                   ) < 3
        )
        SELECT
            COUNT(*)                                                            AS fn_lots,
            -- Among false-negatives: how many have a median ratio suggesting
            -- genuine underestimation vs. tier mismatch?
            SUM(CASE WHEN median_hp_to_est_ratio BETWEEN 1.0 AND 4.0
                     THEN 1 ELSE 0 END)                                         AS likely_tier_mismatch,
            SUM(CASE WHEN median_hp_to_est_ratio > 4.0
                     AND  median_hp_to_est_ratio <= 8.0
                     THEN 1 ELSE 0 END)                                         AS genuine_opportunity_moderate,
            SUM(CASE WHEN median_hp_to_est_ratio > 8.0
                     THEN 1 ELSE 0 END)                                         AS genuine_opportunity_strong,
            ROUND(AVG(median_hp_to_est_ratio), 2)                               AS avg_median_ratio,
            ROUND(AVG(estimate_high), 0)                                        AS avg_estimate_high,
            ROUND(AVG(total_comps), 1)                                          AS avg_total_comps
        FROM fn_lots
    """), {"floor": BAND_FLOOR_RATIO, "ceil": BAND_CEIL_RATIO})
    row = r4.mappings().first()
    fn = row["fn_lots"] or 0
    if fn > 0:
        print(f"  False-negative lots:                {fn:,}")
        print(f"  — Likely tier mismatch (p50 1–4×):  {row['likely_tier_mismatch']:,}  "
              f"({round(row['likely_tier_mismatch']/fn*100,1)}%)  filter is CORRECT here")
        print(f"  — Genuine opp, moderate (p50 4–8×): {row['genuine_opportunity_moderate']:,}  "
              f"({round(row['genuine_opportunity_moderate']/fn*100,1)}%)  filter hides a real signal")
        print(f"  — Genuine opp, strong (p50 >8×):    {row['genuine_opportunity_strong']:,}  "
              f"({round(row['genuine_opportunity_strong']/fn*100,1)}%)  filter hides a strong signal")
        print(f"  Avg estimate_high of FN lots:       €{row['avg_estimate_high']:,.0f}")
        print(f"  Avg total comps before filter:      {row['avg_total_comps']:.1f}")
    else:
        print("  No false-negative lots found.")

    # ── Q5: Fallback defensibility ────────────────────────────────────────────
    print(f"\n{sep}")
    print("Q5 — FALLBACK ANALYSIS: estimate_high × 0.85 vs. actual outcomes")
    print(sep)
    r5 = await db.execute(text("""
        -- For lots that eventually sold: compare fallback bid with actual hammer
        SELECT
            ROUND(AVG(hammer_price_eur / NULLIF(estimate_high, 0)), 3)          AS avg_realized_to_est,
            ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP
                  (ORDER BY hammer_price_eur / NULLIF(estimate_high, 0))::numeric, 3) AS p25_ratio,
            ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP
                  (ORDER BY hammer_price_eur / NULLIF(estimate_high, 0))::numeric, 3) AS p50_ratio,
            ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP
                  (ORDER BY hammer_price_eur / NULLIF(estimate_high, 0))::numeric, 3) AS p75_ratio,
            ROUND(PERCENTILE_CONT(0.9) WITHIN GROUP
                  (ORDER BY hammer_price_eur / NULLIF(estimate_high, 0))::numeric, 3) AS p90_ratio,
            -- What fraction sold below estimate_high × 0.85?
            ROUND(AVG(CASE WHEN hammer_price_eur < estimate_high * 0.85
                           THEN 1.0 ELSE 0.0 END) * 100, 1)                     AS pct_sold_below_fallback,
            -- What fraction sold below estimate_high?
            ROUND(AVG(CASE WHEN hammer_price_eur < estimate_high
                           THEN 1.0 ELSE 0.0 END) * 100, 1)                     AS pct_sold_below_est_high,
            COUNT(*)                                                              AS n
        FROM hammer_prices
        WHERE hammer_price_eur IS NOT NULL
          AND estimate_high    IS NOT NULL
          AND estimate_high    > 0
          AND hammer_price_eur > 0
    """))
    row = r5.mappings().first()
    print(f"  n (historical records):             {row['n']:,}")
    print(f"  Realized/estimate_high ratio:")
    print(f"    p25 = {row['p25_ratio']}×   p50 = {row['p50_ratio']}×   "
          f"p75 = {row['p75_ratio']}×   p90 = {row['p90_ratio']}×")
    print(f"  % sold below estimate_high:         {row['pct_sold_below_est_high']}%")
    print(f"  % sold below est_high × 0.85:       {row['pct_sold_below_fallback']}%")
    print()
    print(f"  → If p50 realized > 1.0× est_high, using est_high (not ×0.85) as fallback is more accurate.")
    print(f"  → % below ×0.85 = lots where even the conservative fallback overbid.")

    # ── Q6: Cache invalidation — are there live lots currently serving ────────
    # stale (pre-fix) comparables?
    print(f"\n{sep}")
    print("Q6 — SUMMARY FOR MERGE DECISION")
    print(sep)
    print("  The numbers above answer:")
    print("  • What fraction of comps are inside the band? (Q1)")
    print("  • How many artists have p50 > 4× estimate? (Q2)")
    print("  • How many live lots lose comp coverage? (Q3, the false-negative rate)")
    print("  • Of those, how many represent real opportunities vs. tier mismatch? (Q4)")
    print("  • Is estimate_high × 0.85 a defensible fallback? (Q5)")
    print(sep)


def main():
    asyncio.run(run())


if __name__ == "__main__":
    main()
