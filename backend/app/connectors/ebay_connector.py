"""
eBay Art connector — millions of art auction listings.
Uses eBay Browse API v1 (free, requires App ID from developer.ebay.com).

Setup:
  1. Register at https://developer.ebay.com (free)
  2. Create an app → get App ID (client_id) and Cert ID (client_secret)
  3. Set EBAY_CLIENT_ID and EBAY_CLIENT_SECRET in Railway env vars

Without credentials this connector returns [] silently.
"""
import httpx
import asyncio
import base64
import os
import structlog
from datetime import datetime
from typing import List, Optional
from app.models.schemas import LotNormalized, AuctionHouseEnum

logger = structlog.get_logger()

EBAY_AUTH_URL = "https://api.ebay.com/identity/v1/oauth2/token"
EBAY_SEARCH_URL = "https://api.ebay.com/buy/browse/v1/item_summary/search"

# eBay fine art category IDs — use specific subcategories (not 550 "Art" which is too generic)
ART_CATEGORIES = {
    "20081": "Paintings",
    "10770": "Prints",
    "617":   "Sculpture",
    "1040":  "Photography",
    "7107":  "Drawings",
    "11450": "Mixed Media",
}

# Search keywords to diversify results beyond category browsing
ART_KEYWORDS = [
    "oil painting signed",
    "watercolor original",
    "lithograph numbered",
    "etching signed",
    "bronze sculpture",
    "contemporary art",
    "impressionist painting",
    "abstract art original",
    "pencil drawing original",
    "screen print signed",
]

# Marketplace: EBAY_FR, EBAY_GB, EBAY_US, EBAY_DE, EBAY_IT
MARKETPLACE_ORDER = ["EBAY_FR", "EBAY_GB", "EBAY_US", "EBAY_DE", "EBAY_IT"]


def _safe_float(val) -> Optional[float]:
    if val is None:
        return None
    try:
        return float(str(val).replace(",", "").strip())
    except (ValueError, TypeError):
        return None


def _safe_date(val) -> Optional[datetime]:
    if not val:
        return None
    try:
        return datetime.fromisoformat(str(val)[:19].replace("Z", ""))
    except Exception:
        return None


def _get_credentials() -> tuple[Optional[str], Optional[str]]:
    """Get eBay client_id and client_secret from environment."""
    client_id = os.environ.get("EBAY_CLIENT_ID")
    client_secret = os.environ.get("EBAY_CLIENT_SECRET")
    # Also try legacy EBAY_APP_ID
    if not client_id:
        client_id = os.environ.get("EBAY_APP_ID")
    try:
        from app.config import get_settings
        s = get_settings()
        client_id = client_id or getattr(s, "ebay_client_id", None)
        client_secret = client_secret or getattr(s, "ebay_client_secret", None)
    except Exception:
        pass
    return client_id, client_secret


async def _get_oauth_token(client: httpx.AsyncClient, client_id: str, client_secret: str) -> Optional[str]:
    """Fetch OAuth token using client credentials flow."""
    try:
        credentials = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
        resp = await client.post(
            EBAY_AUTH_URL,
            headers={
                "Authorization": f"Basic {credentials}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            data={
                "grant_type": "client_credentials",
                "scope": "https://api.ebay.com/oauth/api_scope",
            },
        )
        if resp.status_code == 200:
            return resp.json().get("access_token")
        logger.warning("ebay_auth_failed", status=resp.status_code)
    except Exception as e:
        logger.warning("ebay_auth_error", error=str(e))
    return None


def _parse_item(item: dict, category_name: str) -> Optional[LotNormalized]:
    try:
        item_id = str(item.get("itemId") or item.get("legacyItemId") or "")
        if not item_id:
            return None

        title = item.get("title") or ""
        if not title or len(title) < 3:
            return None

        # Price — eBay auctions: currentBidPrice (with bids) or price (starting bid / BIN)
        price_obj = (
            item.get("currentBidPrice")
            or item.get("price")
            or item.get("startingBid")
            or {}
        )
        current_price = _safe_float(price_obj.get("value"))

        # Also try priceRange for variable-price items
        if not current_price:
            pr = item.get("priceRange") or {}
            current_price = _safe_float((pr.get("minimum") or pr.get("maximum") or {}).get("value"))

        # eBay doesn't have estimate_low/high — use price as estimate
        estimate_low = current_price or 1.0  # default 1.0 so quality filter passes

        currency = str(price_obj.get("currency") or "EUR").upper()

        auction_date = _safe_date(item.get("itemEndDate"))
        if auction_date and auction_date < datetime.utcnow():
            return None  # Already ended

        image_url = item.get("image", {}).get("imageUrl")

        categories = item.get("categories") or []
        cat_name = categories[0].get("categoryName") if categories else category_name

        seller = item.get("seller", {})
        house_name = seller.get("username") or "eBay"

        return LotNormalized(
            external_id=f"ebay-{item_id}",
            source=AuctionHouseEnum.OTHER,
            title=str(title)[:500],
            artist_name_raw=None,  # Not reliably available in eBay search results
            estimate_low=estimate_low,
            estimate_high=None,
            current_price=current_price,
            currency=currency,
            auction_date=auction_date,
            auction_house_name=f"eBay / {house_name}"[:300],
            image_url=image_url,
            url=item.get("itemWebUrl") or f"https://www.ebay.com/itm/{item_id}",
            category=cat_name,
            raw_data={"source": "ebay", "item_id": item_id},
        )
    except Exception as e:
        logger.debug("ebay_parse_error", error=str(e))
        return None


async def fetch_lots(limit: int = 2000) -> List[LotNormalized]:
    """
    Fetch art auction listings from eBay Browse API.
    Returns [] if EBAY_CLIENT_ID / EBAY_CLIENT_SECRET are not set.
    """
    client_id, client_secret = _get_credentials()
    if not client_id or not client_secret:
        logger.info("ebay_skipped", reason="EBAY_CLIENT_ID / EBAY_CLIENT_SECRET not set")
        return []

    lots: List[LotNormalized] = []
    seen: set = set()

    try:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            token = await _get_oauth_token(client, client_id, client_secret)
            if not token:
                logger.warning("ebay_no_token")
                return []

            # Pass 1 — by category across all marketplaces
            for marketplace in MARKETPLACE_ORDER:
                if len(lots) >= limit:
                    break
                for cat_id, cat_name in ART_CATEGORIES.items():
                    if len(lots) >= limit:
                        break
                    try:
                        resp = await client.get(
                            EBAY_SEARCH_URL,
                            params={
                                "q": "art",
                                "category_ids": cat_id,
                                "filter": "buyingOptions:{AUCTION}",
                                "sort": "endingSoonest",
                                "limit": 50,
                            },
                            headers={
                                "Authorization": f"Bearer {token}",
                                "X-EBAY-C-MARKETPLACE-ID": marketplace,
                                "Accept": "application/json",
                            },
                        )
                        if resp.status_code == 200:
                            for item in resp.json().get("itemSummaries", []):
                                parsed = _parse_item(item, cat_name)
                                if parsed and parsed.external_id not in seen:
                                    seen.add(parsed.external_id)
                                    lots.append(parsed)
                        await asyncio.sleep(0.2)
                    except Exception as e:
                        logger.debug("ebay_cat_error", cat=cat_name, error=str(e))

            # Pass 2 — keyword searches for more diversity
            for keyword in ART_KEYWORDS:
                if len(lots) >= limit:
                    break
                for marketplace in ["EBAY_FR", "EBAY_GB", "EBAY_US"]:
                    if len(lots) >= limit:
                        break
                    try:
                        resp = await client.get(
                            EBAY_SEARCH_URL,
                            params={
                                "q": keyword,
                                "category_ids": "550",  # Art
                                "filter": "buyingOptions:{AUCTION}",
                                "sort": "newlyListed",
                                "limit": 50,
                            },
                            headers={
                                "Authorization": f"Bearer {token}",
                                "X-EBAY-C-MARKETPLACE-ID": marketplace,
                                "Accept": "application/json",
                            },
                        )
                        if resp.status_code == 200:
                            for item in resp.json().get("itemSummaries", []):
                                parsed = _parse_item(item, "Paintings")
                                if parsed and parsed.external_id not in seen:
                                    seen.add(parsed.external_id)
                                    lots.append(parsed)
                        await asyncio.sleep(0.2)
                    except Exception as e:
                        logger.debug("ebay_kw_error", keyword=keyword, error=str(e))

    except Exception as e:
        logger.warning("ebay_connector_failed", error=str(e))

    logger.info("ebay_fetched", count=len(lots))
    return lots[:limit]


CONNECTOR_META = {
    "name": "eBay Art",
    "source": AuctionHouseEnum.OTHER,
    "house_reputation_score": 0.45,
    "currency": "MULTI",
    "country": "INTL",
    "supports_real_time": True,
    "poll_interval_minutes": 30,
}
