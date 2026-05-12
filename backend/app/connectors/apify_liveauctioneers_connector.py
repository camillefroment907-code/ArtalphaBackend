"""
Apify LiveAuctioneers connector — uses Apify cloud scraping to fetch
LiveAuctioneers lots without requiring a LiveAuctioneers API key.

Setup:
  1. Get APIFY_API_TOKEN from https://console.apify.com/account/integrations
  2. Set APIFY_API_TOKEN in Railway env vars (optionally APIFY_ACTOR_ID)

Default actor: jupri/liveauctioneers-scraper
Without APIFY_API_TOKEN this connector returns [] silently.
"""
import httpx
import asyncio
import os
import structlog
from datetime import datetime
from typing import List, Optional
from app.models.schemas import LotNormalized, AuctionHouseEnum

logger = structlog.get_logger()

APIFY_RUN_SYNC_URL = "https://api.apify.com/v2/acts/{actor_id}/run-sync-get-dataset-items"
DEFAULT_ACTOR_ID = "jupri/liveauctioneers-scraper"

SEARCH_QUERIES = ["painting", "sculpture", "print", "drawing", "watercolor"]


def _get_apify_token() -> Optional[str]:
    token = os.environ.get("APIFY_API_TOKEN")
    if not token:
        try:
            from app.config import get_settings
            token = get_settings().apify_api_token
        except Exception:
            pass
    return token


def _get_actor_id() -> str:
    actor_id = os.environ.get("APIFY_ACTOR_ID")
    if not actor_id:
        try:
            from app.config import get_settings
            actor_id = get_settings().apify_actor_id
        except Exception:
            pass
    return actor_id or DEFAULT_ACTOR_ID


def _safe_float(val) -> Optional[float]:
    if val is None:
        return None
    try:
        return float(str(val).replace(",", "").replace("$", "").replace("€", "").replace("£", "").strip())
    except (ValueError, TypeError):
        return None


def _safe_date(val) -> Optional[datetime]:
    if not val:
        return None
    if isinstance(val, datetime):
        return val
    try:
        s = str(val).strip()
        return datetime.fromisoformat(s[:19].replace("Z", "").replace("+00:00", ""))
    except Exception:
        pass
    try:
        ts = int(val)
        return datetime.fromtimestamp(ts / 1000 if ts > 1e10 else ts)
    except Exception:
        return None


def _parse_item(item: dict) -> Optional[LotNormalized]:
    """Parse a LiveAuctioneers lot item from Apify actor output."""
    try:
        lot_id = str(
            item.get("lotId") or item.get("lot_id") or item.get("id") or
            item.get("itemId") or ""
        )
        if not lot_id:
            return None

        title = (
            item.get("title") or item.get("lotTitle") or
            item.get("lot_title") or item.get("description") or ""
        )
        if not title or len(str(title).strip()) < 3:
            return None

        artist = (
            item.get("artistName") or item.get("artist_name") or
            item.get("artist") or item.get("maker") or ""
        )
        if isinstance(artist, dict):
            artist = artist.get("name") or artist.get("displayName") or ""

        estimate_low = (
            _safe_float(item.get("estimateLow")) or
            _safe_float(item.get("estimate_low")) or
            _safe_float(item.get("low_estimate")) or
            _safe_float(item.get("priceMin")) or
            _safe_float(item.get("price_min"))
        )
        estimate_high = (
            _safe_float(item.get("estimateHigh")) or
            _safe_float(item.get("estimate_high")) or
            _safe_float(item.get("high_estimate")) or
            _safe_float(item.get("priceMax")) or
            _safe_float(item.get("price_max"))
        )
        current_price = (
            _safe_float(item.get("currentBid")) or
            _safe_float(item.get("current_bid")) or
            _safe_float(item.get("currentPrice")) or
            estimate_low
        )

        currency = str(
            item.get("currency") or item.get("currencyCode") or
            item.get("currency_code") or "USD"
        ).upper()

        auction_date = _safe_date(
            item.get("auctionDate") or item.get("auction_date") or
            item.get("endDate") or item.get("end_date") or
            item.get("saleDate") or item.get("date")
        )

        image_url = (
            item.get("imageUrl") or item.get("image_url") or
            item.get("photo") or item.get("thumbnail") or
            item.get("image")
        )
        if isinstance(image_url, dict):
            image_url = image_url.get("url") or image_url.get("src")

        lot_url = (
            item.get("url") or item.get("lotUrl") or item.get("lot_url") or
            f"https://www.liveauctioneers.com/item/{lot_id}/"
        )

        auction_house = (
            item.get("auctionHouse") or item.get("auction_house") or
            item.get("houseName") or item.get("house_name") or "LiveAuctioneers"
        )

        return LotNormalized(
            external_id=f"la-apify-{lot_id}",
            source='other',
            title=str(title).strip()[:500],
            artist_name_raw=str(artist).strip()[:500] if artist else None,
            estimate_low=estimate_low,
            estimate_high=estimate_high,
            current_price=current_price,
            currency=currency,
            auction_date=auction_date,
            auction_house_name=str(auction_house)[:300],
            image_url=str(image_url) if image_url else None,
            url=lot_url,
            category=item.get("category") or item.get("medium") or "Fine Art",
            medium=item.get("medium") or item.get("technique"),
            dimensions=item.get("dimensions"),
            raw_data={"source": "liveauctioneers_apify", "id": lot_id},
        )
    except Exception as e:
        logger.debug("apify_la_parse_error", error=str(e))
        return None


async def fetch_liveauctioneers_via_apify(limit: int = 100) -> List[LotNormalized]:
    """
    Fetch LiveAuctioneers lots via Apify cloud scraper.
    Returns [] if APIFY_API_TOKEN is not set.
    """
    token = _get_apify_token()
    if not token:
        logger.info("apify_la_skipped", reason="APIFY_API_TOKEN not set")
        return []

    actor_id = _get_actor_id()
    url = APIFY_RUN_SYNC_URL.format(actor_id=actor_id)

    lots: List[LotNormalized] = []
    seen: set = set()

    # Run one actor call per search query until we hit the limit
    per_query = max(20, limit // len(SEARCH_QUERIES))

    try:
        async with httpx.AsyncClient(timeout=180, follow_redirects=True) as client:
            for query in SEARCH_QUERIES:
                if len(lots) >= limit:
                    break
                try:
                    resp = await client.post(
                        url,
                        params={"token": token},
                        json={
                            "keyword": query,
                            "maxItems": min(per_query, limit - len(lots)),
                        },
                        headers={"Content-Type": "application/json"},
                    )

                    if resp.status_code not in (200, 201):
                        logger.warning(
                            "apify_la_run_failed",
                            query=query,
                            status=resp.status_code,
                            body=resp.text[:200],
                        )
                        continue

                    data = resp.json()
                    # Apify run-sync returns array directly or wrapped
                    items = data if isinstance(data, list) else (
                        data.get("items") or data.get("results") or
                        data.get("data") or []
                    )

                    added = 0
                    for item in items:
                        parsed = _parse_item(item)
                        if parsed and parsed.external_id not in seen:
                            seen.add(parsed.external_id)
                            lots.append(parsed)
                            added += 1
                            if len(lots) >= limit:
                                break

                    logger.info("apify_la_query_done", query=query, added=added)
                    await asyncio.sleep(1)

                except httpx.TimeoutException:
                    logger.warning("apify_la_timeout", query=query)
                    continue
                except Exception as e:
                    logger.warning("apify_la_query_error", query=query, error=str(e))
                    continue

    except Exception as e:
        logger.warning("apify_la_connector_failed", error=str(e))

    logger.info("apify_la_total", count=len(lots))
    return lots[:limit]


CONNECTOR_META = {
    "name": "LiveAuctioneers (Apify)",
    "source": 'other',
    "house_reputation_score": 0.80,
    "currency": "MULTI",
    "country": "INTL",
    "supports_real_time": True,
    "poll_interval_minutes": 30,
}
