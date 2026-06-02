# Upside Model Backtest Results — Phase 6

## Status: TBD — run `train_upside_model.py --confirm` to populate

To generate results:
```bash
cd backend
python -m app.scripts.train_upside_model --dry-run   # check dataset stats
python -m app.scripts.train_upside_model --confirm   # train and evaluate
```

---

## Dataset Stats (fill after training)

| Split | Date Range | Rows | Positive Rate |
|-------|-----------|------|---------------|
| Train | ≤ 2023-12-31 | TBD | TBD |
| Validation | 2024-01-01 – 2024-06-30 | TBD | TBD |
| Test | ≥ 2024-07-01 | TBD | TBD |

---

## Baseline Results (test set)

| Baseline | Accuracy | Precision@10 | ROC AUC |
|----------|----------|-------------|---------|
| AlwaysPositive | TBD | TBD | 0.50 |
| ArtistAvg | TBD | TBD | TBD |
| ArtistMediumAvg | TBD | TBD | TBD |

---

## GradientBoostingClassifier Results (test set)

| Metric | Value |
|--------|-------|
| Accuracy | TBD |
| Precision | TBD |
| Recall | TBD |
| F1 | TBD |
| ROC AUC | TBD |
| Precision@10% | TBD |
| Precision@20% | TBD |
| Top decile avg premium ratio | TBD |
| Bottom decile avg premium ratio | TBD |

---

## Promotion Decision

**Rule:**
```python
promoted = (
    precision_at_10 > max(baseline_precision_at_10)
    and roc_auc >= 0.55
    and train_size >= 1000
)
```

**Result:** TBD

---

## Comparison Table

| Model | ROC AUC | Precision@10 | Precision@20 | Promoted |
|-------|---------|-------------|-------------|---------|
| AlwaysPositive | 0.50 | TBD | TBD | No |
| ArtistAvg | TBD | TBD | TBD | No |
| ArtistMediumAvg | TBD | TBD | TBD | No |
| GBM v1.0.0 | TBD | TBD | TBD | TBD |
