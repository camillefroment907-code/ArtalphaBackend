# Nautilus — Data Quality Report

**Status:** Not yet generated. Run the script below to populate this file.

---

## How to run

```bash
# From the backend/ directory:
python -m app.scripts.data_quality_report
```

The script will:
1. Connect to the database using `DATABASE_URL` (or `app.config.settings.database_url`)
2. Run read-only queries against `hammer_prices`
3. Save `reports/data_quality_report.json` with full results
4. Print a Markdown summary to stdout

## Environment

```bash
# Required:
export DATABASE_URL="postgresql://user:pass@host:5432/dbname?sslmode=require"

# Optional:
# No optional env vars for this script — it is always read-only.
```

## Expected output structure

```json
{
  "generated_at": "2026-06-02T12:00:00Z",
  "table": "hammer_prices",
  "total_rows": 500000,
  "overall_health": "GREEN | YELLOW | RED",
  "field_coverage": {
    "hammer_price_eur":        { "count_non_null": ..., "coverage_pct": ..., "status": "GREEN" },
    "estimate_low":            { ... },
    "estimate_high":           { ... },
    "medium":                  { ... },
    "medium_category":         { ... },
    "dimensions":              { ... },
    "artist_name_normalized":  { ... },
    "signed":                  { ... },
    "edition_number":          { ... }
  },
  "by_year": [
    { "year": 2020, "count": ..., "pct_with_estimate": ..., "pct_with_medium_category": ... },
    ...
  ],
  "by_source": [
    { "source": "artmarketapi", "count": ..., "pct_with_hammer_price_eur": ..., "pct_with_medium_category": ... },
    ...
  ],
  "by_auction_house_top20": [
    { "auction_house": "Christie's", "count": ..., "avg_hammer_price_eur": ..., "pct_with_estimates": ... },
    ...
  ],
  "duplicate_candidate_groups": 1234,
  "duplicate_candidate_rows":   3456,
  "missing_artist_name_normalized": 500,
  "pct_missing_artist_name_normalized": 0.1
}
```

## Coverage thresholds

| Status | Coverage |
|---|---|
| GREEN | ≥ 80% |
| YELLOW | 50–79% |
| RED | < 50% |

## What to do with the results

| Status | Recommended action |
|---|---|
| `hammer_price_eur` RED | Currency conversion pipeline may be broken — check `post_auction_fill.py` |
| `medium_category` RED | Run `python -m app.scripts.backfill_medium_category` |
| `artist_name_normalized` RED | Check `post_auction_fill.py` normalization step |
| `signed` / `edition_number` low | Run `python -m app.scripts.backfill_hammer_signatures` |
| Duplicate groups > 1% of total | Run `python -m app.scripts.detect_hammer_duplicates` |
