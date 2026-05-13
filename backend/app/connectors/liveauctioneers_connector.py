"""
LiveAuctioneers connector — uses the internal search-party API.
No API key required. The search endpoint is the same one the website frontend calls.
Returns [] silently if unreachable.
"""
import asyncio
from datetime import datetime
from typing import List, Optional
import httpx
import structlog

from app.models.schemas import LotNormalized, AuctionHouseEnum

logger = structlog.get_logger().bind(connector="liveauctioneers")

# Internal search API used by the LiveAuctioneers frontend
SEARCH_URL = "https://search-party-prod.liveauctioneers.com/search/v4/web"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9,fr;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Referer": "https://www.liveauctioneers.com/",
    "Origin": "https://www.liveauctioneers.com",
    "sec-ch-ua": '"Chromium";v="124", "Google Chrome";v="124"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"macOS"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",
}

# Fine Art category ID on LiveAuctioneers (id=1 = "Art", 127k+ lots)
ART_CATEGORY_ID = 1

# Art-specific search keywords — each fetches multiple pages
ART_QUERIES = [
    "oil painting",
    "watercolor",
    "acrylic painting",
    "sculpture",
    "lithograph print",
    "etching",
    "drawing",
    "bronze",
    "photograph",
    "pastel",
    "gouache",
    "screenprint",
    "silkscreen",
]

# Titles that typically indicate non-art lots — skip these
NON_ART_KEYWORDS = {
    "coin", "stamp", "philatelic", "comic book", "trading card", "baseball card",
    "action figure", "toy train", "banknote", "currency note", "gold coin", "silver coin",
}

# Auction houses we want to sweep completely (all their open lots, not just keyword matches).
# The sweep uses sellerId once discovered from keyword results or a dedicated name search.
FEATURED_HOUSES = [
    "swanley",
]


def _is_art(title: str) -> bool:
    """Heuristic: exclude obvious non-art lots by title keywords."""
    t = title.lower()
    return not any(kw in t for kw in NON_ART_KEYWORDS)


def _safe_float(val) -> Optional[float]:
    if val is None or val == 0:
        return None
    try:
        return float(str(val).replace(",", "").strip())
    except (ValueError, TypeError):
        return None


def _query_to_category(query: str) -> Optional[str]:
    """Map a search keyword to a normalized category label."""
    q = query.lower()
    if any(x in q for x in ["oil", "acrylic", "watercolor", "watercolour", "gouache", "pastel"]):
        return "Paintings"
    if any(x in q for x in ["drawing", "etching", "aquatint"]):
        return "Drawings"
    if any(x in q for x in ["lithograph", "screenprint", "silkscreen", "linocut", "print"]):
        return "Prints & Multiples"
    if any(x in q for x in ["sculpture", "bronze"]):
        return "Sculpture"
    if "photograph" in q:
        return "Photography"
    return None


def _parse_lot(item: dict, query: str = "") -> Optional[LotNormalized]:
    """Map a search-party API item to LotNormalized."""
    try:
        item_id = item.get("itemId")
        if not item_id:
            return None

        title = (item.get("title") or item.get("shortDescription") or "").strip()
        if not title or len(title) < 4:
            return None

        if not _is_art(title):
            return None

        seller_id = item.get("sellerId", 0)
        image_version = item.get("imageVersion", 1)
        photos = item.get("photos", [])

        # Image URL — real CDN pattern: /{seller_id}/{catalog_id}/{item_id}_1_x.jpg
        catalog_id = item.get("catalogId")
        if photos and seller_id and catalog_id:
            image_url = (
                f"https://p1.liveauctioneers.com/{seller_id}/{catalog_id}/{item_id}_1_x.jpg"
            )
        else:
            image_url = None

        # Estimates and price
        est_low = _safe_float(item.get("lowBidEstimate"))
        est_high = _safe_float(item.get("highBidEstimate"))
        leading_bid = _safe_float(item.get("leadingBid"))
        start_price = _safe_float(item.get("startPrice"))
        current_price = leading_bid or start_price or est_low

        currency = (item.get("currency") or "USD").upper()

        # Auction date from Unix timestamp (seconds)
        ts = item.get("saleStartTs") or item.get("lotEndTimeEstimatedTs")
        auction_date: Optional[datetime] = None
        if ts and ts > 0:
            try:
                auction_date = datetime.utcfromtimestamp(ts)
            except (OSError, OverflowError, ValueError):
                pass

        auction_house_name = item.get("sellerName") or item.get("catalogTitle") or "LiveAuctioneers"
        sale_title = item.get("catalogTitle")

        lot_number = str(item.get("lotNumber") or item.get("index") or "").strip() or None
        lot_url = f"https://www.liveauctioneers.com/item/{item_id}/"

        # Determine status
        is_sold = item.get("isSold", False)
        lot_performance = "sold" if is_sold else ""

        return LotNormalized(
            external_id=f"la-{item_id}",
            source=AuctionHouseEnum.LIVEAUCTIONEERS,
            title=title[:500],
            artist_name_raw=None,  # not in search results — would need item detail API
            category=_query_to_category(query),
            estimate_low=est_low,
            estimate_high=est_high,
            current_price=current_price,
            currency=currency,
            auction_date=auction_date,
            auction_house_name=auction_house_name[:300],
            auction_sale_title=sale_title,
            lot_number=lot_number,
            url=lot_url,
            image_url=image_url,
            market_type="AUCTION",
            raw_data={
                "source": "liveauctioneers",
                "item_id": str(item_id),
                "seller_id": seller_id,
                "catalog_id": item.get("catalogId"),
                "catalog_status": item.get("catalogStatus"),
                "is_live": item.get("isLiveAuction", False),
                "lot_performance": lot_performance,
                "country": item.get("lotLocationCountryCode"),
            },
        )
    except Exception as e:
        logger.debug("parse_error", error=str(e))
        return None


async def _fetch_page(
    client: httpx.AsyncClient,
    keyword: str,
    page: int,
) -> List[dict]:
    """Fetch a single page from the search-party API."""
    try:
        resp = await client.get(
            SEARCH_URL,
            params={
                "keyword": keyword,
                "status": "open",       # open = upcoming + live auctions
                "rows": 24,             # API max per page
                "page": page,
                "f1": ART_CATEGORY_ID,  # Art category filter
            },
            timeout=20.0,
        )
        if resp.status_code != 200:
            logger.debug("page_error", keyword=keyword, page=page, status=resp.status_code)
            return []
        payload = resp.json().get("payload", {})
        return payload.get("items", [])
    except Exception as e:
        logger.debug("page_fetch_error", keyword=keyword, page=page, error=str(e))
        return []


async def _search_seller_by_name(client: httpx.AsyncClient, house_name: str) -> Optional[int]:
    """
    Search for an auction house by name and return their sellerId.
    Uses the house name as a keyword — the seller name appears in result items.
    """
    try:
        resp = await client.get(
            SEARCH_URL,
            params={"keyword": house_name, "status": "open", "rows": 24, "page": 1},
            timeout=20.0,
        )
        if resp.status_code != 200:
            return None
        items = resp.json().get("payload", {}).get("items", [])
        for item in items:
            seller_name = (item.get("sellerName") or "").lower()
            if house_name.lower() in seller_name:
                return item.get("sellerId")
    except Exception as e:
        logger.debug("seller_search_error", house=house_name, error=str(e))
    return None


async def _fetch_all_seller_lots(
    client: httpx.AsyncClient, seller_id: int, max_lots: int = 500
) -> List[dict]:
    """Fetch ALL open lots from a seller by their sellerId (all pages, no category filter)."""
    items: List[dict] = []
    for page in range(1, 84):  # up to 2000 lots
        try:
            resp = await client.get(
                SEARCH_URL,
                params={
                    "keyword": "",
                    "sellerId": seller_id,
                    "status": "open",
                    "rows": 24,
                    "page": page,
                },
                timeout=20.0,
            )
            if resp.status_code != 200:
                break
            page_items = resp.json().get("payload", {}).get("items", [])
            if not page_items:
                break
            items.extend(page_items)
            if len(items) >= max_lots:
                break
            await asyncio.sleep(0.3)
        except Exception as e:
            logger.debug("seller_fetch_error", seller_id=seller_id, page=page, error=str(e))
            break
    return items


async def fetch_lots(limit: int = 2000) -> List[LotNormalized]:
    """
    Fetch upcoming fine-art lots from LiveAuctioneers.
    Uses the internal search-party API — no authentication required.
    Queries multiple art keywords × multiple pages to maximise coverage.
    Also sweeps FEATURED_HOUSES completely so all their lots appear regardless of title.
    """
    lots: List[LotNormalized] = []
    seen_ids: set = set()
    # Track seller IDs discovered during keyword sweeps
    discovered_sellers: dict[int, str] = {}  # sellerId → sellerName

    # Pages per keyword: spread the budget across all queries
    pages_per_query = max(2, min(10, limit // (len(ART_QUERIES) * 24) + 1))

    try:
        async with httpx.AsyncClient(
            headers=HEADERS,
            timeout=30.0,
            follow_redirects=True,
            verify=False,
        ) as client:
            # ── Keyword sweep ────────────────────────────────────────────────
            for query in ART_QUERIES:
                if len(lots) >= limit:
                    break
                query_added = 0
                for page in range(1, pages_per_query + 1):
                    if len(lots) >= limit:
                        break
                    items = await _fetch_page(client, query, page)
                    if not items:
                        break  # no more pages
                    for item in items:
                        # Track seller IDs for featured house sweeps
                        sid = item.get("sellerId")
                        sname = (item.get("sellerName") or "").lower()
                        if sid and any(h in sname for h in FEATURED_HOUSES):
                            discovered_sellers[sid] = item.get("sellerName", "")
                        parsed = _parse_lot(item, query=query)
                        if parsed and parsed.external_id not in seen_ids:
                            seen_ids.add(parsed.external_id)
                            lots.append(parsed)
                            query_added += 1
                    await asyncio.sleep(0.3)  # polite rate limiting

                logger.debug("query_done", keyword=query, added=query_added, total=len(lots))
                await asyncio.sleep(0.5)

            # ── Featured house complete sweep ─────────────────────────────────
            # For each featured house, discover their sellerId (from keyword
            # results above, or via a name search) and fetch ALL their lots.
            for house in FEATURED_HOUSES:
                # Find seller ID: from keyword results or explicit name search
                seller_id = next(
                    (sid for sid, name in discovered_sellers.items() if house in name.lower()),
                    None,
                )
                if seller_id is None:
                    seller_id = await _search_seller_by_name(client, house)

                if seller_id is None:
                    logger.debug("featured_house_not_found", house=house)
                    continue

                all_items = await _fetch_all_seller_lots(client, seller_id, max_lots=500)
                added = 0
                for item in all_items:
                    parsed = _parse_lot(item, query="")
                    if parsed and parsed.external_id not in seen_ids:
                        seen_ids.add(parsed.external_id)
                        lots.append(parsed)
                        added += 1
                logger.info("featured_house_sweep", house=house, seller_id=seller_id, added=added)

    except Exception as e:
        logger.warning("connector_failed", error=str(e))

    logger.info("fetched", count=len(lots))
    return lots
