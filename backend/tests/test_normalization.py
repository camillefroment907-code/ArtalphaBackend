"""
Tests for Nautilus normalization utilities.

Covers:
  - normalize_artist_name (from quality_filter, re-exported via normalize.py)
  - normalize_auction_house (new in normalize.py)
  - normalize_medium_category (from quality_filter, re-exported)
  - parse_dimensions_cm (new in normalize.py)
  - size_bucket (new in normalize.py)
  - is_unknown_artist (from quality_filter, re-exported)

Run with:
    pytest backend/tests/test_normalization.py -v
"""
import pytest


# ── Import from the new single-surface module ─────────────────────────────────

from app.utils.normalize import (
    normalize_artist_name,
    normalize_medium_category,
    normalize_auction_house,
    parse_dimensions_cm,
    size_bucket,
    is_unknown_artist,
    AUCTION_HOUSE_CANONICAL,
    SIZE_BUCKETS,
)


# ─────────────────────────────────────────────────────────────────────────────
# normalize_artist_name
# ─────────────────────────────────────────────────────────────────────────────

class TestNormalizeArtistName:

    def test_comma_format(self):
        """PICASSO, Pablo → pablo picasso"""
        assert normalize_artist_name("PICASSO, Pablo (1881-1973)") == "pablo picasso"

    def test_catalog_format_nara(self):
        """NARA Yoshitomo (first token all-caps, rest not) → reordered"""
        assert normalize_artist_name("NARA Yoshitomo") == "yoshitomo nara"

    def test_simple_mixed_case(self):
        """Andy Warhol → andy warhol"""
        assert normalize_artist_name("Andy Warhol") == "andy warhol"

    def test_all_caps_no_reorder(self):
        """ANDY WARHOL — all tokens uppercase → no reorder"""
        assert normalize_artist_name("ANDY WARHOL") == "andy warhol"

    def test_van_gogh_no_reorder(self):
        """VAN GOGH Vincent — first two tokens uppercase → no reorder"""
        assert normalize_artist_name("VAN GOGH Vincent") == "van gogh vincent"

    def test_picasso_catalog_format(self):
        """PICASSO Pablo → pablo picasso"""
        assert normalize_artist_name("PICASSO Pablo") == "pablo picasso"

    def test_empty_string(self):
        """Empty string → empty string"""
        assert normalize_artist_name("") == ""

    def test_none_returns_empty(self):
        """None → empty string (type: ignore because signature is str)"""
        assert normalize_artist_name(None) == ""  # type: ignore[arg-type]

    def test_strips_parenthetical_dates(self):
        """Parenthetical dates are removed"""
        result = normalize_artist_name("Bernard Buffet (1928-1999)")
        assert result == "bernard buffet"

    def test_removes_accents(self):
        """Accents are stripped"""
        result = normalize_artist_name("André Brasilier")
        assert "andre" in result
        assert "brasilier" in result

    def test_extra_whitespace(self):
        """Multiple spaces collapsed"""
        assert normalize_artist_name("Pablo   Picasso") == "pablo picasso"

    def test_punctuation_removed(self):
        """Non-word punctuation stripped"""
        result = normalize_artist_name("O'Keeffe, Georgia")
        assert "georgia" in result
        assert "keeffe" in result


# ─────────────────────────────────────────────────────────────────────────────
# normalize_auction_house
# ─────────────────────────────────────────────────────────────────────────────

class TestNormalizeAuctionHouse:

    def test_christies_with_apostrophe_and_city(self):
        """Christie's Paris → christies"""
        assert normalize_auction_house("Christie's Paris") == "christies"

    def test_sothebys_uppercase(self):
        """SOTHEBY'S (all-caps with apostrophe) → sothebys"""
        assert normalize_auction_house("SOTHEBY'S") == "sothebys"

    def test_sothebys_lowercase(self):
        assert normalize_auction_house("sotheby's") == "sothebys"

    def test_christies_no_apostrophe(self):
        assert normalize_auction_house("Christies") == "christies"

    def test_phillips(self):
        assert normalize_auction_house("Phillips de Pury") == "phillips"

    def test_drouot_with_accent(self):
        """Hôtel Drouot → drouot"""
        assert normalize_auction_house("Hôtel Drouot") == "drouot"

    def test_hotel_drouot_no_accent(self):
        assert normalize_auction_house("Hotel Drouot") == "drouot"

    def test_artcurial(self):
        assert normalize_auction_house("Artcurial") == "artcurial"

    def test_unmapped_passthrough(self):
        """Unmapped value is passed through as cleaned lowercase"""
        result = normalize_auction_house("Unknown House XYZ")
        assert result == "unknown house xyz"

    def test_none_returns_unknown(self):
        assert normalize_auction_house(None) == "unknown"

    def test_empty_string_returns_unknown(self):
        assert normalize_auction_house("") == "unknown"

    def test_whitespace_only_returns_unknown(self):
        assert normalize_auction_house("   ") == "unknown"

    def test_bonhams(self):
        assert normalize_auction_house("Bonhams") == "bonhams"

    def test_bonhams_with_apostrophe(self):
        assert normalize_auction_house("Bonham's") == "bonhams"

    def test_heritage_auctions(self):
        assert normalize_auction_house("Heritage Auctions") == "heritage"

    def test_interencheres_with_accent(self):
        assert normalize_auction_house("Interenchères") == "interencheres"

    def test_partial_match(self):
        """A longer string containing a known variant should match via substring"""
        result = normalize_auction_house("Sotheby's New York — Important Sale")
        assert result == "sothebys"

    def test_canonical_dict_completeness(self):
        """AUCTION_HOUSE_CANONICAL must be a non-empty dict"""
        assert isinstance(AUCTION_HOUSE_CANONICAL, dict)
        assert len(AUCTION_HOUSE_CANONICAL) > 10

    def test_canonical_values_lowercase_no_spaces_at_ends(self):
        """All canonical values must be lowercase and stripped"""
        for raw, canonical in AUCTION_HOUSE_CANONICAL.items():
            assert canonical == canonical.lower(), f"Canonical value {canonical!r} not lowercase"
            assert canonical == canonical.strip(), f"Canonical value {canonical!r} has whitespace"
            assert canonical, f"Canonical value for {raw!r} is empty"


# ─────────────────────────────────────────────────────────────────────────────
# normalize_medium_category
# ─────────────────────────────────────────────────────────────────────────────

class TestNormalizeMediumCategory:

    def test_oil_on_canvas(self):
        assert normalize_medium_category("Oil on canvas") == "painting"

    def test_lithographie_french(self):
        assert normalize_medium_category("Lithographie") == "print"

    def test_bronze(self):
        assert normalize_medium_category("Bronze") == "sculpture"

    def test_none_returns_other(self):
        assert normalize_medium_category(None) == "other"

    def test_empty_string_returns_other(self):
        assert normalize_medium_category("") == "other"

    def test_photography(self):
        result = normalize_medium_category("C-print, mounted on aluminum")
        assert result == "photography"

    def test_watercolor(self):
        result = normalize_medium_category("Watercolor on paper")
        assert result == "painting"

    def test_pencil_drawing(self):
        result = normalize_medium_category("Pencil on paper")
        assert result == "drawing"

    def test_screenprint(self):
        result = normalize_medium_category("Screenprint in colors")
        assert result == "print"

    def test_unknown_medium_returns_other(self):
        result = normalize_medium_category("Needlepoint tapestry")
        assert result == "other"


# ─────────────────────────────────────────────────────────────────────────────
# parse_dimensions_cm
# ─────────────────────────────────────────────────────────────────────────────

class TestParseDimensionsCm:

    def test_unicode_multiply_cm(self):
        """'81.3 × 116.8 cm' with Unicode × sign"""
        dims = parse_dimensions_cm("81.3 × 116.8 cm")
        assert dims["width_cm"] == 81.3
        assert dims["height_cm"] == 116.8
        assert dims["area_cm2"] is not None
        assert abs(dims["area_cm2"] - 81.3 * 116.8) < 1.0

    def test_inches_conversion(self):
        """'32 x 46 in.' → cm (32*2.54 ≈ 81.28, 46*2.54 ≈ 116.84)"""
        dims = parse_dimensions_cm("32 x 46 in.")
        assert dims["width_cm"] is not None
        assert dims["height_cm"] is not None
        assert abs(dims["width_cm"] - 81.28) < 0.5
        assert abs(dims["height_cm"] - 116.84) < 0.5

    def test_comma_decimal_french(self):
        """'56,5 x 40,5 cm' — French catalog format"""
        dims = parse_dimensions_cm("56,5 x 40,5 cm")
        assert dims["width_cm"] == 56.5
        assert dims["height_cm"] == 40.5

    def test_none_input(self):
        """None → all None"""
        dims = parse_dimensions_cm(None)
        assert dims["width_cm"] is None
        assert dims["height_cm"] is None
        assert dims["area_cm2"] is None

    def test_empty_string(self):
        """Empty string → all None"""
        dims = parse_dimensions_cm("")
        assert dims["width_cm"] is None
        assert dims["height_cm"] is None

    def test_3d_dimensions(self):
        """'120 x 80 x 5 cm' — depth is discarded"""
        dims = parse_dimensions_cm("120 x 80 x 5 cm")
        assert dims["width_cm"] == 120.0
        assert dims["height_cm"] == 80.0

    def test_h_w_format(self):
        """'H: 120 cm, W: 80 cm' — labeled format"""
        dims = parse_dimensions_cm("H: 120 cm, W: 80 cm")
        assert dims["height_cm"] == 120.0
        assert dims["width_cm"] == 80.0

    def test_area_computed(self):
        """Area should be width * height"""
        dims = parse_dimensions_cm("100 x 50 cm")
        assert dims["area_cm2"] == 5000.0

    def test_unparseable_returns_none(self):
        """Nonsense string → all None, no exception"""
        dims = parse_dimensions_cm("approx. large")
        assert dims["width_cm"] is None
        assert dims["height_cm"] is None
        assert dims["area_cm2"] is None

    def test_integer_dimensions(self):
        """Integer dimensions (no decimal point)"""
        dims = parse_dimensions_cm("100 x 80 cm")
        assert dims["width_cm"] == 100.0
        assert dims["height_cm"] == 80.0

    def test_returns_dict_keys(self):
        """Return dict always has the three expected keys"""
        dims = parse_dimensions_cm("50 x 40 cm")
        assert "width_cm" in dims
        assert "height_cm" in dims
        assert "area_cm2" in dims


# ─────────────────────────────────────────────────────────────────────────────
# size_bucket
# ─────────────────────────────────────────────────────────────────────────────

class TestSizeBucket:

    def test_small(self):
        """20×20 = 400 cm² → small (< 900)"""
        assert size_bucket(20, 20) == "small"

    def test_medium(self):
        """50×50 = 2500 cm² → medium (900–4999)"""
        assert size_bucket(50, 50) == "medium"

    def test_large(self):
        """100×80 = 8000 cm² → large (5000–14999)"""
        assert size_bucket(100, 80) == "large"

    def test_very_large(self):
        """200×150 = 30000 cm² → very_large (≥15000)"""
        assert size_bucket(200, 150) == "very_large"

    def test_none_none(self):
        assert size_bucket(None, None) == "unknown"

    def test_width_none(self):
        assert size_bucket(50, None) == "unknown"

    def test_height_none(self):
        assert size_bucket(None, 50) == "unknown"

    def test_boundary_900(self):
        """Exactly 900 cm² → medium (not small)"""
        # 30 × 30 = 900
        assert size_bucket(30, 30) == "medium"

    def test_boundary_5000(self):
        """Exactly 5000 cm² → large (not medium)"""
        # e.g. ~70.7 × 70.7 ≈ 5000
        # Use exact: 100 × 50 = 5000
        assert size_bucket(100, 50) == "large"

    def test_boundary_15000(self):
        """Exactly 15000 cm² → very_large"""
        # 150 × 100 = 15000
        assert size_bucket(150, 100) == "very_large"

    def test_size_buckets_constant(self):
        """SIZE_BUCKETS constant should cover 0 to infinity without gaps"""
        assert isinstance(SIZE_BUCKETS, list)
        assert len(SIZE_BUCKETS) > 0
        # First bucket starts at 0
        assert SIZE_BUCKETS[0][1] == 0.0
        # Last bucket ends at infinity
        import math
        assert math.isinf(SIZE_BUCKETS[-1][2])

    def test_zero_dimensions(self):
        """0×0 = 0 cm² → small (area < 900)"""
        assert size_bucket(0.0, 0.0) == "small"


# ─────────────────────────────────────────────────────────────────────────────
# is_unknown_artist
# ─────────────────────────────────────────────────────────────────────────────

class TestIsUnknownArtist:

    def test_unknown_english(self):
        assert is_unknown_artist("Unknown") is True

    def test_anonymous_french(self):
        assert is_unknown_artist("Anonyme") is True

    def test_okand_swedish(self):
        """OKÄND KONSTNÄR (Swedish) → True"""
        assert is_unknown_artist("OKÄND KONSTNÄR") is True

    def test_known_artist(self):
        assert is_unknown_artist("Pablo Picasso") is False

    def test_andy_warhol(self):
        assert is_unknown_artist("Andy Warhol") is False

    def test_empty_string(self):
        """Empty string → unknown"""
        assert is_unknown_artist("") is True

    def test_none(self):
        """None → unknown"""
        assert is_unknown_artist(None) is True  # type: ignore[arg-type]

    def test_anonymous_english(self):
        assert is_unknown_artist("Anonymous") is True

    def test_artiste_inconnu_french(self):
        assert is_unknown_artist("Artiste inconnu") is True

    def test_unbekannt_german(self):
        assert is_unknown_artist("Unbekannt") is True

    def test_partial_match_with_qualifier(self):
        """'unknown artist (19th century)' should still be detected"""
        assert is_unknown_artist("Unknown artist (19th century)") is True
