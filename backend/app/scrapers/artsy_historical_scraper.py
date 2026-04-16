"""
Artsy Historical Auction Results Scraper.
Uses Artsy GraphQL API to fetch past auction results.
Token optional — public API works without auth.
"""
import httpx
import asyncio
import re
from datetime import datetime
from typing import Optional
import structlog

logger = structlog.get_logger()

ARTSY_GRAPHQL = "https://metaphysics-production.artsy.net/v2"

AUCTION_RESULTS_QUERY = """
query ArtistAuctionResults($artistID: String!, $first: Int!, $after: String) {
  artist(id: $artistID) {
    name
    auctionResultsConnection(
      first: $first
      after: $after
      sort: DATE_DESC
    ) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          internalID
          title
          dateText
          mediumText
          dimensionText
          saleDate
          currency
          priceRealized { display }
          estimate { display }
          images { thumbnail { url } }
          organization
          saleTitle
          lotNumber
        }
      }
    }
  }
}
"""

ARTIST_SEARCH_QUERY = """
query SearchArtists($query: String!) {
  searchConnection(query: $query, entities: [ARTIST], first: 5) {
    edges {
      node {
        ... on Artist {
          internalID
          slug
          name
        }
      }
    }
  }
}
"""


def _headers(token: Optional[str]) -> dict:
    h = {"Content-Type": "application/json"}
    if token:
        h["X-Access-Token"] = token
    return h


def _parse_price_display(display: Optional[str], currency: Optional[str] = None):
    """
    Parse Artsy display string like 'US$12,500' or '€8,000' or 'HK$120,000'.
    Returns (amount_float, currency_code) or (None, None).
    """
    if not display:
        return None, None

    display = display.replace("\u00a0", "").replace(",", "").strip()

    # Currency map from prefix
    prefix_map = {
        "US$": "USD", "HK$": "HKD", "AU$": "AUD", "CA$": "CAD",
        "£": "GBP", "€": "EUR", "¥": "JPY", "CHF": "CHF",
        "$": "USD",
    }
    for prefix, code in prefix_map.items():
        if display.startswith(prefix):
            num_str = display[len(prefix):]
            match = re.search(r"[\d.]+", num_str)
            if match:
                return float(match.group()), currency or code
    # Fallback: extract any number
    match = re.search(r"[\d.]+", display)
    if match:
        return float(match.group()), currency or "USD"
    return None, None


def _parse_estimate_display(display: Optional[str], currency: Optional[str] = None):
    """
    Parse estimate range like 'US$6,000–US$8,000' or '€4,000 – €5,000'.
    Returns (low_float, high_float) or (None, None).
    """
    if not display:
        return None, None
    # Split on em-dash, en-dash, or ' - '
    parts = re.split(r"[–—\-]", display, maxsplit=1)
    low, _ = _parse_price_display(parts[0].strip(), currency)
    high, _ = _parse_price_display(parts[-1].strip(), currency) if len(parts) > 1 else (None, None)
    return low, high


def _to_eur(amount: Optional[float], currency: Optional[str]) -> Optional[float]:
    if amount is None:
        return None
    rates = {"USD": 0.92, "GBP": 1.17, "EUR": 1.0, "CHF": 1.05,
             "HKD": 0.12, "AUD": 0.60, "CAD": 0.68, "JPY": 0.0062}
    rate = rates.get(str(currency).upper(), 0.92)
    return round(amount * rate, 2)


async def fetch_artist_id(artist_name: str, token: Optional[str]) -> Optional[str]:
    """Get Artsy artist ID from name."""
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                ARTSY_GRAPHQL,
                json={"query": ARTIST_SEARCH_QUERY, "variables": {"query": artist_name}},
                headers=_headers(token),
            )
            if resp.status_code != 200:
                return None
            data = resp.json()
            edges = data.get("data", {}).get("searchConnection", {}).get("edges", [])
            for edge in edges:
                node = edge.get("node", {})
                if node.get("name", "").lower() == artist_name.lower():
                    return node.get("internalID") or node.get("slug")
            if edges:
                node = edges[0].get("node", {})
                return node.get("internalID") or node.get("slug")
    except Exception as e:
        logger.warning("artsy_artist_id_fetch_error", artist=artist_name, error=str(e))
    return None


async def fetch_artist_auction_results(
    artist_name: str,
    artsy_token: Optional[str] = None,
    max_results: int = 100,
) -> list:
    """Fetch historical auction results for an artist from Artsy. Token optional."""
    results = []

    artist_id = await fetch_artist_id(artist_name, artsy_token)
    if not artist_id:
        logger.warning("artsy_artist_not_found", artist=artist_name)
        return []

    cursor = None
    fetched = 0

    async with httpx.AsyncClient(timeout=30) as client:
        while fetched < max_results:
            batch_size = min(50, max_results - fetched)
            variables = {"artistID": artist_id, "first": batch_size, "after": cursor}

            try:
                resp = await client.post(
                    ARTSY_GRAPHQL,
                    json={"query": AUCTION_RESULTS_QUERY, "variables": variables},
                    headers=_headers(artsy_token),
                )

                if resp.status_code != 200:
                    logger.warning("artsy_historical_failed", status=resp.status_code, body=resp.text[:200])
                    break

                data = resp.json()
                if "errors" in data:
                    logger.warning("artsy_historical_gql_error", errors=data["errors"])
                    break

                artist_data = data.get("data", {}).get("artist", {}) or {}
                connection = artist_data.get("auctionResultsConnection", {}) or {}
                edges = connection.get("edges", []) or []

                for edge in edges:
                    node = edge.get("node", {})
                    if not node:
                        continue

                    currency = node.get("currency") or "USD"

                    # Parse hammer price from display string
                    realized_display = (node.get("priceRealized") or {}).get("display")
                    hammer_amount, _ = _parse_price_display(realized_display, currency)

                    # Parse estimate from display string
                    est_display = (node.get("estimate") or {}).get("display")
                    est_low, est_high = _parse_estimate_display(est_display, currency)

                    # Normalize to EUR
                    hammer_eur = _to_eur(hammer_amount, currency)

                    # Premium ratio
                    premium_ratio = None
                    if hammer_amount and est_low and est_low > 0:
                        premium_ratio = round(hammer_amount / est_low, 2)

                    # Sale date
                    sale_date = None
                    sale_date_str = node.get("saleDate")
                    if sale_date_str:
                        try:
                            from dateutil import parser as dp
                            sale_date = dp.parse(sale_date_str)
                        except Exception:
                            pass

                    # Image URL — images is an object, not array
                    image_url = None
                    images_obj = node.get("images") or {}
                    if isinstance(images_obj, dict):
                        image_url = (images_obj.get("thumbnail") or {}).get("url")

                    external_id = f"artsy-hist-{node.get('internalID', '')}"

                    results.append({
                        "external_id": external_id,
                        "artist_name": artist_data.get("name", artist_name),
                        "artwork_title": node.get("title") or "",
                        "year_created": _parse_year(node.get("dateText")),
                        "medium": node.get("mediumText"),
                        "dimensions": node.get("dimensionText"),
                        "sale_date": sale_date,
                        "hammer_price": hammer_amount,
                        "currency": currency,
                        "hammer_price_eur": hammer_eur,
                        "estimate_low": est_low,
                        "estimate_high": est_high,
                        "premium_ratio": premium_ratio,
                        "auction_house": node.get("organization") or "",
                        "lot_number": node.get("lotNumber"),
                        "source": "artsy",
                        "image_url": image_url,
                    })
                    fetched += 1

                page_info = connection.get("pageInfo", {})
                if not page_info.get("hasNextPage") or not edges:
                    break
                cursor = page_info.get("endCursor")
                await asyncio.sleep(0.5)

            except Exception as e:
                logger.error("artsy_historical_fetch_error", error=str(e))
                break

    logger.info("artsy_historical_fetched", artist=artist_name, count=len(results))
    return results


def _parse_year(date_text: Optional[str]) -> Optional[int]:
    if not date_text:
        return None
    match = re.search(r"\b(1[89]\d{2}|20[0-2]\d)\b", str(date_text))
    return int(match.group(1)) if match else None
