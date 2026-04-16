"""
Artsy Historical Auction Results Scraper.
Uses Artsy GraphQL API to fetch past auction results.
Free — same API key as current Artsy connector.
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
          priceRealized {
            display
            amount
            currencyCode
          }
          estimate {
            display
            low {
              amount
              currencyCode
            }
            high {
              amount
              currencyCode
            }
          }
          images {
            thumbnail {
              url
            }
          }
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


async def fetch_artist_id(artist_name: str, token: str) -> Optional[str]:
    """Get Artsy artist ID from name."""
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                ARTSY_GRAPHQL,
                json={"query": ARTIST_SEARCH_QUERY, "variables": {"query": artist_name}},
                headers={"X-Access-Token": token, "Content-Type": "application/json"},
            )
            if resp.status_code != 200:
                return None
            data = resp.json()
            edges = data.get("data", {}).get("searchConnection", {}).get("edges", [])
            for edge in edges:
                node = edge.get("node", {})
                if node.get("name", "").lower() == artist_name.lower():
                    return node.get("internalID") or node.get("slug")
            # Return first result if no exact match
            if edges:
                node = edges[0].get("node", {})
                return node.get("internalID") or node.get("slug")
    except Exception as e:
        logger.warning("artsy_artist_id_fetch_error", artist=artist_name, error=str(e))
    return None


async def fetch_artist_auction_results(
    artist_name: str,
    artsy_token: str,
    max_results: int = 100,
) -> list:
    """Fetch historical auction results for an artist from Artsy."""
    results = []

    if not artsy_token:
        logger.warning("artsy_token_missing")
        return []

    artist_id = await fetch_artist_id(artist_name, artsy_token)
    if not artist_id:
        logger.warning("artsy_artist_not_found", artist=artist_name)
        return []

    cursor = None
    fetched = 0

    async with httpx.AsyncClient(timeout=30) as client:
        while fetched < max_results:
            batch_size = min(50, max_results - fetched)
            variables = {
                "artistID": artist_id,
                "first": batch_size,
                "after": cursor,
            }

            try:
                resp = await client.post(
                    ARTSY_GRAPHQL,
                    json={"query": AUCTION_RESULTS_QUERY, "variables": variables},
                    headers={"X-Access-Token": artsy_token, "Content-Type": "application/json"},
                )

                if resp.status_code != 200:
                    logger.warning("artsy_historical_failed", status=resp.status_code)
                    break

                data = resp.json()
                artist_data = data.get("data", {}).get("artist", {}) or {}
                connection = artist_data.get("auctionResultsConnection", {}) or {}
                edges = connection.get("edges", []) or []

                for edge in edges:
                    node = edge.get("node", {})
                    if not node:
                        continue

                    # Extract hammer price
                    realized = node.get("priceRealized") or {}
                    hammer_amount = realized.get("amount") if realized else None
                    currency = realized.get("currencyCode", "USD") if realized else "USD"

                    # Extract estimates
                    estimate = node.get("estimate") or {}
                    est_low = None
                    est_high = None
                    if estimate:
                        low = estimate.get("low") or {}
                        high = estimate.get("high") or {}
                        est_low = low.get("amount") if low else None
                        est_high = high.get("amount") if high else None

                    # Parse sale date
                    sale_date = None
                    sale_date_str = node.get("saleDate")
                    if sale_date_str:
                        try:
                            from dateutil import parser as dateparser
                            sale_date = dateparser.parse(sale_date_str)
                        except Exception:
                            pass

                    # Normalize to EUR
                    hammer_eur = None
                    if hammer_amount:
                        rates = {"USD": 0.92, "GBP": 1.17, "EUR": 1.0, "CHF": 1.05, "HKD": 0.12}
                        rate = rates.get(str(currency).upper(), 0.92)
                        hammer_eur = round(float(hammer_amount) * rate, 2)

                    # Premium ratio
                    premium_ratio = None
                    if hammer_amount and est_low and float(est_low) > 0:
                        premium_ratio = round(float(hammer_amount) / float(est_low), 2)

                    external_id = f"artsy-hist-{node.get('internalID', '')}"

                    # Image URL
                    image_url = None
                    images = node.get("images") or []
                    if images and isinstance(images, list):
                        thumb = images[0].get("thumbnail") or {}
                        image_url = thumb.get("url")

                    results.append({
                        "external_id": external_id,
                        "artist_name": artist_data.get("name", artist_name),
                        "artwork_title": node.get("title", ""),
                        "year_created": _parse_year(node.get("dateText")),
                        "medium": node.get("mediumText"),
                        "dimensions": node.get("dimensionText"),
                        "sale_date": sale_date,
                        "hammer_price": float(hammer_amount) if hammer_amount else None,
                        "currency": currency,
                        "hammer_price_eur": hammer_eur,
                        "estimate_low": float(est_low) if est_low else None,
                        "estimate_high": float(est_high) if est_high else None,
                        "premium_ratio": premium_ratio,
                        "auction_house": node.get("organization", ""),
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
    match = re.search(r'\b(1[89]\d{2}|20[0-2]\d)\b', str(date_text))
    return int(match.group(1)) if match else None
