# Artist Eligibility Rules — Step 4

## Problem

Without eligibility gates, small-sample artists pollute the ranking. An artist with 3 sales and 100% sold-above-estimate creates a false signal of perfect performance. We need to prevent 3/3 (Wilson ≈ 0.43) from outranking 150/193 (Wilson ≈ 0.72).

The Wilson score lower bound partially addresses this, but we also need a minimum data volume gate before computing any stats.

## Three-Gate System

### Gate 1: Minimum Total Sales — `total_sales >= 20`

**Why 20?** Below 20 sales, even a good Wilson score is unreliable. The median_premium_ratio becomes highly volatile. Any one outlier sale (e.g., a record-breaking auction) can dominate the stats.

With 20+ sales across years, we have enough to see patterns across at least 2–3 auction cycles.

**What this catches**: Niche artists represented by a few notable sales but with no regular market presence.

### Gate 2: Recent Sales — `recent_sales_3y >= 5`

**Why 5 recent sales?** Ensures the artist's market is currently active. An artist with 50 historical sales but none in 3 years has a stale market — the house/season patterns from 2015 may no longer apply.

**Why 3 years?** Covers 2–3 major auction seasons and is aligned with Nautilus's investment horizon.

**What this catches**: Deceased artists with mostly historical data but no current market; artists who fell out of fashion.

### Gate 3: Estimate Coverage — `estimate_coverage >= 30%`

`estimate_coverage` = proportion of sales where `estimate_low IS NOT NULL`.

**Why 30%?** The `sold_above_low_pct` signal is meaningless without estimates. If only 10% of sales have estimates, we can't compute a reliable sold_above_low_pct.

30% provides enough estimate-linked sales across different segments (medium, house) to compute meaningful per-segment Wilson scores.

**What this catches**: Artists whose records come primarily from sources that don't report estimates (e.g., some interenchères records).

## Summary Table

| Rule | Threshold | Rationale |
|---|---|---|
| `total_sales` | >= 20 | Prevent micro-sample noise |
| `recent_sales_3y` | >= 5 | Ensure current market relevance |
| `estimate_coverage` | >= 30% | Need estimates to compute sold_above_low_pct |

## Segment-Level Gates

Within eligible artists, segments (e.g., "painting" medium) must have:
- `min_segment_sales >= 3` to appear in segment stats
- `min_sales >= 5` to qualify for "best" selection

This prevents a single exceptional sale in a medium from making it "best".

## Example: Why 3/3 Does Not Outrank 150/193

```
Artist A: 3 total sales, 3 sold above estimate
  → INELIGIBLE (total_sales=3 < 20)
  → Wilson lower bound irrelevant

Artist B: 193 total sales, 150 sold above estimate
  → ELIGIBLE (total_sales=193, recent=40, coverage=85%)
  → Wilson lower bound ≈ 0.716
  → Best medium selected based on this score
```
