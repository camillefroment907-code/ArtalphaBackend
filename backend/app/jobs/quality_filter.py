"""
ArtAlpha Quality Filter
Runs before DB insert — eliminates noise, normalizes data, deduplicates cross-source.
"""
import re
import unicodedata
from typing import List
from app.models.schemas import LotNormalized

# ── Category whitelist ───────────────────────────────────────────────────────
# If a category is present, it must contain at least one of these to pass.
# Lots with no category fall back to title/medium heuristics.

CATEGORY_WHITELIST = {
    "painting", "paintings", "peinture", "tableau",
    "huile sur toile", "oil on canvas", "oil on board", "oil on panel",
    "acrylic on canvas", "acrylic on board", "acrylic",
    "watercolor", "watercolour", "aquarelle", "gouache",
    "tempera", "pastel", "fresco",
    "drawing", "drawings", "dessin", "sketch",
    "pencil", "charcoal", "crayon", "ink", "encre",
    "sculpture", "bronze", "marble", "resin", "terracotta",
    "photography", "photograph", "photographie", "photo",
    "print", "lithograph", "etching", "screenprint", "woodcut",
    "serigraph", "lithographie", "gravure", "estampe",
    "mixed media", "media mixtes", "technique mixte",
    "street art", "urban art", "graffiti",
    "contemporary art", "modern art", "fine art",
    "installation", "video", "digital art",
    "collage", "assemblage",
}

# Art indicators used when no category is present
_ART_INDICATORS = [
    "painting", "peinture", "oil", "huile", "acrylic", "acrylique",
    "watercolor", "aquarelle", "drawing", "dessin", "sculpture",
    "photography", "photographie", "print", "lithograph", "gravure",
    "mixed media", "canvas", "toile", "paper", "pastel",
    "street art", "urban art", "contemporary",
]

# Generic/empty categories that don't disqualify a lot
_GENERIC_CATS = {"other", "divers", "miscellaneous", "various", "unknown"}

AUCTION_HOUSE_BLACKLIST = {
    "adam's",
    "adams",
    "adam's fine art",
}

# Title keyword blacklist — exact substring matches (lowercase)
TITLE_BLACKLIST_KEYWORDS = [
    "diamond ring", "cocktail ring", "pearl ring", "sapphire ring",
    "ruby ring", "emerald ring", "diamond pendant", "diamond necklace",
    "diamond brooch", "cultured pearl", "diamond earring", "gold ring",
    "silver ring", "engagement ring", "wedding ring", "signet ring",
    "dress ring", "cluster ring", "solitaire ring", "band ring",
    "diamond bracelet", "tennis bracelet", "charm bracelet",
    "pocket watch", "wristwatch", "rolex", "cartier watch",
    "gold coin", "silver coin", "postage stamp", "first day cover",
    "medal for", "médaille", "monnaie", "numismatic",
    "prix sur demande", "price on request", "price upon request",
    "furniture", "meuble", "armoire", "commode", "table basse",
]


def normalize_artist_name(name: str) -> str:
    """Lowercase, remove accents, strip punctuation, collapse spaces."""
    if not name:
        return ""
    name = unicodedata.normalize("NFD", name)
    name = "".join(c for c in name if unicodedata.category(c) != "Mn")
    name = re.sub(r"[^\w\s]", " ", name)
    name = re.sub(r"\s+", " ", name).strip().lower()
    # Normalize "lastname, firstname" → "firstname lastname"
    if "," in name:
        parts = [p.strip() for p in name.split(",", 1)]
        if len(parts) == 2:
            name = f"{parts[1]} {parts[0]}"
    return name


def normalize_title(title: str) -> str:
    """Lowercase, strip lot numbers, dimensions, punctuation."""
    if not title:
        return ""
    title = title.lower()
    # Remove lot numbers: "lot 123", "n°45", "#12"
    title = re.sub(r"\b(lot\s*\d+|n[°o]?\s*\d+|#\d+)\b", "", title)
    # Remove dimensions: "100x80cm", "50 x 70 cm"
    title = re.sub(r"\d+\s*[xX×]\s*\d+\s*(cm|mm|m)?", "", title)
    # Remove special chars, collapse spaces
    title = re.sub(r"[^\w\s]", " ", title)
    title = re.sub(r"\s+", " ", title).strip()
    return title


def _is_blacklisted(lot: LotNormalized) -> bool:
    """Return True if lot should be rejected based on house or title keywords."""
    auction_house = (lot.auction_house_name or "").lower()
    for blocked_house in AUCTION_HOUSE_BLACKLIST:
        if blocked_house in auction_house:
            return True

    title_lower = (lot.title or "").lower()
    for keyword in TITLE_BLACKLIST_KEYWORDS:
        if keyword in title_lower:
            return True

    return False


def _passes_category_whitelist(lot: LotNormalized) -> bool:
    """
    Returns True if the lot belongs to a fine art category.
    If no category is provided, falls back to title+medium heuristic.
    """
    category = (lot.category or "").lower().strip()
    medium = (lot.medium or "").lower().strip()
    title = (lot.title or "").lower().strip()

    if category and category not in _GENERIC_CATS:
        return any(w in category for w in CATEGORY_WHITELIST)

    # No category (or generic) → require at least one art indicator in title+medium
    combined = f"{title} {medium}"
    return any(ind in combined for ind in _ART_INDICATORS)


def _has_minimum_data(lot: LotNormalized) -> bool:
    """Reject lots where ALL of current_price, estimate_low, estimate_high are None or 0."""
    price = lot.current_price or 0
    est_low = lot.estimate_low or 0
    est_high = lot.estimate_high or 0
    return not (price == 0 and est_low == 0 and est_high == 0)


PRICE_ON_REQUEST_KEYWORDS = [
    "prix sur demande",
    "price on request",
    "price upon request",
    "sur demande",
    "on request",
    "contact for price",
    "contact gallery",
    "inquire",
    "ask for price",
    "p.o.r",
    "estimate on request",
    "estimation sur demande",
]


def _is_price_on_request(lot: LotNormalized) -> bool:
    """Reject lots where price is 'on request' rather than a real number."""
    for field in [lot.title, lot.category, getattr(lot, "description", None)]:
        if not field:
            continue
        field_lower = field.lower()
        for keyword in PRICE_ON_REQUEST_KEYWORDS:
            if keyword in field_lower:
                return True

    raw = lot.raw_data or {}
    for field in ["priceOnRequest", "price_on_request", "isPriceOnRequest", "priceHidden"]:
        if raw.get(field) is True:
            return True

    price_str = str(raw.get("price", "") or raw.get("currentPrice", "") or "").lower().strip()
    if price_str and not any(c.isdigit() for c in price_str):
        return True

    return False


def _compute_similarity(a: LotNormalized, b: LotNormalized) -> float:
    """
    Cross-source similarity score 0.0–1.0.
    Used to detect same lot listed on multiple platforms.
    """
    score = 0.0

    # Same source → handled by external_id dedup, skip
    if a.source == b.source:
        return 0.0

    # Artist name match (normalized)
    a_artist = normalize_artist_name(a.artist_name_raw or "")
    b_artist = normalize_artist_name(b.artist_name_raw or "")
    if a_artist and b_artist:
        if a_artist == b_artist:
            score += 0.35
        elif a_artist in b_artist or b_artist in a_artist:
            score += 0.20

    # Title match (normalized)
    a_title = normalize_title(a.title or "")
    b_title = normalize_title(b.title or "")
    if a_title and b_title and len(a_title) > 5 and len(b_title) > 5:
        if a_title == b_title:
            score += 0.35
        elif a_title[:20] == b_title[:20]:
            score += 0.20

    # Price proximity ±20%
    a_price = a.current_price or a.estimate_low or 0
    b_price = b.current_price or b.estimate_low or 0
    if a_price > 0 and b_price > 0:
        ratio = min(a_price, b_price) / max(a_price, b_price)
        if ratio >= 0.80:
            score += 0.20

    # Auction date proximity ±7 days
    if a.auction_date and b.auction_date:
        delta = abs((a.auction_date - b.auction_date).days)
        if delta <= 7:
            score += 0.10

    return score


# Source priority for dedup winner selection (higher = preferred)
SOURCE_PRIORITY = {
    "christies": 10,
    "sothebys": 9,
    "bonhams": 8,
    "phillips": 8,
    "drouot": 7,
    "artcurial": 7,
    "invaluable": 6,
    "interencheres": 5,
    "liveauctioneers": 4,
    "artsy": 3,
    "artsper": 3,
    "catawiki": 2,
    "other": 1,
}

SIMILARITY_THRESHOLD = 0.75


def _intra_source_deduplicate(lots: List[LotNormalized]) -> tuple[List[LotNormalized], int]:
    """
    Within each source, remove lots with identical normalized title + artist.
    Keeps the first occurrence (which has the most complete data from scraper ordering).
    Returns (deduped_lots, dupe_count).
    """
    seen: dict = {}  # (source, normalized_title, normalized_artist) → index
    kept = []
    dupes = 0
    for lot in lots:
        source_key = str(lot.source.value if hasattr(lot.source, 'value') else lot.source)
        title_key = normalize_title(lot.title or "")[:30]  # first 30 chars sufficient
        artist_key = normalize_artist_name(lot.artist_name_raw or "")
        key = (source_key, title_key, artist_key)
        if title_key and key in seen:
            dupes += 1
            continue
        if title_key:
            seen[key] = True
        kept.append(lot)
    return kept, dupes


def filter_and_deduplicate(lots: List[LotNormalized]) -> tuple[List[LotNormalized], dict]:
    """
    Main entry point. Returns (clean_lots, stats).

    Steps:
    1. Reject blacklisted lots
    2. Reject lots with no price data
    3. Cross-source dedup (same lot on multiple platforms)

    stats = {
        "input": int,
        "blacklisted": int,
        "no_price": int,
        "cross_source_dupes": int,
        "output": int,
    }
    """
    stats = {"input": len(lots), "blacklisted": 0, "no_price": 0, "price_on_request": 0, "category_rejected": 0, "intra_source_dupes": 0, "cross_source_dupes": 0, "output": 0}

    # Step 1–4: basic quality filters
    qualified = []
    for lot in lots:
        if _is_blacklisted(lot):
            stats["blacklisted"] += 1
            continue
        if not _has_minimum_data(lot):
            stats["no_price"] += 1
            continue
        if _is_price_on_request(lot):
            stats["price_on_request"] += 1
            continue
        if not _passes_category_whitelist(lot):
            stats["category_rejected"] += 1
            continue
        qualified.append(lot)

    # Pass 1: intra-source dedup by title+artist
    qualified, intra_dupes = _intra_source_deduplicate(qualified)
    stats["intra_source_dupes"] = intra_dupes

    # Pass 2: cross-source dedup
    kept: List[LotNormalized] = []
    rejected_indices: set = set()

    for i, lot_a in enumerate(qualified):
        if i in rejected_indices:
            continue
        for j, lot_b in enumerate(qualified):
            if j <= i or j in rejected_indices:
                continue
            if _compute_similarity(lot_a, lot_b) >= SIMILARITY_THRESHOLD:
                # Keep the one from higher-priority source
                priority_a = SOURCE_PRIORITY.get(str(lot_a.source.value if hasattr(lot_a.source, 'value') else lot_a.source).lower(), 1)
                priority_b = SOURCE_PRIORITY.get(str(lot_b.source.value if hasattr(lot_b.source, 'value') else lot_b.source).lower(), 1)
                if priority_a >= priority_b:
                    rejected_indices.add(j)
                else:
                    rejected_indices.add(i)
                stats["cross_source_dupes"] += 1

    kept = [lot for i, lot in enumerate(qualified) if i not in rejected_indices]
    stats["output"] = len(kept)
    return kept, stats
