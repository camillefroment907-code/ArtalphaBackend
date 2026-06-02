# Upside Prediction Engine — Implementation Report (Step 3)

## Architecture Diagram

```
hammer_prices (historical)
        │
        ▼ leakage-safe window functions (ROWS UNBOUNDED PRECEDING AND 1 PRECEDING)
        │
[train_upside_model.py --confirm]
        │
        ├─ BaselineAlwaysPositive
        ├─ BaselineArtistAvg
        └─ BaselineArtistMediumAvg
              └─ evaluate on test set
                      │
              GradientBoostingClassifier (scikit-learn)
                      │
                 ┌────┴────────────────────┐
                 │   Promotion check        │
                 │   P@10 > best baseline   │
                 │   ROC AUC >= 0.55        │
                 │   train_size >= 1000     │
                 └────┬────────────────────┘
                      │
              upside_model_versions (DB)
              models/upside/v1.0.0-{date}.joblib (disk)
                      │
        [generate_upside_predictions.py --confirm]
                      │
        live lots (status=upcoming|live)
                      │
              UpsidePredictor.predict_batch()
                      │
              lot_upside_predictions (DB)
                      │ (stored only — no influence on scores)
                      │
        /api/v1/upside/lot/{lot_id}         → UpsidePredictionOut
        /api/v1/upside/lot/{lot_id}/signal  → UpsideSignalOut (bilingual)
        /api/v1/upside/model/active         → UpsideModelVersionOut
```

---

## Files Created

### Core ML
| File | Purpose |
|------|---------|
| `backend/app/engines/upside_predictor.py` | UpsidePredictor class + signal translation |
| `backend/app/scripts/train_upside_model.py` | Training script (--dry-run / --confirm) |
| `backend/app/scripts/generate_upside_predictions.py` | Batch prediction CLI |

### API
| File | Purpose |
|------|---------|
| `backend/app/routers/upside.py` | FastAPI router — 3 endpoints |

### Database
| File | Purpose |
|------|---------|
| `backend/alembic/versions/z7a8b9c0d1e2_add_upside_tables.py` | Migration: 2 new tables |

### Testing
| File | Purpose |
|------|---------|
| `backend/tests/test_upside_model.py` | 20+ unit tests |

### Documentation
| File | Purpose |
|------|---------|
| `docs/UPSIDE_MODEL_AUDIT.md` | Phase 0 audit findings |
| `docs/UPSIDE_DATASET_DESIGN.md` | Dataset design and SQL WHERE clause |
| `docs/UPSIDE_FEATURES.md` | Selected/rejected features with reasoning |
| `docs/UPSIDE_MODEL_SELECTION.md` | Model choice rationale |
| `docs/UPSIDE_BACKTEST_RESULTS.md` | Backtest results (TBD until --confirm run) |
| `docs/UPSIDE_FEATURE_IMPORTANCE.md` | Feature importance (TBD until --confirm run) |

### Model Artifacts Directory
| File | Purpose |
|------|---------|
| `backend/models/upside/.gitkeep` | Directory placeholder (artifacts excluded from git) |

---

## Files Modified (Additive Only)

| File | Change |
|------|--------|
| `backend/app/models/db_models.py` | Added `UpsideModelVersion` and `LotUpsidePrediction` ORM classes (before ArtistCycleStats) |
| `backend/app/models/schemas.py` | Added `UpsideModelVersionOut`, `UpsidePredictionOut`, `UpsideSignalOut` Pydantic schemas |
| `backend/app/main.py` | Added 2 lines: import + `app.include_router(upside_router, prefix="/api")` |
| `.gitignore` | Added `*.joblib` and `*.pkl` patterns for models/upside/ |

---

## Schema Changes

### Migration: `z7a8b9c0d1e2_add_upside_tables.py`
`down_revision = "y6z7a8b9c0d1"` (artist_cycle_stats migration)

#### Table: `upside_model_versions`
```sql
CREATE TABLE upside_model_versions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version       TEXT NOT NULL UNIQUE,
    created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    is_active     BOOLEAN NOT NULL DEFAULT FALSE,
    artifact_path TEXT NOT NULL,
    feature_list  JSONB NOT NULL,
    metrics       JSONB NOT NULL,
    baseline_metrics JSONB,
    train_size    INTEGER,
    val_size      INTEGER,
    test_size     INTEGER,
    train_cutoff  DATE,
    val_cutoff    DATE,
    test_cutoff   DATE,
    promoted      BOOLEAN NOT NULL DEFAULT FALSE,
    notes         TEXT
);
```

#### Table: `lot_upside_predictions`
```sql
CREATE TABLE lot_upside_predictions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lot_id           UUID NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
    model_version_id UUID NOT NULL REFERENCES upside_model_versions(id),
    predicted_at     TIMESTAMP NOT NULL DEFAULT NOW(),
    upside_prob      FLOAT NOT NULL,
    confidence_score FLOAT,
    signal_label     TEXT,
    feature_snapshot JSONB,
    UNIQUE(lot_id, model_version_id)
);
```

---

## Model Selected

**GradientBoostingClassifier** (scikit-learn 1.5.2)

Rationale: XGBoost is not in requirements.txt. GradientBoostingClassifier is the direct
equivalent — same algorithm, same feature importance API, same prediction interface.
When XGBoost is added to requirements.txt in a future sprint, the model can be upgraded
with zero changes to the pipeline infrastructure.

---

## Feature List (21 features)

```
artist_total_sales_before       # historical volume
artist_sold_above_pct_before    # historical beat-estimate rate (most important signal)
artist_median_premium_before    # median price premium
medium_sold_above_pct_before    # medium-specific beat-estimate rate
medium_sales_count_before       # medium-specific volume
house_sold_above_pct_before     # house-specific beat-estimate rate
house_sales_count_before        # house-specific volume
estimate_spread_pct             # price uncertainty (high = uncertain)
estimate_midpoint_eur           # price level
log_estimate_low_eur            # price level (log-transformed)
medium_category                 # painting/print/sculpture/etc
auction_house_norm              # normalized house name
sale_month                      # 1–12
sale_quarter                    # 1–4
sale_season                     # spring/summer/autumn/winter
is_signed                       # bool (0/1)
is_ea                           # épreuve d'artiste (0/1)
has_edition                     # has edition number (0/1)
size_bucket                     # small/medium/large/very_large
cycle_fit_score                 # best_medium_wilson from artist_cycle_stats
artist_cycle_eligible           # is_eligible from artist_cycle_stats (0/1)
```

---

## Dataset Stats

TBD — run `train_upside_model.py --confirm` to populate.

| Split | Date Range | Rows | Positive Rate |
|-------|-----------|------|---------------|
| Train | ≤ 2023-12-31 | TBD | TBD |
| Validation | 2024-01-01 – 2024-06-30 | TBD | TBD |
| Test | ≥ 2024-07-01 | TBD | TBD |

---

## Baseline Results

TBD — see `docs/UPSIDE_BACKTEST_RESULTS.md` after training.

---

## Backtest Results

TBD — run `train_upside_model.py --confirm` to populate.

---

## Signal Translation

| Probability | English Label | French Label |
|-------------|--------------|-------------|
| >= 0.80 | High upside signal | Signal haussier fort |
| 0.60 – 0.79 | Moderate upside signal | Signal haussier modéré |
| < 0.60 | Limited upside signal | Signal haussier limité |

---

## API Endpoints

```
GET  /api/v1/upside/lot/{lot_id}
     Auth: JWT required
     Returns: UpsidePredictionOut | null

GET  /api/v1/upside/lot/{lot_id}/signal
     Auth: JWT required
     Query: ?lang=en|fr
     Returns: UpsideSignalOut (signal_label, explanation, upside_prob)

GET  /api/v1/upside/model/active
     Auth: JWT required
     Returns: UpsideModelVersionOut | null
```

---

## Rollback Instructions

To completely remove the Upside Prediction Engine:

```sql
-- Step 1: Remove predictions
DROP TABLE IF EXISTS lot_upside_predictions;

-- Step 2: Remove model registry
DROP TABLE IF EXISTS upside_model_versions;

-- Step 3: Run alembic downgrade
alembic downgrade y6z7a8b9c0d1
```

No existing tables, columns, or API contracts were modified.
The `cycle_router` and `upside_router` registrations in `main.py` can be removed
by reverting the 2-line additions.

---

## Production Deployment Notes

1. **Model artifacts** (`*.joblib`) are NOT committed to git.
   On production (Railway), use a mounted volume or configure `artifact_path` to point to S3/GCS.

2. **First run workflow:**
   ```bash
   # 1. Apply migration
   alembic upgrade z7a8b9c0d1e2

   # 2. Dry-run to verify data
   python -m app.scripts.train_upside_model --dry-run

   # 3. Train and promote if data quality is sufficient
   python -m app.scripts.train_upside_model --confirm

   # 4. Generate predictions for live lots
   python -m app.scripts.generate_upside_predictions --dry-run
   python -m app.scripts.generate_upside_predictions --confirm
   ```

3. **Periodic retraining:** Schedule `train_upside_model.py --confirm` monthly
   or when significant new hammer_prices data is available.

4. **Safety guarantee:** If no model is active, all `/api/v1/upside/` endpoints
   return null fields — they never raise 500 or fail silently with corrupt data.
