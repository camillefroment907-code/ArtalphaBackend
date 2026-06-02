# Upside Model Audit — Phase 0

## 1. Feature Engineering (`feature_engineering.py`)

### Exact Feature Names from `build_hammer_features()`
| Feature | Type | Notes |
|---------|------|-------|
| `hammer_price_id` | str | identifier only |
| `normalized_artist` | str | from `normalize_artist_name()` |
| `normalized_house` | str | from `normalize_auction_house()` |
| `medium_category` | str | painting/print/sculpture/photography/drawing/other |
| `size_bucket` | str | small/medium/large/very_large/unknown |
| `artwork_period` | str | pre_1900/1900_1950/1950_2000/post_2000/unknown |
| `sale_year` | int | YYYY |
| `sale_month` | int | 1–12 |
| `sale_quarter` | int | 1–4 |
| `estimate_midpoint_eur` | float or None | (low+high)/2 |
| `estimate_spread_pct` | float or None | (high-low)/low*100 |
| `artist_liquidity_at_sale` | float or None | sale_count/years_active, leakage-safe |
| `artist_momentum_at_sale` | float or None | median_last2yr/median_prev2yr - 1, leakage-safe |
| `artist_house_premium_at_sale` | float or None | house_median/overall_median, leakage-safe |
| `sold_above_low_estimate` | bool or None | TARGET — exclude from forward-looking use |

### `@leakage_guard` decorator
- All `compute_*_at_date()` functions are decorated with `@leakage_guard("reference_date")`
- All SQL queries contain `AND sale_date < :reference_date` (strict less-than)
- Training dataset must replicate this via window functions (not per-row function calls)

---

## 2. Cycle Intelligence (`cycle_intelligence.py`)

### `CycleFitResult` structure
```python
{
    "score": float | None,      # 0–100
    "components": dict,         # per-dimension breakdown
    "confidence": float,        # 0–1
    "reasons": list[str],       # bilingual explanations
    "data_quality": str,        # 'sufficient' | 'limited' | 'insufficient'
}
```

### `artist_cycle_stats` table (Step 4)
One row per artist with: `is_eligible`, `best_medium`, `best_medium_wilson`, `best_size`, `best_size_wilson`, `best_house`, `best_house_wilson`, `best_month`, `best_month_wilson`, `best_season`, `best_season_wilson`, plus JSONB columns `medium_stats`, `size_stats`, `house_stats`, `month_stats`, `season_stats`.

---

## 3. `hammer_prices` Table Columns (from ORM)
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | UUID | NOT NULL | PK |
| `external_id` | String(500) | nullable | unique index |
| `artist_name` | String(500) | NOT NULL | raw name |
| `artist_name_normalized` | String(500) | nullable | indexed |
| `artwork_title` | String(1000) | nullable | |
| `year_created` | Integer | nullable | |
| `medium` | String(300) | nullable | raw medium text |
| `medium_category` | String(20) | nullable | normalized: painting/print/etc |
| `dimensions` | String(200) | nullable | raw string e.g. "50x70 cm" |
| `sale_date` | DateTime | nullable | indexed |
| `hammer_price` | Float | nullable | in original currency |
| `currency` | String(10) | default "EUR" | |
| `hammer_price_eur` | Float | nullable | normalized to EUR |
| `auction_house` | String(300) | nullable | indexed, raw name |
| `estimate_low` | Float | nullable | |
| `estimate_high` | Float | nullable | |
| `premium_paid` | Float | nullable | legacy |
| `premium_ratio` | Float | nullable | hammer / estimate_low |
| `source` | String(100) | default "unknown" | |
| `image_url` | String(1000) | nullable | |
| `lot_url` | String(1000) | nullable | |
| `lot_number` | String(100) | nullable | |
| `lot_id` | UUID | nullable | FK → lots.id |
| `created_at` | DateTime | | |
| `signed` | Boolean | nullable | |
| `edition_number` | Integer | nullable | |
| `edition_size` | Integer | nullable | |
| `is_ea` | Boolean | nullable | épreuve d'artiste |

**Key finding:** `hammer_price_eur` exists — use this for training.
**Key finding:** `auction_house` is the raw name string (no normalized column in hammer_prices), but `auction_house_normalized` is used in `feature_engineering.py` via `normalize_auction_house(auction_house)`.
**Note:** `artist_id` FK does NOT exist in `hammer_prices` — artist is tracked by `artist_name_normalized` string, NOT UUID.

---

## 4. ORM Models — No Existing ML Infrastructure
- `ScoringModel` table exists but is for scoring weights (not ML artifacts)
- `ScorePerformance` has `predicted_upside` + `prediction_correct` columns but these are not predictions in the ML sense
- **No `upside_model_versions` table exists**
- **No `lot_upside_predictions` table exists**
- Both must be created fresh in this step

---

## 5. Available ML Libraries (from `requirements.txt`)
- `scikit-learn==1.5.2` — PRESENT
- `numpy==2.1.2` — PRESENT
- `pandas==2.2.3` — PRESENT
- `xgboost` — **NOT PRESENT**
- `joblib` — NOT in requirements.txt but ships with scikit-learn (bundled)

**Model choice:** `GradientBoostingClassifier` from scikit-learn (XGBoost unavailable).

---

## 6. Alembic Migration Chain
Latest migration: `y6z7a8b9c0d1` (add_artist_cycle_stats)
`down_revision` for new migration: `"y6z7a8b9c0d1"`

---

## 7. Router Pattern (from `cycle.py`)
- Import: `from app.routers.cycle import router as cycle_router`
- Registration in `main.py`: `app.include_router(cycle_router, prefix="/api")`
- Auth: `current_user: User = Depends(get_current_user)`
- DB: `db: AsyncSession = Depends(get_db)` (async)
- Prefix: `/v1/cycle` → full path `/api/v1/cycle/...`

---

## 8. Training Script Pattern
- Existing scripts in `backend/app/scripts/` use sync SQLAlchemy or asyncio.run()
- Training scripts are sync — use `psycopg2-binary` (sync driver, already in requirements)

---

## 9. `lots` Table — for Prediction Generation
- `id` UUID, `status` enum (upcoming/live/sold/unsold/withdrawn)
- `artist_id` FK → artists.id (nullable)
- `estimate_low`, `estimate_high` Float nullable
- `medium` String nullable
- `dimensions` String nullable
- `auction_house_name` String nullable
- No `artist_name_normalized` — must join through artists table or use `artist_name_raw`

---

## 10. Key Findings Summary
1. Use `hammer_price_eur` (normalized to EUR) as the price column
2. XGBoost unavailable — use `GradientBoostingClassifier`
3. No existing ML artifact tables — must create both
4. `hammer_prices` has NO `artist_id` FK — uses `artist_name_normalized` string
5. `cycle_fit_score` and `artist_cycle_eligible` can be joined from `artist_cycle_stats` via normalized name
6. `joblib` is available via scikit-learn dependency
7. The `lots` table references `artist_id` (UUID) — prediction pipeline joins via `artists` table
