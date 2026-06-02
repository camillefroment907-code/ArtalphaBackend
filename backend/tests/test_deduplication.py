"""
Tests for Nautilus duplicate detection logic.

Tests pure logic functions only — no DB connection required.

Covers:
  - normalize_title_for_dedup
  - compute_duplicate_confidence
  - _price_close helper

Run with:
    pytest backend/tests/test_deduplication.py -v
"""
import pytest

from app.scripts.detect_hammer_duplicates import (
    compute_duplicate_confidence,
    normalize_title_for_dedup,
    _price_close,
    _get_match_keys_detail,
)


# ─────────────────────────────────────────────────────────────────────────────
# normalize_title_for_dedup
# ─────────────────────────────────────────────────────────────────────────────

class TestNormalizeTitleForDedup:

    def test_basic_lowercase(self):
        assert normalize_title_for_dedup("Composition") == "composition"

    def test_strips_whitespace(self):
        assert normalize_title_for_dedup("  Sans titre  ") == "sans titre"

    def test_removes_accents(self):
        result = normalize_title_for_dedup("Composition N°5")
        assert "composition" in result
        # N° → n  (° is punctuation, removed)
        assert "5" in result

    def test_punctuation_removed(self):
        result = normalize_title_for_dedup("Composition No. 5")
        assert result == "composition no 5"

    def test_numbers_preserved(self):
        """Numbers must be kept — they differentiate 'Serie 1' from 'Serie 2'"""
        result = normalize_title_for_dedup("Composition No. 5")
        assert "5" in result

    def test_none_returns_empty(self):
        assert normalize_title_for_dedup(None) == ""

    def test_empty_string(self):
        assert normalize_title_for_dedup("") == ""

    def test_unicode_normalization(self):
        """French accents stripped"""
        result = normalize_title_for_dedup("Été")
        assert result == "ete"

    def test_collapses_multiple_spaces(self):
        result = normalize_title_for_dedup("sans   titre")
        assert result == "sans titre"

    def test_preserves_letters_and_digits(self):
        result = normalize_title_for_dedup("Series 42")
        assert result == "series 42"


# ─────────────────────────────────────────────────────────────────────────────
# _price_close
# ─────────────────────────────────────────────────────────────────────────────

class TestPriceClose:

    def test_identical_prices(self):
        assert _price_close(5000, 5000) is True

    def test_within_5_pct(self):
        """5100 vs 5000 = 2% difference → True"""
        assert _price_close(5000, 5100) is True

    def test_exactly_5_pct(self):
        """Exactly 5% difference: 5000 → 5250"""
        assert _price_close(5000, 5250) is True

    def test_just_over_5_pct(self):
        """5.1% difference → False (tolerance is exactly 5%)"""
        # 5000 * 1.053 = 5265 → ratio=0.9497 → diff=5.03% → False
        assert _price_close(5000, 5300) is False

    def test_none_a(self):
        assert _price_close(None, 5000) is False

    def test_none_b(self):
        assert _price_close(5000, None) is False

    def test_both_none(self):
        assert _price_close(None, None) is False

    def test_both_zero(self):
        assert _price_close(0, 0) is True

    def test_one_zero(self):
        """One price is 0, other is not → False"""
        assert _price_close(0, 5000) is False

    def test_custom_tolerance(self):
        """Custom tolerance of 10%"""
        assert _price_close(5000, 5400, tolerance_pct=10.0) is True
        assert _price_close(5000, 5600, tolerance_pct=10.0) is False


# ─────────────────────────────────────────────────────────────────────────────
# compute_duplicate_confidence
# ─────────────────────────────────────────────────────────────────────────────

class TestComputeDuplicateConfidence:

    def _record(self, **overrides) -> dict:
        """Base record factory."""
        base = {
            "id":           "id-001",
            "artist":       "pablo picasso",
            "title":        "composition",
            "sale_day":     "2020-01-01",
            "price":        5000.0,
            "house":        "christies",
            "estimate_low": 4000.0,
            "source":       "artmarketapi",
        }
        base.update(overrides)
        return base

    def test_exact_same_record_different_source(self):
        """Same record from different source → EXACT"""
        r1 = self._record()
        r2 = self._record(id="id-002", source="invaluable")
        assert compute_duplicate_confidence(r1, r2) == "EXACT"

    def test_different_house_same_price_same_estimate(self):
        """Different house but price + estimate match + different source → HIGH"""
        r1 = self._record()
        r2 = self._record(id="id-002", house="sothebys", source="invaluable")
        # price=match, house=no match, estimate=match, diff_source=match → 3/4 → HIGH
        result = compute_duplicate_confidence(r1, r2)
        assert result == "HIGH"

    def test_different_price_within_5pct(self):
        """Price differs by ~4% → still counts as match"""
        r1 = self._record()
        r2 = self._record(id="id-002", price=5200.0, source="invaluable")
        # price ≈ match (5000 vs 5200 = 4%), house = match, estimate = match, diff source = match
        result = compute_duplicate_confidence(r1, r2)
        assert result in ("EXACT", "HIGH")

    def test_same_source_no_extra_credit(self):
        """Same source records don't get credit for 'different_source' key"""
        r1 = self._record()
        r2 = self._record(id="id-002")  # same source "artmarketapi"
        # price=match, house=match, estimate=match, diff_source=NO → 3/4 → HIGH
        result = compute_duplicate_confidence(r1, r2)
        assert result == "HIGH"

    def test_none_prices_dont_match(self):
        """None prices → no price match"""
        r1 = self._record(price=None, estimate_low=None)
        r2 = self._record(id="id-002", price=None, estimate_low=None, source="invaluable")
        # price=no, house=match, estimate=no, diff_source=match → 2/4 → MEDIUM
        result = compute_duplicate_confidence(r1, r2)
        assert result == "MEDIUM"

    def test_completely_different_records(self):
        """Different price, house, and same source → MEDIUM"""
        r1 = self._record()
        r2 = self._record(id="id-002", price=99999.0, house="dorotheum", estimate_low=80000.0)
        # price=no, house=no, estimate=no, diff_source=no → 0/4 → MEDIUM
        # (MEDIUM is the minimum we return; caller filters if needed)
        result = compute_duplicate_confidence(r1, r2)
        assert result == "MEDIUM"

    def test_returns_valid_confidence_level(self):
        """Result is always one of the three valid levels"""
        r1 = self._record()
        r2 = self._record(id="id-002", source="invaluable")
        result = compute_duplicate_confidence(r1, r2)
        assert result in ("EXACT", "HIGH", "MEDIUM")


# ─────────────────────────────────────────────────────────────────────────────
# _get_match_keys_detail
# ─────────────────────────────────────────────────────────────────────────────

class TestGetMatchKeysDetail:

    def _record(self, **overrides) -> dict:
        base = {
            "id":           "id-001",
            "price":        5000.0,
            "house":        "christies",
            "estimate_low": 4000.0,
            "source":       "artmarketapi",
        }
        base.update(overrides)
        return base

    def test_all_match(self):
        r1 = self._record()
        r2 = self._record(id="id-002", source="invaluable")
        detail = _get_match_keys_detail(r1, r2)
        assert detail["price_match"] is True
        assert detail["house_match"] is True
        assert detail["estimate_match"] is True
        assert detail["different_source"] is True

    def test_price_mismatch(self):
        r1 = self._record()
        r2 = self._record(id="id-002", price=9999.0, source="invaluable")
        detail = _get_match_keys_detail(r1, r2)
        assert detail["price_match"] is False

    def test_source_ids_in_detail(self):
        r1 = self._record()
        r2 = self._record(id="id-002", source="invaluable")
        detail = _get_match_keys_detail(r1, r2)
        assert detail["source_a"] == "artmarketapi"
        assert detail["source_b"] == "invaluable"


# ─────────────────────────────────────────────────────────────────────────────
# Edge cases for dedup title normalization
# ─────────────────────────────────────────────────────────────────────────────

class TestNormalizeTitleEdgeCases:

    def test_french_title(self):
        """Typical French auction title"""
        result = normalize_title_for_dedup("Sans titre (Composition bleue)")
        assert "sans titre" in result
        assert "composition bleue" in result

    def test_all_caps(self):
        result = normalize_title_for_dedup("COMPOSITION")
        assert result == "composition"

    def test_mixed_languages(self):
        result = normalize_title_for_dedup("Composition über Rot und Blau")
        assert "composition" in result
        assert "rot" in result
        assert "blau" in result

    def test_catalog_number_stripped(self):
        """Catalog-style titles with # or N° stripped of punctuation"""
        result = normalize_title_for_dedup("Composition N° 12")
        assert "12" in result
        assert "composition" in result

    def test_same_title_different_formatting_matches(self):
        """Two versions of the same title should normalize to the same string"""
        t1 = normalize_title_for_dedup("Composition No. 5")
        t2 = normalize_title_for_dedup("composition no 5")
        assert t1 == t2
