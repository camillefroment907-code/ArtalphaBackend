"""Artcurial connector — French auction house (artcurial.com).

Scrapes the Artcurial lot catalog via ScraperAPI (if key set) and parses
structured data from the rendered page.

Falls back silently (info log, 0 lots) on any failure — Artcurial lots are
also covered by the ArtMarket API connector.
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
SCRAPERAPI_URL = "https://api.scraperapi.com/"

# Pages to try in order
BROWSE_URLS = [
    "https://www.artcurial.com/fr/lots-a-venir",
    "https://www.artcurial.com/fr/ventes",
    "https://www.artcurial.com/fr/",
]


def _safe_float(val) -> Optional[float]:
    if val is None:
        return None
    try:
        return float(str(val).replace(",", "").replace(" ", "").replace("\u202f", "")) or None
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
    try:
        lot_id = str(
            item.get("id") or item.get("lotId") or item.get("ref") or
            item.get("lotNumber") or ""
        )
        if not lot_id:
            return None

        title = (
            item.get("title") or item.get("designation") or
            item.get("name") or item.get("label") or ""
        ).strip()
        if not title or len(title) < 3:
            return None

        artist = item.get("artist") or item.get("author") or item.get("artistName") or ""
        if isinstance(artist, dict):
            artist = artist.get("name") or artist.get("fullName") or ""

        est_low = _safe_float(
            item.get("estimateLow") or item.get("estimate_low") or
            item.get("minEstimate") or item.get("estimationMin") or
            item.get("lowEstimate")
        )
        est_high = _safe_float(
            item.get("estimateHigh") or item.get("estimate_high") or
            item.get("maxEstimate") or item.get("estimationMax") or
            item.get("highEstimate")
        )

        auction_date = None
        for k in ("saleDate", "auctionDate", "date", "saleStartDate", "startDate"):
            if item.get(k):
                auction_date = _safe_date(item[k])
                if auction_date:
                    break

        image_url = (
            item.get("imageUrl") or item.get("image") or item.get("thumbnail") or
            (item.get("images", [{}])[0].get("url") if item.get("images") else None)
        )

        lot_url = item.get("url") or item.get("lotUrl") or f"https://www.artcurial.com/fr/lot-{lot_id}"

        return LotNormalized(
            external_id=f"artcurial-{lot_id}",
            source=AuctionHouseEnum.OTHER,
            title=title[:500],
            artist_name_raw=str(artist)[:500] if artist else None,
            estimate_low=est_low,
            estimate_high=est_high,
            current_price=est_low,
            currency="EUR",
            auction_date=auction_date,
            auction_house_name="Artcurial",
            image_url=str(image_url)[:500] if image_url else None,
            url=str(lot_url)[:500] if lot_url else None,
            category=item.get("category") or item.get("discipline"),
            medium=item.get("medium") or item.get("technique"),
            raw_data=item,
        )
    except Exception as e:
        logger.debug("artcurial_lot_parse_error", error=str(e))
        return None


def _extract_lots_from_next_data(data: dict) -> List[dict]:
    """Recursively find lot objects in __NEXT_DATA__ or window.__NUXT__."""
    candidates: List[dict] = []

    def _walk(obj, depth=0):
        if depth > 8:
            return
        if isinstance(obj, list):
            for item in obj:
                if isinstance(item, dict) and (
                    item.get("id") or item.get("lotId") or item.get("ref")
                ) and (
                    item.get("title") or item.get("designation") or item.get("estimateLow")
                ):
                    candidates.append(item)
                else:
                    _walk(item, depth + 1)
        elif isinstance(obj, dict):
            for v in obj.values():
                _walk(v, depth + 1)

    _walk(data)
    return candidates


async def _fetch_html(client: httpx.AsyncClient, url: str) -> Optional[str]:
    try:
        if SCRAPERAPI_KEY:
            resp = await client.get(
                SCRAPERAPI_URL,
                params={
                    "api_key": SCRAPERAPI_KEY,
                    "url": url,
                    "render": "true",
                    "country_code": "fr",   # French IP for Artcurial
                    "keep_headers": "true",
                },
                timeout=45.0,
            )
        else:
            resp = await client.get(
                url,
                headers={
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                    "Accept": "text/html,application/xhtml+xml",
                    "Accept-Language": "fr-FR,fr;q=0.9",
                },
                timeout=20.0,
            )
        if resp.status_code == 200:
            return resp.text
        logger.info("artcurial_page_fetch_failed", status=resp.status_code, url=url)
    except Exception as e:
        logger.info("artcurial_fetch_error", error=str(e))
    return None


async def fetch_lots(limit: int = 100) -> List[LotNormalized]:
    lots: List[LotNormalized] = []
    seen_ids: set = set()

    async with httpx.AsyncClient(follow_redirects=True) as client:
        html = None
        for url in BROWSE_URLS:
            html = await _fetch_html(client, url)
            if html:
                break

        if not html:
            logger.info("artcurial_unavailable")
            return []

        soup = BeautifulSoup(html, "lxml")

        # Try __NEXT_DATA__ (Next.js)
        script = soup.find("script", {"id": "__NEXT_DATA__"})
        if script and script.string:
            try:
                data = json.loads(script.string)
                for item in _extract_lots_from_next_data(data):
                    lot = _parse_lot(item)
                    if lot and lot.external_id not in seen_ids:
                        seen_ids.add(lot.external_id)
                        lots.append(lot)
                        if len(lots) >= limit:
                            break
            except Exception as e:
                logger.debug("artcurial_next_data_error", error=str(e))

        # Try window.__NUXT__ (Vue/Nuxt.js)
        if not lots:
            for tag in soup.find_all("script"):
                text = tag.string or ""
                if "__NUXT__" in text:
                    m = re.search(r'__NUXT__\s*=\s*(\{.*?\})\s*;', text, re.DOTALL)
                    if m:
                        try:
                            data = json.loads(m.group(1))
                            for item in _extract_lots_from_next_data(data):
                                lot = _parse_lot(item)
                                if lot and lot.external_id not in seen_ids:
                                    seen_ids.add(lot.external_id)
                                    lots.append(lot)
                                    if len(lots) >= limit:
                                        break
                        except Exception:
                            pass
                    break

        # Try JSON-LD
        if not lots:
            for tag in soup.find_all("script", {"type": "application/ld+json"}):
                try:
                    ld = json.loads(tag.string or "")
                    items = ld if isinstance(ld, list) else [ld]
                    for item in items:
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
        logger.info("artcurial_fetched", count=len(lots))
    else:
        logger.info("artcurial_no_lots_found")
    return lots
