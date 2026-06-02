# Nautilus — Steps 1 & 2 Implementation Report

**Date:** 2026-06-02  
**Status:** Complete  
**Platform safety:** ADDITIVE ONLY — zero existing files modified.

---

## 1. Audit Findings Summary

### What existed (DO NOT recreate)
- `quality_filter.py` — 5 normalization functions used in the live ingest pipeline
- `parse_dimensions()` in `api/lots.py` — basic W×H parser, used by API handlers
- `backfill_hammer_signatures.py` — idempotent signed/edition backfill with `_parse_db_url()` pattern
- `backfill_medium_category.py` — idempotent medium_category backfill
- `compute_artist_cagr.py` / `compute_cagr_by_medium.py` — CAGR scripts
- `hammer_prices` table with key columns: `artist_name_normalized`, `medium_category`, `signed`, `edition_number`, `is_ea`, `premium_ratio`
- Lot deduplication via `lot_fingerprint` + UNIQUE(source, external_id) on the `lots` table

### What was missing
- No `normalize_auction_house()` — raw strings like "Christie's Paris", "DROUOT" are not normalized
- No extended dimension parser (H:/W: format, comma decimals, diameter)
- No `size_bucket()` function
- No data quality report for `hammer_prices`
- No duplicate detection for `hammer_prices` (cross-source same-sale records)
- No feature engineering module for ML/scoring
- No tests for any normalization or feature engineering functions
- No `auction_house_normalized` column (schema gap — requires a migration)

---

## 2. Reuse Opportunities Taken

| What exists | How it was reused |
|---|---|
| `normalize_artist_name()` in `quality_filter.py` | Re-exported from `utils/normalize.py` — NOT reimplemented |
| `normalize_medium_category()` in `quality_filter.py` | Re-exported |
| `normalize_category()` in `quality_filter.py` | Re-exported |
| `normalize_title()` in `quality_filter.py` | Re-exported |
| `is_unknown_artist()` in `quality_filter.py` | Re-exported |
| `_parse_db_url()` pattern from `backfill_hammer_signatures.py` | Reused verbatim in all 3 new scripts |
| Cursor-based batch pagination from `backfill_hammer_signatures.py` | Reused in `normalize_hammer_prices_cli.py` |
| `asyncpg` + SSL pattern | Reused in all new async scripts |

---

## 3. Files Created

| File | Purpose |
|---|---|
| `docs/STEP_1_2_AUDIT.md` | Comprehensive audit of existing tables, columns, utilities, gaps |
| `docs/SCHEMA_REUSE_PLAN.md` | REUSE/EXTEND/CREATE classification for every addition |
| `docs/HAMMER_PRICE_BACKFILL_PLAN.md` | Readiness assessment, dry-run/full-run/rollback commands |
| `docs/STEP_1_2_IMPLEMENTATION_REPORT.md` | This file |
| `reports/data_quality_report.md` | Template with instructions for running the quality script |
| `backend/app/utils/normalize.py` | Re-exports + `normalize_auction_house()` + `parse_dimensions_cm()` + `size_bucket()` |
| `backend/app/scripts/data_quality_report.py` | Read-only quality profiling for `hammer_prices` |
| `backend/app/scripts/detect_hammer_duplicates.py` | Duplicate detection + optional write to candidate table |
| `backend/app/scripts/normalize_hammer_prices_cli.py` | Auction house normalization validation + optional backfill |
| `backend/app/engines/feature_engineering.py` | Leakage-safe feature vector builder + compute_* functions |
| `backend/tests/test_normalization.py` | 50+ normalization function tests |
| `backend/tests/test_feature_engineering.py` | Feature engineering tests incl. leakage guard assertions |
| `backend/tests/test_deduplication.py` | Pure-logic dedup tests (no DB) |

**Total new files: 13**

---

## 4. Files Modified

**NONE.**

Zero existing files were modified. All additions are in new files or new modules.

---

## 5. New Migrations Proposed

### Migration 1: `hammer_price_dup_candidates` table

```sql
-- Safe to run at any time — CREATE IF NOT EXISTS, no drops, no alterations
CREATE TABLE IF NOT EXISTS hammer_price_dup_candidates (
    id                  SERIAL PRIMARY KEY,
    hammer_price_id_a   TEXT NOT NULL,
    hammer_price_id_b   TEXT NOT NULL,
    confidence          VARCHAR(10) NOT NULL,
    match_keys          JSONB,
    detected_at         TIMESTAMP DEFAULT NOW(),
    resolved_at         TIMESTAMP,
    resolution          VARCHAR(20),
    UNIQUE(hammer_price_id_a, hammer_price_id_b)
);
```

This table is created automatically by `detect_hammer_duplicates.py --confirm`.  
It can also be applied as an Alembic migration. The script is safe to run first.

### Migration 2 (optional): `auction_house_normalized` column

```sql
-- Only needed if you want to persist normalized values.
-- The normalize_hammer_prices_cli.py script requires this column to exist
-- before it will write anything. It checks first.
ALTER TABLE hammer_prices
    ADD COLUMN IF NOT EXISTS auction_house_normalized VARCHAR(200);

CREATE INDEX IF NOT EXISTS ix_hammer_prices_house_normalized
    ON hammer_prices (auction_house_normalized);
```

**Note:** If you don't add this column, `normalize_hammer_prices_cli.py --dry-run` still
works (read-only analysis) and `normalize_auction_house()` is always available for
on-the-fly normalization in feature engineering and duplicate detection.

### Migration 3 (optional): `hammer_price_features` table

For pre-computed feature vectors (Step 3+ use):

```sql
CREATE TABLE IF NOT EXISTS hammer_price_features (
    hammer_price_id         TEXT PRIMARY KEY,
    normalized_artist       TEXT,
    normalized_house        TEXT,
    medium_category         VARCHAR(20),
    size_bucket             VARCHAR(20),
    artwork_period          VARCHAR(20),
    sale_year               INTEGER,
    sale_month              INTEGER,
    sale_quarter            INTEGER,
    estimate_midpoint_eur   FLOAT,
    estimate_spread_pct     FLOAT,
    artist_liquidity_at_sale  FLOAT,
    artist_momentum_at_sale   FLOAT,
    artist_house_premium_at_sale FLOAT,
    sold_above_low_estimate BOOLEAN,
    computed_at             TIMESTAMP DEFAULT NOW()
);
```

---

## 6. Tests Added

| File | Test count | What is tested |
|---|---|---|
| `test_normalization.py` | ~50 tests | `normalize_artist_name`, `normalize_auction_house`, `normalize_medium_category`, `parse_dimensions_cm`, `size_bucket`, `is_unknown_artist` |
| `test_feature_engineering.py` | ~35 tests | `compute_artwork_period`, `compute_estimate_spread_pct`, leakage guard (structural SQL inspection), `compute_artist_liquidity_at_date` (mocked), `build_hammer_features` (mocked) |
| `test_deduplication.py` | ~30 tests | `normalize_title_for_dedup`, `compute_duplicate_confidence`, `_price_close`, `_get_match_keys_detail` |

**Key test patterns:**
- Structural leakage tests use `inspect.getsource()` to verify SQL contains `sale_date < :reference_date`
- DB-dependent functions use `unittest.mock.MagicMock` — no DB connection required
- Edge cases covered: None inputs, empty strings, boundary values, French/Swedish/German input

---

## 7. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| `normalize.py` import fails if `quality_filter.py` import changes | LOW | Re-exports are stable; `quality_filter.py` is not modified |
| `detect_hammer_duplicates.py` produces false positives | MEDIUM | Only writes with `--confirm`; MEDIUM confidence pairs should be reviewed manually |
| Feature engineering `compute_artist_momentum_at_date` returns None for most artists if data is sparse | LOW | Returns None gracefully; `build_hammer_features` handles None for all historical features |
| `normalize_hammer_prices_cli.py --confirm` on missing column | NONE | Script explicitly checks column existence before any write |
| `data_quality_report.py` runs on a live DB under load | LOW | All queries are read-only `SELECT`; no locks acquired |
| `AUCTION_HOUSE_CANONICAL` misses auction houses not in the map | LOW | Passes through cleaned lowercase original — never breaks, just doesn't canonicalize |
| `parse_dimensions_cm` vs `parse_dimensions` — two functions parsing dimensions | LOW | Clearly documented; new code should use `parse_dimensions_cm`; API layer keeps using the original |

---

## 8. Rollback Strategy

**All columns added by backfills are NULLABLE.** Rollback = set to NULL:

```sql
-- Undo auction_house_normalized backfill
UPDATE hammer_prices SET auction_house_normalized = NULL;

-- Undo duplicate candidates
TRUNCATE hammer_price_dup_candidates;
-- or: DROP TABLE IF EXISTS hammer_price_dup_candidates;

-- Remove the normalize.py module (no DB side effects)
-- Just delete backend/app/utils/normalize.py

-- Remove feature_engineering.py (no DB side effects)
-- Just delete backend/app/engines/feature_engineering.py
```

Python files can be deleted without any DB impact. The only DB changes are:
1. The optional `auction_house_normalized` column (ALTER TABLE)
2. The `hammer_price_dup_candidates` table (CREATE TABLE)

Both are fully reversible.

---

## 9. Remaining Work Before Step 3

### High priority
1. **Run `data_quality_report.py`** and review output. This determines which backfills are urgent.
2. **Run `backfill_medium_category.py`** if `medium_category` coverage is < 80%.
3. **Run `backfill_hammer_signatures.py`** if `signed` coverage is low.
4. **Add `auction_house_normalized` column** via migration (migration is optional but enables CLI backfill).
5. **Run `detect_hammer_duplicates.py`** and review EXACT pairs — these are likely true duplicates.

### Medium priority
6. **Add `hammer_price_features` table** via migration.
7. **Build batch feature computation script** (wraps `build_hammer_features()` for all rows).
8. **Integrate `normalize_auction_house()`** into `post_auction_fill.py` or the hammer ingest path for new records.

### Low priority (Step 3+)
9. ML model training using the feature vectors.
10. Automated duplicate resolution workflow (currently manual review).
11. Per-house premium heatmap visualization.

### Scheduler additions (when ready)
```python
# Add to celery_app.py beat_schedule:
"data-quality-report-weekly": {
    "task": "app.jobs.tasks.run_data_quality_report",
    "schedule": crontab(minute="0", hour="4", day_of_week="1"),  # Monday 4am
    "options": {"queue": "maintenance"},
},
```
