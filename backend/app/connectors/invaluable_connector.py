"""
Invaluable.com Connector
Uses the JSON search API at /api/search — returns structured lot data.
"""
import httpx
import asyncio
from datetime import datetime
from typing import List, Optional
import structlog

from app.models.schemas import LotNormalized, AuctionHouseEnum

logger = structlog.get_logger().bind(connector="invaluable")

BASE_URL = "https://www.invaluable.com"
API_URL = f"{BASE_URL}/api/search"
HOUSE_REPUTATION = 0.78

SEARCH_QUERIES = [
    # Mediums
    "oil on canvas",
    "oil on board",
    "oil on panel",
    "acrylic on canvas",
    "watercolor painting",
    "gouache on paper",
    "pastel drawing",
    "ink drawing",
    "pencil drawing",
    "charcoal drawing",
    "mixed media",
    # Photography
    "photograph print",
    "silver gelatin print",
    "chromogenic print",
    "archival pigment print",
    # Prints & Multiples
    "lithograph signed",
    "etching aquatint",
    "screenprint silkscreen",
    "woodcut print",
    "linocut print",
    # Categories
    "contemporary painting",
    "modern art painting",
    "abstract expressionist",
    "figurative painting",
    "landscape painting",
    "portrait painting",
    "still life painting",
    "street art graffiti",
    "pop art",
    "impressionist painting",
    "surrealist painting",
    "expressionist painting",
    # Sculptures
    "bronze sculpture",
    "marble sculpture",
    "ceramic sculpture",
    # Famous names (high probability of results)
    "andy warhol",
    "picasso",
    "basquiat",
    "banksy",
    "keith haring",
    "david hockney",
    "gerhard richter",
    "damien hirst",
    "yayoi kusama",
    "jeff koons",
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Referer": "https://www.invaluable.com/catalog/",
    "sec-ch-ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"macOS"',
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
}


def _safe_float(val) -> Optional[float]:
    if val is None or val == 0:
        return None
    try:
        return float(str(val).replace(",", "").strip())
    except (ValueError, TypeError):
        return None


def _safe_date(ms_timestamp) -> Optional[datetime]:
    if not ms_timestamp:
        return None
    try:
        ts = int(ms_timestamp)
        # milliseconds if > 1e10
        return datetime.fromtimestamp(ts / 1000 if ts > 1e10 else ts)
    except Exception:
        return None


def _extract_image_url(photos: list) -> Optional[str]:
    """Extract highest quality image URL from Invaluable photos array."""
    if not photos:
        return None
    photo = photos[0] if photos else {}
    links = photo.get("_links", photo.get("links", {}))
    # Priority: large > medium > small > thumbnail
    for size in ["large", "medium", "small", "thumbnail"]:
        url = links.get(size, {}).get("href") or links.get(size, {}).get("url")
        if url and url.startswith("http"):
            return url
    # Fallback: direct url field
    for field in ["url", "src", "href", "imageUrl", "image_url"]:
        if photo.get(field) and str(photo[field]).startswith("http"):
            return str(photo[field])
    return None


def _upgrade_image_quality(url: str) -> str:
    """Return URL as-is — Invaluable CDN only serves _thz variant reliably."""
    return url


def _parse_item(item: dict) -> Optional[LotNormalized]:
    try:
        ref = item.get("ref")
        if not ref:
            return None

        title = str(item.get("title") or "").strip()
        if not title or len(title) < 3:
            return None

        # Image — prefer high-res
        photos = item.get("photos") or []
        raw_image_url = _extract_image_url(photos) if isinstance(photos, list) else None
        image_url = _upgrade_image_quality(raw_image_url) if raw_image_url else None

        # Lot URL — invaluable provides a full URL
        lot_url = item.get("url") or f"{BASE_URL}/auction-lot/_{ref}/"
        if lot_url and not lot_url.startswith("http"):
            lot_url = BASE_URL + lot_url

        # Estimates and price
        est_low = _safe_float(item.get("estimateLow"))
        est_high = _safe_float(item.get("estimateHigh"))
        # priceResult is the hammer price (> 0 when sold), price is current/starting bid
        price_result = _safe_float(item.get("priceResult"))
        current_price = price_result or _safe_float(item.get("price")) or est_low

        currency = str(item.get("currency") or "USD").upper()

        # Auction house — skip known non-art houses at source
        seller = item.get("sellerView") or {}
        house_name = str(seller.get("sellerName") or "Invaluable")
        if any(blocked in house_name.lower() for blocked in ["adam's", "adams"]):
            return None

        # Category
        categories = item.get("categories") or []
        category = None
        if isinstance(categories, list) and categories:
            category = categories[0].get("name") if isinstance(categories[0], dict) else None

        # Date — eventDate is milliseconds
        auction_date = _safe_date(item.get("eventDate") or item.get("eventLocalDate"))

        lot_number = str(item.get("lotNumber") or item.get("lotNumberExtension") or "")
        description = str(item.get("description") or "").strip() or None

        # Set auction_date to None if in the past — past lots have no "upcoming" date
        from datetime import timezone as _tz
        if auction_date and auction_date.replace(tzinfo=_tz.utc if auction_date.tzinfo else None) < datetime.now():
            auction_date = None

        return LotNormalized(
            external_id=f"inv-{ref}",
            source=AuctionHouseEnum.INVALUABLE,
            title=title[:500],
            description=description[:1000] if description else None,
            lot_number=lot_number or None,
            category=category,
            estimate_low=est_low,
            estimate_high=est_high,
            current_price=current_price,
            currency=currency,
            auction_date=auction_date,
            auction_house_name=house_name[:300],
            url=lot_url,
            image_url=image_url,
            raw_data={"real": True, "source": "invaluable", "ref": ref},
        )
    except Exception as e:
        logger.debug("parse error", error=str(e))
        return None


async def fetch_past_lots(limit: int = 5000) -> List[LotNormalized]:
    """
    Fetch PAST sold lots from Invaluable — different external_ids from upcoming lots.
    Uses upcoming=false to get historical auction results going back 2 years.
    These lots are stored permanently (auction_date=None, won't be purged).
    """
    lots: List[LotNormalized] = []
    seen: set = set()

    async with httpx.AsyncClient(
        headers=HEADERS, timeout=30.0, follow_redirects=True, verify=False
    ) as client:
        try:
            await client.get(f"{BASE_URL}/catalog/", timeout=10)
            await asyncio.sleep(1.0)
        except Exception:
            pass

        _consecutive_failures = 0

        for query in SEARCH_QUERIES:
            if len(lots) >= limit:
                break
            if _consecutive_failures >= 3:
                logger.warning("invaluable_past_blocked_globally", failures=_consecutive_failures)
                break
            try:
                page_size = min(48, limit - len(lots))
                for page in range(1, 21):
                    if len(lots) >= limit:
                        break

                    resp = None
                    for api_url, params in [
                        (API_URL, {
                            "query": query,
                            "size": page_size,
                            "upcoming": "false",
                            "page": page,
                            "sort": "date_sold:desc",
                        }),
                        (API_URL, {
                            "query": query,
                            "size": page_size,
                            "upcoming": "false",
                            "page": page,
                        }),
                    ]:
                        resp = await client.get(api_url, params=params)
                        if resp.status_code == 200:
                            _consecutive_failures = 0
                            break

                    if resp is None or resp.status_code != 200:
                        _consecutive_failures += 1
                        break

                    try:
                        data = resp.json()
                    except Exception:
                        break

                    items = (
                        data.get("itemViewList")
                        or data.get("results")
                        or data.get("lots")
                        or data.get("items")
                        or []
                    )

                    if not items and page == 1:
                        logger.warning("invaluable_past_empty", query=query,
                                       keys=list(data.keys())[:8])

                    batch = 0
                    for entry in items:
                        item_view = entry.get("itemView") or entry
                        lot = _parse_item(item_view)
                        if lot and lot.external_id not in seen:
                            seen.add(lot.external_id)
                            lots.append(lot)
                            batch += 1
                            if len(lots) >= limit:
                                break

                    logger.info("Invaluable past query done", query=query, page=page, batch=batch, total=len(lots))
                    if batch > 0:
                        await asyncio.sleep(1.5)
                    else:
                        await asyncio.sleep(0.2)

                    if len(items) < page_size:
                        break

            except Exception as e:
                logger.warning("Invaluable past query failed", query=query, error=str(e))

    logger.info("Invaluable past: fetched lots", count=len(lots))
    return lots[:limit]


async def fetch_lots(limit: int = 5000) -> List[LotNormalized]:
    """Fetch real lots from Invaluable JSON API."""
    return []  # temporarily disabled

    lots: List[LotNormalized] = []
    seen: set = set()

    async with httpx.AsyncClient(
        headers=HEADERS, timeout=30.0, follow_redirects=True, verify=False
    ) as client:
        # Prime session cookies with catalog page (more natural than /search/)
        try:
            await client.get(f"{BASE_URL}/catalog/", timeout=10)
            await asyncio.sleep(1.5)
        except Exception:
            pass

        _consecutive_failures = 0  # abort early if API is globally blocked

        for query in SEARCH_QUERIES:
            if len(lots) >= limit:
                break
            if _consecutive_failures >= 3:
                # API is returning non-200 for multiple queries in a row — give up
                logger.warning("invaluable_blocked_globally", failures=_consecutive_failures)
                break
            try:
                page_size = min(48, limit - len(lots))
                # Fetch up to 20 pages per query
                for page in range(1, 21):
                    if len(lots) >= limit:
                        break

                    # Try both API endpoint variants (Invaluable has changed structure)
                    resp = None
                    for api_url, params in [
                        (API_URL, {
                            "query": query,
                            "size": page_size,
                            "upcoming": "true",
                            "page": page,
                            "sort": "upcoming",
                        }),
                        (f"{BASE_URL}/search/", {
                            "query": query,
                            "supercategoryName": "Fine+Art",
                            "upcoming": "true",
                        }),
                    ]:
                        resp = await client.get(api_url, params=params)
                        if resp.status_code == 200:
                            _consecutive_failures = 0
                            break
                    if resp is None or resp.status_code != 200:
                        logger.warning("invaluable_all_endpoints_failed", query=query,
                                       status=resp.status_code if resp else 0)
                        _consecutive_failures += 1
                        break  # move to next query, don't paginate further

                    try:
                        data = resp.json()
                    except Exception:
                        logger.warning("invaluable_non_json", query=query, snippet=resp.text[:100])
                        break

                    # Support multiple response shapes Invaluable has used
                    items = (
                        data.get("itemViewList")
                        or data.get("results")
                        or data.get("lots")
                        or data.get("items")
                        or []
                    )

                    # Log first response structure for debugging
                    if not items and page == 1:
                        logger.warning("invaluable_empty_response", query=query,
                                       keys=list(data.keys())[:8], status=resp.status_code)

                    batch = 0
                    for entry in items:
                        item_view = entry.get("itemView") or entry
                        lot = _parse_item(item_view)
                        if lot and lot.external_id not in seen:
                            seen.add(lot.external_id)
                            lots.append(lot)
                            batch += 1
                            if len(lots) >= limit:
                                break

                    logger.info("Invaluable query done", query=query, page=page, batch=batch, total=len(lots))
                    # Only sleep if we got results (avoid wasting time on empty pages)
                    if batch > 0:
                        await asyncio.sleep(1.5)
                    else:
                        await asyncio.sleep(0.2)

                    # Stop paginating if we got fewer results than requested
                    if len(items) < page_size:
                        break

            except Exception as e:
                logger.warning("Query failed", query=query, error=str(e))

    logger.info("Invaluable: fetched real lots", count=len(lots))
    return lots[:limit]


CONNECTOR_META = {
    "name": "Invaluable",
    "source": AuctionHouseEnum.INVALUABLE,
    "house_reputation_score": HOUSE_REPUTATION,
    "currency": "MULTI",
    "country": "INTL",
    "supports_real_time": True,
    "poll_interval_minutes": 10,
}
