"""
Artist Enrichment Engine
Combines AI analysis, cached market data, and heuristics.
"""
import re
import json
import asyncio
from typing import Optional, Dict, Any, Tuple
from datetime import datetime
import structlog
import httpx

from app.config import get_settings
from app.engines.artist_wikipedia import fetch_artist_from_wikipedia

logger = structlog.get_logger()
settings = get_settings()

# ── Artist Market Database (curated baselines for ~12 blue-chip artists) ──────
# Source: manually compiled from Artprice Global Index reports and public auction
# aggregates (Artnet, Invaluable). Values represent EUR medians/averages across
# all media and houses. Last reviewed: 2024-Q4.
# Do NOT add new entries without citing a source and date.
# For other artists, use real HammerArtistStats from the DB instead.

ARTIST_MARKET_DB: Dict[str, Dict[str, Any]] = {
    "bernard buffet": {
        "avg_price": 1900, "median_price": 1400, "liquidity": 78,
        "popularity": 72, "trend": "stable", "sell_through": 0.68,
        "volatility": 0.35, "lots_sold": 4200, "confidence": 0.90,
        "nationality": "French", "birth_year": 1928, "death_year": 1999,
        "movement": "Expressionism",
    },
    "fernand léger": {
        "avg_price": 48000, "median_price": 32000, "liquidity": 85,
        "popularity": 88, "trend": "up", "sell_through": 0.82,
        "volatility": 0.28, "lots_sold": 8900, "confidence": 0.95,
        "nationality": "French", "birth_year": 1881, "death_year": 1955,
        "movement": "Cubism",
    },
    "niki de saint phalle": {
        "avg_price": 14000, "median_price": 9500, "liquidity": 80,
        "popularity": 85, "trend": "up", "sell_through": 0.78,
        "volatility": 0.32, "lots_sold": 3100, "confidence": 0.88,
        "nationality": "French-American", "birth_year": 1930, "death_year": 2002,
        "movement": "Neo-Dadaism",
    },
    "andy warhol": {
        "avg_price": 95000, "median_price": 42000, "liquidity": 95,
        "popularity": 98, "trend": "stable", "sell_through": 0.88,
        "volatility": 0.45, "lots_sold": 22000, "confidence": 0.97,
        "nationality": "American", "birth_year": 1928, "death_year": 1987,
        "movement": "Pop Art",
    },
    "marc chagall": {
        "avg_price": 42000, "median_price": 28000, "liquidity": 88,
        "popularity": 90, "trend": "stable", "sell_through": 0.84,
        "volatility": 0.25, "lots_sold": 18500, "confidence": 0.96,
        "nationality": "Russian-French", "birth_year": 1887, "death_year": 1985,
        "movement": "Expressionism",
    },
    "joan miró": {
        "avg_price": 32000, "median_price": 20000, "liquidity": 87,
        "popularity": 89, "trend": "stable", "sell_through": 0.83,
        "volatility": 0.22, "lots_sold": 16200, "confidence": 0.96,
        "nationality": "Spanish", "birth_year": 1893, "death_year": 1983,
        "movement": "Surrealism",
    },
    "yves klein": {
        "avg_price": 135000, "median_price": 95000, "liquidity": 82,
        "popularity": 92, "trend": "up", "sell_through": 0.79,
        "volatility": 0.38, "lots_sold": 2800, "confidence": 0.92,
        "nationality": "French", "birth_year": 1928, "death_year": 1962,
        "movement": "New Realism",
    },
    "jean-michel basquiat": {
        "avg_price": 220000, "median_price": 140000, "liquidity": 88,
        "popularity": 96, "trend": "up", "sell_through": 0.85,
        "volatility": 0.55, "lots_sold": 5200, "confidence": 0.94,
        "nationality": "American", "birth_year": 1960, "death_year": 1988,
        "movement": "Neo-Expressionism",
    },
    "gerhard richter": {
        "avg_price": 110000, "median_price": 65000, "liquidity": 85,
        "popularity": 91, "trend": "stable", "sell_through": 0.80,
        "volatility": 0.40, "lots_sold": 9800, "confidence": 0.95,
        "nationality": "German", "birth_year": 1932, "death_year": None,
        "movement": "Contemporary",
    },
    "pierre soulages": {
        "avg_price": 92000, "median_price": 68000, "liquidity": 80,
        "popularity": 88, "trend": "up", "sell_through": 0.77,
        "volatility": 0.30, "lots_sold": 4500, "confidence": 0.92,
        "nationality": "French", "birth_year": 1919, "death_year": 2022,
        "movement": "Abstract Art",
    },
    "david hockney": {
        "avg_price": 14500, "median_price": 8200, "liquidity": 88,
        "popularity": 93, "trend": "up", "sell_through": 0.85,
        "volatility": 0.38, "lots_sold": 12000, "confidence": 0.94,
        "nationality": "British", "birth_year": 1937, "death_year": None,
        "movement": "Pop Art",
    },
    "damien hirst": {
        "avg_price": 25000, "median_price": 12000, "liquidity": 75,
        "popularity": 85, "trend": "down", "sell_through": 0.62,
        "volatility": 0.58, "lots_sold": 8500, "confidence": 0.88,
        "nationality": "British", "birth_year": 1965, "death_year": None,
        "movement": "YBA",
    },
}


def _normalize_artist_name(name: str) -> str:
    """Lowercase, strip accents for matching."""
    import unicodedata
    name = name.lower().strip()
    # Normalize unicode but keep accented chars for display, use for lookup
    nfkd = unicodedata.normalize("NFKD", name)
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def _find_in_db(artist_name: str) -> Optional[Dict[str, Any]]:
    """Fuzzy match against our market database."""
    normalized = _normalize_artist_name(artist_name)

    # Exact match
    if normalized in ARTIST_MARKET_DB:
        return ARTIST_MARKET_DB[normalized]

    # Partial match
    for key, data in ARTIST_MARKET_DB.items():
        if key in normalized or normalized in key:
            return data

    # Word overlap match
    query_words = set(normalized.split())
    best_match = None
    best_overlap = 0

    for key, data in ARTIST_MARKET_DB.items():
        key_words = set(key.split())
        overlap = len(query_words & key_words)
        if overlap > best_overlap and overlap >= 1:
            best_overlap = overlap
            best_match = data

    return best_match


async def _enrich_with_openai(artist_name: str) -> Optional[Dict[str, Any]]:
    """
    Use GPT-4o-mini to fetch biographical fields only (nationality, dates, movement).
    Market data (prices, liquidity, sell-through) is intentionally excluded —
    LLMs do not have reliable access to current auction databases.
    Returns None if API unavailable.
    """
    if not settings.openai_api_key:
        return None

    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=settings.openai_api_key)

        prompt = f"""You are an art historian. For the artist "{artist_name}", provide ONLY biographical facts.

Return ONLY valid JSON with these exact fields:
{{
  "nationality": <string or null>,
  "birth_year": <int or null>,
  "death_year": <int or null>,
  "movement": <string, e.g. "Cubism" or null>,
  "confidence": <float 0-1, how confident you are in these biographical facts>
}}

Do NOT include prices, market data, or any financial estimates.
If you have no reliable information about this artist, return confidence 0.1 and nulls."""

        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=150,
            response_format={"type": "json_object"},
        )

        content = response.choices[0].message.content
        data = json.loads(content)
        # Explicitly ensure no market fields bleed through
        data.pop("avg_price", None)
        data.pop("median_price", None)
        data.pop("liquidity", None)
        data.pop("popularity", None)
        data.pop("trend", None)
        data.pop("sell_through", None)
        data.pop("volatility", None)
        data.pop("lots_sold", None)
        # Cap confidence at 0.4 — GPT biography has no market signal
        data["confidence"] = min(float(data.get("confidence", 0.2)), 0.4)
        return data

    except Exception as e:
        logger.warning("OpenAI enrichment failed", artist=artist_name, error=str(e))
        return None


def _detect_artist_from_title(title: str) -> Optional[str]:
    """
    Heuristically extract artist name from lot title.
    Common formats: "ARTIST — Description", "ARTIST (dates) Title", etc.
    """
    # Pattern: "Name SURNAME —" or "Name SURNAME,"
    patterns = [
        r"^([A-ZÀ-Ÿ][a-zà-ÿ]+(?: [A-ZÀ-Ÿ][a-zà-ÿ]+){1,3})\s*[—\-,]",
        r"^([A-ZÀ-Ÿ][a-zà-ÿ]+ [A-ZÀ-Ÿ]{2,})\b",  # Name SURNAME
        r"^([A-ZÀ-Ÿ]{2,} [A-ZÀ-Ÿ][a-zà-ÿ]+)\b",  # SURNAME Name
    ]

    for pattern in patterns:
        match = re.match(pattern, title)
        if match:
            candidate = match.group(1).strip()
            # Filter out common non-artist prefixes
            skip_words = {"After", "Style", "Attributed", "Circle", "School", "Workshop", "Manner"}
            if not any(word in candidate for word in skip_words):
                return candidate

    return None


async def enrich_artist(
    artist_name: Optional[str],
    lot_title: Optional[str] = None,
) -> Tuple[Optional[str], Dict[str, Any]]:
    """
    Main enrichment function.
    Returns (resolved_artist_name, market_data_dict)
    """
    # Try to detect artist from title if not provided
    resolved_name = artist_name
    if not resolved_name and lot_title:
        resolved_name = _detect_artist_from_title(lot_title)

    if not resolved_name:
        return None, {}

    # 1. Check our local market DB
    db_data = _find_in_db(resolved_name)
    if db_data and db_data.get("confidence", 0) > 0.7:
        logger.debug("Artist found in local DB", artist=resolved_name)
        return resolved_name, db_data

    # 2. Try Wikipedia/Wikidata (free, no API key needed)
    wiki_data = await fetch_artist_from_wikipedia(resolved_name)
    if wiki_data:
        logger.debug("artist_enriched_from_wikipedia", artist=resolved_name)
        if db_data:
            wiki_data = {**wiki_data, **{k: v for k, v in db_data.items() if v is not None}}
        return resolved_name, wiki_data

    # 3. Try OpenAI for biographical data only (no market data)
    ai_data = await _enrich_with_openai(resolved_name)
    if ai_data:
        logger.debug("Artist enriched via OpenAI (bio only)", artist=resolved_name)
        if db_data:
            ai_data = {**ai_data, **{k: v for k, v in db_data.items() if v is not None}}
        return resolved_name, ai_data

    # No reliable data — return empty rather than fabricate
    return resolved_name, db_data or {}
