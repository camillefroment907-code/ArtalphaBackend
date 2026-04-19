"""
LiveAuctioneers connector — no API key required.
Uses the internal search API with browser headers.
Returns [] silently if the API is unreachable.
"""
import asyncio
import httpx
import re
import json
from datetime import datetime
from typing import List, Optional
import structlog

from app.models.schemas import LotNormalized, AuctionHouseEnum

logger = structlog.get_logger().bind(connector="liveauctioneers")

SEARCH_API_URL = "https://api.liveauctioneers.com/search/"
CATALOG_API_URL = "https://api.liveauctioneers.com/search/lots"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9,fr;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Referer": "https://www.liveauctioneers.com/",
    "Origin": "https://www.liveauctioneers.com",
    "sec-ch-ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"macOS"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",
    "Connection": "keep-alive",
}

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
    "contemporary art",
    "impressionist",
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
            return datetime.fromtimestamp(val / 1000 if val > 1e10 else val)
        s = str(val).strip().replace("Z", "").replace("+00:00", "")
        for fmt in [
            "%Y-%m-%dT%H:%M:%S.%f",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d",
        ]:
            try:
                return datetime.strptime(s[:19], fmt)
            except ValueError:
                continue
    except Exception:
        pass
    return None


def _extract_image(item: dict) -> Optional[str]:
    for field in ["photo_path", "photoPath", "thumbnail", "image_url", "imageUrl", "photo", "img"]:
        val = item.get(field)
        if val and isinstance(val, str) and val.startswith("http"):
            return val

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
    try:
        item_id = (
            item.get("item_id") or item.get("id") or item.get("lotId")
            or item.get("lot_id") or item.get("itemId")
        )
        if not item_id:
            return None

        title = (
            item.get("title") or item.get("lot_title") or item.get("lotTitle")
            or item.get("name") or item.get("description") or ""
        ).strip()
        if not title or len(title) < 3:
            return None

        artist = (
            item.get("artist") or item.get("artist_name") or item.get("artistName")
            or item.get("creator") or item.get("maker") or ""
        )
        if isinstance(artist, dict):
            artist = artist.get("name") or artist.get("displayName") or ""
        artist = str(artist).strip() or None

        est_low = _safe_float(
            item.get("low_estimate") or item.get("estimate_low") or item.get("lowEstimate")
            or item.get("starting_bid") or item.get("startingBid") or item.get("price_low")
        )
        est_high = _safe_float(
            item.get("high_estimate") or item.get("estimate_high") or item.get("highEstimate")
            or item.get("price_high")
        )
        current_price = _safe_float(
            item.get("price") or item.get("current_bid") or item.get("currentBid")
            or item.get("hammer_price") or item.get("hammerPrice")
        ) or est_low

        currency = (
            item.get("currency") or item.get("currency_code") or item.get("currencyCode") or "USD"
        ).upper()

        auction_date = _safe_date(
            item.get("date_end") or item.get("auction_date") or item.get("auctionDate")
            or item.get("end_time") or item.get("saleDate") or item.get("date")
        )

        house_name = (
            item.get("auctionhouse_name") or item.get("auction_house")
            or item.get("auctionHouseName") or item.get("house_name")
            or item.get("houseName") or "Live Auctioneers"
        )

        return LotNormalized(
            external_id=f"liveauctioneers-{item_id}",
            source=AuctionHouseEnum.OTHER,
            title=title[:500],
            artist_name_raw=artist,
            estimate_low=est_low,
            estimate_high=est_high,
            current_price=current_price,
            currency=currency,
            auction_date=auction_date,
            auction_house_name=str(house_name)[:300],
            url=f"https://www.liveauctioneers.com/item/{item_id}/",
            image_url=_extract_image(item),
            category=item.get("category") or item.get("categoryName"),
            medium=item.get("medium") or item.get("technique"),
            raw_data={"source": "liveauctioneers", "item_id": str(item_id)},
        )
    except Exception as e:
        logger.debug("parse_error", error=str(e))
        return None


def _extract_items_from_response(data) -> list:
    """Flexible extraction — handles multiple response shapes."""
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for key in ["items", "results", "lots", "data", "hits", "records"]:
            v = data.get(key)
            if isinstance(v, list):
                return v
        # Nested: {"search": {"items": [...]}}
        for key in ["search", "response", "payload"]:
            v = data.get(key)
            if isinstance(v, dict):
                for sub in ["items", "results", "lots", "data", "hits"]:
                    sv = v.get(sub)
                    if isinstance(sv, list):
                        return sv
    return []


async def _try_search_api(client: httpx.AsyncClient, query: str, rows: int) -> list:
    """Hit the internal search API — no auth required."""
    try:
        resp = await client.get(
            SEARCH_API_URL,
            params={
                "keyword": query,
                "rows": rows,
                "status": "upcoming",
                "sort": "date_asc",
                "page": 1,
            },
        )
        if resp.status_code == 200:
            return _extract_items_from_response(resp.json())
        # Try alternate endpoint
        resp2 = await client.get(
            CATALOG_API_URL,
            params={
                "keyword": query,
                "limit": rows,
                "upcoming": "true",
            },
        )
        if resp2.status_code == 200:
            return _extract_items_from_response(resp2.json())
    except Exception as e:
        logger.debug("search_api_error", query=query, error=str(e))
    return []


async def fetch_lots(limit: int = 500) -> List[LotNormalized]:
    """
    Fetch upcoming art lots from LiveAuctioneers.
    No API key required — uses internal API with browser headers.
    """
    lots: List[LotNormalized] = []
    seen: set = set()
    rows_per_query = max(20, min(50, limit // len(SEARCH_QUERIES)))

    try:
        async with httpx.AsyncClient(
            headers=HEADERS,
            timeout=30.0,
            follow_redirects=True,
            verify=False,
        ) as client:
            for query in SEARCH_QUERIES:
                if len(lots) >= limit:
                    break
                items = await _try_search_api(client, query, rows_per_query)
                added = 0
                for item in items:
                    parsed = _parse_lot(item)
                    if parsed and parsed.external_id not in seen:
                        seen.add(parsed.external_id)
                        lots.append(parsed)
                        added += 1
                if added:
                    logger.debug("query_done", query=query, added=added)
                await asyncio.sleep(0.5)

    except Exception as e:
        logger.warning("connector_failed", error=str(e))

    logger.info("fetched", count=len(lots))
    return lots[:limit]
