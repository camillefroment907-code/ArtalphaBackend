"""
URL validator and fixer for auction lot URLs.
Call fix_url() before saving any lot to the DB.

Wraps auction_urls.py (which has verified working URL patterns) and adds:
- Domain-match validation (URL must belong to declared source)
- Non-art content filter (rejects vehicules, cuisine, etc.)
- Relative-URL repair
- Search-URL fallback via auction_urls.build_url()
"""
import re
from typing import Optional
from urllib.parse import urlparse

from app.utils.auction_urls import build_url

# source value (lowercase) → expected domain fragment
SOURCE_DOMAINS: dict[str, str] = {
    "drouot":          "drouot.com",
    "interencheres":   "interencheres.com",
    "invaluable":      "invaluable.com",
    "liveauctioneers": "liveauctioneers.com",
    "artsy":           "artsy.net",
    "sothebys":        "sothebys.com",
    "christies":       "christies.com",
    "bonhams":         "bonhams.com",
    "ebay":            "ebay.",
    "catawiki":        "catawiki.com",
    "artnet":          "artnet.com",
    "mutualart":       "mutualart.com",
    "phillips":        "phillips.com",
    "artcurial":       "artcurial.com",
    "artsper":         "artsper.com",
    "saatchi_art":     "saatchiart.com",
    "singulart":       "singulart.com",
}

# Substrings that signal the lot belongs to a non-art category.
# Interenchères in particular leaks vehicule/cuisine/hardware lots.
NON_ART_PATTERNS: list[str] = [
    "vehicule", "voiture", "moto", "motorcycles",
    "electromenager", "cuisine", "ixina", "hardware",
    "informatique", "high-tech", "telephonie",
    "immobilier", "foncier",
]


def _is_non_art(url: str) -> bool:
    low = url.lower()
    return any(pat in low for pat in NON_ART_PATTERNS)


def validate_url(url: Optional[str], source: str) -> bool:
    """
    Return True only if:
    - URL is present and starts with http(s)
    - netloc is non-empty
    - URL belongs to the expected domain for this source
    - URL does not contain non-art category markers
    """
    if not url:
        return False
    try:
        parsed = urlparse(url)
    except Exception:
        return False

    if parsed.scheme not in ("http", "https"):
        return False
    if not parsed.netloc:
        return False
    if _is_non_art(url):
        return False

    expected = SOURCE_DOMAINS.get(source.lower(), "")
    if expected and expected not in parsed.netloc:
        return False

    # Invaluable: require a direct lot or auction path (not just the homepage/search)
    if source.lower() == "invaluable":
        path = parsed.path.lower()
        if not any(seg in path for seg in ["/lot/", "/auction-lot/", "/auction/"]):
            return False

    return True


def _clean_search_term(source: str, title: str, artist: str) -> str:
    """
    Return the cleanest possible search string for the fallback URL.

    Interenchères lots often have messy titles that duplicate the artist name
    and embed technique codes, e.g.:
        "Pierre BRUNE Pierre BRUNE (1887-1956) - HST signé ..."
    For Interenchères we therefore use only the artist name.
    For other sources we combine artist + cleaned title.
    """
    artist = (artist or "").strip()
    title  = (title  or "").strip()

    # --- clean the title ---
    # Remove artist-name prefix duplication (title starts with artist name)
    if artist and title.lower().startswith(artist.lower()):
        title = title[len(artist):].lstrip(" -–—")

    # Remove birth-death year patterns: (1887-1956)
    title = re.sub(r'\(\d{4}[-–]\d{4}\)', '', title).strip()

    # Remove technique-suffix noise: "- HST signé", "- H/T", "- H ..."
    title = re.sub(r'\s*[-–]\s*(HST|HSP|HSTsig|H/T|H\b).*$', '', title,
                   flags=re.IGNORECASE).strip()

    # Truncate
    title = title[:60].strip()

    if source == "interencheres":
        # Artist name alone gives much cleaner results on Interenchères
        return artist[:40] if artist else title

    # All other sources: "Artist Title"
    parts = []
    if artist:
        parts.append(artist[:30])
    if title and title.lower() != artist.lower():
        parts.append(title[:40])
    return " ".join(parts).strip()


def fix_url(
    url: Optional[str],
    source: str,
    title: str = "",
    artist: str = "",
    lot_id: str = "",  # not used directly; kept for call-site compat
) -> Optional[str]:
    """
    Return the best URL for a lot.

    Priority:
    1. Existing URL if it passes validation
    2. Repair relative URL (starts with '/') → prepend domain
    3. Fall back to verified search URL from auction_urls.build_url()
    4. None if source is unknown and nothing else is available
    """
    source = (source or "").lower()

    # Repair relative URL
    if url and url.startswith("/"):
        domain = SOURCE_DOMAINS.get(source, "")
        if domain:
            url = f"https://www.{domain}{url}"

    if validate_url(url, source):
        return url

    # Fallback: build a clean search URL
    search_name = _clean_search_term(source, title, artist)
    fallback = build_url(source, search_name or None)
    return fallback or None
