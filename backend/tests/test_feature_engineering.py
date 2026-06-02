"""
Tests for Nautilus feature engineering functions.

Covers:
  - compute_artwork_period
  - compute_estimate_spread_pct
  - leakage contract (structural SQL verification)
  - compute_artist_liquidity_at_date (mock DB)
  - compute_artist_momentum_at_date (mock DB)
  - compute_artist_house_premium_at_date (mock DB)
  - build_hammer_features (mock DB)

Run with:
    pytest backend/tests/test_feature_engineering.py -v
"""
import inspect
from datetime import date, datetime
from unittest.mock import MagicMock, patch
import pytest

from app.engines.feature_engineering import (
    compute_artwork_period,
    compute_estimate_spread_pct,
    compute_artist_liquidity_at_date,
    compute_artist_momentum_at_date,
    compute_artist_house_premium_at_date,
    build_hammer_features,
    leakage_guard,
)


# ─────────────────────────────────────────────────────────────────────────────
# compute_artwork_period
# ─────────────────────────────────────────────────────────────────────────────

class TestComputeArtworkPeriod:

    def test_pre_1900(self):
        assert compute_artwork_period(1850) == "pre_1900"

    def test_exactly_1899(self):
        assert compute_artwork_period(1899) == "pre_1900"

    def test_1900_boundary(self):
        assert compute_artwork_period(1900) == "1900_1950"

    def test_1900_1950(self):
        assert compute_artwork_period(1925) == "1900_1950"

    def test_exactly_1949(self):
        assert compute_artwork_period(1949) == "1900_1950"

    def test_1950_boundary(self):
        assert compute_artwork_period(1950) == "1950_2000"

    def test_1950_2000(self):
        assert compute_artwork_period(1975) == "1950_2000"

    def test_exactly_1999(self):
        assert compute_artwork_period(1999) == "1950_2000"

    def test_2000_boundary(self):
        assert compute_artwork_period(2000) == "post_2000"

    def test_post_2000(self):
        assert compute_artwork_period(2010) == "post_2000"

    def test_none_returns_unknown(self):
        assert compute_artwork_period(None) == "unknown"

    def test_very_old(self):
        """Works from before 1000 AD should still return pre_1900"""
        assert compute_artwork_period(500) == "pre_1900"


# ─────────────────────────────────────────────────────────────────────────────
# compute_estimate_spread_pct
# ─────────────────────────────────────────────────────────────────────────────

class TestComputeEstimateSpreadPct:

    def test_standard_spread(self):
        """(1500 - 1000) / 1000 * 100 = 50.0"""
        assert compute_estimate_spread_pct(1000, 1500) == 50.0

    def test_zero_spread(self):
        """Same low and high → 0.0"""
        assert compute_estimate_spread_pct(1000, 1000) == 0.0

    def test_none_low(self):
        assert compute_estimate_spread_pct(None, 1500) is None

    def test_none_high(self):
        assert compute_estimate_spread_pct(1000, None) is None

    def test_both_none(self):
        assert compute_estimate_spread_pct(None, None) is None

    def test_zero_low_div_guard(self):
        """low=0 → division by zero guard → None"""
        assert compute_estimate_spread_pct(0, 1500) is None

    def test_zero_low_zero_high(self):
        assert compute_estimate_spread_pct(0, 0) is None

    def test_typical_auction_spread(self):
        """Typical 20% spread: 10000–12000"""
        result = compute_estimate_spread_pct(10000, 12000)
        assert result == 20.0

    def test_wide_spread(self):
        """100% spread (double the estimate)"""
        result = compute_estimate_spread_pct(5000, 10000)
        assert result == 100.0

    def test_returns_float_not_int(self):
        """Return type is float"""
        result = compute_estimate_spread_pct(1000, 1200)
        assert isinstance(result, float)


# ─────────────────────────────────────────────────────────────────────────────
# Leakage guard — structural tests
# ─────────────────────────────────────────────────────────────────────────────

class TestLeakageGuard:

    def test_leakage_guard_marker_on_liquidity(self):
        """compute_artist_liquidity_at_date must have _leakage_guard_param attribute"""
        assert hasattr(compute_artist_liquidity_at_date, "_leakage_guard_param")
        assert compute_artist_liquidity_at_date._leakage_guard_param == "reference_date"

    def test_leakage_guard_marker_on_momentum(self):
        """compute_artist_momentum_at_date must have _leakage_guard_param attribute"""
        assert hasattr(compute_artist_momentum_at_date, "_leakage_guard_param")

    def test_leakage_guard_marker_on_house_premium(self):
        """compute_artist_house_premium_at_date must have _leakage_guard_param attribute"""
        assert hasattr(compute_artist_house_premium_at_date, "_leakage_guard_param")

    def test_leakage_guard_decorator_callable(self):
        """leakage_guard should be a decorator factory"""
        decorator = leakage_guard("some_param")
        assert callable(decorator)

    def test_leakage_guard_preserves_function_name(self):
        """Decorator must preserve __name__ via functools.wraps"""
        @leakage_guard("ref_date")
        def my_test_func(x, ref_date):
            return x

        assert my_test_func.__name__ == "my_test_func"

    def test_liquidity_sql_has_strict_filter(self):
        """
        Structural test: the source code of compute_artist_liquidity_at_date
        must contain 'sale_date < :reference_date' (strict less-than).
        This is the leakage prevention contract.
        """
        source = inspect.getsource(compute_artist_liquidity_at_date)
        assert "sale_date < :reference_date" in source, (
            "LEAKAGE VIOLATION: compute_artist_liquidity_at_date SQL must have "
            "'sale_date < :reference_date' (strict less-than)"
        )

    def test_momentum_sql_has_strict_filter(self):
        """Structural test: momentum must filter strictly before reference_date."""
        source = inspect.getsource(compute_artist_momentum_at_date)
        assert "sale_date < :reference_date" in source, (
            "LEAKAGE VIOLATION: compute_artist_momentum_at_date SQL must have "
            "'sale_date < :reference_date'"
        )

    def test_house_premium_sql_has_strict_filter(self):
        """Structural test: house premium must filter strictly before reference_date."""
        source = inspect.getsource(compute_artist_house_premium_at_date)
        assert "sale_date < :reference_date" in source, (
            "LEAKAGE VIOLATION: compute_artist_house_premium_at_date SQL must have "
            "'sale_date < :reference_date'"
        )


# ─────────────────────────────────────────────────────────────────────────────
# compute_artist_liquidity_at_date — mock DB tests
# ─────────────────────────────────────────────────────────────────────────────

class TestComputeArtistLiquidityAtDate:

    def _make_session(self, sale_count, first_sale, last_sale):
        """Helper: creates a mock session that returns a single row."""
        mock_row = MagicMock()
        mock_row.__getitem__ = lambda self, i: [sale_count, first_sale, last_sale][i]
        mock_result = MagicMock()
        mock_result.fetchone.return_value = mock_row
        mock_session = MagicMock()
        mock_session.execute.return_value = mock_result
        return mock_session

    def test_normal_case(self):
        """10 sales over 5 years = liquidity 2.0"""
        session = self._make_session(
            sale_count=10,
            first_sale=date(2015, 1, 1),
            last_sale=date(2020, 1, 1),
        )
        result = compute_artist_liquidity_at_date(
            "pablo picasso", date(2021, 1, 1), session
        )
        assert result is not None
        # 10 / 5.0 = 2.0
        assert abs(result - 2.0) < 0.5

    def test_zero_sales_returns_none(self):
        """0 sales → None"""
        mock_row = MagicMock()
        mock_row.__getitem__ = lambda self, i: [0, None, None][i]
        mock_result = MagicMock()
        mock_result.fetchone.return_value = mock_row
        session = MagicMock()
        session.execute.return_value = mock_result

        result = compute_artist_liquidity_at_date(
            "pablo picasso", date(2021, 1, 1), session
        )
        assert result is None

    def test_caps_at_100(self):
        """Very high sale count capped at 100"""
        session = self._make_session(
            sale_count=10000,
            first_sale=date(2019, 1, 1),
            last_sale=date(2020, 1, 1),
        )
        result = compute_artist_liquidity_at_date(
            "pablo picasso", date(2021, 1, 1), session
        )
        assert result is not None
        assert result <= 100.0

    def test_empty_artist_returns_none(self):
        """Empty artist name → None without DB query"""
        session = MagicMock()
        result = compute_artist_liquidity_at_date("", date(2021, 1, 1), session)
        assert result is None
        session.execute.assert_not_called()


# ─────────────────────────────────────────────────────────────────────────────
# compute_estimate_spread_pct — edge cases
# ─────────────────────────────────────────────────────────────────────────────

class TestEstimateSpreadEdgeCases:

    def test_high_below_low(self):
        """High < low → negative spread (valid, indicates data error but we compute it)"""
        result = compute_estimate_spread_pct(2000, 1000)
        assert result == -50.0

    def test_very_small_values(self):
        """Small values handled without floating point issues"""
        result = compute_estimate_spread_pct(100.0, 120.0)
        assert result == 20.0

    def test_large_values(self):
        """Large values (millions) handled correctly"""
        result = compute_estimate_spread_pct(1_000_000, 1_200_000)
        assert result == 20.0


# ─────────────────────────────────────────────────────────────────────────────
# build_hammer_features — mock DB integration test
# ─────────────────────────────────────────────────────────────────────────────

class TestBuildHammerFeatures:

    def _make_session_for_record(self, record_row):
        """Return a mock session that serves a hammer price record + empty history."""
        def execute_side_effect(query_text, params=None):
            query_str = str(query_text)
            mock_result = MagicMock()

            # Main record fetch
            if "FROM hammer_prices" in query_str and "WHERE id = :id" in query_str:
                mock_result.fetchone.return_value = record_row
            # History queries — return empty result → None for historical features
            else:
                mock_result.fetchone.return_value = None

            return mock_result

        session = MagicMock()
        session.execute.side_effect = execute_side_effect
        return session

    def test_returns_none_for_missing_record(self):
        """Non-existent id → None"""
        session = MagicMock()
        mock_result = MagicMock()
        mock_result.fetchone.return_value = None
        session.execute.return_value = mock_result

        result = build_hammer_features("nonexistent-id", session)
        assert result is None

    def test_returns_none_for_missing_sale_date(self):
        """Record without sale_date → None (cannot build time-based features)"""
        # Simulate a row where sale_date is None (index 7)
        row = [
            "test-id-123",    # 0: id
            "Picasso",        # 1: artist_name
            "pablo picasso",  # 2: artist_name_normalized
            "Oil on canvas",  # 3: medium
            "painting",       # 4: medium_category
            "100 x 80 cm",    # 5: dimensions
            1935,             # 6: year_created
            None,             # 7: sale_date — missing!
            50000.0,          # 8: hammer_price_eur
            "Christie's",     # 9: auction_house
            40000.0,          # 10: estimate_low
            60000.0,          # 11: estimate_high
            "artmarketapi",   # 12: source
        ]
        session = self._make_session_for_record(row)
        result = build_hammer_features("test-id-123", session)
        assert result is None

    def test_full_feature_vector(self):
        """Valid record → returns complete feature dict with all expected keys."""
        row = [
            "test-id-456",
            "Pablo Picasso",
            "pablo picasso",
            "Oil on canvas",
            "painting",
            "81.3 × 116.8 cm",
            1935,
            datetime(2020, 6, 15),
            50000.0,
            "Christie's",
            40000.0,
            60000.0,
            "artmarketapi",
        ]

        def execute_side_effect(query_text, params=None):
            query_str = str(query_text)
            mock_result = MagicMock()
            if "WHERE id = :id" in query_str:
                mock_result.fetchone.return_value = row
            else:
                mock_result.fetchone.return_value = None
            return mock_result

        session = MagicMock()
        session.execute.side_effect = execute_side_effect

        result = build_hammer_features("test-id-456", session)

        assert result is not None
        # Check all expected keys are present
        expected_keys = {
            "hammer_price_id",
            "normalized_artist",
            "normalized_house",
            "medium_category",
            "size_bucket",
            "artwork_period",
            "sale_year",
            "sale_month",
            "sale_quarter",
            "estimate_midpoint_eur",
            "estimate_spread_pct",
            "artist_liquidity_at_sale",
            "artist_momentum_at_sale",
            "artist_house_premium_at_sale",
            "sold_above_low_estimate",
        }
        for key in expected_keys:
            assert key in result, f"Missing key: {key}"

        # Spot-check values
        assert result["normalized_artist"] == "pablo picasso"
        assert result["normalized_house"] == "christies"
        assert result["medium_category"] == "painting"
        assert result["artwork_period"] == "1900_1950"
        assert result["sale_year"] == 2020
        assert result["sale_month"] == 6
        assert result["sale_quarter"] == 2
        assert result["estimate_midpoint_eur"] == 50000.0
        assert result["estimate_spread_pct"] == 50.0  # (60000-40000)/40000*100
        assert result["sold_above_low_estimate"] is True  # 50000 > 40000
        assert result["size_bucket"] in ("small", "medium", "large", "very_large", "unknown")
