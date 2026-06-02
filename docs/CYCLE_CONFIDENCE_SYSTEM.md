# Cycle Confidence System — Step 4

## Problem

Raw proportions (sold_above_low_pct) are misleading for small samples. An artist who sold 3/3 works above estimate sounds 100% reliable, but this is statistically meaningless with only 3 observations. We need a ranking system that rewards both high success rates AND statistical confidence.

## Solution: Wilson Score Lower Bound

The Wilson score lower bound is the standard solution for ranking binary outcomes with unequal sample sizes. It is used by Amazon, Reddit, and academic ranking systems.

### Formula

```
p̂ = k / n    (observed proportion)
z = 1.645     (z-score for 90% confidence interval)

wilson_lower = (p̂ + z²/2n − z × sqrt(p̂(1−p̂)/n + z²/4n²)) / (1 + z²/n)
```

Where:
- `n` = number of sales with `estimate_low` available
- `k` = number of sales where `hammer_price >= estimate_low`

### Worked Examples (z=1.645, 90% CI)

| n | k | p̂ | Wilson Lower | Interpretation |
|---|---|---|---|---|
| 3 | 3 | 100% | ≈0.526 | Looks great but tiny sample |
| 10 | 9 | 90% | ≈0.658 | Better confidence |
| 50 | 40 | 80% | ≈0.680 | Solid signal |
| 150 | 117 | 78% | ≈0.715 | High confidence |
| 193 | 150 | 77.7% | ≈0.718 | Benchmark example |
| 200 | 130 | 65% | ≈0.585 | Large n, lower rate |

Note: Some resources quote Wilson lower bound values for 95% CI (z=1.96). We use 90% CI (z=1.645) as it is less conservative and better suited for auction market datasets where n rarely exceeds 500.

**Key insight**: n=3/100% (Wilson ≈ 0.53) still ranks far below n=193/78% (Wilson ≈ 0.72). The formula naturally handles the quality/quantity tradeoff.

### Why 90% CI (z=1.645)?

We use a one-sided 90% confidence interval because:
1. We want a conservative lower bound (how bad could performance be?)
2. 95% CI would be too conservative for typical auction datasets (n < 200)
3. Consistent with academic auction market research

## Confidence Tiers

In addition to the Wilson score, we label each segment with a human-readable tier:

| Tier | n threshold | Meaning |
|---|---|---|
| `low` | n < 10 | Treat with caution — limited observations |
| `medium` | 10 ≤ n < 50 | Useful signal, some uncertainty remains |
| `high` | n ≥ 50 | Statistically robust signal |

Confidence tiers are used in the explanation layer ("Limited data for this medium — treat this signal with caution.").

## Usage in Cycle Fit Scoring

The Wilson lower bound serves as the key metric for:
1. **Best configuration selection**: `select_best_segment()` ranks by `wilson_lower`
2. **Cycle fit scoring**: `compute_cycle_fit()` computes `dimension_score = weight × (lot_wilson / best_wilson)`
3. **Overall confidence**: weighted average of tier weights (low=0.3, medium=0.6, high=1.0)

## Anti-Patterns Avoided

- NOT using `avg_premium_ratio` as primary rank — highly sensitive to outlier prices
- NOT using raw `sold_above_low_pct` — ignores sample size
- NOT excluding below-estimate sales (no survivorship bias)
- NOT requiring estimates to filter rows — estimate_low=None rows count in `sales_count` but not in Wilson numerator/denominator
