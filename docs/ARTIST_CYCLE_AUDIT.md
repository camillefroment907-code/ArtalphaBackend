# Artist Cycle Audit — Step 4 Pre-Implementation Audit

## 1. hammer_prices Table (Primary Data Source)

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| external_id | TEXT | Unique (nullable) |
| artist_name | VARCHAR(500) | Raw artist name (indexed) |
| artist_name_normalized | VARCHAR(500) | Normalized (indexed) |
| artwork_title | VARCHAR(1000) | |
| year_created | INTEGER | |
| medium | VARCHAR(300) | Raw medium string |
| medium_category | VARCHAR(20) | Normalized category (painting/print/…) |
| dimensions | VARCHAR(200) | Raw dimension string |
| sale_date | DATETIME | Indexed, nullable |
| hammer_price | FLOAT | Raw price |
| currency | VARCHAR(10) | |
| hammer_price_eur | FLOAT | EUR-normalized |
| auction_house | VARCHAR(300) | Raw house name (indexed) |
| estimate_low | FLOAT | Used for sold_above_low_pct |
| estimate_high | FLOAT | |
| premium_paid | FLOAT | Legacy |
| premium_ratio | FLOAT | hammer / estimate_low |
| source | VARCHAR(100) | |
| lot_id | UUID FK → lots | |
| signed | BOOLEAN | Backfilled (Step 2) |
| edition_number | INTEGER | Backfilled |
| edition_size | INTEGER | Backfilled |
| is_ea | BOOLEAN | Backfilled |
| created_at | DATETIME | |

**Key indexes**: `ix_hammer_prices_artist_date(artist_name, sale_date)`, `artist_name_normalized`, `auction_house`, `medium_category`, `sale_date`

## 2. artists Table (Eligibility Join)

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| name | VARCHAR(500) | |
| name_normalized | VARCHAR(500) | Used for JOIN with hammer_prices |
| cagr_calculated / cagr_raw | FLOAT | Step 2 computed |
| cagr_confidence | VARCHAR(20) | HIGH/MEDIUM/LOW |
| popularity_score, liquidity_score | FLOAT | |
| total_lots_sold | INTEGER | |
| sell_through_rate | FLOAT | |

## 3. Reusable Functions (Step 1 & 2)

From `backend/app/utils/normalize.py`:
- `normalize_auction_house(raw)` — maps 50+ house names to canonical keys
- `parse_dimensions_cm(dimensions_str)` — returns `{width_cm, height_cm, area_cm2}`
- `size_bucket(width_cm, height_cm)` — returns small/medium/large/very_large/unknown
- `normalize_medium_category(raw)` — returns painting/print/drawing/sculpture/photography/other
- `normalize_artist_name(name)` — canonical artist name normalization

From `backend/app/engines/feature_engineering.py`:
- `compute_artist_liquidity_at_date(artist, date, db)` — leakage-safe
- `compute_artist_momentum_at_date(artist, date, db)` — leakage-safe
- `compute_artist_house_premium_at_date(artist, house, date, db)` — leakage-safe

## 4. Existing API Patterns

- Auth: `from app.api.auth_utils import get_current_user` — HTTPBearer JWT dependency
- DB: `from app.database import get_db` — async SQLAlchemy session dependency
- Routers registered in `backend/app/main.py` with `app.include_router(router, prefix="/api")`
- Existing routers in `backend/app/api/` — cycle router goes in `backend/app/routers/`
- Error handling: wrap in try/except → graceful JSON response

## 5. Existing cycle-related code

- `backend/app/utils/cycle_stage.py` — market cycle stage (price momentum)
  - Uses raw `artist_name` ILIKE match
  - Returns EARLY RISE / RISING / PEAK / CORRECTION / BOTTOM / STABLE
  - Different purpose: price momentum, not medium/house/season fit

## 6. What is Missing (Step 4 Adds)

- `artist_cycle_stats` table (JSONB segment stats per artist)
- Wilson score confidence adjustment
- Per-segment performance (medium, size, house, month, season)
- Best configuration selection
- Cycle fit engine (lot vs artist's best config)
- Bilingual explanation layer
- CLI script for batch computation
- REST API endpoints
