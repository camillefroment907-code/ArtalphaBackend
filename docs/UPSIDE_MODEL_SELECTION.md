# Upside Model Selection — Phase 4

## Decision

**Model selected:** `GradientBoostingClassifier` (scikit-learn 1.5.2)

**Reason:** XGBoost is not in `requirements.txt`. Scikit-learn is present (`scikit-learn==1.5.2`).
`GradientBoostingClassifier` is the natural fallback — same gradient boosting algorithm, same feature importance API, same leakage-safe temporal split approach.

## Why Gradient Boosting for Art Auction Prediction

1. **Handles mixed data types** — categorical (medium, house) + numeric (estimate, history rates) naturally
2. **Robust to nulls after imputation** — many features are sparse (new artists have no history)
3. **Non-linear interactions** — the relationship between estimate_spread_pct and sold_above probability is non-linear
4. **Feature importance built-in** — `model.feature_importances_` available
5. **No distribution assumptions** — unlike logistic regression, doesn't require feature normality

## Rejected Alternatives

| Model | Reason Rejected |
|-------|----------------|
| LogisticRegression | Assumes linear decision boundary; art auction signals are non-linear |
| RandomForest | Slower prediction, higher memory; GBM typically outperforms RF on tabular data |
| XGBoost | Not in requirements.txt — adding it violates the constraint |
| Neural Network | No deep learning libraries; tabular data doesn't benefit from NN at this scale |

## Hyperparameters (default starting point)

```python
GradientBoostingClassifier(
    n_estimators=200,
    max_depth=4,
    learning_rate=0.05,
    subsample=0.8,
    min_samples_leaf=20,
    random_state=42,
)
```

**Notes:**
- `max_depth=4` prevents overfitting on small datasets
- `min_samples_leaf=20` ensures terminal nodes have meaningful support
- `subsample=0.8` adds stochastic regularization (equivalent to XGBoost's `colsample_bytree`)
- `random_state=42` for reproducibility

## Model Artifact Storage

- Format: `joblib.dump()` — ships with scikit-learn, no additional dependencies
- Path: `models/upside/{version}.joblib`
- Version format: `v1.0.0-YYYY-MM-DD`
- Git: model artifacts NOT committed (large binary files — add to `.gitignore`)
- Production: path should be a mounted volume or S3 bucket

## Note on Future Upgrade

When XGBoost is added to requirements.txt, the training script can be upgraded to:
```python
from xgboost import XGBClassifier
model = XGBClassifier(n_estimators=200, max_depth=4, ...)
```
The rest of the pipeline (feature engineering, evaluation, storage) is unchanged.
