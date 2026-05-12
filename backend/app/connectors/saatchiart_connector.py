"""Saatchi Art connector — primary market gallery (saatchiart.com).

Strategy:
1. Fetch https://www.saatchiart.com/paintings via ScraperAPI render=true
   so the Next.js page is fully rendered and artwork cards appear in the DOM.
2. Parse artwork cards from rendered HTML (title, artist, price, image, URL).
3. Falls back silently (info log, 0 lots) when ScraperAPI is not configured
   or the page structure changes — this is expected behavior for a primary
   market site with no public API.
"""
import json
import os
import re
from typing import List, Optional

import httpx
import structlog
from bs4 import BeautifulSoup

from app.models.schemas import LotNormalized, AuctionHouseEnum

logger = structlog.get_logger()

SCRAPERAPI_KEY = os.getenv("SCRAPERAPI_KEY")
SCRAPERAPI_URL = "https://api.scraperapi.com/"
BROWSE_URL = "https://www.saatchiart.com/paintings"


def _safe_float(val) -> Optional[float]:
    if val is None:
        return None
    try:
        return float(str(val).replace(",", "").replace("$", "").replace(" ", "")) or None
    except (ValueError, TypeError):
        return None


def _parse_artwork(item: dict, idx: int) -> Optional[LotNormalized]:
    try:
        artwork_id = str(
            item.get("ArtworkId") or item.get("id") or item.get("artworkId") or
            item.get("slug") or item.get("ArtworkUrl", "").rstrip("/").split("/")[-1] or
            str(idx)
        )

        title = (
            item.get("ArtTitle") or item.get("title") or item.get("name") or "Untitled"
        ).strip()

        artist = (
            item.get("ArtistName") or item.get("artist") or item.get("artistName") or ""
        )
        if isinstance(artist, dict):
            artist = artist.get("name") or artist.get("displayName") or ""

        price = _safe_float(
            item.get("OriginalPrice") or item.get("price") or
            item.get("sellingPrice") or item.get("priceUsd")
        )

        currency = str(item.get("currency") or "USD").upper()

        image_raw = item.get("ArtworkImageUrl") or item.get("imageUrl") or item.get("image") or ""
        image_url = image_raw if image_raw.startswith("http") else f"https:{image_raw}" if image_raw.startswith("//") else None

        url_raw = item.get("ArtworkUrl") or item.get("url") or f"/art/{artwork_id}"
        lot_url = url_raw if url_raw.startswith("http") else f"https://www.saatchiart.com{url_raw}"

        if not title or len(title) < 2:
            return None

        return LotNormalized(
            external_id=f"saatchi-{artwork_id}",
            source='other',
            title=title[:500],
            artist_name_raw=str(artist)[:500] if artist else None,
            estimate_low=price,
            estimate_high=price,
            current_price=price,
            currency=currency,
            auction_date=None,
            auction_house_name="Saatchi Art",
            image_url=image_url,
            url=lot_url,
            category=item.get("category") or item.get("medium") or "Painting",
            medium=item.get("medium") or item.get("materials"),
            market_type="PRIMARY",
            is_buy_now=True,
            raw_data={"title": title, "artist": str(artist)},
        )
    except Exception as e:
        logger.debug("saatchi_parse_error", error=str(e))
        return None


def _extract_from_next_data(html: str) -> List[dict]:
    """Extract artwork dicts from __NEXT_DATA__ JSON embedded in HTML."""
    results: List[dict] = []
    try:
        soup = BeautifulSoup(html, "lxml")
        script = soup.find("script", {"id": "__NEXT_DATA__"})
        if not (script and script.string):
            return results

        data = json.loads(script.string)

        def _walk(obj, depth=0):
            if depth > 10 or len(results) >= 200:
                return
            if isinstance(obj, list):
                for item in obj:
                    if isinstance(item, dict) and (
                        item.get("ArtTitle") or item.get("ArtworkUrl") or
                        item.get("OriginalPrice") is not None
                    ):
                        results.append(item)
                    else:
                        _walk(item, depth + 1)
            elif isinstance(obj, dict):
                for v in obj.values():
                    _walk(v, depth + 1)

        _walk(data)
    except Exception as e:
        logger.debug("saatchi_next_data_error", error=str(e))
    return results


def _extract_from_html_cards(html: str) -> List[dict]:
    """Parse rendered artwork cards from DOM when __NEXT_DATA__ has no inventory."""
    results: List[dict] = []
    try:
        soup = BeautifulSoup(html, "lxml")

        # Look for structured product data (Open Graph or microdata)
        for meta in soup.find_all("meta", {"property": "og:title"}):
            title = meta.get("content", "")
            if title:
                item: dict = {"ArtTitle": title}
                price_meta = soup.find("meta", {"property": "product:price:amount"})
                if price_meta:
                    item["OriginalPrice"] = price_meta.get("content")
                img_meta = soup.find("meta", {"property": "og:image"})
                if img_meta:
                    item["ArtworkImageUrl"] = img_meta.get("content", "")
                url_meta = soup.find("meta", {"property": "og:url"})
                if url_meta:
                    item["ArtworkUrl"] = url_meta.get("content", "")
                results.append(item)
                break  # only one artwork per page on product pages

        # Look for JSON-LD Product schema
        for tag in soup.find_all("script", {"type": "application/ld+json"}):
            try:
                ld = json.loads(tag.string or "")
                items = ld if isinstance(ld, list) else [ld]
                for obj in items:
                    if obj.get("@type") in ("Product", "ArtWork", "VisualArtwork"):
                        result = {
                            "ArtTitle": obj.get("name") or "",
                            "OriginalPrice": (obj.get("offers") or {}).get("price"),
                            "ArtworkImageUrl": obj.get("image") or "",
                            "ArtworkUrl": obj.get("url") or "",
                            "ArtistName": (obj.get("author") or obj.get("creator") or {}).get("name", "") if isinstance(obj.get("author") or obj.get("creator"), dict) else "",
                        }
                        if result["ArtTitle"]:
                            results.append(result)
            except Exception:
                continue

        # Look for inline window.__STATE__ or similar
        for tag in soup.find_all("script"):
            text = tag.string or ""
            if "ArtTitle" in text or "ArtistName" in text:
                m = re.search(r'(\{[^{}]*"ArtTitle"[^{}]*\})', text)
                if m:
                    try:
                        obj = json.loads(m.group(1))
                        if obj.get("ArtTitle"):
                            results.append(obj)
                    except Exception:
                        pass

    except Exception as e:
        logger.debug("saatchi_card_parse_error", error=str(e))
    return results


async def fetch_lots(limit: int = 100) -> List[LotNormalized]:
    if not SCRAPERAPI_KEY:
        logger.info("saatchiart_no_scraperapi_key")
        return []

    lots: List[LotNormalized] = []
    seen_ids: set = set()

    try:
        async with httpx.AsyncClient(follow_redirects=True) as client:
            resp = await client.get(
                SCRAPERAPI_URL,
                params={
                    "api_key": SCRAPERAPI_KEY,
                    "url": BROWSE_URL,
                    "render": "true",
                    "country_code": "us",
                    "keep_headers": "true",
                },
                timeout=60.0,
            )

            if resp.status_code != 200:
                logger.info("saatchiart_fetch_failed", status=resp.status_code)
                return []

            html = resp.text

            # Try __NEXT_DATA__ first (server-rendered artwork objects)
            items = _extract_from_next_data(html)

            # Fallback: parse rendered DOM cards
            if not items:
                items = _extract_from_html_cards(html)

            for idx, item in enumerate(items):
                lot = _parse_artwork(item, idx)
                if lot and lot.external_id not in seen_ids:
                    seen_ids.add(lot.external_id)
                    lots.append(lot)
                    if len(lots) >= limit:
                        break

    except Exception as e:
        logger.info("saatchiart_connector_error", error=str(e))

    if lots:
        logger.info("saatchiart_fetched", count=len(lots))
    else:
        logger.info("saatchiart_no_lots_found")
    return lots
