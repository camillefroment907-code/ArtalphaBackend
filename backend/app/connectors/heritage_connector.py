"""
Heritage Auctions connector — public JSON API.
One of the largest auction houses globally, strong in fine art.
No API key required for public listings.
"""
import httpx
import structlog
from datetime import datetime
from typing import List, Optional
from app.models.schemas import LotNormalized, AuctionHouseEnum

logger = structlog.get_logger()

BASE_URL = "https://www.ha.com/c/search-results.zx"


async def fetch_lots(limit: int = 100) -> List[LotNormalized]:
    """Fetch upcoming fine art lots from Heritage Auctions public API."""
    lots = []
    try:
        async with httpx.AsyncClient(
            timeout=20,
            headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                "Accept": "application/json, text/javascript, */*",
                "Accept-Language": "en-US,en;q=0.9",
                "Referer": "https://www.ha.com/fine-art-auction.s",
            },
            follow_redirects=True,
        ) as client:

            # Heritage public search API — fine art category
            params = {
                "type": "lot",
                "N": "790+231",   # Fine Art category IDs on Heritage
                "ic3": "1",       # upcoming only
                "Ns": "P_Event_Date|1",
                "No": "0",
                "Nrpp": str(min(limit, 48)),
                "ic4": "1",
                "LotType": "1",
            }

            resp = await client.get(BASE_URL, params=params, timeout=15)
            if resp.status_code != 200:
                # Try alternate endpoint
                alt_params = {
                    "type": "lot",
                    "category": "fine-art",
                    "status": "upcoming",
                    "limit": min(limit, 50),
                }
                resp = await client.get(
                    "https://api.ha.com/v1/lots",
                    params=alt_params,
                    timeout=15,
                )

            if resp.status_code != 200:
                logger.warning("heritage_api_failed", status=resp.status_code)
                return []

            # Try to parse JSON
            try:
                data = resp.json()
            except Exception:
                logger.warning("heritage_not_json")
                return []

            # Handle different response shapes
            items = (
                data.get("lots", []) or
                data.get("results", []) or
                data.get("items", []) or
                data.get("data", []) or
                (data if isinstance(data, list) else [])
            )

            for item in items[:limit]:
                try:
                    lot = _parse_lot(item)
                    if lot:
                        lots.append(lot)
                except Exception as e:
                    logger.debug("heritage_parse_error", error=str(e))
                    continue

    except Exception as e:
        logger.warning("heritage_fetch_failed", error=str(e))

    logger.info("heritage_fetched", count=len(lots))
    return lots


def _parse_lot(item: dict) -> Optional[LotNormalized]:
    """Parse a single Heritage lot into LotNormalized."""
    # ID
    lot_id = (
        str(item.get("lotIdStr") or item.get("lotId") or
            item.get("id") or item.get("lotNumber", ""))
    )
    if not lot_id:
        return None

    # Title
    title = (
        item.get("title") or item.get("description") or
        item.get("lotTitle") or item.get("name", "")
    )
    if not title:
        return None

    # Artist
    artist = (
        item.get("artistName") or item.get("artist") or
        item.get("makerName") or item.get("creator", "")
    )
    if isinstance(artist, dict):
        artist = artist.get("name") or artist.get("displayName", "")

    # Prices
    estimate_low = _parse_price(
        item.get("lowEstimate") or item.get("estimateLow") or
        item.get("lowEst") or item.get("startBid")
    )
    estimate_high = _parse_price(
        item.get("highEstimate") or item.get("estimateHigh") or
        item.get("highEst")
    )
    current_price = _parse_price(
        item.get("currentBid") or item.get("currentPrice") or
        item.get("hammer") or item.get("bidAmount")
    ) or estimate_low

    # Skip if no price at all
    if not current_price and not estimate_low:
        return None

    # Image — Heritage uses imgPath or imageUrl
    image_url = (
        item.get("imageUrl") or item.get("imgPath") or
        item.get("thumbnailUrl") or item.get("image") or
        item.get("primaryImageUrl")
    )
    # Upgrade to HD if thumbnail
    if image_url and "/tn/" in str(image_url):
        image_url = str(image_url).replace("/tn/", "/lg/")
    if image_url and "tn_" in str(image_url):
        image_url = str(image_url).replace("tn_", "")

    # URL
    url = item.get("url") or item.get("lotUrl") or item.get("detailUrl")
    if not url and lot_id:
        url = f"https://www.ha.com/itm/{lot_id}"

    # Auction date
    auction_date = None
    for date_field in ["endDate", "saleDate", "auctionDate", "eventDate", "endTime"]:
        raw_date = item.get(date_field)
        if raw_date:
            try:
                auction_date = datetime.fromisoformat(str(raw_date)[:19])
                break
            except Exception:
                pass

    # Category
    category = (
        item.get("category") or item.get("categoryName") or
        item.get("primaryCategory") or "Fine Art"
    )

    # Sale/auction name
    sale_name = (
        item.get("saleName") or item.get("auctionName") or
        item.get("eventName") or "Heritage Auctions"
    )
    auction_house = f"Heritage Auctions: {sale_name}" if sale_name != "Heritage Auctions" else "Heritage Auctions"

    return LotNormalized(
        external_id=f"heritage-{lot_id}",
        source=AuctionHouseEnum.HERITAGE,
        title=str(title)[:500],
        artist_name_raw=str(artist)[:500] if artist else None,
        estimate_low=estimate_low,
        estimate_high=estimate_high,
        current_price=current_price,
        currency="USD",
        auction_date=auction_date,
        auction_house_name=auction_house[:300],
        image_url=str(image_url) if image_url else None,
        url=str(url) if url else None,
        category=str(category)[:200] if category else "Fine Art",
        medium=item.get("medium") or item.get("materials"),
        raw_data={
            "id": lot_id,
            "title": str(title)[:200],
        },
    )


def _parse_price(value) -> Optional[float]:
    """Parse price from various formats."""
    if value is None:
        return None
    try:
        clean = str(value).replace(",", "").replace("$", "").replace("€", "").strip()
        if not clean or not any(c.isdigit() for c in clean):
            return None
        return float(clean)
    except Exception:
        return None
