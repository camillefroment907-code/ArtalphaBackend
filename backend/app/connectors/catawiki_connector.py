"""
Catawiki Connector
Fetches art lots from Catawiki's public buyer API.

Catawiki blocks datacenter IPs (Railway, AWS, GCP). To enable from Railway,
set the SCRAPERAPI_KEY environment variable — requests are then routed through
ScraperAPI's residential IP pool (https://scraperapi.com, free tier: 1000 req/mo).
Without the key the connector tries direct access (works from local dev).
"""
import asyncio
import os
from datetime import datetime
from typing import List, Optional
from urllib.parse import urlencode
import httpx
import structlog

from app.models.schemas import LotNormalized, AuctionHouseEnum

logger = structlog.get_logger().bind(connector="catawiki")

BASE_URL = "https://www.catawiki.com"
API_URL = f"{BASE_URL}/buyer/api/v1/lots"

# Optional: residential proxy to bypass Railway datacenter IP block
SCRAPERAPI_KEY = os.getenv("SCRAPERAPI_KEY")
SCRAPERAPI_URL = "https://api.scraperapi.com/"

# Art category IDs on Catawiki
ART_CATEGORY_IDS = [
    27,   # Paintings
    28,   # Drawings & Watercolours
    29,   # Prints & Multiples
    30,   # Photographs
    31,   # Sculptures
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Accept-Language": "en-GB,en;q=0.9,fr;q=0.8",
    "Referer": "https://www.catawiki.com/en/l/art",
    "Origin": "https://www.catawiki.com",
}


def _safe_float(val) -> Optional[float]:
    if val is None:
        return None
    try:
        return float(str(val).replace(",", "").replace(" ", "").strip()) or None
    except (ValueError, TypeError):
        return None


def _safe_date(val) -> Optional[datetime]:
    if not val:
        return None
    try:
        s = str(val).strip().replace("Z", "").replace("+00:00", "")
        for fmt in [
            "%Y-%m-%dT%H:%M:%S.%f",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d",
        ]:
            try:
                return datetime.strptime(s, fmt)
            except ValueError:
                continue
    except Exception:
        pass
    return None


def _parse_lot(item: dict) -> Optional[LotNormalized]:
    try:
        lot_id = item.get("id") or item.get("lot_id")
        if not lot_id:
            return None

        title = (item.get("title") or item.get("name") or "").strip()
        if not title or len(title) < 3:
            return None

        # Skip closed lots
        auction_date = _safe_date(
            item.get("closing_date") or item.get("end_date") or item.get("auction_date")
        )
        if auction_date and auction_date < datetime.utcnow():
            return None

        artist = (
            item.get("maker_name") or item.get("maker") or
            item.get("seller_title") or item.get("artist")
        )
        if isinstance(artist, dict):
            artist = artist.get("name") or artist.get("title")
        artist = str(artist).strip() if artist else None

        est_low = _safe_float(item.get("minimum_bid") or item.get("reserve_price") or item.get("estimate_low"))
        est_high = _safe_float(item.get("estimate_high") or item.get("buy_now_price"))
        current_price = _safe_float(item.get("current_bid") or item.get("minimum_bid"))

        _raw_currency = item.get("currency")
        if not _raw_currency:
            _country = (
                item.get("country")
                or item.get("seller_country")
                or item.get("location_country")
                or (item.get("auction_house", {}).get("country") if isinstance(item.get("auction_house"), dict) else None)
                or (item.get("locale") or "")[:2]
                or ""
            ).upper()
            _currency_by_country = {
                "SE": "SEK", "SWE": "SEK",
                "DK": "DKK", "DNK": "DKK",
                "NO": "NOK", "NOR": "NOK",
                "GB": "GBP", "GBR": "GBP",
                "US": "USD", "USA": "USD",
                "CH": "CHF", "CHE": "CHF",
                "AU": "AUD", "AUS": "AUD",
                "CA": "CAD", "CAN": "CAD",
                "JP": "JPY", "JPN": "JPY",
            }
            _raw_currency = _currency_by_country.get(_country, "EUR")
        currency = _raw_currency.upper()

        # Image URL
        image_url = None
        photos = item.get("photos") or item.get("images") or []
        if isinstance(photos, list) and photos:
            p = photos[0]
            if isinstance(p, str):
                image_url = p
            elif isinstance(p, dict):
                image_url = p.get("large_url") or p.get("url") or p.get("src")
        if not image_url:
            image_url = item.get("photo_url") or item.get("image_url") or item.get("thumbnail_url")

        category = None
        cat = item.get("category") or item.get("category_name")
        if isinstance(cat, dict):
            category = cat.get("name") or cat.get("title")
        elif isinstance(cat, str):
            category = cat

        lot_url = (
            item.get("url") or
            item.get("lot_url") or
            f"{BASE_URL}/en/l/{lot_id}"
        )

        return LotNormalized(
            external_id=f"catawiki-{lot_id}",
            source=AuctionHouseEnum.CATAWIKI,
            title=title[:500],
            artist_name_raw=artist,
            description=(item.get("description") or "")[:1000] or None,
            lot_number=str(item.get("lot_number") or "") or None,
            category=category,
            estimate_low=est_low,
            estimate_high=est_high,
            current_price=current_price,
            currency=currency,
            auction_date=auction_date,
            auction_house_name="Catawiki",
            url=lot_url,
            image_url=image_url,
            market_type="AUCTION",
            raw_data={
                "real": True,
                "source": "catawiki",
                "lot_id": str(lot_id),
                "scraped_at": datetime.utcnow().isoformat(),
            },
        )
    except Exception as e:
        logger.debug("parse_error", error=str(e))
        return None


async def _fetch_category(
    client: httpx.AsyncClient,
    cat_id: int,
    per_page: int,
) -> list:
    """Fetch one category page, routing through ScraperAPI if key is set."""
    params = {
        "category_id": cat_id,
        "status": "open",
        "per_page": per_page,
        "sort": "end_date_asc",
        "page": 1,
    }

    if SCRAPERAPI_KEY:
        # Build the full target URL with query string
        target = f"{API_URL}?{urlencode(params)}"
        resp = await client.get(
            SCRAPERAPI_URL,
            params={
                "api_key": SCRAPERAPI_KEY,
                "url": target,
                "render": "true",       # headless browser — bypasses JS challenges
                "country_code": "nl",   # Netherlands residential IP (Catawiki origin)
                "keep_headers": "true",
            },
            timeout=45.0,
        )
    else:
        resp = await client.get(API_URL, params=params, timeout=20.0)

    if resp.status_code != 200:
        logger.info("catawiki_non200", status=resp.status_code, category_id=cat_id)
        return []

    data = resp.json()
    items = data.get("lots") or data.get("data") or data.get("results") or []
    if isinstance(data, list):
        items = data
    return items


async def fetch_lots(limit: int = 300) -> List[LotNormalized]:
    """
    Fetch upcoming art lots from Catawiki.

    Requires SCRAPERAPI_KEY env var when running from Railway (datacenter IP).
    Falls back to direct connection for local development.
    """
    if not SCRAPERAPI_KEY:
        logger.info("catawiki_no_proxy", note="set SCRAPERAPI_KEY to enable from Railway")

    all_lots: List[LotNormalized] = []
    seen_ids: set = set()

    async with httpx.AsyncClient(
        headers=HEADERS,
        timeout=30.0,
        follow_redirects=True,
        verify=False,
    ) as client:
        for cat_id in ART_CATEGORY_IDS:
            if len(all_lots) >= limit:
                break
            try:
                items = await _fetch_category(
                    client,
                    cat_id,
                    per_page=min(50, limit - len(all_lots)),
                )
                for item in items:
                    lot = _parse_lot(item)
                    if lot and lot.external_id not in seen_ids:
                        seen_ids.add(lot.external_id)
                        all_lots.append(lot)

                await asyncio.sleep(0.5)

            except httpx.TimeoutException:
                logger.warning("catawiki_timeout", category_id=cat_id)
            except Exception as e:
                logger.warning("catawiki_fetch_error", category_id=cat_id, error=str(e))

    logger.info("catawiki_fetched", count=len(all_lots), proxy=bool(SCRAPERAPI_KEY))
    return all_lots[:limit]
