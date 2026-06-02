"""
Nautilus normalization utilities — Step 1/2 foundation.

Re-exports stable functions from quality_filter for a single import surface,
and adds auction_house normalization + extended dimension parsing + size bucketing.

Usage:
    from app.utils.normalize import (
        normalize_artist_name,
        normalize_medium_category,
        normalize_auction_house,
        parse_dimensions_cm,
        size_bucket,
    )

IMPORTANT:
  Do NOT modify app.jobs.quality_filter directly. This module wraps it safely.
  The re-exports below ensure callers can use either import path — both stay in sync.
"""

import re
from typing import Optional

# ── Re-export existing functions (DO NOT REIMPLEMENT) ─────────────────────────
# These are the canonical normalization functions used throughout the pipeline.
# We re-export rather than copy so there is exactly one implementation.

from app.jobs.quality_filter import (
    normalize_artist_name,
    normalize_medium_category,
    normalize_category,
    normalize_title,
    is_unknown_artist,
)

__all__ = [
    # Re-exported from quality_filter
    "normalize_artist_name",
    "normalize_medium_category",
    "normalize_category",
    "normalize_title",
    "is_unknown_artist",
    # New in this module
    "AUCTION_HOUSE_CANONICAL",
    "normalize_auction_house",
    "parse_dimensions_cm",
    "SIZE_BUCKETS",
    "size_bucket",
]


# ── Auction house normalization ────────────────────────────────────────────────

# Maps lowercase raw auction house names to their canonical identifiers.
# Canonical values match the AuctionHouse enum values in db_models.py where applicable.
# Add new variants here — never modify the canonical keys (they are stable join keys).
AUCTION_HOUSE_CANONICAL: dict[str, str] = {
    # Christie's variants
    "christie's":               "christies",
    "christies":                "christies",
    "christie's paris":         "christies",
    "christie's london":        "christies",
    "christie's new york":      "christies",
    "christies paris":          "christies",
    "christie's south kensington": "christies",
    "christie's amsterdam":     "christies",
    # Sotheby's variants
    "sotheby's":                "sothebys",
    "sothebys":                 "sothebys",
    "sotheby's paris":          "sothebys",
    "sotheby's london":         "sothebys",
    "sotheby's new york":       "sothebys",
    "sotheby's amsterdam":      "sothebys",
    "sotheby's hong kong":      "sothebys",
    # Phillips
    "phillips":                 "phillips",
    "phillips de pury":         "phillips",
    "phillips auction":         "phillips",
    "phillips london":          "phillips",
    "phillips new york":        "phillips",
    # Bonhams
    "bonhams":                  "bonhams",
    "bonham's":                 "bonhams",
    "bonhams & butterfields":   "bonhams",
    "bonhams london":           "bonhams",
    # Drouot
    "drouot":                   "drouot",
    "hôtel drouot":             "drouot",
    "hotel drouot":             "drouot",
    "drouot paris":             "drouot",
    "drouot montaigne":         "drouot",
    # Artcurial
    "artcurial":                "artcurial",
    "artcurial paris":          "artcurial",
    # Aguttes
    "aguttes":                  "aguttes",
    "aguttes neuilly":          "aguttes",
    # Millon
    "millon":                   "millon",
    "millon paris":             "millon",
    "millon & associes":        "millon",
    "millon & associés":        "millon",
    # Invaluable
    "invaluable":               "invaluable",
    # Interenchères
    "interencheres":            "interencheres",
    "interenchères":            "interencheres",
    "inter encheres":           "interencheres",
    # Auctionet (Swedish)
    "auctionet":                "auctionet",
    # Heritage Auctions
    "heritage auctions":        "heritage",
    "heritage":                 "heritage",
    # Dorotheum (Vienna)
    "dorotheum":                "dorotheum",
    # Ketterer Kunst
    "ketterer kunst":           "ketterer",
    "ketterer":                 "ketterer",
    # Bruun Rasmussen
    "bruun rasmussen":          "bruun_rasmussen",
    "bruun-rasmussen":          "bruun_rasmussen",
    # Stockholms Auktionsverk
    "stockholms auktionsverk":  "stockholms_auktionsverk",
    "stockholms auktionsverk ab": "stockholms_auktionsverk",
    # Bukowskis (Swedish)
    "bukowskis":                "bukowskis",
    # Cornette de Saint Cyr
    "cornette de saint cyr":    "cornette_de_saint_cyr",
    "cornette de saint-cyr":    "cornette_de_saint_cyr",
    # Tajan (Paris)
    "tajan":                    "tajan",
    # Piasa (Paris)
    "piasa":                    "piasa",
    # Osenat (Fontainebleau)
    "osenat":                   "osenat",
    # Artmarketapi / Art Market Research
    "artmarketapi":             "artmarketapi",
    "art market api":           "artmarketapi",
    "art market research":      "artmarketapi",
    # Catawiki
    "catawiki":                 "catawiki",
    # LiveAuctioneers (aggregator)
    "liveauctioneers":          "liveauctioneers",
    # Roseberys (London)
    "roseberys":                "roseberys",
    "roseberys london":         "roseberys",
    # Artsy
    "artsy":                    "artsy",
    # Digard (Paris)
    "digard":                   "digard",
    # Picard (France)
    "picard":                   "picard",
    # EVE (France)
    "eve":                      "eve",
    # Binoche et Giquello (Paris)
    "binoche et giquello":      "binoche_giquello",
    "binoche giquello":         "binoche_giquello",
    # Coutau-Bégarie (Paris)
    "coutau-begarie":           "coutau_begarie",
    "coutau begarie":           "coutau_begarie",
    # Gros & Delettrez (Paris)
    "gros & delettrez":         "gros_delettrez",
    "gros delettrez":           "gros_delettrez",
}


def normalize_auction_house(raw: str | None) -> str:
    """
    Normalize a raw auction house name to a canonical lowercase identifier.

    Steps:
      1. Return 'unknown' for None or empty input.
      2. Strip whitespace and lowercase.
      3. Direct lookup in AUCTION_HOUSE_CANONICAL.
      4. Partial/substring match (longest match wins).
      5. Return cleaned lowercase original if no match found.

    Returns:
        str: Canonical identifier (e.g. 'christies', 'sothebys') or cleaned
             lowercase input if unmapped. Never returns an empty string.

    Examples:
        >>> normalize_auction_house("Christie's Paris")
        'christies'
        >>> normalize_auction_house("SOTHEBY'S")
        'sothebys'
        >>> normalize_auction_house("Petite Maison de Ventes XYZ")
        'petite maison de ventes xyz'
        >>> normalize_auction_house(None)
        'unknown'
    """
    if not raw:
        return "unknown"

    cleaned = raw.strip().lower()
    if not cleaned:
        return "unknown"

    # 1. Direct lookup
    if cleaned in AUCTION_HOUSE_CANONICAL:
        return AUCTION_HOUSE_CANONICAL[cleaned]

    # 2. Partial/substring match — longest variant that appears in the string wins.
    #    This handles "Christie's South Kensington Impressionist Sale" → "christies".
    best: str | None = None
    best_len: int = 0
    for variant, canonical in AUCTION_HOUSE_CANONICAL.items():
        if variant in cleaned and len(variant) > best_len:
            best = canonical
            best_len = len(variant)

    return best if best is not None else cleaned


# ── Dimension parsing ──────────────────────────────────────────────────────────

def parse_dimensions_cm(dimensions_str: str | None) -> dict:
    """
    Extended dimension parser. Converts artwork dimension strings to centimetres.

    Handles the following formats (and combinations thereof):
      - "81.3 × 116.8 cm"              (Unicode multiplication sign)
      - "32 x 46 in."                  (inches)
      - "H: 120 cm, W: 80 cm"          (labeled H/W)
      - "120 x 80 x 5 cm"              (3D — returns the two largest dimensions)
      - "Ø 45 cm"  or  "D. 45 cm"      (circular / diameter)
      - "56,5 x 40,5 cm"               (comma as decimal, common in French catalogs)
      - Mixed Unicode: ✕, ✗ normalized to x

    Returns:
        dict with keys:
          - width_cm  (float | None)
          - height_cm (float | None)
          - area_cm2  (float | None)  — width × height

    Never raises an exception. Returns all-None on parse failure.

    NOTE: This extends (but does NOT replace) parse_dimensions() in backend/app/api/lots.py.
    That function remains unchanged and used by the API layer.
    """
    if not dimensions_str:
        return {"width_cm": None, "height_cm": None, "area_cm2": None}

    # Normalize decimal commas and Unicode multiplication signs
    s = (
        dimensions_str
        .replace(",", ".")
        .replace("×", "x")
        .replace("✕", "x")
        .replace("✗", "x")
    )

    unit_re = re.compile(r'(cm|in\.?)', re.IGNORECASE)

    # ── Pattern 1: H:/W: labeled format ──────────────────────────────────────
    # e.g. "H: 120 cm, W: 80 cm" or "H 120 W 80 cm"
    h_match = re.search(r'\b[Hh]\s*:?\s*(\d+\.?\d*)', s)
    w_match = re.search(r'\b[Ww]\s*:?\s*(\d+\.?\d*)', s)
    unit_match = unit_re.search(s)
    if h_match and w_match:
        h = float(h_match.group(1))
        w = float(w_match.group(1))
        if unit_match and unit_match.group(1).lower().startswith('in'):
            h, w = h * 2.54, w * 2.54
        area = round(w * h, 1)
        return {"width_cm": round(w, 1), "height_cm": round(h, 1), "area_cm2": area}

    # ── Pattern 2: W x H [x D] cm/in ─────────────────────────────────────────
    # e.g. "81.3 x 116.8 cm"  or  "120 x 80 x 5 cm" (depth discarded)
    multi = re.search(
        r'(\d+\.?\d*)\s*x\s*(\d+\.?\d*)(?:\s*x\s*\d+\.?\d*)?\s*(cm|in\.?)',
        s,
        re.IGNORECASE,
    )
    if multi:
        w = float(multi.group(1))
        h = float(multi.group(2))
        unit = multi.group(3).lower()
        if unit.startswith('in'):
            w, h = w * 2.54, h * 2.54
        area = round(w * h, 1)
        return {"width_cm": round(w, 1), "height_cm": round(h, 1), "area_cm2": area}

    # ── Pattern 3: Diameter / circular works ─────────────────────────────────
    # e.g. "Ø 45 cm"  "D. 45 cm"  "diam. 40 in"
    diam = re.search(
        r'(?:[ØÃ¸∅Dd](?:iam\.?)?\s*)\.?\s*(\d+\.?\d*)\s*(cm|in\.?)',
        s,
        re.IGNORECASE,
    )
    if diam:
        d = float(diam.group(1))
        if diam.group(2).lower().startswith('in'):
            d = d * 2.54
        # Treat diameter as both width and height; area = circle area
        area = round(3.14159265 * (d / 2) ** 2, 1)
        return {"width_cm": round(d, 1), "height_cm": round(d, 1), "area_cm2": area}

    # Unable to parse
    return {"width_cm": None, "height_cm": None, "area_cm2": None}


# ── Size bucketing ────────────────────────────────────────────────────────────

# Thresholds based on area in cm².
# Designed to reflect how auction catalogs and collectors describe artwork scale.
SIZE_BUCKETS: list[tuple[str, float, float]] = [
    ("small",       0.0,     900.0),    # < ~30×30 cm    (e.g. small works on paper)
    ("medium",      900.0,   5000.0),   # ~30×30–70×70   (most mid-career prints/drawings)
    ("large",       5000.0,  15000.0),  # ~70×70–120×125 (standard oil canvas)
    ("very_large",  15000.0, float("inf")),  # ≥ ~120×125 (large-format works)
]


def size_bucket(width_cm: Optional[float], height_cm: Optional[float]) -> str:
    """
    Return a human-readable size category based on artwork area.

    Categories (area thresholds in cm²):
      small       < 900      (< ~30×30 cm)
      medium      900–4999   (~30×30 to ~70×70 cm)
      large       5000–14999 (~70×70 to ~120×125 cm)
      very_large  ≥ 15000    (large-format works)
      unknown     dimensions not available

    Args:
        width_cm:  Width in centimetres (float or None).
        height_cm: Height in centimetres (float or None).

    Returns:
        One of: 'small', 'medium', 'large', 'very_large', 'unknown'.

    Examples:
        >>> size_bucket(20, 20)
        'small'
        >>> size_bucket(50, 50)
        'medium'
        >>> size_bucket(100, 80)
        'large'
        >>> size_bucket(200, 150)
        'very_large'
        >>> size_bucket(None, None)
        'unknown'
    """
    if width_cm is None or height_cm is None:
        return "unknown"
    area = width_cm * height_cm
    for bucket_name, low, high in SIZE_BUCKETS:
        if low <= area < high:
            return bucket_name
    # Fallback (should not be reached given float("inf") upper bound)
    return "very_large"
