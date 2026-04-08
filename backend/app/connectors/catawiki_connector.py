"""
Catawiki Connector
Fetches art lots from Catawiki's public buyer API.
No API key required — uses public JSON endpoints.
"""
import asyncio
import httpx
from datetime import datetime
from typing import List, Optional
import structlog

from app.models.schemas import LotNormalized, AuctionHouseEnum

logger = structlog.get_logger().bind(connector="catawiki")

BASE_URL = "https://www.catawiki.com"
API_URL = f"{BASE_URL}/buyer/api/v1/lots"

# Art category IDs on Catawiki
ART_CATEGORY_IDS = [
    1,    # Art (root)
    27,   # Paintings
    28,   # Drawings & Watercolours
    29,   # Prints & Multiples
    30,   # Photographs
    31,   # Sculptures
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
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

        currency = str(item.get("currency") or "EUR").upper()

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
            source=AuctionHouseEnum.OTHER,
            title=title[:500],
            artist_name_raw=artist,
            description=(item.get("description") or "")[:1000] or None,
            lot_number=str(item.get("lot_number") or ""),
            category=category,
            estimate_low=est_low,
            estimate_high=est_high,
            current_price=current_price,
            currency=currency,
            auction_date=auction_date,
            auction_house_name="Catawiki",
            url=lot_url,
            image_url=image_url,
            raw_data={
                "real": True,
                "source": "catawiki",
                "lot_id": str(lot_id),
                "scraped_at": datetime.utcnow().isoformat(),
            },
        )
    except Exception as e:
        logger.debug("Parse error", error=str(e))
        return None


async def fetch_lots(limit: int = 80) -> List[LotNormalized]:
    """Fetch art lots from Catawiki public API. No key required."""
    all_lots: List[LotNormalized] = []
    seen_ids: set = set()

    async with httpx.AsyncClient(headers=HEADERS, timeout=20.0, follow_redirects=True) as client:
        for cat_id in ART_CATEGORY_IDS:
            if len(all_lots) >= limit:
                break
            try:
                resp = await client.get(API_URL, params={
                    "category_id": cat_id,
                    "status": "open",
                    "per_page": min(50, limit - len(all_lots)),
                    "sort": "end_date_asc",
                    "page": 1,
                })

                if resp.status_code == 200:
                    data = resp.json()
                    items = data.get("lots") or data.get("data") or data.get("results") or []
                    if isinstance(data, list):
                        items = data

                    for item in items:
                        lot = _parse_lot(item)
                        if lot and lot.url and lot.external_id not in seen_ids:
                            seen_ids.add(lot.external_id)
                            all_lots.append(lot)
                else:
                    logger.warning("Catawiki API non-200", status=resp.status_code, category_id=cat_id)

                await asyncio.sleep(0.5)

            except httpx.TimeoutException:
                logger.warning("Timeout", category_id=cat_id)
            except Exception as e:
                logger.warning("Fetch error", category_id=cat_id, error=str(e))

    logger.info("Catawiki", lots_found=len(all_lots))
    return all_lots[:limit]
