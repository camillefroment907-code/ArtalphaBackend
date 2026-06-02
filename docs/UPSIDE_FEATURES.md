# Upside Feature Selection — Phase 2

## Selected Features

### Artist History (leakage-safe via window functions)
| Feature | SQL Expression | Notes |
|---------|---------------|-------|
| `artist_total_sales_before` | COUNT OVER (PARTITION BY artist_name_normalized ORDER BY sale_date ROWS UNBOUNDED PRECEDING EXCLUDE CURRENT ROW) | Rows before this sale |
| `artist_sold_above_pct_before` | AVG(target) same partition | Historical beat-estimate rate |
| `artist_median_premium_before` | PERCENTILE_CONT(0.5) of (hammer/estimate_low) same partition | Median premium ratio |

### Medium-Specific History (leakage-safe)
| Feature | Notes |
|---------|-------|
| `medium_sold_above_pct_before` | For same artist + medium_category, before this sale |
| `medium_sales_count_before` | COUNT for same artist + medium |

### House-Specific History (leakage-safe)
| Feature | Notes |
|---------|-------|
| `house_sold_above_pct_before` | For same artist + auction_house (normalized), before this sale |
| `house_sales_count_before` | COUNT for same artist + house |

### Estimate Features (no leakage — from lot itself)
| Feature | Formula | Notes |
|---------|---------|-------|
| `estimate_spread_pct` | (estimate_high - estimate_low) / estimate_low | Null if high missing |
| `estimate_midpoint_eur` | (estimate_low + estimate_high) / 2 | Falls back to estimate_low |
| `log_estimate_low_eur` | log(estimate_low) | Price level signal |

### Categorical (label-encoded or target-encoded)
| Feature | Values | Notes |
|---------|--------|-------|
| `medium_category` | painting/print/sculpture/photography/drawing/other | Normalized |
| `auction_house_norm` | normalized house string | From normalize_auction_house() |
| `sale_month` | 1–12 | Seasonality |
| `sale_quarter` | 1–4 | Seasonality |
| `sale_season` | spring/summer/autumn/winter | From cycle_intelligence.month_to_season() |

### Artwork Attributes
| Feature | Type | Notes |
|---------|------|-------|
| `is_signed` | int (0/1) | signed column, null → 0 |
| `is_ea` | int (0/1) | épreuve d'artiste, null → 0 |
| `has_edition` | int (0/1) | edition_number IS NOT NULL |
| `size_bucket` | str | small/medium/large/very_large from dimensions |

### Cycle Intelligence (from artist_cycle_stats if available)
| Feature | Notes |
|---------|-------|
| `cycle_fit_score` | From artist_cycle_stats (best_medium_wilson as proxy for artist quality) |
| `artist_cycle_eligible` | is_eligible from artist_cycle_stats (0/1) |

---

## Rejected Features

| Feature | Reason Rejected |
|---------|-----------------|
| `hammer_price_eur` | TARGET LEAKAGE — this IS the target |
| `premium_ratio` | TARGET LEAKAGE — derived from hammer_price/estimate_low |
| `premium_paid` | TARGET LEAKAGE — legacy premium column |
| `artist_liquidity_at_sale` (per-row) | O(N×DB calls) catastrophically slow for training |
| `artist_momentum_at_sale` (per-row) | Same — replaced by batch window functions |
| `artist_house_premium_at_sale` (per-row) | Same — batch alternative used |
| `sale_year` | Risk of spurious year overfitting; temporal split handles time |
| `artwork_period` | Correlated with `sale_year` / `year_created`; added noise in tests |
| `artist_name_normalized` | Too many categories, target-encode leakage risk |
| `artwork_title` | NLP — scope creep |
| `year_created` | Too sparse, correlated with artist |

---

## Feature Engineering Notes

### Leakage-Safe Window Functions
All artist history features use:
```sql
ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
```
This includes all rows chronologically BEFORE the current row (by sale_date), excluding the current row itself. This is the batch equivalent of `sale_date < :reference_date`.

**Edge case — same-day sales:** Multiple sales on the same date for the same artist create ambiguity. We use `ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING` (not RANGE) to use physical row ordering. This is slightly imperfect for same-day sales but is standard practice and not a material leak.

### Null Handling in Training
- Numeric nulls → filled with column median (computed on training set only)
- Categorical nulls → filled with "unknown"
- `artist_total_sales_before = 0` for a artist's first-ever sale (no prior history)
- `artist_sold_above_pct_before = null` when `artist_total_sales_before = 0` → filled with global mean

### Preprocessing Pipeline
1. Label-encode: `medium_category`, `auction_house_norm`, `sale_season`
2. Fill numeric nulls: median (fit on train only)
3. Fill categorical nulls: "unknown"
4. Log-transform: `estimate_midpoint_eur`, `log_estimate_low_eur` (already logged)
5. Store: encoding maps + imputation values in `preprocessing_config` dict alongside model artifact
