# Upside Feature Importance — Phase 7

## Status: TBD — run `train_upside_model.py --confirm` to populate

After training, the script prints and saves feature importance to this file.

To generate:
```bash
cd backend
python -m app.scripts.train_upside_model --confirm
```

---

## Feature Importance (fill after training)

| Rank | Feature | Importance | Category |
|------|---------|-----------|---------|
| 1 | TBD | TBD | TBD |
| 2 | TBD | TBD | TBD |
| 3 | TBD | TBD | TBD |
| ... | ... | ... | ... |

---

## Full Feature List

```
artist_total_sales_before
artist_sold_above_pct_before
artist_median_premium_before
medium_sold_above_pct_before
medium_sales_count_before
house_sold_above_pct_before
house_sales_count_before
estimate_spread_pct
estimate_midpoint_eur
log_estimate_low_eur
medium_category
auction_house_norm
sale_month
sale_quarter
sale_season
is_signed
is_ea
has_edition
size_bucket
cycle_fit_score
artist_cycle_eligible
```

---

## Notes

- Features with importance near 0 should be considered for removal in v2
- `artist_sold_above_pct_before` is expected to be among the top predictors
- `log_estimate_low_eur` (price level) is expected to be significant — cheaper lots tend to sell above estimate more often (lower barrier)
- `estimate_spread_pct` wide spreads indicate price uncertainty — expected negative correlation with sold_above
