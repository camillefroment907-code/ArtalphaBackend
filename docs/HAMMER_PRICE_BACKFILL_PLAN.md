# Nautilus — Hammer Price Backfill Plan

**Date:** 2026-06-02  
**Scope:** Steps 1–2 data foundation backfills for `hammer_prices`.  
**Safety rule:** All backfill columns are NULLABLE. Rollback = set to NULL. No data is ever destroyed.

---

## 1. Readiness Assessment

### 1.1 Existing scripts

| Script | Status | Idempotent | What it fills |
|---|---|---|---|
| `backfill_medium_category.py` | Production-ready | Yes (skips non-NULL rows) | `medium_category` |
| `backfill_hammer_signatures.py` | Production-ready | Yes (overwrites, safe) | `signed`, `edition_number`, `edition_size`, `is_ea` |
| `backfill_artist_real_data.py` | Production-ready | Yes | Artist stats from hammer_prices |
| `compute_artist_cagr.py` | Production-ready | Yes | `cagr_*` columns on `artists` |
| `compute_cagr_by_medium.py` | Production-ready | Yes | `cagr_by_medium` on `artists` |

### 1.2 New scripts (Steps 1–2 additions)

| Script | Status | Idempotent | What it does |
|---|---|---|---|
| `data_quality_report.py` | Ready | N/A — read-only | Produces coverage report |
| `detect_hammer_duplicates.py` | Ready | Yes (UNIQUE constraint) | Populates `hammer_price_dup_candidates` |
| `normalize_hammer_prices_cli.py` | Ready | Yes | Validates/backfills `auction_house_normalized` if column exists |

### 1.3 Pattern: `_parse_db_url()` + asyncpg

All scripts use this pattern (original in `backfill_hammer_signatures.py`):

```python
def _parse_db_url() -> tuple[str, dict]:
    raw = os.getenv("DATABASE_URL")
    if not raw:
        from app.config import settings
        raw = settings.database_url
    # Strips sslmode and channel_binding (not supported by asyncpg as URL params)
    # Returns (asyncpg_url, connect_args) where connect_args may contain ssl=ctx
```

This pattern handles both local (no SSL) and Neon/RDS (SSL) connections. It is the canonical
approach and must be reused in all new async scripts.

### 1.4 Batch cursor pattern

Scripts use cursor-based pagination to avoid OFFSET double-skip:

```python
# Pattern from backfill_hammer_signatures.py
last_id = None
while True:
    if last_id is None:
        rows = await session.execute(text("SELECT ... ORDER BY id LIMIT :limit"), {"limit": BATCH_SIZE})
    else:
        rows = await session.execute(text("SELECT ... WHERE id > :last_id ORDER BY id LIMIT :limit"), {...})
    if not rows:
        break
    last_id = rows[-1][0]
```

This is O(n) total and does not re-scan rows. Use this pattern for all new backfills.

---

## 2. Dry-Run Commands

Run these first to validate without writing anything.

```bash
# Medium category coverage analysis
DRY_RUN=1 python -m app.scripts.backfill_medium_category

# Signature / edition / EA analysis (samples 50k rows)
DRY_RUN=1 python -m app.scripts.backfill_hammer_signatures

# Data quality report (always read-only, no DRY_RUN needed)
python -m app.scripts.data_quality_report

# Auction house normalization analysis
python -m app.scripts.normalize_hammer_prices_cli --dry-run

# Duplicate detection (always dry-run by default)
python -m app.scripts.detect_hammer_duplicates

# Sample run (first 1000 rows only)
LIMIT=1000 python -m app.scripts.detect_hammer_duplicates
```

---

## 3. Limited-Run Commands

Test on a subset before running the full table.

```bash
# Medium category — first 5k rows
BATCH_SIZE=5000 DRY_RUN=0 python -m app.scripts.backfill_medium_category
# Then check: SELECT COUNT(*), medium_category FROM hammer_prices GROUP BY 2 LIMIT 10;

# Signatures — first 10k rows
BATCH_SIZE=10000 python -m app.scripts.backfill_hammer_signatures

# Auction house normalization — sample of 1000 distinct values
LIMIT=1000 python -m app.scripts.normalize_hammer_prices_cli --dry-run

# Duplicate detection — limited sample
LIMIT=5000 python -m app.scripts.detect_hammer_duplicates
```

---

## 4. Full-Run Commands

Run these once dry-run and limited-run are validated.

```bash
# Step 1: backfill medium_category (fastest — pure text classification)
python -m app.scripts.backfill_medium_category
# Expected runtime: ~5–15 min for 500k rows at BATCH_SIZE=5000

# Step 2: backfill signatures, editions, EA
python -m app.scripts.backfill_hammer_signatures
# Expected runtime: ~10–20 min for 500k rows at BATCH_SIZE=10000

# Step 3: data quality report (validation checkpoint)
python -m app.scripts.data_quality_report
# Expected runtime: <1 min (read-only aggregates)

# Step 4: duplicate detection (read-only scan)
python -m app.scripts.detect_hammer_duplicates
# Expected runtime: 5–30 min depending on table size (group-by scan)

# Step 5: duplicate detection write (only after reviewing Step 4 output)
python -m app.scripts.detect_hammer_duplicates --confirm
# Expected runtime: same + insert time for candidate rows

# Step 6: auction house normalization validation
python -m app.scripts.normalize_hammer_prices_cli --dry-run
# Then, IF auction_house_normalized column has been added:
python -m app.scripts.normalize_hammer_prices_cli --confirm

# Step 7: artist CAGR recomputation (after all data is clean)
python -m app.scripts.compute_artist_cagr
python -m app.scripts.compute_cagr_by_medium
```

---

## 5. Rollback Strategy

**Principle:** All backfilled columns are NULLABLE. Rollback = set to NULL.  
No rows are ever deleted. No schema changes are ever reversed by these scripts.

```sql
-- Rollback medium_category backfill
UPDATE hammer_prices SET medium_category = NULL;

-- Rollback signature backfill
UPDATE hammer_prices SET signed = NULL, edition_number = NULL, edition_size = NULL, is_ea = NULL;

-- Rollback duplicate candidates (if --confirm was used)
TRUNCATE hammer_price_dup_candidates;
-- (or DROP TABLE IF EXISTS hammer_price_dup_candidates; — table is disposable)

-- Rollback auction_house_normalized (if column was added and backfilled)
UPDATE hammer_prices SET auction_house_normalized = NULL;
```

**Note:** The `artists.cagr_*` columns can also be nulled:
```sql
UPDATE artists SET
    cagr_calculated = NULL,
    cagr_raw = NULL,
    cagr_confidence = NULL,
    cagr_source = NULL,
    cagr_n_sales = NULL,
    cagr_window_start = NULL,
    cagr_window_end = NULL,
    cagr_computed_at = NULL,
    cagr_by_medium = NULL;
```

---

## 6. Runtime Estimates

Based on the batch sizes and asyncpg throughput (typically 5k–15k rows/sec for UPDATE):

| Script | Batch Size | Est. rows | Est. time |
|---|---|---|---|
| `backfill_medium_category` | 5,000 | 500k | 5–15 min |
| `backfill_hammer_signatures` | 10,000 | 500k | 10–20 min |
| `data_quality_report` | N/A (read-only) | 500k | < 1 min |
| `detect_hammer_duplicates` | GROUP BY scan | 500k | 5–30 min |
| `detect_hammer_duplicates --confirm` | INSERT batches | varies | +2–5 min |
| `normalize_hammer_prices_cli` | cursor-based | 500k | 10–20 min |
| `compute_artist_cagr` | per-artist | varies | 15–45 min |
| `compute_cagr_by_medium` | per-artist×medium | varies | 15–45 min |

**Important:** Run these during off-peak hours (low user traffic) to avoid lock contention.
All UPDATE statements target specific rows by ID, so lock contention is minimal. However,
large batches can cause I/O pressure on the database.

---

## 7. Monitoring During Backfill

All scripts use Python's `logging` module at INFO level. Run with:

```bash
# Capture logs
python -m app.scripts.backfill_medium_category 2>&1 | tee backfill_medium_category.log

# Monitor progress in another terminal
tail -f backfill_medium_category.log
```

Log format: `2026-06-02 12:00:00,123 INFO <message>`

Progress is logged every batch. For `backfill_medium_category` at 5k batch:
```
2026-06-02 12:00:00 INFO  5,000/500,000 rows updated
2026-06-02 12:00:05 INFO 10,000/500,000 rows updated
...
```

---

## 8. Pre-conditions Checklist

Before running any backfill:

- [ ] `data_quality_report.py` has been run and output reviewed
- [ ] `DATABASE_URL` env var is set and pointing to the correct environment
- [ ] A DB backup or snapshot is available (standard pre-maintenance procedure)
- [ ] `DRY_RUN=1` test has been completed for the target script
- [ ] Off-peak window confirmed with the team

---

## 9. Post-backfill Validation

After each backfill, run these SQL checks:

```sql
-- medium_category
SELECT medium_category, COUNT(*) FROM hammer_prices GROUP BY 1 ORDER BY 2 DESC;
-- Expect: print/painting/photography/drawing/sculpture/other — no NULLs (or very few for rows with no medium at all)

-- signatures
SELECT
    COUNT(*) FILTER (WHERE signed = TRUE) AS signed_count,
    COUNT(*) FILTER (WHERE edition_number IS NOT NULL) AS with_edition,
    COUNT(*) FILTER (WHERE is_ea = TRUE) AS ea_count,
    COUNT(*) AS total
FROM hammer_prices;

-- duplicate candidates
SELECT confidence, COUNT(*) FROM hammer_price_dup_candidates GROUP BY 1;
-- Expect: rows in EXACT/HIGH/MEDIUM buckets

-- artist_name_normalized coverage
SELECT
    COUNT(*) FILTER (WHERE artist_name_normalized IS NOT NULL) AS normalized,
    COUNT(*) AS total,
    ROUND(COUNT(*) FILTER (WHERE artist_name_normalized IS NOT NULL) * 100.0 / COUNT(*), 1) AS pct
FROM hammer_prices;
```
