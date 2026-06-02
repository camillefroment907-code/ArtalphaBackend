"""
Tests for Artist Cycle Intelligence (Step 4).

Covers:
  - wilson_lower_bound: edge cases, known values
  - confidence_tier: boundary conditions
  - is_artist_eligible: all rule combinations
  - compute_segment_stats: correctness, edge cases, no survivorship bias
  - compute_all_segment_stats: grouping logic
  - select_best_segment / select_best_config
  - compute_cycle_fit: matching and non-matching lots
  - generate_cycle_reasons: French and English
  - API null safety: no 500 errors on missing data
  - month_to_season: all months
"""
from __future__ import annotations

import math
import pytest
from typing import Optional
from unittest.mock import MagicMock, AsyncMock, patch

from app.engines.cycle_intelligence import (
    wilson_lower_bound,
    confidence_tier,
    is_artist_eligible,
    compute_segment_stats,
    compute_all_segment_stats,
    select_best_segment,
    select_best_config,
    compute_cycle_fit,
    generate_cycle_reasons,
    month_to_season,
    MIN_TOTAL_SALES,
    MIN_RECENT_SALES_3Y,
    MIN_ESTIMATE_COVERAGE,
)


# ── wilson_lower_bound ────────────────────────────────────────────────────────

class TestWilsonLowerBound:
    def test_n_zero(self):
        """No data → 0.0"""
        assert wilson_lower_bound(0, 0) == 0.0

    def test_n_one_success(self):
        """n=1, k=1 → well below 1.0 due to uncertainty"""
        result = wilson_lower_bound(1, 1)
        assert 0.0 < result < 0.8, f"Expected 0 < result < 0.8, got {result}"

    def test_n_three_full_success(self):
        """n=3, 100% success → significantly below 1.0 due to small sample.

        With z=1.645 (90% CI): wilson(3,3) ≈ 0.526.
        Note: Some references quote ≈0.43 for z=1.96 (95% CI). We use 90% CI.
        """
        result = wilson_lower_bound(3, 3)
        assert abs(result - 0.526) < 0.01, f"Expected ≈0.526 (90% CI), got {result}"
        # Critically: must be much less than 1.0
        assert result < 0.7, f"n=3 should have high uncertainty, got {result}"

    def test_n_150_78pct(self):
        """n=150, 78% success → ranks higher than n=3/100% (key correctness test)"""
        result_3 = wilson_lower_bound(3, 3)
        result_150 = wilson_lower_bound(150, int(0.78 * 150))
        assert result_150 > result_3, (
            f"n=150/78% ({result_150:.3f}) should rank > n=3/100% ({result_3:.3f})"
        )

    def test_n_193_150(self):
        """n=193, k=150 ≈ 77.7% → high confidence value (80%+ CI)"""
        result = wilson_lower_bound(193, 150)
        # With z=1.645 (90%): ~0.716 for 95%; exact value differs
        # Just check it's high and in a reasonable range
        assert result > 0.70, f"Expected >0.70 for n=193/78%, got {result}"
        assert result < 0.80, f"Expected <0.80 for n=193/78%, got {result}"

    def test_zero_successes(self):
        """n=50, k=0 → very low but not zero"""
        result = wilson_lower_bound(50, 0)
        assert 0.0 <= result < 0.1

    def test_all_success_large_n(self):
        """n=200, k=200 → close to 1.0 but confidence-adjusted"""
        result = wilson_lower_bound(200, 200)
        assert 0.95 < result <= 1.0

    def test_k_negative_clamped(self):
        """Negative k is clamped to 0"""
        result = wilson_lower_bound(10, -5)
        assert result == wilson_lower_bound(10, 0)

    def test_k_exceeds_n_clamped(self):
        """k > n is clamped to n"""
        result = wilson_lower_bound(10, 15)
        assert result == wilson_lower_bound(10, 10)

    def test_result_in_unit_interval(self):
        """Always returns value in [0, 1]"""
        for n, k in [(0, 0), (1, 0), (1, 1), (5, 3), (100, 75), (1000, 999)]:
            result = wilson_lower_bound(n, k)
            assert 0.0 <= result <= 1.0, f"Out of range for n={n}, k={k}: {result}"


# ── confidence_tier ───────────────────────────────────────────────────────────

class TestConfidenceTier:
    def test_low_below_10(self):
        for n in [0, 1, 5, 9]:
            assert confidence_tier(n) == "low", f"n={n} should be 'low'"

    def test_medium_10_to_49(self):
        for n in [10, 20, 49]:
            assert confidence_tier(n) == "medium", f"n={n} should be 'medium'"

    def test_high_50_plus(self):
        for n in [50, 100, 1000]:
            assert confidence_tier(n) == "high", f"n={n} should be 'high'"

    def test_boundary_exactly_10(self):
        assert confidence_tier(10) == "medium"

    def test_boundary_exactly_50(self):
        assert confidence_tier(50) == "high"


# ── is_artist_eligible ────────────────────────────────────────────────────────

class TestIsArtistEligible:
    def test_eligible(self):
        ok, reason = is_artist_eligible(25, 8, 0.60)
        assert ok is True
        assert reason == "eligible"

    def test_too_few_total_sales(self):
        ok, reason = is_artist_eligible(3, 3, 1.0)
        assert ok is False
        assert "total_sales" in reason

    def test_too_few_recent_sales(self):
        ok, reason = is_artist_eligible(25, 2, 0.60)
        assert ok is False
        assert "recent_sales_3y" in reason

    def test_insufficient_estimate_coverage(self):
        ok, reason = is_artist_eligible(25, 8, 0.10)
        assert ok is False
        assert "estimate_coverage" in reason

    def test_boundary_exact_minimums(self):
        ok, _ = is_artist_eligible(
            MIN_TOTAL_SALES, MIN_RECENT_SALES_3Y, MIN_ESTIMATE_COVERAGE
        )
        assert ok is True

    def test_custom_overrides(self):
        ok, _ = is_artist_eligible(5, 2, 0.5, min_total=5, min_recent=2, min_coverage=0.5)
        assert ok is True

    def test_zero_coverage_with_sufficient_sales(self):
        """0% coverage fails even with many sales"""
        ok, _ = is_artist_eligible(100, 20, 0.0)
        assert ok is False


# ── compute_segment_stats ─────────────────────────────────────────────────────

class TestComputeSegmentStats:
    def _make_rows(self, pairs: list) -> list[dict]:
        """pairs = [(hammer_price_eur, estimate_low)]"""
        return [
            {"hammer_price_eur": hp, "estimate_low": el}
            for hp, el in pairs
        ]

    def test_empty_rows(self):
        stats = compute_segment_stats([])
        assert stats["sales_count"] == 0
        assert stats["wilson_lower"] == 0.0

    def test_no_estimates(self):
        rows = self._make_rows([(1000, None), (2000, None)])
        stats = compute_segment_stats(rows)
        assert stats["sales_count"] == 2
        assert stats["n_with_estimate"] == 0
        assert stats["sold_above_low_pct"] == 0.0
        assert stats["wilson_lower"] == 0.0

    def test_all_above_estimate(self):
        rows = self._make_rows([(2000, 1000), (3000, 2000), (4000, 3000)])
        stats = compute_segment_stats(rows)
        assert stats["sold_above_low_count"] == 3
        assert stats["n_with_estimate"] == 3
        assert stats["sold_above_low_pct"] == 1.0
        # Wilson lower should be significantly < 1.0 for small n
        assert stats["wilson_lower"] < 1.0
        assert stats["wilson_lower"] > 0.3

    def test_none_above_estimate(self):
        rows = self._make_rows([(500, 1000), (800, 1000)])
        stats = compute_segment_stats(rows)
        assert stats["sold_above_low_count"] == 0
        assert stats["sold_above_low_pct"] == 0.0

    def test_mixed_results_include_below_estimate(self):
        """NO SURVIVORSHIP BIAS — below-estimate sales count too."""
        rows = self._make_rows([
            (2000, 1000),  # above
            (500,  1000),  # below
            (1500, 1000),  # above (equal counts)
        ])
        stats = compute_segment_stats(rows)
        assert stats["sales_count"] == 3
        assert stats["sold_above_low_count"] == 2
        assert abs(stats["sold_above_low_pct"] - 2/3) < 0.001

    def test_premium_ratio_computed(self):
        rows = self._make_rows([(2000, 1000), (3000, 1000)])
        stats = compute_segment_stats(rows)
        # ratios = [2.0, 3.0], median = 2.5
        assert stats["median_premium_ratio"] == 2.5
        assert stats["avg_premium_ratio"] == 2.5

    def test_confidence_tier_assigned(self):
        rows_low = self._make_rows([(1000, 800)] * 5)
        rows_med = self._make_rows([(1000, 800)] * 20)
        rows_high = self._make_rows([(1000, 800)] * 60)
        assert compute_segment_stats(rows_low)["confidence_tier"] == "low"
        assert compute_segment_stats(rows_med)["confidence_tier"] == "medium"
        assert compute_segment_stats(rows_high)["confidence_tier"] == "high"

    def test_hammer_price_fallback(self):
        """Falls back to hammer_price if hammer_price_eur is None."""
        rows = [
            {"hammer_price_eur": None, "hammer_price": 1500.0, "estimate_low": 1000.0}
        ]
        stats = compute_segment_stats(rows)
        assert stats["sales_count"] == 1
        assert stats["sold_above_low_count"] == 1


# ── compute_all_segment_stats ─────────────────────────────────────────────────

class TestComputeAllSegmentStats:
    def _make_rich_rows(self, n: int, medium: str, house: str, season: str) -> list[dict]:
        return [
            {
                "hammer_price_eur": 2000.0,
                "estimate_low": 1000.0,
                "medium_category": medium,
                "size_bkt": "medium",
                "auction_house_norm": house,
                "sale_month": 3 if season == "spring" else 7,
                "sale_season": season,
            }
        ] * n

    def test_grouping_by_all_dimensions(self):
        rows = (
            self._make_rich_rows(10, "painting", "christies", "spring")
            + self._make_rich_rows(8, "print", "sothebys", "autumn")
        )
        stats = compute_all_segment_stats(rows, min_segment_sales=3)
        assert "painting" in stats["medium"]
        assert "print" in stats["medium"]
        assert "christies" in stats["house"]
        assert "spring" in stats["season"]

    def test_small_segments_excluded(self):
        rows = self._make_rich_rows(2, "photography", "heritage", "winter")
        stats = compute_all_segment_stats(rows, min_segment_sales=3)
        assert "photography" not in stats["medium"]

    def test_unknown_medium_grouped(self):
        rows = [
            {
                "hammer_price_eur": 1000.0,
                "estimate_low": 800.0,
                "medium_category": None,
                "size_bkt": None,
                "auction_house_norm": None,
                "sale_month": 6,
                "sale_season": "summer",
            }
        ] * 5
        stats = compute_all_segment_stats(rows, min_segment_sales=3)
        assert "unknown" in stats["medium"]


# ── select_best_config ────────────────────────────────────────────────────────

class TestSelectBestConfig:
    def test_best_medium_selected(self):
        all_stats = {
            "medium": {
                "painting": {
                    "sales_count": 50, "n_with_estimate": 40,
                    "wilson_lower": 0.75, "sold_above_low_pct": 0.8,
                    "confidence_tier": "high",
                },
                "print": {
                    "sales_count": 30, "n_with_estimate": 20,
                    "wilson_lower": 0.50, "sold_above_low_pct": 0.6,
                    "confidence_tier": "medium",
                },
            },
            "size": {},
            "house": {},
            "month": {},
            "season": {},
        }
        best = select_best_config(all_stats, min_sales=5)
        assert best["best_medium"] == "painting"
        assert best["best_medium_wilson"] == 0.75

    def test_no_qualifying_segments_returns_none(self):
        all_stats = {k: {} for k in ("medium", "size", "house", "month", "season")}
        best = select_best_config(all_stats, min_sales=5)
        assert best["best_medium"] is None
        assert best["best_season"] is None

    def test_min_sales_filter(self):
        all_stats = {
            "medium": {
                "oil": {
                    "sales_count": 3, "n_with_estimate": 3,
                    "wilson_lower": 0.90, "sold_above_low_pct": 1.0,
                    "confidence_tier": "low",
                },
            },
            "size": {}, "house": {}, "month": {}, "season": {},
        }
        best = select_best_config(all_stats, min_sales=5)
        assert best["best_medium"] is None  # 3 < min_sales=5


# ── compute_cycle_fit ─────────────────────────────────────────────────────────

class TestComputeCycleFit:
    def _make_artist_stats(self) -> dict:
        return {
            "is_eligible": True,
            "total_sales": 100,
            "best_medium": "painting",
            "best_medium_wilson": 0.75,
            "best_size": "medium",
            "best_size_wilson": 0.65,
            "best_house": "christies",
            "best_house_wilson": 0.70,
            "best_month": 5,
            "best_month_wilson": 0.72,
            "best_season": "spring",
            "best_season_wilson": 0.68,
            "medium_stats": {
                "painting": {
                    "sales_count": 60, "n_with_estimate": 50,
                    "sold_above_low_pct": 0.80, "wilson_lower": 0.75,
                    "confidence_tier": "high",
                },
                "print": {
                    "sales_count": 40, "n_with_estimate": 30,
                    "sold_above_low_pct": 0.60, "wilson_lower": 0.50,
                    "confidence_tier": "medium",
                },
            },
            "size_stats": {
                "medium": {
                    "sales_count": 50, "n_with_estimate": 40,
                    "sold_above_low_pct": 0.70, "wilson_lower": 0.65,
                    "confidence_tier": "high",
                },
            },
            "house_stats": {
                "christies": {
                    "sales_count": 40, "n_with_estimate": 35,
                    "sold_above_low_pct": 0.74, "wilson_lower": 0.70,
                    "confidence_tier": "high",
                },
            },
            "season_stats": {
                "spring": {
                    "sales_count": 30, "n_with_estimate": 25,
                    "sold_above_low_pct": 0.72, "wilson_lower": 0.68,
                    "confidence_tier": "medium",
                },
                "autumn": {
                    "sales_count": 25, "n_with_estimate": 20,
                    "sold_above_low_pct": 0.55, "wilson_lower": 0.45,
                    "confidence_tier": "medium",
                },
            },
            "month_stats": {},
        }

    def test_perfect_match_scores_100(self):
        """Lot matches best config on all dimensions → score = 100"""
        stats = self._make_artist_stats()
        result = compute_cycle_fit(
            artist_stats=stats,
            medium="painting",
            auction_house="christies",
            sale_date="2026-05-15",  # May = spring
            dimensions_cm={"width_cm": 60, "height_cm": 70},  # → medium size
        )
        assert result["score"] == pytest.approx(100.0, abs=2.0)
        assert result["data_quality"] == "sufficient"

    def test_partial_match_scores_below_100(self):
        """Lot uses 'print' (not best medium 'painting') → score below max"""
        stats = self._make_artist_stats()
        result = compute_cycle_fit(
            artist_stats=stats,
            medium="print",
            auction_house="christies",
            sale_date="2026-05-15",
        )
        assert result["score"] < 100.0
        assert result["score"] > 0.0

    def test_no_data_returns_null(self):
        """Ineligible artist → score=None, data_quality=insufficient"""
        result = compute_cycle_fit(artist_stats=None)
        assert result["score"] is None
        assert result["data_quality"] == "insufficient"

    def test_ineligible_artist(self):
        stats = {"is_eligible": False, "total_sales": 5}
        result = compute_cycle_fit(artist_stats=stats)
        assert result["score"] is None

    def test_unknown_house_scores_zero_for_that_dim(self):
        stats = self._make_artist_stats()
        result = compute_cycle_fit(
            artist_stats=stats,
            medium="painting",
            auction_house="xyz_unknown_house",
            sale_date="2026-05-15",
        )
        house_component = result["components"].get("house", {})
        assert house_component.get("score", 0) == 0.0

    def test_score_in_valid_range(self):
        stats = self._make_artist_stats()
        result = compute_cycle_fit(
            artist_stats=stats,
            medium="print",
            auction_house="christies",
            sale_date="2026-11-15",  # autumn
        )
        score = result["score"]
        assert score is not None
        assert 0 <= score <= 100

    def test_no_500_on_bad_sale_date(self):
        """Malformed sale_date should not raise — just ignore season"""
        stats = self._make_artist_stats()
        result = compute_cycle_fit(
            artist_stats=stats,
            medium="painting",
            auction_house="christies",
            sale_date="not-a-date",
        )
        assert result["score"] is not None  # Still computes without season


# ── generate_cycle_reasons ────────────────────────────────────────────────────

class TestGenerateCycleReasons:
    def _artist_stats(self) -> dict:
        return {
            "is_eligible": True,
            "total_sales": 80,
            "best_medium": "painting",
            "best_house": "christies",
            "best_season": "spring",
            "best_size": "large",
            "medium_stats": {
                "painting": {
                    "n_with_estimate": 40, "sold_above_low_pct": 0.78,
                    "confidence_tier": "high",
                },
            },
            "house_stats": {
                "christies": {
                    "n_with_estimate": 30, "sold_above_low_pct": 0.74,
                    "confidence_tier": "high",
                },
            },
            "season_stats": {
                "spring": {
                    "n_with_estimate": 20, "sold_above_low_pct": 0.80,
                    "confidence_tier": "medium",
                },
            },
            "size_stats": {
                "large": {
                    "n_with_estimate": 15, "sold_above_low_pct": 0.73,
                    "confidence_tier": "medium",
                },
            },
        }

    def test_english_reasons_generated(self):
        reasons = generate_cycle_reasons(
            self._artist_stats(),
            lot_medium="painting",
            lot_house="christies",
            lot_season="spring",
            lot_size_bucket="large",
            is_fr=False,
        )
        assert len(reasons) > 0
        assert any("above estimate" in r.lower() or "78%" in r or "painting" in r.lower()
                   for r in reasons)

    def test_french_reasons_generated(self):
        reasons = generate_cycle_reasons(
            self._artist_stats(),
            lot_medium="painting",
            lot_house="christies",
            lot_season="spring",
            lot_size_bucket="large",
            is_fr=True,
        )
        assert len(reasons) > 0
        assert any("estimation" in r.lower() or "artiste" in r.lower()
                   for r in reasons)

    def test_best_medium_highlighted(self):
        reasons = generate_cycle_reasons(
            self._artist_stats(),
            lot_medium="painting",
            is_fr=False,
        )
        assert any("strongest medium" in r.lower() or "painting" in r.lower()
                   for r in reasons)

    def test_non_best_medium_mentioned(self):
        stats = self._artist_stats()
        stats["medium_stats"]["print"] = {
            "n_with_estimate": 10, "sold_above_low_pct": 0.50,
            "confidence_tier": "medium",
        }
        reasons = generate_cycle_reasons(
            stats,
            lot_medium="print",
            is_fr=False,
        )
        # Should mention print without calling it best
        assert any("print" in r.lower() for r in reasons)
        assert not any("strongest medium" in r.lower() for r in reasons)

    def test_ineligible_artist_returns_fallback(self):
        reasons_en = generate_cycle_reasons(None, is_fr=False)
        reasons_fr = generate_cycle_reasons(None, is_fr=True)
        assert len(reasons_en) == 1
        assert "insufficient" in reasons_en[0].lower()
        assert len(reasons_fr) == 1
        assert "insuffisantes" in reasons_fr[0].lower()

    def test_best_house_highlighted(self):
        reasons = generate_cycle_reasons(
            self._artist_stats(),
            lot_house="christies",
            is_fr=False,
        )
        assert any("christies" in r.lower() or "strongest results" in r.lower()
                   for r in reasons)

    def test_french_season_language(self):
        reasons = generate_cycle_reasons(
            self._artist_stats(),
            lot_season="spring",
            is_fr=True,
        )
        assert any("printemps" in r.lower() for r in reasons)

    def test_caution_note_for_low_confidence_medium(self):
        stats = self._artist_stats()
        stats["medium_stats"]["painting"]["confidence_tier"] = "low"
        stats["medium_stats"]["painting"]["n_with_estimate"] = 5
        reasons = generate_cycle_reasons(
            stats,
            lot_medium="painting",
            is_fr=False,
        )
        assert any("caution" in r.lower() or "limited" in r.lower()
                   for r in reasons)

    def test_no_crash_with_empty_stats(self):
        """No 500 on artist with no segment data."""
        stats = {
            "is_eligible": True,
            "total_sales": 25,
            "best_medium": None,
            "best_house": None,
            "best_season": None,
            "best_size": None,
            "medium_stats": {},
            "house_stats": {},
            "season_stats": {},
            "size_stats": {},
        }
        reasons = generate_cycle_reasons(stats, is_fr=False)
        assert isinstance(reasons, list)
        assert len(reasons) > 0


# ── month_to_season ───────────────────────────────────────────────────────────

class TestMonthToSeason:
    def test_winter(self):
        assert month_to_season(12) == "winter"
        assert month_to_season(1) == "winter"
        assert month_to_season(2) == "winter"

    def test_spring(self):
        for m in (3, 4, 5):
            assert month_to_season(m) == "spring", f"Month {m} should be spring"

    def test_summer(self):
        for m in (6, 7, 8):
            assert month_to_season(m) == "summer", f"Month {m} should be summer"

    def test_autumn(self):
        for m in (9, 10, 11):
            assert month_to_season(m) == "autumn", f"Month {m} should be autumn"

    def test_invalid_month(self):
        assert month_to_season(0) == "unknown"
        assert month_to_season(13) == "unknown"


# ── API null safety ───────────────────────────────────────────────────────────

class TestAPINull:
    """Ensure the router never raises a 500 for missing data."""

    def _make_null_fit(self):
        """cycle fit with None artist_stats should return null-safe result."""
        result = compute_cycle_fit(artist_stats=None)
        assert result["score"] is None
        assert isinstance(result["reasons"], list)
        assert result["data_quality"] == "insufficient"
        return result

    def test_null_artist_stats_no_exception(self):
        self._make_null_fit()

    def test_missing_best_wilson_no_exception(self):
        """If best_wilson is None, dimension gets score 0 not exception."""
        stats = {
            "is_eligible": True,
            "total_sales": 30,
            "best_medium": "painting",
            "best_medium_wilson": None,   # ← missing
            "best_size": None,
            "best_size_wilson": None,
            "best_house": None,
            "best_house_wilson": None,
            "best_season": None,
            "best_season_wilson": None,
            "medium_stats": {},
            "size_stats": {},
            "house_stats": {},
            "season_stats": {},
            "month_stats": {},
        }
        result = compute_cycle_fit(
            artist_stats=stats,
            medium="painting",
            auction_house="christies",
            sale_date="2026-05-01",
        )
        # Should not raise; score may be 0 but not None
        assert result["score"] is not None or result["data_quality"] == "insufficient"

    def test_reasons_always_list(self):
        """reasons field is always a list, never None."""
        for stats in [None, {"is_eligible": False}, {"is_eligible": True, "total_sales": 5}]:
            reasons = generate_cycle_reasons(stats)
            assert isinstance(reasons, list)

    def test_no_500_on_none_dimensions(self):
        """dimensions_cm=None → size dimension skipped gracefully."""
        stats = {
            "is_eligible": True,
            "total_sales": 25,
            "best_medium": "painting",
            "best_medium_wilson": 0.7,
            "best_size": None,
            "best_size_wilson": None,
            "best_house": None,
            "best_house_wilson": None,
            "best_season": None,
            "best_season_wilson": None,
            "medium_stats": {"painting": {"n_with_estimate": 20, "wilson_lower": 0.7, "confidence_tier": "medium"}},
            "size_stats": {}, "house_stats": {}, "season_stats": {}, "month_stats": {},
        }
        result = compute_cycle_fit(
            artist_stats=stats,
            medium="painting",
            dimensions_cm=None,
        )
        assert result["score"] is not None
        size_comp = result["components"].get("size", {})
        assert size_comp.get("available", False) is False
