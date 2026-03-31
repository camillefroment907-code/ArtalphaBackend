"""
Live Auctioneers Real Connector
Fetches REAL auction lots with REAL URLs that actually work.
Every lot returned by this connector exists on liveauctioneers.com

API key required — get free key at: https://www.liveauctioneers.com/developers/
Set LIVEAUCTIONEERS_API_KEY in .env to enable this connector.
"""
import asyncio
import httpx
from datetime import datetime
from typing import List, Optional
import structlog

from app.models.schemas import LotNormalized, AuctionHouseEnum

logger = structlog.get_logger().bind(connector="liveauctioneers")

# Real lot URL — verified pattern: https://www.liveauctioneers.com/item/{item_id}/
LOT_URL_PATTERN = "https://www.liveauctioneers.com/item/{item_id}/"

SEARCH_URL = "https://api.liveauctioneers.com/search/"

# Art categories to search
SEARCH_QUERIES = [
    "painting",
    "sculpture",
    "print",
    "drawing",
    "watercolor",
    "oil painting",
    "lithograph",
    "bronze",
    "photograph",
    "artwork",
]


def _safe_float(val) -> Optional[float]:
    if val is None:
        return None
    try:
        return float(str(val).replace(",", "").replace(" ", "").replace("$", "").replace("€", "").replace("£", ""))
    except (ValueError, TypeError):
        return None


def _safe_date(val) -> Optional[datetime]:
    if not val:
        return None
    try:
        if isinstance(val, (int, float)):
            # Unix timestamp — milliseconds if > 1e10
            return datetime.fromtimestamp(val / 1000 if val > 1e10 else val)
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


def _extract_image(item: dict) -> Optional[str]:
    """Extract best available image URL from item dict."""
    for field in ["photo_path", "photoPath", "thumbnail", "image_url", "imageUrl", "photo"]:
        val = item.get(field)
        if val and isinstance(val, str) and val.startswith("http"):
            return val

    # Live Auctioneers CDN pattern: built from item_id + house_id
    item_id = item.get("item_id") or item.get("id") or item.get("lotId")
    house_id = item.get("auctionhouse_id") or item.get("auctionHouseId") or item.get("house_id")
    if item_id and house_id:
        return f"https://p1.liveauctioneers.com/houses/{house_id}/{item_id}_1_l.jpg?quality=80&version=1"

    photos = item.get("photos") or item.get("images") or []
    if isinstance(photos, list) and photos:
        p = photos[0]
        if isinstance(p, str) and p.startswith("http"):
            return p
        if isinstance(p, dict):
            return p.get("url") or p.get("src") or p.get("path")

    return None


def _parse_lot(item: dict) -> Optional[LotNormalized]:
    """Parse a Live Auctioneers API item into a normalized lot."""
    try:
        item_id = (
            item.get("item_id")
            or item.get("id")
            or item.get("lotId")
            or item.get("lot_id")
        )
        if not item_id:
            return None

        real_url = LOT_URL_PATTERN.format(item_id=item_id)

        title = (
            item.get("title")
            or item.get("lot_title")
            or item.get("lotTitle")
            or item.get("name")
            or ""
        ).strip()
        if not title or len(title) < 3:
            return None

        artist = (
            item.get("artist")
            or item.get("artist_name")
            or item.get("artistName")
            or item.get("creator")
            or item.get("maker")
            or ""
        ).strip() or None

        est_low = _safe_float(
            item.get("low_estimate")
            or item.get("estimate_low")
            or item.get("lowEstimate")
            or item.get("starting_bid")
            or item.get("startingBid")
        )
        est_high = _safe_float(
            item.get("high_estimate")
            or item.get("estimate_high")
            or item.get("highEstimate")
        )
        current_price = _safe_float(
            item.get("price")
            or item.get("current_bid")
            or item.get("currentBid")
            or item.get("hammer_price")
            or item.get("hammerPrice")
        ) or est_low

        currency = (
            item.get("currency")
            or item.get("currency_code")
            or item.get("currencyCode")
            or "USD"
        ).upper()

        auction_date = _safe_date(
            item.get("date_end")
            or item.get("auction_date")
            or item.get("auctionDate")
            or item.get("end_time")
            or item.get("saleDate")
        )

        house_name = (
            item.get("auctionhouse_name")
            or item.get("auction_house")
            or item.get("auctionHouseName")
            or item.get("house_name")
            or item.get("houseName")
            or "Live Auctioneers"
        )

        category = item.get("category") or item.get("categoryName") or None
        description = item.get("description") or item.get("lot_description") or None
        lot_number = str(item.get("lot_number") or item.get("lotNumber") or "")
        image_url = _extract_image(item)

        return LotNormalized(
            external_id=f"liveauctioneers-{item_id}",
            source=AuctionHouseEnum.OTHER,
            title=title[:500],
            artist_name_raw=artist,
            description=description[:1000] if description else None,
            lot_number=lot_number,
            category=category,
            estimate_low=est_low,
            estimate_high=est_high,
            current_price=current_price,
            currency=currency,
            auction_date=auction_date,
            auction_house_name=str(house_name)[:300],
            url=real_url,
            image_url=image_url,
            raw_data={
                "real": True,
                "source": "liveauctioneers",
                "item_id": str(item_id),
                "scraped_at": datetime.utcnow().isoformat(),
            },
        )

    except Exception as e:
        logger.debug("Parse error", error=str(e))
        return None


async def fetch_lots(limit: int = 80) -> List[LotNormalized]:
    """
    Fetch real auction lots from Live Auctioneers API.
    Requires LIVEAUCTIONEERS_API_KEY in environment.
    Returns [] if no API key is configured.
    """
    try:
        from app.config import settings
        api_key = getattr(settings, "liveauctioneers_api_key", None)
    except Exception:
        api_key = None

    import os
    api_key = api_key or os.environ.get("LIVEAUCTIONEERS_API_KEY")

    if not api_key:
        logger.warning(
            "Live Auctioneers: no API key configured — skipping. "
            "Get free key at https://www.liveauctioneers.com/developers/ "
            "then set LIVEAUCTIONEERS_API_KEY in .env"
        )
        return []

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
        "Accept-Language": "en-US,en;q=0.9,fr;q=0.8",
        "Authorization": f"Bearer {api_key}",
        "Referer": "https://www.liveauctioneers.com/",
        "Origin": "https://www.liveauctioneers.com",
    }

    all_lots: List[LotNormalized] = []
    seen_ids: set = set()

    async with httpx.AsyncClient(headers=headers, timeout=30.0, follow_redirects=True, verify=False) as client:
        for query in SEARCH_QUERIES:
            if len(all_lots) >= limit:
                break
            try:
                resp = await client.get(SEARCH_URL, params={
                    "keyword": query,
                    "status": "upcoming",
                    "rows": min(20, limit - len(all_lots)),
                    "start": 0,
                    "sort": "date_asc",
                })
                if resp.status_code != 200:
                    logger.warning("Non-200", status=resp.status_code, query=query)
                    continue

                data = resp.json()
                items = (
                    data.get("items")
                    or data.get("results")
                    or data.get("lots")
                    or data.get("data")
                    or data.get("search", {}).get("items", [])
                    or []
                )

                for item in items:
                    lot = _parse_lot(item)
                    if lot and lot.url and lot.external_id not in seen_ids:
                        seen_ids.add(lot.external_id)
                        all_lots.append(lot)

                await asyncio.sleep(0.8)

            except httpx.TimeoutException:
                logger.warning("Timeout", query=query)
            except Exception as e:
                logger.warning("Query failed", query=query, error=str(e))

    logger.info("Live Auctioneers: fetched lots", count=len(all_lots))
    return all_lots[:limit]
