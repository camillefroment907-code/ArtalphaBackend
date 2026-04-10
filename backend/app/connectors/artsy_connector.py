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


async def fetch_lots(limit: int = 100) -> List[LotNormalized]:
    """Fetch auction lots from Artsy public API. Handles 401 gracefully."""
    lots: List[LotNormalized] = []
    seen: set = set()

    try:
        async with httpx.AsyncClient(
            timeout=20,
            follow_redirects=True,
            verify=False,
            headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                "Accept": "application/json",
            },
        ) as client:
            endpoints_to_try = [
                f"{BASE_URL}/sales?is_auction=true&live=true&size=50",
                f"{BASE_URL}/artworks?for_sale=true&sort=-created_at&size=50&at_auction=true",
            ]

            for endpoint in endpoints_to_try:
                if len(lots) >= limit:
                    break
                try:
                    resp = await client.get(endpoint, timeout=10)
                    if resp.status_code == 401:
                        logger.warning("artsy_auth_required", endpoint=endpoint)
                        continue
                    if resp.status_code != 200:
                        logger.warning("artsy_endpoint_failed", status=resp.status_code, endpoint=endpoint)
                        continue

                    data = resp.json()
                    items = (
                        data.get("_embedded", {}).get("artworks", [])
                        or data.get("_embedded", {}).get("sales", [])
                        or data.get("results", [])
                        or (data if isinstance(data, list) else [])
                    )

                    if not items:
                        continue

                    for item in items[:limit]:
                        try:
                            artwork_id = item.get("id") or item.get("slug", "")
                            if not artwork_id:
                                continue

                            ext_id = f"artsy-{artwork_id}"
                            if ext_id in seen:
                                continue

                            title = item.get("title", "Untitled")

                            # Artist
                            artist = ""
                            for field in ["artistNames", "artist_names", "artist"]:
                                val = item.get(field)
                                if val:
                                    artist = val if isinstance(val, str) else val.get("name", "")
                                    if artist:
                                        break
                            if not artist:
                                artists = item.get("_embedded", {}).get("artists", [])
                                if artists:
                                    artist = artists[0].get("name", "")

                            # Price
                            price = None
                            for price_field in ["price", "listPrice", "list_price", "internalDisplayPrice"]:
                                val = item.get(price_field, "")
                                if val:
                                    try:
                                        clean = str(val).replace(",", "").replace("$", "").replace("€", "").replace("£", "").strip()
                                        if clean and clean.replace(".", "").isdigit():
                                            price = float(clean)
                                            break
                                    except Exception:
                                        pass

                            # Estimates
                            estimate_low = None
                            estimate_high = None
                            try:
                                if item.get("lowEstimate"):
                                    estimate_low = float(item["lowEstimate"])
                                if item.get("highEstimate"):
                                    estimate_high = float(item["highEstimate"])
                            except Exception:
                                pass

                            # Image
                            image_url = None
                            links = item.get("_links", {})
                            img = links.get("image", {})
                            if img:
                                href = img.get("href", "")
                                for size in ["large", "medium", "square"]:
                                    candidate = href.replace("{image_version}", size)
                                    if candidate.startswith("http"):
                                        image_url = candidate
                                        break
                            if not image_url:
                                thumbnail = links.get("thumbnail", {})
                                image_url = thumbnail.get("href") if thumbnail else None

                            # Sale date
                            auction_date = None
                            for date_field in ["end_at", "start_at", "live_start_at"]:
                                date_str = item.get(date_field)
                                if date_str:
                                    try:
                                        auction_date = datetime.fromisoformat(str(date_str)[:19])
                                        break
                                    except Exception:
                                        pass

                            lot = LotNormalized(
                                external_id=ext_id,
                                source=AuctionHouseEnum.OTHER,
                                title=str(title)[:500],
                                artist_name_raw=str(artist)[:500] if artist else None,
                                estimate_low=estimate_low,
                                estimate_high=estimate_high,
                                current_price=price or estimate_low,
                                currency="USD",
                                auction_date=auction_date,
                                auction_house_name="Artsy",
                                image_url=str(image_url) if image_url else None,
                                url=f"https://www.artsy.net/artwork/{artwork_id}",
                                category=item.get("category") or item.get("medium"),
                                medium=item.get("medium"),
                                raw_data={"real": True, "source": "artsy", "id": artwork_id},
                            )
                            seen.add(ext_id)
                            lots.append(lot)

                        except Exception as e:
                            logger.debug("artsy_lot_parse_error", error=str(e))
                            continue

                    if lots:
                        break  # Got results — stop trying other endpoints

                except Exception as e:
                    logger.warning("artsy_endpoint_error", endpoint=endpoint, error=str(e))
                    continue

    except Exception as e:
        logger.warning("artsy_fetch_failed", error=str(e))

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
