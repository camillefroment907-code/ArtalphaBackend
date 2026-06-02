# Upside Dataset Design — Phase 1

## Target Variable

**Name:** `sold_above_low_estimate` (binary integer 0/1)

**Definition:**
- `1` if `hammer_price_eur >= estimate_low`
- `0` if `hammer_price_eur < estimate_low`

## Eligible Rows — Exact WHERE Clause

```sql
WHERE hp.hammer_price_eur IS NOT NULL
  AND hp.hammer_price_eur > 0
  AND hp.estimate_low IS NOT NULL
  AND hp.estimate_low > 0
  AND hp.sale_date IS NOT NULL
```

## Columns Used

From `hammer_prices`:
- `id`, `artist_name_normalized`, `medium_category`, `dimensions`, `sale_date`
- `hammer_price_eur` (normalized to EUR — NOT `hammer_price`)
- `estimate_low`, `estimate_high`, `auction_house`
- `signed`, `is_ea`, `edition_number`

Joined from `artist_cycle_stats` (LEFT JOIN on `artist_name_normalized`):
- `cycle_fit_score` (not directly — computed at prediction time, not training)
- Actually: `is_eligible` from `artist_cycle_stats` joined via `artists.name_normalized`

## Temporal Split

| Split | Date Range | Purpose |
|-------|-----------|---------|
| Train | sale_date <= 2023-12-31 | Model fitting |
| Validation | 2024-01-01 to 2024-06-30 | Hyperparameter selection |
| Test | sale_date >= 2024-07-01 | Final evaluation |

**Rationale:** Strict temporal split prevents look-ahead bias. No random shuffling across time.
Art market data has seasonality (spring/autumn peaks) — a 6-month validation window captures both spring 2024 and early summer 2024 seasonal patterns.

## Expected Dataset Size

Based on typical art auction databases with ~5 years of data:
- Total eligible rows: estimated 50,000–500,000 (depends on data accumulation)
- Training set (pre-2024): ~70–80% of total
- Validation: ~10–15%
- Test: ~10–15%

**Minimum training size guard:** `--min-train-size 1000` (abort if < 1000 rows)

## Class Balance

Art auctions typically show 55–70% sell-above-low-estimate rate.
- Expected positive rate: ~60–65%
- **No upsampling** — document the imbalance, baselines will reflect it naturally
- If `precision_at_10` cannot beat the best baseline, model is not promoted

## Exclusion Rules

| Rule | Reason |
|------|--------|
| `hammer_price_eur IS NULL` | Cannot compute target |
| `hammer_price_eur <= 0` | Data quality — impossible value |
| `estimate_low IS NULL` | Cannot compute target |
| `estimate_low <= 0` | Data quality — impossible value |
| `sale_date IS NULL` | Cannot apply temporal split or leakage-safe features |

## SQL Skeleton

```sql
SELECT
    hp.id::TEXT AS hammer_price_id,
    hp.artist_name_normalized,
    hp.medium_category,
    hp.dimensions,
    hp.sale_date,
    hp.hammer_price_eur,
    hp.estimate_low,
    hp.estimate_high,
    hp.auction_house,
    hp.signed,
    hp.is_ea,
    hp.edition_number,
    CASE WHEN hp.hammer_price_eur >= hp.estimate_low THEN 1 ELSE 0 END AS target
FROM hammer_prices hp
WHERE hp.hammer_price_eur IS NOT NULL
  AND hp.hammer_price_eur > 0
  AND hp.estimate_low IS NOT NULL
  AND hp.estimate_low > 0
  AND hp.sale_date IS NOT NULL
ORDER BY hp.sale_date ASC
```
