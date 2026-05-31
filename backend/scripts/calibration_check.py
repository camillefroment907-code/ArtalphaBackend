"""
Calibration Check — does the deal_score predict anything real?

Three questions:
  1. Do high-scored lots sell through more often than low-scored lots?
  2. Do high-scored lots hammer above estimate more often?
  3. In hammer_prices history, do artists we score highly outperform artists we score poorly?

Run from backend/ directory:
    python3 scripts/calibration_check.py
"""

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.database import BgSessionLocal


def pct(n, total):
    if not total:
        return "—"
    return f"{n / total * 100:.1f}%"


def fmt(v):
    if v is None:
        return "—"
    return f"{v:,.0f}"


async def main():
    async with BgSessionLocal() as db:

        print("\n" + "═" * 60)
        print("  NAUTILUS — CALIBRATION CHECK")
        print("═" * 60)

        # ── 0. Inventory ──────────────────────────────────────────────
        print("\n── 0. INVENTORY ─────────────────────────────────────────\n")

        r = await db.execute(text("""
            SELECT
                COUNT(*)                                            AS total_lots,
                COUNT(*) FILTER (WHERE deal_score IS NOT NULL)      AS scored_lots,
                COUNT(*) FILTER (WHERE status::text IN ('sold','SOLD'))    AS sold_lots,
                COUNT(*) FILTER (WHERE status::text IN ('unsold','UNSOLD')) AS unsold_lots,
                COUNT(*) FILTER (WHERE hammer_price IS NOT NULL)    AS has_hammer,
                COUNT(*) FILTER (WHERE estimate_low IS NOT NULL)    AS has_estimate
            FROM lots
        """))
        row = r.mappings().one()
        print(f"  Total lots in DB           : {fmt(row['total_lots'])}")
        print(f"  Lots with deal_score       : {fmt(row['scored_lots'])}")
        print(f"  Lots marked SOLD           : {fmt(row['sold_lots'])}")
        print(f"  Lots marked UNSOLD         : {fmt(row['unsold_lots'])}")
        print(f"  Lots with hammer_price     : {fmt(row['has_hammer'])}")
        print(f"  Lots with estimate_low     : {fmt(row['has_estimate'])}")

        r2 = await db.execute(text("""
            SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE hammer_price_eur > 0) AS with_price
            FROM hammer_prices
        """))
        row2 = r2.mappings().one()
        print(f"\n  hammer_prices total rows   : {fmt(row2['total'])}")
        print(f"  hammer_prices with EUR     : {fmt(row2['with_price'])}")

        # ── 1. Sell-through rate by score bracket ─────────────────────
        print("\n── 1. SELL-THROUGH RATE BY SCORE BRACKET ────────────────\n")
        print(f"  {'Score bracket':<20} {'Total':>8} {'Sold':>8} {'Unsold':>8} {'Sell-through':>14}")
        print(f"  {'-'*20} {'-'*8} {'-'*8} {'-'*8} {'-'*14}")

        r = await db.execute(text("""
            SELECT
                CASE
                    WHEN deal_score >= 83 THEN '≥83 (Exceptionnel)'
                    WHEN deal_score >= 77 THEN '77-82 (Très fort)'
                    WHEN deal_score >= 70 THEN '70-76 (Opportunité)'
                    WHEN deal_score >= 60 THEN '60-69 (À surveiller)'
                    WHEN deal_score >= 40 THEN '40-59 (Faible)'
                    ELSE                      '<40  (Très faible)'
                END AS bracket,
                CASE
                    WHEN deal_score >= 83 THEN 1
                    WHEN deal_score >= 77 THEN 2
                    WHEN deal_score >= 70 THEN 3
                    WHEN deal_score >= 60 THEN 4
                    WHEN deal_score >= 40 THEN 5
                    ELSE                       6
                END AS sort_order,
                COUNT(*)                                                     AS total,
                COUNT(*) FILTER (WHERE status::text IN ('sold','SOLD'))      AS sold,
                COUNT(*) FILTER (WHERE status::text IN ('unsold','UNSOLD'))  AS unsold
            FROM lots
            WHERE deal_score IS NOT NULL
            GROUP BY bracket, sort_order
            ORDER BY sort_order
        """))
        rows = r.mappings().all()
        for row in rows:
            print(f"  {row['bracket']:<20} {fmt(row['total']):>8} {fmt(row['sold']):>8} {fmt(row['unsold']):>8} {pct(row['sold'], row['total']):>14}")

        # ── 2. Premium ratio by score bracket ─────────────────────────
        print("\n── 2. HAMMER vs ESTIMATE BY SCORE BRACKET ───────────────\n")
        print("  (lots with deal_score AND hammer_price AND estimate_low)")
        print(f"\n  {'Score bracket':<20} {'N':>6} {'Median ratio':>14} {'Above est':>12} {'Below est':>12}")
        print(f"  {'-'*20} {'-'*6} {'-'*14} {'-'*12} {'-'*12}")

        r = await db.execute(text("""
            SELECT
                CASE
                    WHEN deal_score >= 83 THEN '≥83 (Exceptionnel)'
                    WHEN deal_score >= 77 THEN '77-82 (Très fort)'
                    WHEN deal_score >= 70 THEN '70-76 (Opportunité)'
                    WHEN deal_score >= 60 THEN '60-69 (À surveiller)'
                    WHEN deal_score >= 40 THEN '40-59 (Faible)'
                    ELSE                      '<40  (Très faible)'
                END AS bracket,
                CASE
                    WHEN deal_score >= 83 THEN 1
                    WHEN deal_score >= 77 THEN 2
                    WHEN deal_score >= 70 THEN 3
                    WHEN deal_score >= 60 THEN 4
                    WHEN deal_score >= 40 THEN 5
                    ELSE                       6
                END AS sort_order,
                COUNT(*)                                                    AS n,
                ROUND(
                    PERCENTILE_CONT(0.5) WITHIN GROUP (
                        ORDER BY hammer_price / NULLIF(estimate_low, 0)
                    )::numeric, 2
                )                                                           AS median_ratio,
                COUNT(*) FILTER (WHERE hammer_price > estimate_low)         AS above_est,
                COUNT(*) FILTER (WHERE hammer_price <= estimate_low)        AS below_est
            FROM lots
            WHERE deal_score IS NOT NULL
              AND hammer_price IS NOT NULL
              AND estimate_low IS NOT NULL
              AND estimate_low > 0
            GROUP BY bracket, sort_order
            ORDER BY sort_order
        """))
        rows = r.mappings().all()
        if not rows:
            print("  Aucun lot avec deal_score + hammer_price + estimate_low trouvé.")
            print("  → Les lots de Nautilus sont probablement actifs (pas encore vendus).")
        else:
            for row in rows:
                ratio = f"×{row['median_ratio']}" if row['median_ratio'] else "—"
                print(f"  {row['bracket']:<20} {fmt(row['n']):>6} {ratio:>14} {pct(row['above_est'], row['n']):>12} {pct(row['below_est'], row['n']):>12}")

        # ── 3 & 4. Artist score vs historical hammer — Python-side join ──
        # normalize_artist_name() strips accents + inverts "LASTNAME, Firstname"
        # so we must normalize in Python, not SQL, to match hammer_prices correctly
        from app.jobs.quality_filter import normalize_artist_name as _norm

        print("\n── 3. ARTIST SCORE vs HISTORICAL HAMMER PERFORMANCE ─────\n")
        print("  Method: normalize_artist_name() join — artists with ≥5 HP sales\n")
        print(f"  {'Score bracket':<22} {'Artists':>8} {'Median hammer/est':>18} {'Avg sales/artist':>18}")
        print(f"  {'-'*22} {'-'*8} {'-'*18} {'-'*18}")

        # Fetch all scored artists from lots
        r_lots = await db.execute(text("""
            SELECT artist_name_raw, AVG(deal_score) AS avg_score
            FROM lots
            WHERE deal_score IS NOT NULL AND artist_name_raw IS NOT NULL
            GROUP BY artist_name_raw
        """))
        lots_artists = {
            _norm(row["artist_name_raw"]): row["avg_score"]
            for row in r_lots.mappings().all()
            if _norm(row["artist_name_raw"])
        }

        # Fetch hammer stats per normalized artist
        r_hp = await db.execute(text("""
            SELECT
                artist_name_normalized,
                PERCENTILE_CONT(0.5) WITHIN GROUP (
                    ORDER BY hammer_price_eur / NULLIF(estimate_low, 0)
                ) AS median_ratio,
                COUNT(*) AS sale_count
            FROM hammer_prices
            WHERE hammer_price_eur > 0
              AND estimate_low > 0
              AND artist_name_normalized IS NOT NULL
            GROUP BY artist_name_normalized
            HAVING COUNT(*) >= 5
        """))
        hp_stats = {
            row["artist_name_normalized"]: {
                "median_ratio": row["median_ratio"],
                "sale_count":   row["sale_count"],
            }
            for row in r_hp.mappings().all()
        }

        # Join in Python
        matched = []
        for norm_name, avg_score in lots_artists.items():
            if norm_name in hp_stats:
                matched.append({
                    "name":         norm_name,
                    "avg_score":    avg_score,
                    "median_ratio": hp_stats[norm_name]["median_ratio"],
                    "sale_count":   hp_stats[norm_name]["sale_count"],
                })

        def _bracket(s):
            if s >= 83: return ("≥83 (Exceptionnel)", 1)
            if s >= 77: return ("77-82 (Très fort)",  2)
            if s >= 70: return ("70-76 (Opportunité)",3)
            if s >= 60: return ("60-69 (À surveiller)",4)
            if s >= 40: return ("40-59 (Faible)",     5)
            return            ("<40  (Très faible)",  6)

        from collections import defaultdict
        import statistics as stats_lib

        brackets: dict = defaultdict(list)
        for m in matched:
            label, order = _bracket(m["avg_score"])
            brackets[(order, label)].append(m)

        for (order, label) in sorted(brackets.keys()):
            artists = brackets[(order, label)]
            ratios = [a["median_ratio"] for a in artists if a["median_ratio"]]
            sales  = [a["sale_count"]   for a in artists]
            med_ratio = stats_lib.median(ratios) if ratios else None
            avg_sales = sum(sales) / len(sales) if sales else None
            ratio_str = f"×{med_ratio:.3f}" if med_ratio else "—"
            sales_str = f"{avg_sales:.1f}" if avg_sales else "—"
            print(f"  {label:<22} {len(artists):>8} {ratio_str:>18} {sales_str:>18}")

        print(f"\n  Total artistes matchés : {len(matched)} / {len(lots_artists)} scorés")

        # ── 4. Top 30 artists detail ───────────────────────────────────
        print("\n── 4. TOP 30 ARTISTES SCORÉS — DÉTAIL ───────────────────\n")
        print(f"  {'Artiste':<32} {'Score':>7} {'Ventes HP':>10} {'Median ×est':>12} {'Écart %':>9}")
        print(f"  {'-'*32} {'-'*7} {'-'*10} {'-'*12} {'-'*9}")

        # Need display names — fetch canonical artist_name_raw for each norm key
        r_names = await db.execute(text("""
            SELECT DISTINCT ON (LOWER(TRIM(artist_name_raw)))
                artist_name_raw
            FROM lots
            WHERE artist_name_raw IS NOT NULL
        """))
        raw_name_map: dict = {}
        for row in r_names.mappings().all():
            key = _norm(row["artist_name_raw"])
            if key and key not in raw_name_map:
                raw_name_map[key] = row["artist_name_raw"]

        top = sorted(matched, key=lambda x: x["avg_score"], reverse=True)[:30]
        for m in top:
            display = raw_name_map.get(m["name"], m["name"])[:32]
            ratio_str   = f"×{m['median_ratio']:.3f}" if m["median_ratio"] else "—"
            premium_str = f"{(m['median_ratio'] - 1) * 100:+.1f}%" if m["median_ratio"] else "—"
            print(f"  {display:<32} {m['avg_score']:>7.1f} {fmt(m['sale_count']):>10} {ratio_str:>12} {premium_str:>9}")

        # ── 5. Score distribution ──────────────────────────────────────
        print("\n── 5. DISTRIBUTION DES SCORES ───────────────────────────\n")
        r = await db.execute(text("""
            SELECT
                COUNT(*)                                                AS total,
                ROUND(MIN(deal_score)::numeric, 1)                      AS min_score,
                ROUND(MAX(deal_score)::numeric, 1)                      AS max_score,
                ROUND(AVG(deal_score)::numeric, 1)                      AS avg_score,
                ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY deal_score)::numeric, 1) AS median_score,
                COUNT(*) FILTER (WHERE deal_score >= 83)                AS top_tier,
                COUNT(*) FILTER (WHERE deal_score >= 70)                AS investable,
                COUNT(*) FILTER (WHERE deal_score < 60)                 AS low_quality
            FROM lots
            WHERE deal_score IS NOT NULL
        """))
        row = r.mappings().one()
        print(f"  Lots scorés          : {fmt(row['total'])}")
        print(f"  Score min / max      : {row['min_score']} / {row['max_score']}")
        print(f"  Score moyen / médian : {row['avg_score']} / {row['median_score']}")
        print(f"  Score ≥83 (top)      : {fmt(row['top_tier'])} ({pct(row['top_tier'], row['total'])})")
        print(f"  Score ≥70 (investable): {fmt(row['investable'])} ({pct(row['investable'], row['total'])})")
        print(f"  Score <60 (faible)   : {fmt(row['low_quality'])} ({pct(row['low_quality'], row['total'])})")

        print("\n" + "═" * 60)
        print("  FIN DU RAPPORT")
        print("═" * 60 + "\n")


if __name__ == "__main__":
    asyncio.run(main())
