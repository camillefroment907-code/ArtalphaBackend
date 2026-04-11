"""
Artsy Connector
Public API — no key required for basic access.
Lot URL: https://www.artsy.net/artwork/{slug}
"""
import asyncio
import httpx
from datetime import datetime
from typing import List, Optional
import structlog
from app.models.schemas import LotNormalized, AuctionHouseEnum

logger = structlog.get_logger().bind(connector="artsy")

BASE_URL = "https://api.artsy.net/api"
ARTSY_CLIENT_ID = ""      # Optional — leave empty for public access
ARTSY_CLIENT_SECRET = ""  # Optional

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Accept": "application/vnd.artsy-v2+json",
    "X-Access-Token": "",  # Will be set after auth if credentials available
}


def _f(val) -> Optional[float]:
    if not val:
        return None
    try:
        return float(
            str(val)
            .replace(",", "").replace(" ", "")
            .replace("$", "").replace("€", "").replace("£", "")
            .replace("USD", "").replace("EUR", "").strip()
        )
    except Exception:
        return None


def _d(val) -> Optional[datetime]:
    if not val:
        return None
    try:
        s = str(val).replace("Z", "").replace("+00:00", "")
        for fmt in ["%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M", "%Y-%m-%d"]:
            try:
                return datetime.strptime(s[:len(fmt)], fmt)
            except ValueError:
                pass
    except Exception:
        pass
    return None


def _parse_artwork(item: dict) -> Optional[LotNormalized]:
    """Parse an Artsy artwork/lot item."""
    try:
        slug = item.get("slug") or item.get("id")
        if not slug:
            return None

        lot_url = f"https://www.artsy.net/artwork/{slug}"

        title = str(item.get("title") or "").strip()
        if not title or len(title) < 2:
            return None

        # Artist
        artist = item.get("artist_names") or item.get("artist_name") or ""

        # Image
        image_url = None
        links = item.get("_links") or {}
        thumbnail = links.get("thumbnail") or {}
        image_url = thumbnail.get("href")
        if not image_url:
            img = item.get("image") or {}
            image_url = img.get("url") or img.get("href")

        # Price
        price_listed = item.get("price_listed") or item.get("price") or ""
        price_str = str(price_listed)
        est_low = _f(price_str.split("–")[0].split("-")[0]) if price_listed else None

        # Date
        sale_date = _d(
            item.get("end_at") or item.get("start_at") or item.get("auction_date")
        )

        # Category
        category = None
        classifications = item.get("classifications") or item.get("category") or []
        if isinstance(classifications, list) and classifications:
            category = classifications[0] if isinstance(classifications[0], str) else None
        elif isinstance(classifications, str):
            category = classifications

        return LotNormalized(
            external_id=f"artsy-{slug}",
            source=AuctionHouseEnum.OTHER,
            title=title[:500],
            artist_name_raw=str(artist)[:300] if artist else None,
            description=item.get("description") or item.get("blurb"),
            category=category,
            medium=item.get("medium") or item.get("materials"),
            dimensions=(
                item.get("dimensions", {}).get("cm", {}).get("text")
                if isinstance(item.get("dimensions"), dict) else None
            ),
            estimate_low=est_low,
            estimate_high=(
                _f(price_str.split("–")[-1])
                if price_listed and "–" in price_str else None
            ),
            current_price=est_low,
            currency="USD",
            auction_date=sale_date,
            auction_house_name="Artsy",
            url=lot_url,
            image_url=image_url,
            raw_data={"real": True, "source": "artsy", "slug": slug},
        )
    except Exception as e:
        logger.debug("parse error", error=str(e))
        return None


async def _get_token(client: httpx.AsyncClient) -> Optional[str]:
    """Get Artsy access token if credentials are configured."""
    if not ARTSY_CLIENT_ID or not ARTSY_CLIENT_SECRET:
        return None
    try:
        resp = await client.post(
            f"{BASE_URL}/tokens/xapp_token",
            json={"client_id": ARTSY_CLIENT_ID, "client_secret": ARTSY_CLIENT_SECRET},
        )
        if resp.status_code == 201:
            return resp.json().get("token")
    except Exception:
        pass
    return None


_GRAPHQL_URL = "https://metaphysics-production.artsy.net/v2"

_GRAPHQL_QUERY = """
{
  artworksConnection(
    forSale: true,
    atAuction: true,
    first: 50,
    sort: "-published_at"
  ) {
    edges {
      node {
        internalID
        slug
        title
        medium
        category
        image { url(version: "large") }
        artists { name }
        saleArtwork {
          currency
          lowEstimate { display }
          highEstimate { display }
          currentBid { display }
        }
        sale {
          name
          endAt
          isAuction
        }
        partner { name }
      }
    }
  }
}
"""


def _parse_display_price(display: Optional[str]) -> Optional[float]:
    if not display:
        return None
    clean = "".join(c for c in str(display) if c.isdigit() or c == ".")
    try:
        return float(clean) if clean else None
    except ValueError:
        return None


async def fetch_lots(limit: int = 100) -> List[LotNormalized]:
    """Fetch auction lots from Artsy via public GraphQL (no auth required)."""
    lots: List[LotNormalized] = []

    try:
        async with httpx.AsyncClient(
            timeout=20,
            headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"},
        ) as client:
            resp = await client.post(
                _GRAPHQL_URL,
                json={"query": _GRAPHQL_QUERY},
                timeout=15,
            )

            if resp.status_code != 200:
                logger.warning("artsy_graphql_failed", status=resp.status_code)
                return []

            edges = (
                resp.json()
                .get("data", {})
                .get("artworksConnection", {})
                .get("edges", [])
            )

            for edge in edges:
                node = edge.get("node") or {}
                try:
                    artwork_id = node.get("slug") or node.get("internalID", "")
                    title = (node.get("title") or "").strip()
                    if not title or not artwork_id:
                        continue

                    artists = node.get("artists") or []
                    artist = artists[0].get("name", "") if artists else ""

                    sale_artwork = node.get("saleArtwork") or {}
                    low = _parse_display_price((sale_artwork.get("lowEstimate") or {}).get("display"))
                    high = _parse_display_price((sale_artwork.get("highEstimate") or {}).get("display"))
                    bid = _parse_display_price((sale_artwork.get("currentBid") or {}).get("display"))
                    currency = (sale_artwork.get("currency") or "USD").upper()

                    sale = node.get("sale") or {}
                    auction_date = None
                    if sale.get("endAt"):
                        try:
                            auction_date = datetime.fromisoformat(str(sale["endAt"])[:19])
                        except Exception:
                            pass

                    image = node.get("image") or {}
                    image_url = image.get("url")

                    partner = node.get("partner") or {}
                    gallery_name = partner.get("name", "")
                    house_name = sale.get("name") or gallery_name or "Artsy"
                    is_auction = sale.get("isAuction", True)

                    lots.append(LotNormalized(
                        external_id=f"artsy-{artwork_id}",
                        source=AuctionHouseEnum.OTHER,
                        title=str(title)[:500],
                        artist_name_raw=str(artist)[:300] if artist else None,
                        estimate_low=low,
                        estimate_high=high,
                        current_price=bid or low,
                        currency=currency,
                        auction_date=auction_date,
                        auction_house_name=house_name[:300],
                        image_url=str(image_url) if image_url else None,
                        url=f"https://www.artsy.net/artwork/{artwork_id}",
                        category=node.get("category") or node.get("medium"),
                        medium=node.get("medium"),
                        market_type="AUCTION" if is_auction else "PRIMARY",
                        is_buy_now=not is_auction,
                        gallery_name=gallery_name[:300] if gallery_name else None,
                        raw_data={"real": True, "source": "artsy", "slug": artwork_id},
                    ))
                    if len(lots) >= limit:
                        break

                except Exception as e:
                    logger.debug("artsy_graphql_parse_error", error=str(e))
                    continue

    except Exception as e:
        logger.warning("artsy_graphql_fetch_failed", error=str(e))

    logger.info("artsy_fetched", count=len(lots))
    return lots[:limit]


async def fetch_primary_lots(limit: int = 100) -> List[LotNormalized]:
    """
    Fetch primary market artworks from Artsy galleries.
    Uses Artsy public API v2 — no key needed for public data.
    """
    lots = []
    try:
        async with httpx.AsyncClient(timeout=20, headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            "Accept": "application/json",
            "X-Xapp-Token": "",  # public access
        }) as client:
            endpoints = [
                "https://api.artsy.net/api/artworks?for_sale=true&size=50&sort=-published_at",
                "https://api.artsy.net/api/artworks?for_sale=true&size=50&sort=-created_at&gene_id=emerging-art",
            ]

            for endpoint in endpoints:
                try:
                    resp = await client.get(endpoint, timeout=10)
                    if resp.status_code != 200:
                        continue

                    data = resp.json()
                    items = data.get("_embedded", {}).get("artworks", [])

                    for item in items:
                        try:
                            artwork_id = item.get("id") or item.get("slug", "")
                            if not artwork_id:
                                continue

                            title = item.get("title", "Untitled")

                            artist = ""
                            artists = item.get("_embedded", {}).get("artists", [])
                            if artists:
                                artist = artists[0].get("name", "")

                            # Price
                            price = None
                            price_str = item.get("price", "") or item.get("price_listed", "")
                            if price_str:
                                try:
                                    clean = str(price_str).replace(",", "").replace("$", "").replace("€", "").replace("£", "").strip()
                                    if " - " in clean:
                                        parts = clean.split(" - ")
                                        price = float(parts[0].strip())
                                    else:
                                        price = float(clean)
                                except Exception:
                                    pass

                            currency = item.get("price_currency", "USD") or "USD"

                            image_url = None
                            images = item.get("_links", {}).get("image", {})
                            if images:
                                image_url = images.get("href", "").replace("{image_version}", "large")
                            if not image_url:
                                thumbnail = item.get("_links", {}).get("thumbnail", {})
                                image_url = thumbnail.get("href") if thumbnail else None

                            url = f"https://www.artsy.net/artwork/{artwork_id}"

                            gallery_name = ""
                            partners = item.get("_embedded", {}).get("partner", {})
                            if partners:
                                gallery_name = partners.get("name", "")

                            lots.append(LotNormalized(
                                external_id=f"artsy-primary-{artwork_id}",
                                source=AuctionHouseEnum.OTHER,
                                title=str(title)[:500],
                                artist_name_raw=str(artist)[:500] if artist else None,
                                estimate_low=price,
                                estimate_high=price,
                                current_price=price,
                                currency=currency.upper(),
                                auction_date=None,
                                auction_house_name=gallery_name or "Artsy",
                                image_url=str(image_url) if image_url else None,
                                url=url,
                                category=item.get("category"),
                                medium=item.get("medium"),
                                market_type="PRIMARY",
                                is_buy_now=True,
                                gallery_name=gallery_name,
                                raw_data=item,
                            ))
                        except Exception as e:
                            logger.debug("artsy_primary_parse_error", error=str(e))
                            continue

                except Exception as e:
                    logger.warning("artsy_primary_endpoint_failed", url=endpoint, error=str(e))
                    continue

    except Exception as e:
        logger.warning("artsy_primary_fetch_failed", error=str(e))

    logger.info("artsy_primary_fetched", count=len(lots))
    return lots
