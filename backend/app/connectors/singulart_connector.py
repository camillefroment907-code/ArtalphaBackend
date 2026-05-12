"""Singulart connector — primary market gallery (singulart.com).

Strategy:
1. Fetch Singulart's painting browse page via ScraperAPI render=true.
2. Parse artwork data from window.app state or rendered DOM cards.
3. Falls back silently (info log, 0 lots) when ScraperAPI is not configured
   or the page structure changes — no public API is available.
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

BROWSE_URLS = [
    "https://www.singulart.com/en/paintings/",
    "https://www.singulart.com/en/",
]


def _safe_float(val) -> Optional[float]:
    if val is None:
        return None
    try:
        return float(str(val).replace(",", "").replace("€", "").replace("$", "").replace(" ", "")) or None
    except (ValueError, TypeError):
        return None


def _parse_artwork(item: dict, idx: int) -> Optional[LotNormalized]:
    try:
        artwork_id = str(
            item.get("id") or item.get("artworkId") or item.get("slug") or str(idx)
        )

        title = (
            item.get("title") or item.get("name") or "Untitled"
        ).strip()
        if not title or len(title) < 2:
            return None

        artist = item.get("artist") or item.get("artistName") or item.get("artist_name") or ""
        if isinstance(artist, dict):
            artist = (
                artist.get("name") or artist.get("fullName") or
                artist.get("displayName") or ""
            )

        price = _safe_float(
            item.get("price") or item.get("sellingPrice") or
            item.get("priceEur") or item.get("currentPrice") or
            item.get("amount")
        )

        currency = str(item.get("currency") or "EUR").upper()

        image_url = (
            item.get("imageUrl") or item.get("image") or item.get("mainImage") or
            item.get("photo") or
            (item.get("images", [{}])[0].get("url") if item.get("images") else None)
        )

        url_raw = item.get("url") or item.get("artworkUrl") or f"/en/artwork/{artwork_id}"
        lot_url = url_raw if url_raw.startswith("http") else f"https://www.singulart.com{url_raw}"

        return LotNormalized(
            external_id=f"singulart-{artwork_id}",
            source='other',
            title=title[:500],
            artist_name_raw=str(artist)[:500] if artist else None,
            estimate_low=price,
            estimate_high=price,
            current_price=price,
            currency=currency,
            auction_date=None,
            auction_house_name="Singulart",
            image_url=str(image_url)[:500] if image_url else None,
            url=lot_url[:500],
            category=item.get("category") or item.get("discipline") or "Painting",
            medium=item.get("medium") or item.get("technique"),
            market_type="PRIMARY",
            is_buy_now=True,
            raw_data={"title": title, "artist": str(artist)},
        )
    except Exception as e:
        logger.debug("singulart_parse_error", error=str(e))
        return None


def _extract_from_window_app(html: str) -> List[dict]:
    """Extract artwork objects from Singulart's window.app JavaScript state."""
    results: List[dict] = []
    try:
        # window.app = {...} or similar patterns
        patterns = [
            r'window\.app\s*=\s*(\{.*?\})\s*;',
            r'window\.__INITIAL_STATE__\s*=\s*(\{.*?\})\s*;',
            r'"artworks"\s*:\s*(\[.*?\])',
        ]
        for pattern in patterns:
            m = re.search(pattern, html, re.DOTALL)
            if not m:
                continue
            try:
                data = json.loads(m.group(1))
                _walk(data, results)
                if results:
                    break
            except Exception:
                continue
    except Exception as e:
        logger.debug("singulart_window_app_error", error=str(e))
    return results


def _walk(obj, results: List[dict], depth=0):
    if depth > 10 or len(results) >= 200:
        return
    if isinstance(obj, list):
        for item in obj:
            if isinstance(item, dict) and (
                item.get("title") or item.get("name")
            ) and (
                item.get("price") or item.get("sellingPrice") or item.get("amount")
            ):
                results.append(item)
            else:
                _walk(item, results, depth + 1)
    elif isinstance(obj, dict):
        for v in obj.values():
            _walk(v, results, depth + 1)


def _extract_from_html(html: str) -> List[dict]:
    """Parse JSON-LD or Open Graph metadata from rendered HTML."""
    results: List[dict] = []
    try:
        soup = BeautifulSoup(html, "lxml")

        # JSON-LD schema
        for tag in soup.find_all("script", {"type": "application/ld+json"}):
            try:
                ld = json.loads(tag.string or "")
                items = ld if isinstance(ld, list) else [ld]
                for obj in items:
                    if obj.get("@type") in ("Product", "ArtWork", "VisualArtwork"):
                        results.append({
                            "title": obj.get("name") or "",
                            "price": (obj.get("offers") or {}).get("price"),
                            "currency": (obj.get("offers") or {}).get("priceCurrency", "EUR"),
                            "image": obj.get("image") or "",
                            "url": obj.get("url") or "",
                            "artist": (obj.get("author") or obj.get("creator") or {}).get("name", "")
                            if isinstance(obj.get("author") or obj.get("creator"), dict) else "",
                        })
                    elif obj.get("@type") == "ItemList":
                        for elem in obj.get("itemListElement", []):
                            item = elem.get("item") or elem
                            if item.get("name"):
                                results.append({"title": item.get("name"), "url": item.get("url", "")})
            except Exception:
                continue

        # __NEXT_DATA__
        script = soup.find("script", {"id": "__NEXT_DATA__"})
        if script and script.string:
            try:
                data = json.loads(script.string)
                _walk(data, results)
            except Exception:
                pass

    except Exception as e:
        logger.debug("singulart_html_parse_error", error=str(e))
    return results


async def fetch_lots(limit: int = 100) -> List[LotNormalized]:
    if not SCRAPERAPI_KEY:
        logger.info("singulart_no_scraperapi_key")
        return []

    lots: List[LotNormalized] = []
    seen_ids: set = set()

    try:
        async with httpx.AsyncClient(follow_redirects=True) as client:
            html = None
            for url in BROWSE_URLS:
                try:
                    resp = await client.get(
                        SCRAPERAPI_URL,
                        params={
                            "api_key": SCRAPERAPI_KEY,
                            "url": url,
                            "render": "true",
                            "country_code": "fr",   # Singulart is French
                            "keep_headers": "true",
                        },
                        timeout=60.0,
                    )
                    if resp.status_code == 200:
                        html = resp.text
                        break
                    logger.info("singulart_page_failed", status=resp.status_code, url=url)
                except Exception as e:
                    logger.info("singulart_request_error", error=str(e))
                    continue

            if not html:
                logger.info("singulart_unavailable")
                return []

            # Try window.app / __INITIAL_STATE__ first
            items = _extract_from_window_app(html)

            # Fallback: JSON-LD / __NEXT_DATA__
            if not items:
                items = _extract_from_html(html)

            for idx, item in enumerate(items):
                lot = _parse_artwork(item, idx)
                if lot and lot.external_id not in seen_ids:
                    seen_ids.add(lot.external_id)
                    lots.append(lot)
                    if len(lots) >= limit:
                        break

    except Exception as e:
        logger.info("singulart_connector_error", error=str(e))

    if lots:
        logger.info("singulart_fetched", count=len(lots))
    else:
        logger.info("singulart_no_lots_found")
    return lots
