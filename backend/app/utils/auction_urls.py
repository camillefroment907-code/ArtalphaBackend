"""
Verified auction house URL builder.
Every URL pattern in this file has been manually confirmed to work.
"""
import urllib.parse
import unicodedata
from typing import Optional


def _encode(name: str, remove_accents: bool = False) -> str:
    """URL-encode artist name. Optionally remove accents."""
    if remove_accents:
        nfkd = unicodedata.normalize("NFD", name)
        name = "".join(c for c in nfkd if not unicodedata.combining(c))
    return urllib.parse.quote(name.strip())


def build_url(source: str, artist_name: Optional[str] = None) -> str:
    """
    Build a verified working URL for an auction house.
    Falls back to the house homepage search if no artist name.

    All patterns verified working as of 2025.
    """
    source = source.lower().replace("auctionhouse.", "")

    if not artist_name or not artist_name.strip():
        fallbacks = {
            "drouot":        "https://www.drouot.com/lots",
            "interencheres": "https://www.interencheres.com/recherche/?type=lot",
            "invaluable":    "https://www.invaluable.com/search/?upcoming=true",
            "christies":     "https://www.christies.com/search?tab=objects",
            "sothebys":      "https://www.sothebys.com/en/results",
            "bonhams":       "https://www.bonhams.com/auction-results/",
        }
        return fallbacks.get(source, "https://www.invaluable.com/search/?upcoming=true")

    if source == "drouot":
        encoded = _encode(artist_name)
        return f"https://www.drouot.com/lots?q={encoded}"

    elif source == "interencheres":
        # Interenchères requires accent-free for reliable results
        encoded = _encode(artist_name, remove_accents=True)
        return f"https://www.interencheres.com/recherche/?q={encoded}&type=lot"

    elif source == "invaluable":
        encoded = _encode(artist_name)
        return f"https://www.invaluable.com/search/?query={encoded}&upcoming=true"

    elif source == "christies":
        encoded = _encode(artist_name)
        return f"https://www.christies.com/search?query={encoded}&tab=objects"

    elif source == "sothebys":
        encoded = _encode(artist_name)
        return f"https://www.sothebys.com/en/results?query={encoded}"

    elif source == "bonhams":
        encoded = _encode(artist_name)
        return f"https://www.bonhams.com/auction-results/?keyword={encoded}"

    else:
        encoded = _encode(artist_name)
        return f"https://www.invaluable.com/search/?query={encoded}&upcoming=true"


def build_lot_url(source: str, lot_id: str, artist_name: Optional[str] = None) -> str:
    """
    Build URL for a specific lot when we have a real lot ID from scraping.
    Falls back to search URL if no lot ID.
    """
    source = source.lower().replace("auctionhouse.", "")

    if not lot_id:
        return build_url(source, artist_name)

    if source == "drouot":
        return f"https://www.drouot.com/lot/{lot_id}"

    elif source == "interencheres":
        return f"https://www.interencheres.com/lot/{lot_id}/"

    elif source == "invaluable":
        return f"https://www.invaluable.com/auction-lot/{lot_id}/"

    else:
        return build_url(source, artist_name)
