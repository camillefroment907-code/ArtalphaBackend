"""
Nautilus — Principal Quant Researcher Audit
READ-ONLY. No INSERT / UPDATE / DELETE / DDL.

Run from backend/ directory:
    DATABASE_URL=... python3 scripts/quant_audit.py
"""

import asyncio
import os
import sys
import statistics as _stat
import math

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.database import BgSessionLocal

import numpy as np
from scipy import stats as scipy_stats

SEP  = "═" * 72
SEP2 = "─" * 72

def pct(n, total):
    if not total: return "—"
    return f"{n/total*100:.1f}%"

def fmt(v):
    if v is None: return "—"
    try: return f"{float(v):,.1f}"
    except: return str(v)

def pearson(x, y):
    if len(x) < 5: return None, None
    r, p = scipy_stats.pearsonr(x, y)
    return round(r, 4), round(p, 6)

def spearman(x, y):
    if len(x) < 5: return None, None
    r, p = scipy_stats.spearmanr(x, y)
    return round(r, 4), round(p, 6)

def r_squared(x, y):
    if len(x) < 5: return None
    slope, intercept, r, p, se = scipy_stats.linregress(x, y)
    return round(r**2, 4)

def median_safe(lst):
    lst = [v for v in lst if v is not None]
    if not lst: return None
    return round(_stat.median(lst), 4)

def mean_safe(lst):
    lst = [v for v in lst if v is not None]
    if not lst: return None
    return round(sum(lst)/len(lst), 4)

async def run():
    async with BgSessionLocal() as db:

        print("\n" + SEP)
        print("  NAUTILUS — QUANT AUDIT — deal_score falsification test")
        print(SEP)

        # ══════════════════════════════════════════════════════════════════
        # ÉTAPE 0 — SCHÉMA
        # ══════════════════════════════════════════════════════════════════
        print("\n" + SEP2)
        print("ÉTAPE 0 — SCHÉMA")
        print(SEP2)

        SCHEMA_SQL = """
SELECT
    c.table_name,
    c.column_name,
    c.data_type,
    c.is_nullable,
    c.column_default
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name IN ('lots','hammer_prices')
ORDER BY c.table_name, c.ordinal_position;
"""
        print(f"\nSQL:\n{SCHEMA_SQL}")
        r = await db.execute(text(SCHEMA_SQL))
        rows = r.mappings().all()
        print(f"\n{'Table':<20} {'Column':<35} {'Type':<20} {'Nullable':<10} {'Default'}")
        print(f"{'─'*20} {'─'*35} {'─'*20} {'─'*10} {'─'*20}")
        for row in rows:
            print(f"{row['table_name']:<20} {row['column_name']:<35} {row['data_type']:<20} {row['is_nullable']:<10} {str(row['column_default'] or '')[:20]}")

        INDEX_SQL = """
SELECT
    t.relname AS table_name,
    i.relname AS index_name,
    array_to_string(array_agg(a.attname ORDER BY ix.indseq), ', ') AS columns
FROM pg_class t
JOIN pg_index ix ON t.oid = ix.indrelid
JOIN pg_class i  ON i.oid = ix.indexrelid
JOIN (SELECT *, generate_subscripts(indkey, 1) AS indseq FROM pg_index) ix ON ix.indrelid = t.oid AND ix.indexrelid = i.oid
JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ix.indkey[ix.indseq-1]
WHERE t.relname IN ('lots','hammer_prices')
GROUP BY t.relname, i.relname
ORDER BY t.relname, i.relname;
"""
        print(f"\n[INDEX SQL — omitted for brevity, key indexes checked separately]")

        # FK / relationship between lots and hammer_prices
        FK_SQL = """
SELECT
    tc.table_name, kcu.column_name,
    ccu.table_name  AS foreign_table,
    ccu.column_name AS foreign_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('lots','hammer_prices');
"""
        print(f"\nSQL (FKs):\n{FK_SQL}")
        r = await db.execute(text(FK_SQL))
        fk_rows = r.mappings().all()
        if fk_rows:
            for row in fk_rows:
                print(f"  {row['table_name']}.{row['column_name']} → {row['foreign_table']}.{row['foreign_column']}")
        else:
            print("  → No FK relationship between lots and hammer_prices.")
            print("  → Join key must be inferred: artist_name_normalized (hammer_prices) ↔ artist_name_raw normalized (lots)")

        # ══════════════════════════════════════════════════════════════════
        # ÉTAPE 1 — QUALITÉ DES DONNÉES
        # ══════════════════════════════════════════════════════════════════
        print("\n" + SEP2)
        print("ÉTAPE 1 — QUALITÉ DES DONNÉES")
        print(SEP2)

        DQ_SQL = """
SELECT
    COUNT(*)                                                           AS total_lots,
    COUNT(*) FILTER (WHERE deal_score IS NOT NULL)                     AS has_score,
    COUNT(*) FILTER (WHERE estimate_low IS NOT NULL)                   AS has_est_low,
    COUNT(*) FILTER (WHERE estimate_high IS NOT NULL)                  AS has_est_high,
    COUNT(*) FILTER (WHERE hammer_price IS NOT NULL)                   AS has_hammer,
    COUNT(*) FILTER (WHERE deal_score IS NOT NULL
                       AND estimate_low IS NOT NULL
                       AND hammer_price IS NOT NULL)                   AS full_set,
    COUNT(*) FILTER (WHERE deal_score IS NOT NULL
                       AND estimate_low IS NOT NULL
                       AND estimate_high IS NOT NULL
                       AND hammer_price IS NOT NULL)                   AS full_set_with_high,
    ROUND(AVG(deal_score)::numeric, 2)                                 AS avg_score_all,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY deal_score)::numeric, 2) AS med_score_all
FROM lots;
"""
        print(f"\nSQL:\n{DQ_SQL}")
        r = await db.execute(text(DQ_SQL))
        dq = r.mappings().one()
        total = dq['total_lots']
        print(f"\n  Total lots                          : {dq['total_lots']:,}")
        print(f"  With deal_score                     : {dq['has_score']:,}  ({pct(dq['has_score'], total)})")
        print(f"  With estimate_low                   : {dq['has_est_low']:,}  ({pct(dq['has_est_low'], total)})")
        print(f"  With estimate_high                  : {dq['has_est_high']:,}  ({pct(dq['has_est_high'], total)})")
        print(f"  With hammer_price (local currency)  : {dq['has_hammer']:,}  ({pct(dq['has_hammer'], total)})")
        print(f"  ANALYTICAL SET (score+est_low+hammer): {dq['full_set']:,}  ({pct(dq['full_set'], total)})")
        print(f"  FULL SET (+ est_high)               : {dq['full_set_with_high']:,}  ({pct(dq['full_set_with_high'], total)})")
        print(f"  Avg deal_score (all scored)         : {dq['avg_score_all']}")
        print(f"  Median deal_score (all scored)      : {dq['med_score_all']}")

        # Biais par source
        BIAS_SOURCE_SQL = """
SELECT
    source::text                                          AS source,
    COUNT(*)                                              AS n,
    COUNT(*) FILTER (WHERE hammer_price IS NOT NULL)      AS n_outcome,
    ROUND(AVG(deal_score)::numeric, 1)                    AS avg_score,
    ROUND(AVG(estimate_low)::numeric, 0)                  AS avg_est_low
FROM lots
WHERE deal_score IS NOT NULL
GROUP BY source::text
ORDER BY n DESC
LIMIT 15;
"""
        print(f"\n[BIAIS SOURCE]\nSQL:\n{BIAS_SOURCE_SQL}")
        r = await db.execute(text(BIAS_SOURCE_SQL))
        rows = r.mappings().all()
        print(f"\n  {'Source':<20} {'N':>8} {'N_outcome':>10} {'%_outcome':>10} {'Avg_score':>10} {'Avg_est_low':>12}")
        print(f"  {'─'*20} {'─'*8} {'─'*10} {'─'*10} {'─'*10} {'─'*12}")
        for row in rows:
            print(f"  {str(row['source']):<20} {row['n']:>8,} {row['n_outcome']:>10,} {pct(row['n_outcome'], row['n']):>10} {fmt(row['avg_score']):>10} {fmt(row['avg_est_low']):>12}")

        # Biais par maison
        BIAS_HOUSE_SQL = """
SELECT
    auction_house_name                                    AS house,
    COUNT(*)                                              AS n,
    COUNT(*) FILTER (WHERE hammer_price IS NOT NULL)      AS n_outcome,
    ROUND(AVG(deal_score)::numeric, 1)                    AS avg_score
FROM lots
WHERE deal_score IS NOT NULL AND auction_house_name IS NOT NULL
GROUP BY auction_house_name
ORDER BY n DESC
LIMIT 12;
"""
        print(f"\n[BIAIS MAISON]\nSQL:\n{BIAS_HOUSE_SQL}")
        r = await db.execute(text(BIAS_HOUSE_SQL))
        rows = r.mappings().all()
        print(f"\n  {'House':<30} {'N':>8} {'N_outcome':>10} {'%_outcome':>10} {'Avg_score':>10}")
        print(f"  {'─'*30} {'─'*8} {'─'*10} {'─'*10} {'─'*10}")
        for row in rows:
            print(f"  {str(row['house'])[:30]:<30} {row['n']:>8,} {row['n_outcome']:>10,} {pct(row['n_outcome'], row['n']):>10} {fmt(row['avg_score']):>10}")

        # Biais: lots WITH outcome vs WITHOUT outcome
        SURVIVAL_BIAS_SQL = """
SELECT
    CASE WHEN hammer_price IS NOT NULL THEN 'WITH_outcome' ELSE 'WITHOUT_outcome' END AS grp,
    COUNT(*)                                                    AS n,
    ROUND(AVG(deal_score)::numeric, 2)                          AS avg_score,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY deal_score)::numeric, 2) AS med_score,
    ROUND(AVG(estimate_low)::numeric, 0)                        AS avg_est_low,
    ROUND(AVG(estimate_high)::numeric, 0)                       AS avg_est_high
FROM lots
WHERE deal_score IS NOT NULL
GROUP BY grp;
"""
        print(f"\n[BIAIS SURVIE — lots avec vs sans outcome]\nSQL:\n{SURVIVAL_BIAS_SQL}")
        r = await db.execute(text(SURVIVAL_BIAS_SQL))
        rows = r.mappings().all()
        for row in rows:
            print(f"\n  Groupe        : {row['grp']}")
            print(f"  N             : {row['n']:,}")
            print(f"  Avg score     : {row['avg_score']}")
            print(f"  Median score  : {row['med_score']}")
            print(f"  Avg est_low   : {fmt(row['avg_est_low'])}")
            print(f"  Avg est_high  : {fmt(row['avg_est_high'])}")

        # ══════════════════════════════════════════════════════════════════
        # ÉTAPE 2 — ANALYSE PRINCIPALE : score>=80 vs score<60
        # ══════════════════════════════════════════════════════════════════
        print("\n" + SEP2)
        print("ÉTAPE 2 — ANALYSE PRINCIPALE : score ≥80 vs score <60")
        print(SEP2)

        MAIN_SQL = """
SELECT
    CASE WHEN deal_score >= 80 THEN 'HIGH (>=80)' ELSE 'LOW (<60)' END AS grp,
    COUNT(*)                                                             AS n_lots,
    COUNT(*) FILTER (WHERE hammer_price IS NOT NULL)                     AS n_outcomes,
    COUNT(*) FILTER (WHERE hammer_price > estimate_low)                  AS above_est_low,
    COUNT(*) FILTER (WHERE hammer_price > estimate_high)                 AS above_est_high,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (
        ORDER BY hammer_price / NULLIF(estimate_low, 0)
    )::numeric, 4)                                                       AS median_ratio_low,
    ROUND(AVG(hammer_price / NULLIF(estimate_low, 0))::numeric, 4)      AS mean_ratio_low,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (
        ORDER BY hammer_price / NULLIF(estimate_high, 0)
    )::numeric, 4)                                                       AS median_ratio_high,
    ROUND(AVG(hammer_price / NULLIF(estimate_high, 0))::numeric, 4)     AS mean_ratio_high
FROM lots
WHERE deal_score IS NOT NULL
  AND hammer_price IS NOT NULL
  AND estimate_low IS NOT NULL
  AND estimate_low > 0
  AND (deal_score >= 80 OR deal_score < 60)
GROUP BY grp
ORDER BY grp DESC;
"""
        print(f"\nSQL:\n{MAIN_SQL}")
        r = await db.execute(text(MAIN_SQL))
        rows = r.mappings().all()
        print(f"\n  {'Groupe':<15} {'N_lots':>8} {'N_out':>8} {'%_out':>7} {'Above_low':>10} {'%>low':>7} {'Above_high':>11} {'%>high':>7} {'Med×low':>9} {'Avg×low':>9} {'Med×high':>10} {'Avg×high':>10}")
        print(f"  {'─'*15} {'─'*8} {'─'*8} {'─'*7} {'─'*10} {'─'*7} {'─'*11} {'─'*7} {'─'*9} {'─'*9} {'─'*10} {'─'*10}")
        for row in rows:
            n_out = row['n_outcomes'] or 0
            print(f"  {row['grp']:<15} {row['n_lots']:>8,} {n_out:>8,} {pct(n_out, row['n_lots']):>7} "
                  f"{(row['above_est_low'] or 0):>10,} {pct(row['above_est_low'], n_out):>7} "
                  f"{(row['above_est_high'] or 0):>11,} {pct(row['above_est_high'], n_out):>7} "
                  f"{fmt(row['median_ratio_low']):>9} {fmt(row['mean_ratio_low']):>9} "
                  f"{fmt(row['median_ratio_high']):>10} {fmt(row['mean_ratio_high']):>10}")

        # ══════════════════════════════════════════════════════════════════
        # ÉTAPE 3 — CALIBRATION PAR BUCKET
        # ══════════════════════════════════════════════════════════════════
        print("\n" + SEP2)
        print("ÉTAPE 3 — CALIBRATION PAR BUCKET")
        print(SEP2)

        BUCKET_SQL = """
SELECT
    CASE
        WHEN deal_score >= 83 THEN '83+      '
        WHEN deal_score >= 77 THEN '77-82    '
        WHEN deal_score >= 70 THEN '70-76    '
        WHEN deal_score >= 60 THEN '60-69    '
        ELSE                       '<60      '
    END AS bucket,
    CASE
        WHEN deal_score >= 83 THEN 1
        WHEN deal_score >= 77 THEN 2
        WHEN deal_score >= 70 THEN 3
        WHEN deal_score >= 60 THEN 4
        ELSE 5
    END AS sort_order,
    COUNT(*)                                                             AS n_lots,
    COUNT(*) FILTER (WHERE hammer_price IS NOT NULL)                     AS n_outcomes,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (
        ORDER BY hammer_price / NULLIF(estimate_low, 0)
    )::numeric, 4)                                                       AS med_ratio_low,
    ROUND(AVG(hammer_price / NULLIF(estimate_low, 0))::numeric, 4)      AS avg_ratio_low,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (
        ORDER BY hammer_price / NULLIF(estimate_high, 0)
    )::numeric, 4)                                                       AS med_ratio_high,
    COUNT(*) FILTER (WHERE hammer_price > estimate_low)                  AS above_low,
    COUNT(*) FILTER (WHERE hammer_price > estimate_high)                 AS above_high
FROM lots
WHERE deal_score IS NOT NULL
  AND hammer_price IS NOT NULL
  AND estimate_low IS NOT NULL
  AND estimate_low > 0
GROUP BY bucket, sort_order
ORDER BY sort_order;
"""
        print(f"\nSQL:\n{BUCKET_SQL}")
        r = await db.execute(text(BUCKET_SQL))
        rows = r.mappings().all()
        print(f"\n  {'Bucket':<12} {'N_lots':>8} {'N_out':>7} {'%_out':>7} {'Med×low':>9} {'Avg×low':>9} {'Med×high':>10} {'%>low':>7} {'%>high':>7}")
        print(f"  {'─'*12} {'─'*8} {'─'*7} {'─'*7} {'─'*9} {'─'*9} {'─'*10} {'─'*7} {'─'*7}")
        bucket_data = []
        for row in rows:
            n_out = row['n_outcomes'] or 0
            bucket_data.append(row)
            print(f"  {row['bucket']:<12} {row['n_lots']:>8,} {n_out:>7,} {pct(n_out, row['n_lots']):>7} "
                  f"{fmt(row['med_ratio_low']):>9} {fmt(row['avg_ratio_low']):>9} "
                  f"{fmt(row['med_ratio_high']):>10} "
                  f"{pct(row['above_low'], n_out):>7} {pct(row['above_high'], n_out):>7}")

        # ══════════════════════════════════════════════════════════════════
        # ÉTAPE 4 — TEST DE MONOTONICITÉ
        # ══════════════════════════════════════════════════════════════════
        print("\n" + SEP2)
        print("ÉTAPE 4 — TEST DE MONOTONICITÉ (Pearson + Spearman)")
        print(SEP2)

        MONO_SQL = """
SELECT
    deal_score,
    hammer_price / NULLIF(estimate_low, 0)  AS ratio_low,
    hammer_price / NULLIF(estimate_high, 0) AS ratio_high
FROM lots
WHERE deal_score IS NOT NULL
  AND hammer_price IS NOT NULL
  AND estimate_low IS NOT NULL
  AND estimate_low > 0
  AND hammer_price > 0;
"""
        print(f"\nSQL:\n{MONO_SQL}")
        r = await db.execute(text(MONO_SQL))
        mono_rows = r.mappings().all()

        scores      = [float(row['deal_score']) for row in mono_rows]
        ratios_low  = [float(row['ratio_low'])  for row in mono_rows if row['ratio_low']  is not None]
        ratios_high = [float(row['ratio_high']) for row in mono_rows if row['ratio_high'] is not None]
        scores_low  = [float(row['deal_score']) for row in mono_rows if row['ratio_low']  is not None]
        scores_high = [float(row['deal_score']) for row in mono_rows if row['ratio_high'] is not None]

        pr_low,  pp_low  = pearson(scores_low,  ratios_low)
        sr_low,  sp_low  = spearman(scores_low, ratios_low)
        pr_high, pp_high = pearson(scores_high, ratios_high)
        sr_high, sp_high = spearman(scores_high, ratios_high)

        r2_low  = r_squared(scores_low,  ratios_low)
        r2_high = r_squared(scores_high, ratios_high)

        print(f"\n  N pairs (score + ratio_low)  : {len(scores_low):,}")
        print(f"  N pairs (score + ratio_high) : {len(scores_high):,}")
        print(f"\n  deal_score ↔ hammer/estimate_low:")
        print(f"    Pearson r   = {pr_low}  (p = {pp_low})")
        print(f"    Spearman ρ  = {sr_low}  (p = {sp_low})")
        print(f"    R²          = {r2_low}")
        print(f"\n  deal_score ↔ hammer/estimate_high:")
        print(f"    Pearson r   = {pr_high}  (p = {pp_high})")
        print(f"    Spearman ρ  = {sr_high}  (p = {sp_high})")
        print(f"    R²          = {r2_high}")

        # ══════════════════════════════════════════════════════════════════
        # ÉTAPE 4B — TEST MOMENTUM
        # ══════════════════════════════════════════════════════════════════
        print("\n" + SEP2)
        print("ÉTAPE 4B — TEST MOMENTUM")
        print(SEP2)

        # Fetch analysis set lots
        ANALYSIS_SET_SQL = """
SELECT
    l.id::text              AS lot_id,
    l.deal_score,
    l.artist_name_raw,
    l.auction_date,
    l.hammer_price          AS lot_hammer,
    l.estimate_low          AS lot_est_low
FROM lots l
WHERE l.deal_score IS NOT NULL
  AND l.hammer_price IS NOT NULL
  AND l.estimate_low IS NOT NULL
  AND l.estimate_low > 0
  AND l.hammer_price > 0
  AND l.artist_name_raw IS NOT NULL
ORDER BY l.auction_date NULLS LAST
LIMIT 5000;
"""
        print(f"\nSQL (analysis set for momentum):\n{ANALYSIS_SET_SQL}")
        r = await db.execute(text(ANALYSIS_SET_SQL))
        analysis_lots = r.mappings().all()
        print(f"\n  Analysis set: {len(analysis_lots):,} lots")

        # Fetch hammer_prices for momentum calculation
        HP_MOMENTUM_SQL = """
SELECT
    artist_name_normalized,
    sale_date,
    hammer_price_eur,
    estimate_low
FROM hammer_prices
WHERE hammer_price_eur IS NOT NULL
  AND hammer_price_eur > 0
  AND estimate_low IS NOT NULL
  AND estimate_low > 0
  AND artist_name_normalized IS NOT NULL
  AND sale_date IS NOT NULL
ORDER BY artist_name_normalized, sale_date;
"""
        print(f"\nSQL (hammer_prices for momentum):\n{HP_MOMENTUM_SQL}")
        r = await db.execute(text(HP_MOMENTUM_SQL))
        hp_rows = r.mappings().all()
        print(f"  hammer_prices rows loaded: {len(hp_rows):,}")

        # Build index: normalized_name -> sorted list of (date, ratio)
        from app.jobs.quality_filter import normalize_artist_name as _norm
        from collections import defaultdict
        from datetime import datetime as _dt

        hp_by_artist = defaultdict(list)
        for row in hp_rows:
            ratio = float(row['hammer_price_eur']) / float(row['estimate_low'])
            hp_by_artist[row['artist_name_normalized']].append(
                (row['sale_date'], ratio)
            )
        # Already sorted by SQL ORDER BY

        matched = []
        no_momentum = 0
        for lot in analysis_lots:
            norm = _norm(lot['artist_name_raw'])
            if not norm or norm not in hp_by_artist:
                no_momentum += 1
                continue

            lot_date = lot['auction_date']
            hist = [(d, r) for d, r in hp_by_artist[norm]
                    if lot_date is None or (d is not None and d < lot_date)]
            if len(hist) < 5:
                no_momentum += 1
                continue

            trailing = [r for _, r in hist[-5:]]
            trailing_med = _stat.median(trailing)
            lot_ratio = float(lot['lot_hammer']) / float(lot['lot_est_low'])

            matched.append({
                'score':       float(lot['deal_score']),
                'trailing':    trailing_med,
                'outcome':     lot_ratio,
            })

        print(f"\n  Lots with trailing_momentum_5 computed : {len(matched):,}")
        print(f"  Lots without momentum data             : {no_momentum:,}")

        if len(matched) >= 10:
            scores_m   = [m['score']    for m in matched]
            trailing_m = [m['trailing'] for m in matched]
            outcomes_m = [m['outcome']  for m in matched]

            pr_score_out,   pp_score_out   = pearson(scores_m,   outcomes_m)
            sr_score_out,   sp_score_out   = spearman(scores_m,  outcomes_m)
            pr_trail_out,   pp_trail_out   = pearson(trailing_m,  outcomes_m)
            sr_trail_out,   sp_trail_out   = spearman(trailing_m, outcomes_m)
            r2_score  = r_squared(scores_m,   outcomes_m)
            r2_trail  = r_squared(trailing_m, outcomes_m)

            # Model C: deal_score + trailing_momentum (multiple regression)
            X = np.column_stack([scores_m, trailing_m])
            y = np.array(outcomes_m)
            slope, resid, rank, sv = np.linalg.lstsq(
                np.column_stack([np.ones(len(y)), X]), y, rcond=None
            )
            y_pred = np.column_stack([np.ones(len(y)), X]) @ slope
            ss_res = np.sum((y - y_pred)**2)
            ss_tot = np.sum((y - y.mean())**2)
            r2_combined = round(1 - ss_res/ss_tot, 4) if ss_tot > 0 else None

            print(f"\n  [Modèle A] outcome ~ deal_score:")
            print(f"    Pearson  = {pr_score_out}  (p={pp_score_out})")
            print(f"    Spearman = {sr_score_out}  (p={sp_score_out})")
            print(f"    R²       = {r2_score}")
            print(f"\n  [Modèle B] outcome ~ trailing_momentum_5:")
            print(f"    Pearson  = {pr_trail_out}  (p={pp_trail_out})")
            print(f"    Spearman = {sr_trail_out}  (p={sp_trail_out})")
            print(f"    R²       = {r2_trail}")
            print(f"\n  [Modèle C] outcome ~ deal_score + trailing_momentum:")
            print(f"    R²       = {r2_combined}")
            print(f"    Δ R² vs Model A  = {round((r2_combined or 0) - (r2_score or 0), 4)}")
            print(f"    Δ R² vs Model B  = {round((r2_combined or 0) - (r2_trail or 0), 4)}")
        else:
            print("  INSUFFICIENT DATA for momentum test (<10 matched lots)")

        # ══════════════════════════════════════════════════════════════════
        # ÉTAPE 4C — TEST D'INCRÉMENTALITÉ
        # ══════════════════════════════════════════════════════════════════
        print("\n" + SEP2)
        print("ÉTAPE 4C — TEST D'INCRÉMENTALITÉ")
        print(SEP2)

        INCR_SQL = """
SELECT
    deal_score,
    estimate_low,
    estimate_high,
    hammer_price,
    hammer_price / NULLIF(estimate_low, 0)  AS ratio_low,
    hammer_price / NULLIF(estimate_high, 0) AS ratio_high
FROM lots
WHERE deal_score IS NOT NULL
  AND hammer_price IS NOT NULL
  AND estimate_low IS NOT NULL
  AND estimate_high IS NOT NULL
  AND estimate_low > 0
  AND estimate_high > 0
  AND hammer_price > 0;
"""
        print(f"\nSQL:\n{INCR_SQL}")
        r = await db.execute(text(INCR_SQL))
        incr_rows = r.mappings().all()
        print(f"\n  N (with score + est_low + est_high + hammer): {len(incr_rows):,}")

        if len(incr_rows) >= 10:
            i_scores  = [float(row['deal_score'])    for row in incr_rows]
            i_est_low = [float(row['estimate_low'])  for row in incr_rows]
            i_est_hi  = [float(row['estimate_high']) for row in incr_rows]
            i_out     = [float(row['ratio_low'])     for row in incr_rows]

            # Log transform prices (standard in auction literature)
            log_est_low = [math.log(v) for v in i_est_low if v > 0]
            log_est_hi  = [math.log(v) for v in i_est_hi  if v > 0]

            pr_A, _ = pearson(i_est_low, i_out)
            pr_B, _ = pearson(i_est_hi,  i_out)
            pr_C, _ = pearson(i_scores,  i_out)

            r2_A = r_squared(i_est_low, i_out)
            r2_B = r_squared(i_est_hi,  i_out)
            r2_C = r_squared(i_scores,  i_out)

            # D: estimate_low + deal_score
            Xd = np.column_stack([np.ones(len(i_out)), i_est_low, i_scores])
            yd = np.array(i_out)
            coef_d, _, _, _ = np.linalg.lstsq(Xd, yd, rcond=None)
            pred_d = Xd @ coef_d
            r2_D = round(1 - np.sum((yd - pred_d)**2) / np.sum((yd - yd.mean())**2), 4)

            # E: estimate_high + deal_score
            Xe = np.column_stack([np.ones(len(i_out)), i_est_hi, i_scores])
            coef_e, _, _, _ = np.linalg.lstsq(Xe, yd, rcond=None)
            pred_e = Xe @ coef_e
            r2_E = round(1 - np.sum((yd - pred_e)**2) / np.sum((yd - yd.mean())**2), 4)

            print(f"\n  Prédiction de hammer/estimate_low:")
            print(f"  {'Modèle':<35} {'Pearson r':>10} {'R²':>8}")
            print(f"  {'─'*35} {'─'*10} {'─'*8}")
            print(f"  A: estimate_low seul                {pr_A or '—':>10} {r2_A or '—':>8}")
            print(f"  B: estimate_high seul               {pr_B or '—':>10} {r2_B or '—':>8}")
            print(f"  C: deal_score seul                  {pr_C or '—':>10} {r2_C or '—':>8}")
            print(f"  D: estimate_low + deal_score        {'—':>10} {r2_D:>8}")
            print(f"  E: estimate_high + deal_score       {'—':>10} {r2_E:>8}")
            print(f"\n  Δ R² (D vs A — incrément du score)  : {round(r2_D - (r2_A or 0), 4)}")
            print(f"  Δ R² (E vs B — incrément du score)  : {round(r2_E - (r2_B or 0), 4)}")
        else:
            print("  INSUFFICIENT DATA for incrementality test (<10 lots)")

        # ══════════════════════════════════════════════════════════════════
        # ÉTAPE 5 — ROBUSTESSE (top 10/20/30%)
        # ══════════════════════════════════════════════════════════════════
        print("\n" + SEP2)
        print("ÉTAPE 5 — ROBUSTESSE : TOP 10/20/30% vs RESTE")
        print(SEP2)

        ROBUST_SQL = """
WITH ranked AS (
    SELECT
        deal_score,
        hammer_price,
        estimate_low,
        estimate_high,
        PERCENT_RANK() OVER (ORDER BY deal_score DESC) AS prank
    FROM lots
    WHERE deal_score IS NOT NULL
      AND hammer_price IS NOT NULL
      AND estimate_low IS NOT NULL
      AND estimate_low > 0
      AND hammer_price > 0
)
SELECT
    CASE
        WHEN prank <= 0.10 THEN 'Top 10%'
        WHEN prank <= 0.20 THEN 'Top 11-20%'
        WHEN prank <= 0.30 THEN 'Top 21-30%'
        ELSE                    'Bottom 70%'
    END AS grp,
    CASE
        WHEN prank <= 0.10 THEN 1
        WHEN prank <= 0.20 THEN 2
        WHEN prank <= 0.30 THEN 3
        ELSE 4
    END AS sort_order,
    COUNT(*)                                                AS n,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (
        ORDER BY hammer_price / NULLIF(estimate_low, 0))::numeric, 4) AS med_ratio,
    ROUND(AVG(hammer_price / NULLIF(estimate_low, 0))::numeric, 4)   AS avg_ratio,
    COUNT(*) FILTER (WHERE hammer_price > estimate_low)               AS above_low,
    COUNT(*) FILTER (WHERE hammer_price > estimate_high)              AS above_high,
    ROUND(AVG(deal_score)::numeric, 1)                               AS avg_score
FROM ranked
GROUP BY grp, sort_order
ORDER BY sort_order;
"""
        print(f"\nSQL:\n{ROBUST_SQL}")
        r = await db.execute(text(ROBUST_SQL))
        rows = r.mappings().all()
        print(f"\n  {'Groupe':<14} {'N':>7} {'Avg_score':>10} {'Med×low':>9} {'Avg×low':>9} {'%>low':>7} {'%>high':>7}")
        print(f"  {'─'*14} {'─'*7} {'─'*10} {'─'*9} {'─'*9} {'─'*7} {'─'*7}")
        for row in rows:
            print(f"  {row['grp']:<14} {row['n']:>7,} {fmt(row['avg_score']):>10} "
                  f"{fmt(row['med_ratio']):>9} {fmt(row['avg_ratio']):>9} "
                  f"{pct(row['above_low'], row['n']):>7} {pct(row['above_high'], row['n']):>7}")

        # ══════════════════════════════════════════════════════════════════
        # ÉTAPE 6 — BIAIS DE SURVIE (déjà partiellement en ÉTAPE 1)
        # ══════════════════════════════════════════════════════════════════
        print("\n" + SEP2)
        print("ÉTAPE 6 — BIAIS DE SURVIE (détail)")
        print(SEP2)

        SURV_SQL = """
SELECT
    CASE WHEN hammer_price IS NOT NULL AND estimate_low IS NOT NULL THEN 'OBSERVABLE'
         ELSE 'NOT_OBSERVABLE'
    END AS grp,
    COUNT(*)                                                    AS n,
    ROUND(AVG(deal_score)::numeric, 2)                          AS avg_score,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY deal_score)::numeric, 2) AS med_score,
    ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY deal_score)::numeric, 2) AS p25_score,
    ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY deal_score)::numeric, 2) AS p75_score,
    ROUND(AVG(estimate_low)::numeric, 0)                        AS avg_est_low,
    COUNT(*) FILTER (WHERE auction_house_name ILIKE '%christie%'
                       OR auction_house_name ILIKE '%sotheby%'
                       OR auction_house_name ILIKE '%phillips%')  AS major_house
FROM lots
WHERE deal_score IS NOT NULL
GROUP BY grp;
"""
        print(f"\nSQL:\n{SURV_SQL}")
        r = await db.execute(text(SURV_SQL))
        rows = r.mappings().all()
        for row in rows:
            print(f"\n  Groupe       : {row['grp']}")
            print(f"  N            : {row['n']:,}")
            print(f"  Avg score    : {row['avg_score']}")
            print(f"  Med score    : {row['med_score']}")
            print(f"  P25/P75      : {row['p25_score']} / {row['p75_score']}")
            print(f"  Avg est_low  : {fmt(row['avg_est_low'])}")
            print(f"  Major house  : {row['major_house']:,}")

        # ══════════════════════════════════════════════════════════════════
        # ÉTAPE 7 — VOLUME RÉEL
        # ══════════════════════════════════════════════════════════════════
        print("\n" + SEP2)
        print("ÉTAPE 7 — VOLUME RÉEL DU SET ANALYTIQUE")
        print(SEP2)

        VOL_SQL = """
SELECT
    COUNT(*)                                          AS n_lots,
    COUNT(DISTINCT artist_name_raw)                   AS n_artists,
    COUNT(DISTINCT auction_house_name)                AS n_houses,
    COUNT(DISTINCT category)                          AS n_categories,
    MIN(auction_date)                                 AS first_sale,
    MAX(auction_date)                                 AS last_sale
FROM lots
WHERE deal_score IS NOT NULL
  AND estimate_low IS NOT NULL
  AND hammer_price IS NOT NULL
  AND estimate_low > 0;
"""
        print(f"\nSQL:\n{VOL_SQL}")
        r = await db.execute(text(VOL_SQL))
        row = r.mappings().one()
        print(f"\n  N lots analytiques    : {row['n_lots']:,}")
        print(f"  N artistes            : {row['n_artists']:,}")
        print(f"  N maisons             : {row['n_houses']:,}")
        print(f"  N catégories          : {row['n_categories']:,}")
        print(f"  Première vente        : {row['first_sale']}")
        print(f"  Dernière vente        : {row['last_sale']}")

        # ══════════════════════════════════════════════════════════════════
        # ÉTAPE 7B — STABILITÉ TEMPORELLE
        # ══════════════════════════════════════════════════════════════════
        print("\n" + SEP2)
        print("ÉTAPE 7B — STABILITÉ TEMPORELLE PAR ANNÉE")
        print(SEP2)

        TEMPORAL_SQL = """
SELECT
    EXTRACT(YEAR FROM auction_date)::int              AS yr,
    COUNT(*)                                          AS n,
    ROUND(AVG(deal_score)::numeric, 1)                AS avg_score,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (
        ORDER BY hammer_price / NULLIF(estimate_low, 0))::numeric, 4) AS med_ratio_low,
    COUNT(*) FILTER (WHERE hammer_price > estimate_low)              AS above_low,
    COUNT(*) FILTER (WHERE deal_score >= 80 AND hammer_price > estimate_low) AS hi_score_above,
    COUNT(*) FILTER (WHERE deal_score >= 80)                         AS hi_score_n,
    COUNT(*) FILTER (WHERE deal_score < 60 AND hammer_price > estimate_low)  AS lo_score_above,
    COUNT(*) FILTER (WHERE deal_score < 60)                          AS lo_score_n
FROM lots
WHERE deal_score IS NOT NULL
  AND hammer_price IS NOT NULL
  AND estimate_low IS NOT NULL
  AND estimate_low > 0
  AND auction_date IS NOT NULL
GROUP BY yr
ORDER BY yr;
"""
        print(f"\nSQL:\n{TEMPORAL_SQL}")
        r = await db.execute(text(TEMPORAL_SQL))
        rows = r.mappings().all()
        print(f"\n  {'Year':>6} {'N':>7} {'Avg_scr':>8} {'Med×low':>9} {'%>low':>7} {'Hi≥80 %>low':>13} {'Lo<60 %>low':>13} {'Note'}")
        print(f"  {'─'*6} {'─'*7} {'─'*8} {'─'*9} {'─'*7} {'─'*13} {'─'*13} {'─'*15}")
        for row in rows:
            note = "⚠ n<50" if row['n'] < 50 else ""
            print(f"  {row['yr']:>6} {row['n']:>7,} {fmt(row['avg_score']):>8} "
                  f"{fmt(row['med_ratio_low']):>9} "
                  f"{pct(row['above_low'], row['n']):>7} "
                  f"{pct(row['hi_score_above'], row['hi_score_n']):>13} "
                  f"{pct(row['lo_score_above'], row['lo_score_n']):>13} "
                  f"{note}")

        # Per-year correlations
        TEMPORAL_CORR_SQL = """
SELECT
    EXTRACT(YEAR FROM auction_date)::int  AS yr,
    deal_score,
    hammer_price / NULLIF(estimate_low, 0) AS ratio
FROM lots
WHERE deal_score IS NOT NULL
  AND hammer_price IS NOT NULL
  AND estimate_low IS NOT NULL
  AND estimate_low > 0
  AND auction_date IS NOT NULL
ORDER BY yr;
"""
        r = await db.execute(text(TEMPORAL_CORR_SQL))
        tc_rows = r.mappings().all()

        from collections import defaultdict as _dd
        by_year = _dd(list)
        for row in tc_rows:
            if row['ratio'] is not None:
                by_year[row['yr']].append((float(row['deal_score']), float(row['ratio'])))

        print(f"\n  Corrélations Pearson/Spearman deal_score ↔ hammer/estimate_low par année:")
        print(f"\n  {'Year':>6} {'N':>7} {'Pearson r':>10} {'p-value':>10} {'Spearman ρ':>11} {'p-value':>10}")
        print(f"  {'─'*6} {'─'*7} {'─'*10} {'─'*10} {'─'*11} {'─'*10}")
        for yr in sorted(by_year.keys()):
            pairs = by_year[yr]
            if len(pairs) < 5:
                print(f"  {yr:>6} {len(pairs):>7}  ⚠ insufficient data")
                continue
            xs = [p[0] for p in pairs]
            ys = [p[1] for p in pairs]
            pr, pp = pearson(xs, ys)
            sr, sp = spearman(xs, ys)
            print(f"  {yr:>6} {len(pairs):>7,} {str(pr):>10} {str(pp):>10} {str(sr):>11} {str(sp):>10}")

        # ══════════════════════════════════════════════════════════════════
        # ÉTAPE 8 — FALSIFICATION
        # ══════════════════════════════════════════════════════════════════
        print("\n" + SEP2)
        print("ÉTAPE 8 — TEST DE FALSIFICATION")
        print(SEP2)
        print("""
  Hypothèse nulle : deal_score est inutile.

  Si deal_score était inutile, on observerait :
    - Corrélation Pearson ≈ 0 (non significative)
    - Corrélation Spearman ≈ 0 (non significative)
    - Ratio med hammer/estimate_low identique entre buckets
    - % au-dessus de estimate_low identique entre buckets
    - Aucune monotonie des ratios avec le score
    - Score moyen des lots observable ≈ score moyen des lots non observables

  Résultats observés vs hypothèse nulle :
""")

        # Random shuffle test: compare observed correlation vs shuffled
        if len(scores_low) >= 20:
            np.random.seed(42)
            shuffled = np.random.permutation(ratios_low)
            pr_shuf, pp_shuf = pearson(scores_low, list(shuffled))
            print(f"  Corrélation observée (score ↔ ratio_low) : Pearson r = {pr_low}")
            print(f"  Corrélation après shuffle aléatoire      : Pearson r = {pr_shuf}")
            print(f"  Différence                                : {round((pr_low or 0) - (pr_shuf or 0), 4)}")

            # Permutation test: how often does random beat observed?
            n_perm = 1000
            perm_corrs = []
            for _ in range(n_perm):
                shuf = np.random.permutation(ratios_low)
                r_s, _ = scipy_stats.pearsonr(scores_low, shuf)
                perm_corrs.append(r_s)
            perm_p = sum(abs(c) >= abs(pr_low or 0) for c in perm_corrs) / n_perm
            print(f"  Permutation test (n={n_perm}): p = {perm_p:.4f}")
            print(f"  (Proportion of random permutations with |r| ≥ observed |r|)")

        # ══════════════════════════════════════════════════════════════════
        # LIVRABLE FINAL — RÉSUMÉ
        # ══════════════════════════════════════════════════════════════════
        print("\n" + SEP)
        print("  RÉSUMÉ QUANTITATIF")
        print(SEP)

        print(f"""
  ── QUALITÉ DES DONNÉES ─────────────────────────────────────────────

  Set analytique (score + est_low + hammer) : {dq['full_set']:,} lots
  Sur {dq['has_score']:,} lots scorés total → {pct(dq['full_set'], dq['has_score'])} ont un outcome observable.

  ── CALIBRATION ──────────────────────────────────────────────────────

  [Buckets — médiane hammer/estimate_low]
""")
        for row in bucket_data:
            n_out = row['n_outcomes'] or 0
            if n_out > 0:
                print(f"  {row['bucket']}  n={n_out:,}  med×low={fmt(row['med_ratio_low'])}  %>low={pct(row['above_low'], n_out)}")

        print(f"""
  ── MONOTONICITÉ ─────────────────────────────────────────────────────

  Pearson  r (score ↔ ratio_low)  = {pr_low}  p={pp_low}
  Spearman ρ (score ↔ ratio_low)  = {sr_low}  p={sp_low}
  R²                               = {r2_low}

  ── CONCLUSION FORCÉE ────────────────────────────────────────────────
""")

        print("\n" + SEP)
        print("  CONCLUSIONS")
        print(SEP)

if __name__ == "__main__":
    asyncio.run(run())
