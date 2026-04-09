"""
Artist enrichment via Wikipedia + Wikidata APIs.
Free, no API key needed. Used as fallback after local DB lookup.
"""
import httpx
import structlog
from typing import Optional, Dict, Any

logger = structlog.get_logger()

WIKIDATA_SPARQL = "https://query.wikidata.org/sparql"
WIKIPEDIA_API = "https://en.wikipedia.org/api/rest_v1/page/summary"
WIKIPEDIA_FR_API = "https://fr.wikipedia.org/api/rest_v1/page/summary"


async def fetch_artist_from_wikipedia(artist_name: str) -> Optional[Dict[str, Any]]:
    """
    Fetch artist data from Wikipedia/Wikidata.
    Returns dict compatible with ARTIST_MARKET_DB structure.
    """
    if not artist_name or len(artist_name.strip()) < 3:
        return None

    name = artist_name.strip()

    try:
        async with httpx.AsyncClient(timeout=10, headers={
            "User-Agent": "ArtAlpha/1.0 (art investment platform; contact@artalpha.io)"
        }) as client:

            wiki_data = await _fetch_wikipedia_summary(client, name)
            wikidata = await _fetch_wikidata(client, name)

            if not wiki_data and not wikidata:
                return None

            result: Dict[str, Any] = {
                "name": name,
                "nationality": None,
                "birth_year": None,
                "death_year": None,
                "movement": None,
                "liquidity": 50.0,
                "avg_price": None,
                "popularity": 50.0,
                "trend": "stable",
                "confidence": 0.6,
                "source": "wikipedia",
            }

            if wikidata:
                result.update({
                    "nationality": wikidata.get("nationality"),
                    "birth_year": wikidata.get("birth_year"),
                    "death_year": wikidata.get("death_year"),
                    "movement": wikidata.get("movement"),
                })
                sitelinks = wikidata.get("sitelinks_count", 0)
                if sitelinks > 50:
                    result["popularity"] = 85.0
                    result["liquidity"] = 75.0
                elif sitelinks > 20:
                    result["popularity"] = 70.0
                    result["liquidity"] = 60.0
                elif sitelinks > 5:
                    result["popularity"] = 55.0
                    result["liquidity"] = 45.0

            if wiki_data:
                result["description"] = wiki_data.get("extract", "")[:500]
                extract = (wiki_data.get("extract") or "").lower()
                if any(w in extract for w in ["contemporary", "contemporain", "emerging", "émergent"]):
                    result["trend"] = "up"
                    result["popularity"] = min(result["popularity"] + 10, 90)

            return result

    except Exception as e:
        logger.debug("wikipedia_fetch_failed", artist=name, error=str(e))
        return None


async def _fetch_wikipedia_summary(
    client: httpx.AsyncClient, name: str
) -> Optional[Dict[str, Any]]:
    """Fetch Wikipedia page summary for artist."""
    for api_url in [WIKIPEDIA_API, WIKIPEDIA_FR_API]:
        try:
            title = name.replace(" ", "_")
            resp = await client.get(f"{api_url}/{title}")
            if resp.status_code == 200:
                data = resp.json()
                description = (data.get("description") or "").lower()
                extract = (data.get("extract") or "").lower()
                art_keywords = [
                    "artist", "painter", "sculptor", "photographer",
                    "artiste", "peintre", "sculpteur",
                ]
                if any(kw in description or kw in extract[:200] for kw in art_keywords):
                    return data
        except Exception:
            continue
    return None


async def _fetch_wikidata(
    client: httpx.AsyncClient, name: str
) -> Optional[Dict[str, Any]]:
    """Fetch structured data from Wikidata SPARQL endpoint."""
    query = f"""
    SELECT ?person ?personLabel ?nationalityLabel ?birthDate ?deathDate ?movementLabel ?sitelinks WHERE {{
      ?person wdt:P106 wd:Q1028181 .
      ?person rdfs:label "{name}"@en .
      OPTIONAL {{ ?person wdt:P27 ?nationality . }}
      OPTIONAL {{ ?person wdt:P569 ?birthDate . }}
      OPTIONAL {{ ?person wdt:P570 ?deathDate . }}
      OPTIONAL {{ ?person wdt:P135 ?movement . }}
      OPTIONAL {{ ?person wikibase:sitelinks ?sitelinks . }}
      SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en,fr" . }}
    }}
    LIMIT 1
    """
    try:
        resp = await client.get(
            WIKIDATA_SPARQL,
            params={"query": query, "format": "json"},
            headers={"Accept": "application/json"},
            timeout=8,
        )
        if resp.status_code != 200:
            return None

        data = resp.json()
        bindings = data.get("results", {}).get("bindings", [])
        if not bindings:
            return None

        b = bindings[0]

        birth_year = None
        death_year = None
        if b.get("birthDate"):
            try:
                birth_year = int(b["birthDate"]["value"][:4])
            except Exception:
                pass
        if b.get("deathDate"):
            try:
                death_year = int(b["deathDate"]["value"][:4])
            except Exception:
                pass

        return {
            "nationality": b.get("nationalityLabel", {}).get("value"),
            "birth_year": birth_year,
            "death_year": death_year,
            "movement": b.get("movementLabel", {}).get("value"),
            "sitelinks_count": int(b.get("sitelinks", {}).get("value", 0)),
        }
    except Exception as e:
        logger.debug("wikidata_sparql_failed", error=str(e))
        return None
