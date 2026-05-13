"""Phillips auction connector.

Scrapes https://www.phillips.com/en/buy/lots via ScraperAPI (if key is set)
and parses lot data from the page's __NEXT_DATA__ JSON.

Falls back silently (info log, 0 lots) if ScraperAPI is not configured or the
page structure changes — Phillips lots are also covered by the ArtMarket API
connector so no data is permanently lost.
"""
import json
import os
import re
from datetime import datetime
from typing import List, Optional

import httpx
import structlog
from bs4 import BeautifulSoup

from app.models.schemas import LotNormalized, AuctionHouseEnum

logger = structlog.get_logger()

SCRAPERAPI_KEY = os.getenv("SCRAPERAPI_KEY")
BROWSE_URL = "https://www.phillips.com/en/buy/lots"
SCRAPERAPI_URL = "https://api.scraperapi.com/"


def _safe_float(val) -> Optional[float]:
    if val is None:
        return None
    try:
        return float(str(val).replace(",", "").replace(" ", "")) or None
    except (ValueError, TypeError):
        return None


def _safe_date(val) -> Optional[datetime]:
    if not val:
        return None
    try:
        return datetime.fromisoformat(str(val)[:19].replace("Z", ""))
    except Exception:
        return None


def _parse_lot(item: dict) -> Optional[LotNormalized]:
    """Map a Phillips lot dict (from __NEXT_DATA__ or JSON-LD) to LotNormalized."""
    try:
        lot_id = str(
            item.get("lotId") or item.get("id") or item.get("lotNumber") or
            item.get("webId") or ""
        )
        if not lot_id:
            return None

        title = (
            item.get("title") or item.get("lotTitle") or
            item.get("description") or item.get("name") or ""
        ).strip()
        if not title or len(title) < 3:
            return None

        artist = (
            item.get("makerName") or item.get("artistName") or
            item.get("maker") or item.get("artist") or ""
        )
        if isinstance(artist, dict):
            artist = artist.get("name") or artist.get("displayName") or ""

        est_low = _safe_float(item.get("estimateLow") or item.get("lowEstimate") or item.get("estimate_low"))
        est_high = _safe_float(item.get("estimateHigh") or item.get("highEstimate") or item.get("estimate_high"))
        currency = str(item.get("currency") or item.get("currencyCode") or "USD").upper()

        auction_date = _safe_date(item.get("saleDate") or item.get("auctionDate") or item.get("date"))

        image_url = (
            item.get("imageUrl") or item.get("primaryImage") or item.get("image") or
            (item.get("images", [{}])[0].get("url") if item.get("images") else None)
        )

        sale_id = item.get("saleId") or item.get("saleNumber") or ""
        url = item.get("url") or (
            f"https://www.phillips.com/lot/{sale_id}/{lot_id}" if sale_id else
            f"https://www.phillips.com/lots/{lot_id}"
        )

        return LotNormalized(
            external_id=f"phillips-{lot_id}",
            source=AuctionHouseEnum.PHILLIPS,
            title=title[:500],
            artist_name_raw=str(artist)[:500] if artist else None,
            estimate_low=est_low,
            estimate_high=est_high,
            current_price=est_low,
            currency=currency,
            auction_date=auction_date,
            auction_house_name="Phillips",
            image_url=str(image_url)[:500] if image_url else None,
            url=str(url)[:500] if url else None,
            category=item.get("category") or item.get("medium"),
            medium=item.get("medium") or item.get("materials"),
            raw_data=item,
        )
    except Exception as e:
        logger.debug("phillips_lot_parse_error", error=str(e))
        return None


def _extract_lots_from_next_data(data: dict) -> List[dict]:
    """Walk common __NEXT_DATA__ paths to find lot arrays."""
    candidates: List[dict] = []

    def _walk(obj, depth=0):
        if depth > 8:
            return
        if isinstance(obj, list):
            for item in obj:
                if isinstance(item, dict) and (
                    item.get("lotId") or item.get("lotNumber") or item.get("lotTitle")
                    or item.get("makerName") or item.get("estimateLow")
                ):
                    candidates.append(item)
                else:
                    _walk(item, depth + 1)
        elif isinstance(obj, dict):
            for v in obj.values():
                _walk(v, depth + 1)

    _walk(data)
    return candidates


async def _fetch_json_api(
    client: httpx.AsyncClient, page: int = 1, page_size: int = 100
) -> Optional[object]:
    """Try Phillips JSON API endpoints before falling back to HTML scraping."""
    urls_to_try = [
        f"https://www.phillips.com/api/lots?page={page}&pageSize={page_size}&status=upcoming",
        f"https://www.phillips.com/en/buy/lots?format=json&page={page}",
        f"https://www.phillips.com/api/search/lots?page={page}&limit={page_size}",
    ]
    headers = {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json",
        "Referer": "https://www.phillips.com/en/buy/lots",
    }
    for url in urls_to_try:
        try:
            resp = await client.get(url, headers=headers, timeout=15.0)
            if resp.status_code == 200:
                data = resp.json()
                if isinstance(data, (list, dict)):
                    return data
        except Exception:
            continue
    return None


async def _fetch_html(client: httpx.AsyncClient) -> Optional[str]:
    """Fetch the Phillips browse page via ScraperAPI (if key set) or direct."""
    try:
        if SCRAPERAPI_KEY:
            resp = await client.get(
                SCRAPERAPI_URL,
                params={
                    "api_key": SCRAPERAPI_KEY,
                    "url": BROWSE_URL,
                    "render": "true",
                    "country_code": "gb",   # UK IP — closer to Phillips London
                    "keep_headers": "true",
                },
                timeout=45.0,
            )
        else:
            resp = await client.get(
                BROWSE_URL,
                headers={
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                    "Accept": "text/html,application/xhtml+xml",
                },
                timeout=20.0,
            )

        if resp.status_code == 200:
            return resp.text
        logger.info("phillips_page_fetch_failed", status=resp.status_code)
    except Exception as e:
        logger.info("phillips_fetch_error", error=str(e))
    return None


async def fetch_lots(limit: int = 100) -> List[LotNormalized]:
    lots: List[LotNormalized] = []
    seen_ids: set = set()

    async with httpx.AsyncClient(follow_redirects=True) as client:
        # --- Try JSON API with pagination first ---
        for page in range(1, 20):  # up to ~2000 lots at 100/page
            if len(lots) >= limit:
                break
            data = await _fetch_json_api(client, page=page)
            if data is None:
                break  # API not available; fall through to HTML
            raw_lots = (
                _extract_lots_from_next_data(data) if isinstance(data, dict)
                else (data if isinstance(data, list) else [])
            )
            if not raw_lots:
                break  # empty page — no more results
            added = 0
            for item in raw_lots:
                lot = _parse_lot(item)
                if lot and lot.external_id not in seen_ids:
                    seen_ids.add(lot.external_id)
                    lots.append(lot)
                    added += 1
                    if len(lots) >= limit:
                        break
            if not added:
                break  # page returned items but none parsed — stop

        # --- Fallback: HTML scraping if API returned nothing ---
        if not lots:
            html = await _fetch_html(client)
            if not html:
                logger.info("phillips_unavailable")
                return []

            soup = BeautifulSoup(html, "lxml")
            script = soup.find("script", {"id": "__NEXT_DATA__"})
            if script and script.string:
                try:
                    data = json.loads(script.string)
                    raw_lots = _extract_lots_from_next_data(data)
                    for item in raw_lots:
                        lot = _parse_lot(item)
                        if lot and lot.external_id not in seen_ids:
                            seen_ids.add(lot.external_id)
                            lots.append(lot)
                            if len(lots) >= limit:
                                break
                except Exception as e:
                    logger.debug("phillips_next_data_parse_error", error=str(e))

            # Fallback: JSON-LD product/auction schema
            if not lots:
                for tag in soup.find_all("script", {"type": "application/ld+json"}):
                    try:
                        ld = json.loads(tag.string or "")
                        items = ld if isinstance(ld, list) else [ld]
                        for item in items:
                            # Handle ItemList
                            if item.get("@type") == "ItemList":
                                items = item.get("itemListElement", [])
                            lot = _parse_lot(item)
                            if lot and lot.external_id not in seen_ids:
                                seen_ids.add(lot.external_id)
                                lots.append(lot)
                                if len(lots) >= limit:
                                    break
                    except Exception:
                        continue

    if lots:
        logger.info("phillips_fetched", count=len(lots))
    else:
        logger.info("phillips_no_lots_found")
    return lots
