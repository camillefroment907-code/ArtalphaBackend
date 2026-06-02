"""
Nautilus — Artist Cycle Intelligence Engine (Step 4).

Pure logic functions for:
  - Wilson score lower bound (confidence-adjusted proportions)
  - Artist eligibility determination
  - Medium / size / house / month / season performance stats
  - Best configuration selection
  - Cycle fit scoring
  - Bilingual explanation generation

ALL functions in this module are side-effect-free (no DB calls).
DB queries live in the CLI script and router.

Usage:
    from app.engines.cycle_intelligence import (
        wilson_lower_bound,
        confidence_tier,
        is_artist_eligible,
        compute_segment_stats,
        select_best_config,
        compute_cycle_fit,
        generate_cycle_reasons,
    )
"""

from __future__ import annotations

import math
import logging
from datetime import date, datetime
from typing import Any, Optional

log = logging.getLogger(__name__)

# ── Wilson score lower bound ──────────────────────────────────────────────────

# z = 1.645 → 90% confidence interval (one-sided lower bound)
_Z = 1.645
_Z2 = _Z ** 2  # 2.706025


def wilson_lower_bound(n: int, k: int) -> float:
    """
    Compute the Wilson score lower bound for a proportion p = k/n.

    This is the standard way to rank binary outcomes (sold-above-estimate)
    while correcting for small sample sizes. An artist with 3/3 successes
    (p=1.0, n=3) scores ≈0.43, far below 150/193 successes (p=0.78, n=193)
    which scores ≈0.71.

    Formula (z=1.645, 90% CI):
        wilson_lower = (p + z²/2n − z × sqrt(p(1−p)/n + z²/4n²)) / (1 + z²/n)

    Args:
        n: Total number of trials (e.g., sales with estimate_low available)
        k: Number of successes (e.g., sales where hammer >= estimate_low)

    Returns:
        Float in [0, 1]. Returns 0.0 if n == 0.

    Examples:
        >>> wilson_lower_bound(0, 0)   # n=0 → no data
        0.0
        >>> round(wilson_lower_bound(3, 3), 3)   # n=3, 100% → ≈0.434
        0.434
        >>> round(wilson_lower_bound(193, 150), 3)   # n=193, 78% → ≈0.716
        0.716
    """
    if n <= 0:
        return 0.0
    if k < 0:
        k = 0
    if k > n:
        k = n

    p = k / n
    centre = p + _Z2 / (2 * n)
    margin = _Z * math.sqrt(p * (1 - p) / n + _Z2 / (4 * n * n))
    denom = 1 + _Z2 / n
    return max(0.0, min(1.0, (centre - margin) / denom))


def confidence_tier(n: int) -> str:
    """
    Return a human-readable confidence tier based on sample size.

    Tiers:
        'high'   — n >= 50  (statistically robust)
        'medium' — 10 <= n < 50  (useful signal, some uncertainty)
        'low'    — n < 10  (treat with caution)

    Args:
        n: Sample size (number of observations).

    Returns:
        One of 'high', 'medium', 'low'.
    """
    if n >= 50:
        return "high"
    if n >= 10:
        return "medium"
    return "low"


def _tier_weight(tier: str) -> float:
    """Map confidence tier to a numeric weight for averaging."""
    return {"high": 1.0, "medium": 0.6, "low": 0.3}.get(tier, 0.3)


# ── Artist eligibility ────────────────────────────────────────────────────────

MIN_TOTAL_SALES: int = 20
MIN_RECENT_SALES_3Y: int = 5
MIN_ESTIMATE_COVERAGE: float = 0.30   # 30% of sales must have estimate_low


def is_artist_eligible(
    total_sales: int,
    recent_sales_3y: int,
    estimate_coverage: float,
    *,
    min_total: int = MIN_TOTAL_SALES,
    min_recent: int = MIN_RECENT_SALES_3Y,
    min_coverage: float = MIN_ESTIMATE_COVERAGE,
) -> tuple[bool, str]:
    """
    Determine whether an artist has sufficient data for cycle analysis.

    Rules (all must pass):
        1. total_sales >= min_total (default 20) — prevents vanishingly small samples
        2. recent_sales_3y >= min_recent (default 5) — ensures current market relevance
        3. estimate_coverage >= min_coverage (default 30%) — need enough sales with
           estimate_low to compute sold_above_low_pct reliably

    Returns:
        (is_eligible: bool, reason: str)

    Examples:
        >>> is_artist_eligible(3, 3, 1.0)  # 3 sales, 100% — rejected
        (False, 'total_sales=3 < minimum 20')
        >>> is_artist_eligible(25, 8, 0.60)  # 25 sales, recent, good coverage
        (True, 'eligible')
    """
    if total_sales < min_total:
        return False, f"total_sales={total_sales} < minimum {min_total}"
    if recent_sales_3y < min_recent:
        return False, f"recent_sales_3y={recent_sales_3y} < minimum {min_recent}"
    if estimate_coverage < min_coverage:
        return False, f"estimate_coverage={estimate_coverage:.1%} < minimum {min_coverage:.0%}"
    return True, "eligible"


# ── Season mapping ────────────────────────────────────────────────────────────

_MONTH_TO_SEASON: dict[int, str] = {
    12: "winter", 1: "winter", 2: "winter",
    3: "spring",  4: "spring", 5: "spring",
    6: "summer",  7: "summer", 8: "summer",
    9: "autumn", 10: "autumn", 11: "autumn",
}


def month_to_season(month: int) -> str:
    """
    Map a calendar month (1–12) to a meteorological season.

    Seasons:
        winter = December, January, February (DJF)
        spring = March, April, May           (MAM)
        summer = June, July, August          (JJA)
        autumn = September, October, November (SON)

    Args:
        month: Integer month 1–12.

    Returns:
        One of 'winter', 'spring', 'summer', 'autumn'. Returns 'unknown' for
        out-of-range inputs.
    """
    return _MONTH_TO_SEASON.get(month, "unknown")


# ── Segment stats computation ─────────────────────────────────────────────────

def _safe_median(values: list[float]) -> Optional[float]:
    """Return the median of a list of floats, or None if empty."""
    if not values:
        return None
    s = sorted(values)
    n = len(s)
    mid = n // 2
    if n % 2 == 0:
        return (s[mid - 1] + s[mid]) / 2.0
    return s[mid]


def compute_segment_stats(rows: list[dict]) -> dict:
    """
    Compute aggregate statistics for a group of hammer_price rows
    that share a common dimension (medium, size, house, month, season).

    Expected row keys (all optional except hammer_price_eur):
        hammer_price_eur  (float)        — required
        estimate_low      (float | None) — used for sold_above_low, premium_ratio
        sale_date         (date | None)  — not used here, slicing done upstream

    Returns a dict with:
        sales_count          int   — total number of rows in this segment
        sold_above_low_count int   — rows where hammer >= estimate_low (estimate present)
        n_with_estimate      int   — rows where estimate_low is not None
        sold_above_low_pct   float — sold_above_low_count / n_with_estimate (0.0 if n=0)
        median_premium_ratio float — median of (hammer / estimate_low); None if unavailable
        avg_premium_ratio    float — mean of (hammer / estimate_low); None if unavailable
        wilson_lower         float — Wilson lower bound on sold_above_low_pct
        confidence_tier      str   — 'low' | 'medium' | 'high'

    No survivorship bias: includes unsold/below-estimate records.
    """
    sales_count = len(rows)
    if sales_count == 0:
        return {
            "sales_count": 0,
            "sold_above_low_count": 0,
            "n_with_estimate": 0,
            "sold_above_low_pct": 0.0,
            "median_premium_ratio": None,
            "avg_premium_ratio": None,
            "wilson_lower": 0.0,
            "confidence_tier": "low",
        }

    ratios: list[float] = []
    sold_above = 0
    n_with_est = 0

    for row in rows:
        hp = row.get("hammer_price_eur") or row.get("hammer_price")
        el = row.get("estimate_low")

        if hp is None:
            continue

        if el is not None and el > 0:
            n_with_est += 1
            ratio = float(hp) / float(el)
            ratios.append(ratio)
            if float(hp) >= float(el):
                sold_above += 1

    sold_pct = sold_above / n_with_est if n_with_est > 0 else 0.0
    wilson = wilson_lower_bound(n_with_est, sold_above)

    return {
        "sales_count": sales_count,
        "sold_above_low_count": sold_above,
        "n_with_estimate": n_with_est,
        "sold_above_low_pct": round(sold_pct, 4),
        "median_premium_ratio": round(_safe_median(ratios), 4) if ratios else None,
        "avg_premium_ratio": round(sum(ratios) / len(ratios), 4) if ratios else None,
        "wilson_lower": round(wilson, 4),
        "confidence_tier": confidence_tier(n_with_est),
    }


def compute_all_segment_stats(
    rows: list[dict],
    *,
    min_segment_sales: int = 3,
) -> dict[str, dict[str, dict]]:
    """
    Slice all hammer_price rows into segments by medium, size, house, month, season,
    and compute stats for each segment.

    Args:
        rows: List of dicts. Required keys per row:
            hammer_price_eur  (float)
            estimate_low      (float | None)
            medium_category   (str | None)
            size_bkt          (str | None)     — pre-computed size bucket
            auction_house_norm (str | None)    — normalized auction house
            sale_month        (int | None)
            sale_season       (str | None)     — pre-computed season
        min_segment_sales: Exclude segments with fewer than this many total sales.

    Returns:
        dict with keys 'medium', 'size', 'house', 'month', 'season', each mapping
        to a dict of { segment_value: stats_dict }.
    """
    # Grouping buckets
    medium_groups: dict[str, list[dict]] = {}
    size_groups: dict[str, list[dict]] = {}
    house_groups: dict[str, list[dict]] = {}
    month_groups: dict[str, list[dict]] = {}
    season_groups: dict[str, list[dict]] = {}

    for row in rows:
        med = row.get("medium_category") or "unknown"
        sz = row.get("size_bkt") or "unknown"
        house = row.get("auction_house_norm") or "unknown"
        month = row.get("sale_month")
        season = row.get("sale_season") or "unknown"

        medium_groups.setdefault(med, []).append(row)
        size_groups.setdefault(sz, []).append(row)
        house_groups.setdefault(house, []).append(row)
        if month is not None:
            month_groups.setdefault(str(month), []).append(row)
        season_groups.setdefault(season, []).append(row)

    def _build(groups: dict[str, list[dict]]) -> dict[str, dict]:
        out = {}
        for key, grp in groups.items():
            stats = compute_segment_stats(grp)
            if stats["sales_count"] >= min_segment_sales:
                out[key] = stats
        return out

    return {
        "medium": _build(medium_groups),
        "size": _build(size_groups),
        "house": _build(house_groups),
        "month": _build(month_groups),
        "season": _build(season_groups),
    }


# ── Best configuration selection ─────────────────────────────────────────────

def select_best_segment(
    segment_stats: dict[str, dict],
    min_sales: int = 5,
) -> Optional[tuple[str, dict]]:
    """
    Select the best-performing segment by Wilson lower bound.

    Segments with fewer than min_sales total sales are excluded.
    Ranking is by wilson_lower (confidence-adjusted sold_above_low_pct).

    Args:
        segment_stats: Dict of { segment_key: stats_dict } from compute_segment_stats.
        min_sales:     Minimum sales count to be considered.

    Returns:
        (best_key, stats_dict) for the highest-ranked segment, or None if no
        qualifying segments.
    """
    candidates = [
        (key, stats)
        for key, stats in segment_stats.items()
        if stats.get("sales_count", 0) >= min_sales and stats.get("n_with_estimate", 0) > 0
    ]
    if not candidates:
        return None
    best = max(candidates, key=lambda t: t[1].get("wilson_lower", 0.0))
    return best


def select_best_config(
    all_stats: dict[str, dict[str, dict]],
    min_sales: int = 5,
) -> dict[str, Any]:
    """
    Select the best medium, size, house, month, and season for an artist.

    Args:
        all_stats: Output of compute_all_segment_stats().
        min_sales: Minimum sales to consider a segment.

    Returns:
        dict with keys:
            best_medium, best_medium_wilson
            best_size, best_size_wilson
            best_house, best_house_wilson
            best_month, best_month_wilson
            best_season, best_season_wilson
        Any value may be None if no qualifying segment.
    """
    result: dict[str, Any] = {}

    for dim in ("medium", "size", "house", "month", "season"):
        seg = select_best_segment(all_stats.get(dim, {}), min_sales=min_sales)
        if seg:
            key, stats = seg
            result[f"best_{dim}"] = key
            result[f"best_{dim}_wilson"] = stats.get("wilson_lower")
        else:
            result[f"best_{dim}"] = None
            result[f"best_{dim}_wilson"] = None

    return result


# ── Cycle fit scoring ─────────────────────────────────────────────────────────

# Dimension weights (must sum to 100)
_DIM_WEIGHTS = {
    "medium": 30,
    "house":  25,
    "season": 25,
    "size":   20,
}


def compute_cycle_fit(
    artist_stats: Optional[dict],
    medium: Optional[str] = None,
    auction_house: Optional[str] = None,
    sale_date: Optional[Any] = None,
    dimensions_cm: Optional[dict] = None,
) -> dict:
    """
    Compute a Cycle Fit score (0–100) for a lot against an artist's best configuration.

    Scoring logic per dimension:
        dimension_score = weight × (segment_wilson_lower / best_wilson_lower)
        capped at 1.0 per dimension (never penalised for exceeding best)

    Args:
        artist_stats: dict from the artist_cycle_stats row, or None if unavailable.
            Required keys: best_medium, best_medium_wilson, best_size, best_size_wilson,
            best_house, best_house_wilson, best_season, best_season_wilson,
            medium_stats, size_stats, house_stats, season_stats, is_eligible.
        medium:        The lot's medium_category (normalized).
        auction_house: The lot's auction_house (normalized).
        sale_date:     The lot's sale date (datetime, date, or ISO string).
        dimensions_cm: dict with width_cm, height_cm (from parse_dimensions_cm).

    Returns:
        dict with:
            score           float | None   (0–100, or None if insufficient data)
            components      dict           per-dimension score contribution
            confidence      float          weighted average of dimension confidence tiers
            reasons         list[str]      human-readable English explanations
            data_quality    str            'sufficient' | 'limited' | 'insufficient'
    """
    if not artist_stats or not artist_stats.get("is_eligible"):
        return {
            "score": None,
            "components": {},
            "confidence": 0.0,
            "reasons": ["Insufficient historical data to compute a cycle fit score."],
            "data_quality": "insufficient",
        }

    # Resolve season from sale_date
    lot_season: Optional[str] = None
    if sale_date is not None:
        try:
            if isinstance(sale_date, datetime):
                lot_season = month_to_season(sale_date.month)
            elif isinstance(sale_date, date):
                lot_season = month_to_season(sale_date.month)
            elif isinstance(sale_date, str):
                dt = datetime.fromisoformat(sale_date[:10])
                lot_season = month_to_season(dt.month)
        except (ValueError, TypeError):
            lot_season = None

    # Resolve size bucket (inline to avoid import chain issues in pure-logic contexts)
    lot_size: Optional[str] = None
    if dimensions_cm:
        w = dimensions_cm.get("width_cm")
        h = dimensions_cm.get("height_cm")
        if w is not None and h is not None:
            area = w * h
            if area < 900:
                lot_size = "small"
            elif area < 5000:
                lot_size = "medium"
            elif area < 15000:
                lot_size = "large"
            else:
                lot_size = "very_large"

    # Map dimension → (lot_value, best_key, best_wilson, stats_dict)
    dim_inputs = {
        "medium": (
            medium,
            artist_stats.get("best_medium"),
            artist_stats.get("best_medium_wilson"),
            artist_stats.get("medium_stats") or {},
        ),
        "house": (
            auction_house,
            artist_stats.get("best_house"),
            artist_stats.get("best_house_wilson"),
            artist_stats.get("house_stats") or {},
        ),
        "season": (
            lot_season,
            artist_stats.get("best_season"),
            artist_stats.get("best_season_wilson"),
            artist_stats.get("season_stats") or {},
        ),
        "size": (
            lot_size,
            artist_stats.get("best_size"),
            artist_stats.get("best_size_wilson"),
            artist_stats.get("size_stats") or {},
        ),
    }

    total_score = 0.0
    components: dict[str, Any] = {}
    weighted_confidence = 0.0
    total_weight = 0.0

    for dim, (lot_val, best_key, best_wilson, stats) in dim_inputs.items():
        weight = _DIM_WEIGHTS[dim]

        if lot_val is None or best_wilson is None or best_wilson <= 0:
            # Dimension data unavailable — contribute 0 but don't penalise
            components[dim] = {
                "lot_value": lot_val,
                "best_value": best_key,
                "score": 0.0,
                "available": False,
            }
            continue

        # Get the Wilson lower for the lot's actual segment
        seg_stats = stats.get(lot_val) if stats else None
        if seg_stats and seg_stats.get("n_with_estimate", 0) > 0:
            seg_wilson = seg_stats.get("wilson_lower", 0.0)
            seg_tier = seg_stats.get("confidence_tier", "low")
            ratio = min(1.0, seg_wilson / best_wilson) if best_wilson > 0 else 0.0
        else:
            # Lot's segment not seen before — score 0 for this dimension
            seg_wilson = 0.0
            seg_tier = "low"
            ratio = 0.0

        dim_score = weight * ratio
        total_score += dim_score
        t_weight = _tier_weight(seg_tier)
        weighted_confidence += t_weight * weight
        total_weight += weight

        components[dim] = {
            "lot_value": lot_val,
            "best_value": best_key,
            "score": round(dim_score, 2),
            "segment_wilson": round(seg_wilson, 4),
            "best_wilson": round(best_wilson, 4),
            "confidence_tier": seg_tier,
            "available": True,
        }

    # Overall confidence = weighted average of tier weights
    confidence = (weighted_confidence / total_weight) if total_weight > 0 else 0.0

    # Data quality assessment
    n_available = sum(1 for c in components.values() if c.get("available"))
    if n_available >= 3:
        data_quality = "sufficient"
    elif n_available >= 1:
        data_quality = "limited"
    else:
        data_quality = "insufficient"

    return {
        "score": round(total_score, 1),
        "components": components,
        "confidence": round(confidence, 3),
        "reasons": [],  # populated by generate_cycle_reasons
        "data_quality": data_quality,
    }


# ── Explanation layer ─────────────────────────────────────────────────────────

def generate_cycle_reasons(
    artist_stats: Optional[dict],
    lot_medium: Optional[str] = None,
    lot_house: Optional[str] = None,
    lot_season: Optional[str] = None,
    lot_size_bucket: Optional[str] = None,
    *,
    is_fr: bool = False,
) -> list[str]:
    """
    Generate human-readable explanations for a cycle fit result.

    Uses simple, concrete language suitable for non-specialist collectors
    (Sophie and Thomas). References specific percentages when data is available.
    Flags low confidence with a caution note.

    Args:
        artist_stats:     Full artist_cycle_stats dict (or None).
        lot_medium:       Lot's medium_category.
        lot_house:        Lot's auction house (normalized).
        lot_season:       Lot's season ('winter'/'spring'/'summer'/'autumn').
        lot_size_bucket:  Lot's size bucket ('small'/'medium'/'large'/'very_large').
        is_fr:            If True, return French strings. Default: English.

    Returns:
        List of human-readable strings (may be empty if no data).
    """
    if not artist_stats or not artist_stats.get("is_eligible"):
        if is_fr:
            return ["Données historiques insuffisantes — aucun signal de cycle disponible."]
        return ["Insufficient historical data — no cycle signal available."]

    reasons: list[str] = []
    medium_stats = artist_stats.get("medium_stats") or {}
    house_stats = artist_stats.get("house_stats") or {}
    season_stats = artist_stats.get("season_stats") or {}
    size_stats = artist_stats.get("size_stats") or {}

    best_medium = artist_stats.get("best_medium")
    best_house = artist_stats.get("best_house")
    best_season = artist_stats.get("best_season")
    best_size = artist_stats.get("best_size")

    # ── Medium ──────────────────────────────────────────────────────────────────
    if lot_medium and medium_stats.get(lot_medium):
        ms = medium_stats[lot_medium]
        pct = ms.get("sold_above_low_pct", 0)
        n = ms.get("n_with_estimate", 0)
        if n >= 5:
            pct_str = f"{pct:.0%}"
            tier = ms.get("confidence_tier", "low")
            if lot_medium == best_medium:
                if is_fr:
                    reasons.append(
                        f"Les œuvres de type « {lot_medium} » de cet artiste ont dépassé "
                        f"l'estimation dans {pct_str} des cas — son meilleur médium."
                    )
                else:
                    reasons.append(
                        f"{lot_medium.capitalize()} works by this artist have sold above "
                        f"estimate in {pct_str} of cases — their strongest medium."
                    )
            else:
                if is_fr:
                    reasons.append(
                        f"Les œuvres de type « {lot_medium} » de cet artiste ont dépassé "
                        f"l'estimation dans {pct_str} des cas."
                    )
                else:
                    reasons.append(
                        f"{lot_medium.capitalize()} works by this artist have sold above "
                        f"estimate in {pct_str} of cases."
                    )
            if tier == "low":
                if is_fr:
                    reasons.append("Données limitées sur ce médium — signal à interpréter avec prudence.")
                else:
                    reasons.append("Limited data for this medium — treat this signal with caution.")
    elif best_medium and medium_stats.get(best_medium):
        ms = medium_stats[best_medium]
        pct = ms.get("sold_above_low_pct", 0)
        if ms.get("n_with_estimate", 0) >= 5:
            pct_str = f"{pct:.0%}"
            if is_fr:
                reasons.append(
                    f"Le médium le plus performant de cet artiste est « {best_medium} » "
                    f"({pct_str} au-dessus de l'estimation). Ce lot a un médium différent."
                )
            else:
                reasons.append(
                    f"This artist performs best in {best_medium} ({pct_str} above estimate). "
                    f"This lot uses a different medium."
                )

    # ── Auction house ────────────────────────────────────────────────────────────
    if lot_house and house_stats.get(lot_house):
        hs = house_stats[lot_house]
        pct = hs.get("sold_above_low_pct", 0)
        n = hs.get("n_with_estimate", 0)
        if n >= 5:
            pct_str = f"{pct:.0%}"
            house_display = lot_house.replace("_", " ").title()
            if lot_house == best_house:
                if is_fr:
                    reasons.append(
                        f"{house_display} a historiquement produit les meilleurs résultats "
                        f"pour cet artiste ({pct_str} au-dessus de l'estimation)."
                    )
                else:
                    reasons.append(
                        f"{house_display} has historically produced the strongest results "
                        f"for this artist ({pct_str} above estimate)."
                    )
            else:
                if is_fr:
                    reasons.append(
                        f"Cet artiste atteint {pct_str} au-dessus de l'estimation chez {house_display}."
                    )
                else:
                    reasons.append(
                        f"This artist achieves {pct_str} above estimate at {house_display}."
                    )
    elif best_house and house_stats.get(best_house):
        hs = house_stats[best_house]
        pct = hs.get("sold_above_low_pct", 0)
        if hs.get("n_with_estimate", 0) >= 5:
            best_display = best_house.replace("_", " ").title()
            pct_str = f"{pct:.0%}"
            if is_fr:
                reasons.append(
                    f"{best_display} est la maison de vente la plus performante pour cet artiste "
                    f"({pct_str}). Ce lot est proposé ailleurs."
                )
            else:
                reasons.append(
                    f"{best_display} is this artist's strongest auction house ({pct_str}). "
                    f"This lot is offered elsewhere."
                )

    # ── Season ───────────────────────────────────────────────────────────────────
    _SEASON_LABEL_EN = {
        "winter": "Winter", "spring": "Spring",
        "summer": "Summer", "autumn": "Autumn",
    }
    _SEASON_LABEL_FR = {
        "winter": "hiver", "spring": "printemps",
        "summer": "été", "autumn": "automne",
    }

    if lot_season and season_stats.get(lot_season):
        ss = season_stats[lot_season]
        pct = ss.get("sold_above_low_pct", 0)
        n = ss.get("n_with_estimate", 0)
        if n >= 5:
            pct_str = f"{pct:.0%}"
            s_label = (_SEASON_LABEL_FR if is_fr else _SEASON_LABEL_EN).get(lot_season, lot_season)
            if lot_season == best_season:
                if is_fr:
                    reasons.append(
                        f"Les ventes de {s_label} ont surperformé les autres saisons pour cet artiste "
                        f"({pct_str} au-dessus de l'estimation)."
                    )
                else:
                    reasons.append(
                        f"{s_label} auctions have outperformed other seasons for this artist "
                        f"({pct_str} above estimate)."
                    )
            else:
                if is_fr:
                    reasons.append(
                        f"La saison la plus performante de cet artiste est l'{_SEASON_LABEL_FR.get(best_season, best_season or '')}. "
                        f"Cette vente a lieu en {s_label}."
                    )
                else:
                    reasons.append(
                        f"This artist performs best in {_SEASON_LABEL_EN.get(best_season, best_season or '')}. "
                        f"This sale takes place in {s_label}."
                    )

    # ── Size ─────────────────────────────────────────────────────────────────────
    _SIZE_LABEL_EN = {
        "small": "Small-format", "medium": "Medium-format",
        "large": "Large-format", "very_large": "Very large-format",
    }
    _SIZE_LABEL_FR = {
        "small": "Les petits formats", "medium": "Les formats moyens",
        "large": "Les grands formats", "very_large": "Les très grands formats",
    }

    if lot_size_bucket and size_stats.get(lot_size_bucket):
        szs = size_stats[lot_size_bucket]
        pct = szs.get("sold_above_low_pct", 0)
        n = szs.get("n_with_estimate", 0)
        if n >= 5:
            pct_str = f"{pct:.0%}"
            sz_label_en = _SIZE_LABEL_EN.get(lot_size_bucket, lot_size_bucket)
            sz_label_fr = _SIZE_LABEL_FR.get(lot_size_bucket, lot_size_bucket)
            if lot_size_bucket == best_size:
                if is_fr:
                    reasons.append(
                        f"{sz_label_fr} de cet artiste ont montré des performances "
                        f"supérieures à la moyenne ({pct_str} au-dessus de l'estimation)."
                    )
                else:
                    reasons.append(
                        f"{sz_label_en} works by this artist have shown above-average "
                        f"market performance ({pct_str} above estimate)."
                    )
            else:
                if is_fr:
                    reasons.append(
                        f"{sz_label_fr} de cet artiste ont un taux de dépassement "
                        f"d'estimation de {pct_str}."
                    )
                else:
                    reasons.append(
                        f"{sz_label_en} works by this artist have a {pct_str} above-estimate rate."
                    )

    # ── Fallback if no reasons generated ────────────────────────────────────────
    if not reasons:
        total_sales = artist_stats.get("total_sales", 0)
        if is_fr:
            reasons.append(
                f"Cet artiste dispose de {total_sales} vente(s) aux enchères enregistrée(s), "
                f"mais les données disponibles sont insuffisantes pour identifier un signal de cycle précis."
            )
        else:
            reasons.append(
                f"This artist has {total_sales} recorded auction sale(s), "
                f"but available data is insufficient to identify a precise cycle signal."
            )

    return reasons
