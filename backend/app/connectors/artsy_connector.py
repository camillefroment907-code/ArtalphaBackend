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


async def fetch_lots(limit: int = 500) -> List[LotNormalized]:
    lots: List[LotNormalized] = []
    seen: set = set()

    headers = {**HEADERS}

    async with httpx.AsyncClient(
        headers=headers, timeout=30.0, follow_redirects=True, verify=False
    ) as client:

        # Try to get auth token
        token = await _get_token(client)
        if token:
            client.headers["X-Access-Token"] = token

        # Strategy 1: Get active auction sales, then their lots
        try:
            sales_resp = await client.get(
                f"{BASE_URL}/sales",
                params={"is_auction": "true", "live": "true", "size": 20},
            )
            if sales_resp.status_code == 200:
                sales_data = sales_resp.json()
                sales = sales_data.get("_embedded", {}).get("sales", [])
                logger.info(f"Artsy: {len(sales)} active sales found")

                for sale in sales[:10]:
                    if len(lots) >= limit:
                        break
                    sale_id = sale.get("id")
                    sale_name = sale.get("name", "Artsy")
                    if not sale_id:
                        continue

                    try:
                        lots_resp = await client.get(
                            f"{BASE_URL}/sale_artworks",
                            params={
                                "sale_id": sale_id,
                                "size": min(100, limit - len(lots)),
                            },
                        )
                        if lots_resp.status_code == 200:
                            items = lots_resp.json().get("_embedded", {}).get(
                                "sale_artworks", []
                            )
                            for item in items:
                                artwork = item.get("_embedded", {}).get("artwork", item)
                                lot = _parse_artwork(artwork)
                                if lot and lot.external_id not in seen:
                                    lot.auction_house_name = sale_name
                                    # Add estimate from sale_artwork level
                                    if not lot.estimate_low:
                                        cents = item.get("low_estimate_cents")
                                        lot.estimate_low = (
                                            _f(cents) / 100 if cents else None
                                        )
                                        hi_cents = item.get("high_estimate_cents")
                                        lot.estimate_high = (
                                            _f(hi_cents) / 100 if hi_cents else None
                                        )
                                    seen.add(lot.external_id)
                                    lots.append(lot)
                        await asyncio.sleep(0.3)
                    except Exception as e:
                        logger.warning("sale lots failed", sale_id=sale_id, error=str(e))

        except Exception as e:
            logger.warning("Artsy sales failed", error=str(e))

        # Strategy 2: Direct artwork search if not enough lots
        if len(lots) < limit:
            search_terms = [
                "painting", "sculpture", "photograph",
                "print", "drawing", "artwork",
            ]
            for term in search_terms:
                if len(lots) >= limit:
                    break
                try:
                    resp = await client.get(
                        f"{BASE_URL}/search",
                        params={
                            "q": term,
                            "type": "artwork",
                            "size": min(50, limit - len(lots)),
                        },
                    )
                    if resp.status_code == 200:
                        items = resp.json().get("_embedded", {}).get("results", [])
                        for item in items:
                            artwork_href = (
                                item.get("_links", {}).get("self", {}).get("href")
                            )
                            if artwork_href:
                                try:
                                    art_resp = await client.get(artwork_href)
                                    if art_resp.status_code == 200:
                                        lot = _parse_artwork(art_resp.json())
                                        if lot and lot.external_id not in seen:
                                            seen.add(lot.external_id)
                                            lots.append(lot)
                                except Exception:
                                    pass
                    await asyncio.sleep(0.5)
                except Exception as e:
                    logger.warning("Artsy search failed", term=term, error=str(e))

    logger.info(f"Artsy: {len(lots)} lots fetched")
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
                                market_type="primary",
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
