# Nautilus — Steps 1 & 2 Data Foundation Audit

**Date:** 2026-06-02  
**Author:** Claude Code (automated audit pass)  
**Scope:** Identify what already exists before building the Steps 1–2 data foundation so
nothing is duplicated and every addition is genuinely additive.

---

## 1. Existing Relevant Tables

### `hammer_prices` (core table)
Primary store of historical auction results. Key columns for Steps 1–2:

| Column | Type | Status |
|---|---|---|
| `id` | UUID PK | Stable |
| `external_id` | VARCHAR(500) UNIQUE | Dedup anchor |
| `artist_name` | VARCHAR(500) NOT NULL | Raw input |
| `artist_name_normalized` | VARCHAR(500) NULLABLE INDEXED | Normalization field |
| `artwork_title` | VARCHAR(1000) | Raw input |
| `year_created` | INTEGER NULLABLE | Artwork period feature |
| `medium` | VARCHAR(300) NULLABLE | Raw input |
| `medium_category` | VARCHAR(20) NULLABLE INDEXED | Normalized bucket |
| `dimensions` | VARCHAR(200) NULLABLE | Raw dimension string |
| `sale_date` | DATETIME INDEXED NULLABLE | Temporal anchor |
| `hammer_price` | FLOAT NULLABLE | Raw price |
| `currency` | VARCHAR(10) DEFAULT 'EUR' | Currency |
| `hammer_price_eur` | FLOAT NULLABLE | EUR-normalized price |
| `auction_house` | VARCHAR(300) INDEXED NULLABLE | Raw house string |
| `estimate_low` | FLOAT NULLABLE | Pre-sale estimate |
| `estimate_high` | FLOAT NULLABLE | Pre-sale estimate |
| `source` | VARCHAR(100) DEFAULT 'unknown' | Data source |
| `signed` | BOOLEAN NULLABLE | Backfilled by backfill_hammer_signatures.py |
| `edition_number` | INTEGER NULLABLE | Backfilled |
| `edition_size` | INTEGER NULLABLE | Backfilled |
| `is_ea` | BOOLEAN NULLABLE | Backfilled |
| `lot_id` | UUID FK→lots NULLABLE | Link to live lots |
| `premium_ratio` | FLOAT NULLABLE | hammer / estimate_low |

**Composite index:** `ix_hammer_prices_artist_date` on `(artist_name, sale_date)`  
**Gap:** No `auction_house_normalized` column. No `width_cm`, `height_cm`, `area_cm2` columns.
No `size_bucket` column. No `artwork_period` column.

### `hammer_artist_stats`
Pre-aggregated hammer price statistics per normalized artist name (≥ 5 sales).

| Column | Type |
|---|---|
| `artist_name_normalized` | VARCHAR(500) PK |
| `avg_eur` | FLOAT NULLABLE |
| `median_eur` | FLOAT NULLABLE |
| `sale_count` | INTEGER DEFAULT 0 |
| `last_updated` | DATETIME |

### `hammer_artist_medium_stats`
Per-artist × per-medium-category stats (≥ 3 sales). Composite PK.

| Column | Type |
|---|---|
| `artist_name_normalized` | VARCHAR(500) PK |
| `medium_category` | VARCHAR(50) PK |
| `avg_eur`, `median_eur`, `sale_count`, `last_updated` | — |

### `artists`
Canonical artist registry.

Relevant columns for Steps 1–2:
- `name_normalized` — indexed, stable normalized key
- `cagr_calculated`, `cagr_raw`, `cagr_confidence` — computed from hammer_prices
- `cagr_by_medium` — JSON per-medium CAGR breakdown
- `cagr_n_sales`, `cagr_window_start`, `cagr_window_end` — CAGR provenance
- `avg_auction_price`, `median_auction_price`, `total_lots_sold` — market aggregates
- `liquidity_score`, `sell_through_rate` — relevance to feature engineering

### `artist_signals`
Predictive oracle signals (one row per artist, recomputed weekly).

Relevant for feature engineering context:
- `price_median_90d`, `price_median_180d`, `price_growth_ratio`
- `vol_30d`, `vol_90d`, `vol_180d`
- `oracle_score_6m`, `oracle_score_18m`, `oracle_signal`

### `artist_aliases`
Alternate artist name forms for fuzzy matching:
- `alias`, `alias_normalized`, `alias_type`

### `artist_profiles`
Artsy-sourced enrichment:
- `momentum_score`, `liquidity_score`, `institutional_score`
- `gallery_tier_avg`, `public_collections_count`

### `artsper_artist_snapshots`
Primary market moat — 193k+ artworks.

Relevant for feature cross-referencing:
- `artist_name_normalized`
- `price_min`, `price_max`, `price_avg`, `price_median`
- `works_available`, `works_sold`

### `lots`
Live lot table. Shares the dedup logic via `lot_fingerprint` + UNIQUE(source, external_id).

---

## 2. Existing Normalization Columns and Feature-like Fields

### In `hammer_prices`
- `artist_name_normalized` — populated by backfill_medium_category.py convention + post_auction_fill.py
- `medium_category` — one of: print/painting/photography/drawing/sculpture/other
- `signed` — boolean, backfilled
- `edition_number`, `edition_size` — backfilled
- `is_ea` — boolean, backfilled
- `premium_ratio` — derived feature (hammer / estimate_low)

### In `lots`
- `lot_fingerprint` — SHA-256 of (title + artist + est_low + est_high) for cross-source dedup

### In `artists`
- `name_normalized` — stable cross-source key

---

## 3. Existing Normalization Utilities

**File:** `backend/app/jobs/quality_filter.py`

| Function | Purpose |
|---|---|
| `normalize_artist_name(name: str) -> str` | Handles comma-format, SURNAME Firstname, parenthetical dates, accents, Unicode |
| `normalize_medium_category(medium: str \| None) -> str` | Maps free-text to: print / painting / photography / drawing / sculpture / other |
| `normalize_category(raw: str) -> str` | Maps to 6 display categories: Paintings / Prints & Multiples / Drawings / Sculpture / Photography / Street Art / Other |
| `normalize_title(title: str) -> str` | Lowercases, strips lot numbers, dimensions, punctuation |
| `is_unknown_artist(name: str) -> bool` | Detects 30+ "unknown artist" phrases in 12 languages |
| `filter_and_deduplicate(lots) -> (lots, stats)` | Full pipeline: blacklist + quality + cross-source dedup |

**File:** `backend/app/api/lots.py` (lines 125–148)

| Function | Purpose |
|---|---|
| `parse_dimensions(dimensions_str: str) -> dict` | Basic W×H cm/in parser → `{width_cm, height_cm}` |

**Missing:** No `normalize_auction_house()`. No extended dimension parser (H: W: format, comma decimals, 3D, diameter). No `size_bucket()`.

---

## 4. Existing Deduplication Logic

### Lot-level (lots table)
- `lot_fingerprint` (SHA-256) + partial UNIQUE index (`uq_lots_fingerprint WHERE lot_fingerprint IS NOT NULL`)
- UNIQUE partial index on `(source, external_id)` — prevents same-source duplicates
- `filter_and_deduplicate()` — cross-source dedup using `_compute_similarity()` scoring

### Hammer price level
- `external_id` UNIQUE constraint — prevents re-ingestion of same record
- No explicit duplicate candidate tracking table (gap)
- No grouping/flagging of records that appear to be the same sale from different sources

---

## 5. Existing Backfill Scripts

| Script | What It Does | Idempotent |
|---|---|---|
| `backfill_hammer_signatures.py` | Fills `signed`, `edition_number`, `edition_size`, `is_ea` from title+medium text | Yes — re-runs overwrite same values |
| `backfill_medium_category.py` | Fills `medium_category` from `medium` using `normalize_medium_category()` | Yes — only processes NULL rows |
| `backfill_hammer_from_lots.py` | Promotes closed lots to hammer_prices | Partially — checks external_id |
| `backfill_artist_real_data.py` | Syncs artist stats from hammer_prices to artists table | Yes |
| `compute_artist_cagr.py` | Computes per-artist CAGR with tier fallbacks | Yes |
| `compute_cagr_by_medium.py` | Per-medium CAGR breakdown | Yes |

**Note:** All scripts use the `_parse_db_url()` + asyncpg pattern for SSL-safe async DB access. This pattern must be reused in all new scripts.

---

## 6. Existing Jobs and Schedulers

**File:** `backend/app/jobs/celery_app.py` — Celery Beat schedule

| Schedule | Task | Frequency |
|---|---|---|
| `poll-and-score-twice-daily` | poll + score lots | 6am, 6pm UTC |
| `rescore-live-lots-every-hour` | re-score live lots | hourly |
| `daily-cleanup` | cleanup | 3am UTC daily |
| `dedup-cleanup-weekly` | dedup | Monday 2am |
| `ingest-artsy-liveauctioneers-every-3h` | artsy + LA ingest | every 3h |
| `weekly-brief-monday-8am` | email brief | Monday 8am |
| `sync-artsper-artist-data-weekly` | Artsper sync | Sunday 1am |
| `oracle-weekly-sunday-2am` | Oracle signals | Sunday 2am |
| `portfolio-snapshot-weekly` | portfolio snapshots | Sunday 8pm |

**Gap:** No scheduled backfill for `auction_house_normalized`, parsed dimensions, or feature engineering. These need to be run manually or added to beat after validation.

---

## 7. Gaps — What Is Missing for Steps 1–2

### Normalization gaps
1. **No `normalize_auction_house()`** — "Christie's Paris", "Sotheby's London", "HÔTEL DROUOT" are all distinct strings in the DB with no canonical mapping.
2. **No extended `parse_dimensions_cm()`** — The existing `parse_dimensions()` in `lots.py` handles only basic W×H cm/in. Missing: H:/W: format, comma decimals (French catalogs), 3D objects, diameter (Ø).
3. **No `size_bucket()`** — No area-based size category computed.

### Schema gaps
4. **No `hammer_price_features` table** — No pre-computed feature vectors for ML/scoring use.
5. **No `hammer_price_dup_candidates` table** — No tracking of suspected duplicate records across sources.
6. **No `auction_house_normalized` column in `hammer_prices`** — Normalization currently only computed on-the-fly.

### Reporting gaps
7. **No data quality report** — No automated coverage/completeness analysis of hammer_prices.
8. **No duplicate detection report** — Unknown how many same-sale records exist from multiple sources.

### Feature engineering gaps
9. **No `feature_engineering.py`** — No centralized place to build leakage-safe feature vectors.
10. **No `artist_liquidity_at_date()`** — Existing `liquidity_score` in artists table is a point-in-time value, not a historical time-aware lookup.
11. **No `artist_momentum_at_date()`** — `ArtistSignal.price_growth_ratio` is current-only.
12. **No `artist_house_premium_at_date()`** — No per-house premium factor computed from historical data.

### Testing gaps
13. **No tests for normalization utilities** — `quality_filter.py` functions are untested.
14. **No tests for feature engineering** — No leakage guard tests.
15. **No tests for dedup detection logic** — Confidence scoring untested.
