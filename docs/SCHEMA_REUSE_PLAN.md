# Nautilus — Steps 1 & 2 Schema Reuse Plan

**Date:** 2026-06-02  
**Rule:** ADDITIVE ONLY. No deletions, renames, or destructive alterations.

---

## Classification legend

- **REUSE** — Use as-is. Do not touch.
- **EXTEND** — Add functionality around the existing code without modifying it.
- **CREATE** — Net-new module, table, or function that does not exist anywhere.

---

## 1. Auction House Normalization

**Decision: EXTEND** `backend/app/utils/normalize.py` (new utility module)

**Why not modify `quality_filter.py`?**  
`quality_filter.py` is a production hot-path that runs on every lot ingestion. Modifying it risks
breaking the live filter pipeline. The correct approach is to create a separate `normalize.py`
utility module that re-exports the stable functions from `quality_filter.py` and adds the new
`normalize_auction_house()` function alongside it.

**Existing context:**  
`BYPASS_CATEGORY_WHITELIST_SOURCES` in `quality_filter.py` already has a canonical list of auction
house identifiers (`christies`, `sothebys`, `bonhams`, etc.) as Python set literals. The new
`AUCTION_HOUSE_CANONICAL` dict must be consistent with these values. No overlap in logic — the
existing set is for bypassing category checks; the new dict is for normalizing raw strings.

**What is added:**
- `AUCTION_HOUSE_CANONICAL: dict[str, str]` — mapping raw → canonical key
- `normalize_auction_house(raw: str | None) -> str` — with partial-match fallback, never returns
  empty, returns `"unknown"` for None/empty input

---

## 2. Dimension Parsing

**Decision: EXTEND** (create `parse_dimensions_cm()` in `backend/app/utils/normalize.py`)

**Why not modify `backend/app/api/lots.py`?**  
`parse_dimensions()` in `lots.py` is embedded in the API layer and is used directly by request
handlers. It is intentionally minimal (only basic W×H). Replacing or patching it in that file
risks API regressions. The correct approach is to create an extended version in the new utility
module. Both functions coexist; new code calls `parse_dimensions_cm()`; existing API code
continues using the original.

**Existing `parse_dimensions()` limitations addressed by the new function:**
- Does not handle `H: 120 cm, W: 80 cm` labeled format
- Does not handle comma decimals: `56,5 x 40,5 cm` (common in French auction catalogs)
- Does not handle 3D dimensions: `120 x 80 x 5 cm`
- Does not handle diameter: `Ø 45 cm`
- Returns `{width_cm, height_cm}` only — no `area_cm2`

**What is added:**
- `parse_dimensions_cm(dimensions_str: str | None) -> dict` — extended parser, returns
  `{width_cm, height_cm, area_cm2}`, all nullable
- `SIZE_BUCKETS` constant list
- `size_bucket(width_cm, height_cm) -> str` — returns one of: small / medium / large / very_large / unknown

---

## 3. Feature Engineering Table

**Decision: CREATE** (new table `hammer_price_features`)

**Why:** No feature store exists anywhere in the schema. Pre-computing feature vectors:
- Avoids recomputing expensive historical aggregates (liquidity, momentum, house premium) at
  inference time
- Makes training datasets reproducible (features are frozen at the time of sale)
- Enables batch re-scoring without touching `hammer_prices`

**Table:** `hammer_price_features` — not yet created. Will be proposed as a migration in
`HAMMER_PRICE_BACKFILL_PLAN.md`. Contains one row per `hammer_prices.id`.

**Key columns proposed:**
```
hammer_price_id         UUID FK→hammer_prices(id)  PK
normalized_artist       TEXT
normalized_house        TEXT
medium_category         VARCHAR(20)
size_bucket             VARCHAR(20)
artwork_period          VARCHAR(20)
sale_year               INTEGER
sale_month              INTEGER
sale_quarter            INTEGER
estimate_midpoint_eur   FLOAT
estimate_spread_pct     FLOAT
artist_liquidity_at_sale FLOAT
artist_momentum_at_sale  FLOAT
artist_house_premium_at_sale FLOAT
sold_above_low_estimate  BOOLEAN
computed_at             TIMESTAMP DEFAULT NOW()
```

**All values leakage-safe:** every computed feature uses only data available before or at
`sale_date`. The `sold_above_low_estimate` column is the prediction target — it must be
excluded from any forward-looking feature set.

---

## 4. Duplicate Candidate Table

**Decision: CREATE** (new table `hammer_price_dup_candidates`)

**Why:** No duplicate tracking infrastructure exists for `hammer_prices`. The `lots` table has
`lot_fingerprint` + cross-source dedup, but this logic was never applied retrospectively to
historical hammer records imported from different sources (artmarketapi, drouot, invaluable, etc.)
that may represent the same auction event.

**Table:** `hammer_price_dup_candidates` — created with `CREATE TABLE IF NOT EXISTS` by the
`detect_hammer_duplicates.py` script when run with `--confirm`. Never dropped.

**Schema:**
```sql
CREATE TABLE IF NOT EXISTS hammer_price_dup_candidates (
    id SERIAL PRIMARY KEY,
    hammer_price_id_a BIGINT NOT NULL REFERENCES hammer_prices(id),
    hammer_price_id_b BIGINT NOT NULL REFERENCES hammer_prices(id),
    confidence VARCHAR(10) NOT NULL,    -- EXACT / HIGH / MEDIUM
    match_keys JSONB,                   -- which fields matched
    detected_at TIMESTAMP DEFAULT NOW(),
    resolved_at TIMESTAMP,             -- NULL = unresolved
    resolution VARCHAR(20),            -- 'duplicate' / 'distinct' / NULL
    UNIQUE(hammer_price_id_a, hammer_price_id_b)
);
```

**Why not use the existing `lots` dedup mechanism?**  
The `lots` dedup runs at ingest time on live lots. `hammer_prices` is a separate table with a
different ingestion path; retroactive duplicate detection requires a dedicated offline scan, not
a real-time filter.

---

## 5. Re-export strategy for `normalize.py`

The new `backend/app/utils/normalize.py` module re-exports from `quality_filter.py` using:

```python
from app.jobs.quality_filter import (
    normalize_artist_name,
    normalize_medium_category,
    normalize_category,
    normalize_title,
    is_unknown_artist,
)
```

This means:
- Callers that previously imported directly from `quality_filter` continue to work unchanged
- New code can import everything from `app.utils.normalize` as a single stable surface
- If `quality_filter.py` is ever refactored, only `normalize.py` needs updating

---

## 6. Summary Table

| Proposed Addition | Classification | Rationale |
|---|---|---|
| `normalize_auction_house()` | EXTEND (new module) | Adds to utility surface without touching hot-path filter |
| `parse_dimensions_cm()` + `size_bucket()` | EXTEND (new module) | Extended over existing `parse_dimensions()` without breaking it |
| `AUCTION_HOUSE_CANONICAL` dict | CREATE | New constant, no equivalent exists |
| `SIZE_BUCKETS` constant | CREATE | New constant, no equivalent exists |
| `backend/app/utils/normalize.py` | CREATE | New module (utils dir exists, normalize.py does not) |
| `hammer_price_features` table | CREATE | No feature store exists |
| `hammer_price_dup_candidates` table | CREATE | No dup tracking exists for hammer_prices |
| `backend/app/scripts/data_quality_report.py` | CREATE | No data quality report script exists |
| `backend/app/scripts/detect_hammer_duplicates.py` | CREATE | No dup detection script exists |
| `backend/app/scripts/normalize_hammer_prices_cli.py` | CREATE | No normalization CLI exists |
| `backend/app/engines/feature_engineering.py` | CREATE | engines/ dir exists, no feature engineering file |
| `backend/tests/test_normalization.py` | CREATE | tests/ dir exists, no normalization tests |
| `backend/tests/test_feature_engineering.py` | CREATE | No feature engineering tests |
| `backend/tests/test_deduplication.py` | CREATE | No dedup logic tests |
| `reports/data_quality_report.md` | CREATE | Template, not yet generated |
| `docs/HAMMER_PRICE_BACKFILL_PLAN.md` | CREATE | Documentation |
| `docs/STEP_1_2_IMPLEMENTATION_REPORT.md` | CREATE | Documentation |

**Files modified:** NONE. Everything is additive.
