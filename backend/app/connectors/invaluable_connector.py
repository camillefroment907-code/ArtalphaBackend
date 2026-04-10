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
    "fine art",
    "oil painting",
    "contemporary art",
    "modern art",
    "impressionist",
    "abstract",
    "acrylic",
    "mixed media",
    "painting",
    "artwork",
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.invaluable.com/search/",
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
    """Upgrade thumbnail URLs to higher resolution on Invaluable CDN."""
    if not url:
        return url
    for low_res, high_res in [
        # Invaluable CDN: _thz = thumbnail → _lrg = large
        ("_thz.", "_lrg."),
        ("_sml.", "_lrg."),
        ("_med.", "_lrg."),
        # Generic patterns
        ("/thumb/", "/large/"),
        ("/thumbnail/", "/large/"),
        ("_thumb.", "_large."),
        ("_thumbnail.", "_large."),
        ("size=small", "size=large"),
        ("size=thumb", "size=large"),
    ]:
        if low_res in url:
            return url.replace(low_res, high_res)
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


async def fetch_lots(limit: int = 100) -> List[LotNormalized]:
    """Fetch real lots from Invaluable JSON API."""

    lots: List[LotNormalized] = []
    seen: set = set()

    async with httpx.AsyncClient(
        headers=HEADERS, timeout=30.0, follow_redirects=True, verify=False
    ) as client:
        # Prime session cookies — required before API calls work
        try:
            await client.get(f"{BASE_URL}/search/")
            await asyncio.sleep(1.0)
        except Exception:
            pass

        for query in SEARCH_QUERIES:
            if len(lots) >= limit:
                break
            try:
                page_size = min(48, limit - len(lots))
                # Fetch up to 2 pages per query
                for page in range(1, 3):
                    if len(lots) >= limit:
                        break
                    resp = await client.get(
                        API_URL,
                        params={
                            "query": query,
                            "size": page_size,
                            "upcoming": "true",
                            "page": page,
                        },
                    )
                    if resp.status_code != 200:
                        logger.warning("Non-200 response", query=query, status=resp.status_code)
                        break

                    data = resp.json()
                    items = data.get("itemViewList") or []
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
                    await asyncio.sleep(1.5)

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
