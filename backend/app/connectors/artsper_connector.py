"""Artsper connector — French primary market gallery platform.

Uses Artsper's public Algolia search index (193k+ artworks).
Algolia public search keys are browser-visible by design and read-only.

Fallback: Playwright browser scraping if the Algolia key rotates.
"""
import re
import json
import asyncio
import structlog
from typing import List, Optional, Any

import httpx
from app.models.schemas import LotNormalized, AuctionHouseEnum

logger = structlog.get_logger()

# ---------------------------------------------------------------------------
# Algolia credentials (public read-only search key, visible in browser)
# ---------------------------------------------------------------------------
ALGOLIA_APP_ID = "FEOHGOI5X1"
ALGOLIA_SEARCH_KEY = "b4379a5897050044b31d92bbfbab1f86"
ALGOLIA_INDEX = "artworks_channel_6"
ALGOLIA_URL = f"https://{ALGOLIA_APP_ID.lower()}-dsn.algolia.net/1/indexes/*/queries"
ALGOLIA_AGENT = "Algolia for JavaScript (4.8.6); Browser (lite); instantsearch.js (4.17.0); JS Helper (3.12.0)"

MEDIA_BASE = "https://media.artsper.com/"
SITE_BASE = "https://www.artsper.com"

# Categories to fetch (Algolia category_en filter value → display name)
CATEGORY_FILTERS = [
    "Painting",
    "Photography",
    "Sculpture",
    "Drawing",
    "Print",
    "Digital Art",
    "Mixed Media",
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_facet(val: Any) -> Optional[str]:
    """Parse Algolia facet string like '6*Painting*painting' → 'Painting'."""
    if not val:
        return None
    if isinstance(val, list):
        val = val[0] if val else None
    if not val:
        return None
    parts = str(val).split("*")
    return parts[1] if len(parts) >= 2 else str(val)


def _resolve_image(hit: dict) -> Optional[str]:
    """Get best image URL from a hit."""
    # Direct full URLs
    img = hit.get("image") or hit.get("image_s")
    if img and img.startswith("http"):
        return img
    # Thumbnails dict with relative paths
    thumbs = hit.get("thumbnails")
    if isinstance(thumbs, dict):
        rel = thumbs.get("m") or thumbs.get("grid") or thumbs.get("s")
        if rel:
            return f"{MEDIA_BASE}{rel}"
    return None


def _resolve_url(hit: dict) -> Optional[str]:
    """Get artwork page URL from a hit."""
    urls = hit.get("urls")
    if isinstance(urls, dict):
        rel = urls.get("en") or urls.get("fr") or next(iter(urls.values()), None)
        if rel:
            return f"{SITE_BASE}{rel}"
    oid = hit.get("objectID") or hit.get("id_artwork") or hit.get("id")
    if oid:
        return f"{SITE_BASE}/us/contemporary-artworks/{oid}"
    return None


def _resolve_price(hit: dict) -> Optional[float]:
    """Get EUR price from a hit, preferring price_eur → current_price → artwork_price."""
    for k in ("price_eur", "current_price", "artwork_price", "discounted_price"):
        v = hit.get(k)
        if v is not None:
            try:
                f = float(v)
                if f > 0:
                    return f
            except (TypeError, ValueError):
                pass
    return None


def _hit_to_lot(hit: dict) -> Optional[LotNormalized]:
    """Convert an Algolia hit to a LotNormalized."""
    try:
        oid = str(hit.get("objectID") or hit.get("id_artwork") or hit.get("id") or "")
        if not oid:
            return None

        title = hit.get("artwork_title") or hit.get("name")
        if not title:
            return None

        price = _resolve_price(hit)
        if not price:
            return None

        category_raw = hit.get("category_en")
        category = _parse_facet(category_raw) or "Art"

        medium_raw = hit.get("medium_en")
        medium = _parse_facet(medium_raw)

        artist = hit.get("artist_name")
        gallery = hit.get("vendor_name") or "Artsper"

        return LotNormalized(
            external_id=f"artsper-{oid}",
            source=AuctionHouseEnum.OTHER,
            title=str(title)[:500],
            artist_name_raw=str(artist)[:500] if artist else None,
            estimate_low=price,
            estimate_high=price,
            current_price=price,
            currency="EUR",
            auction_date=None,
            auction_house_name="Artsper",
            image_url=_resolve_image(hit),
            url=_resolve_url(hit),
            category=category[:200],
            medium=str(medium)[:200] if medium else None,
            market_type="PRIMARY",
            is_buy_now=True,
            gallery_name=str(gallery)[:200],
            raw_data={"id": oid, "title": str(title)[:200]},
        )
    except Exception as e:
        logger.debug("artsper_hit_parse_error", error=str(e))
        return None


# ---------------------------------------------------------------------------
# Algolia query (primary strategy)
# ---------------------------------------------------------------------------

async def _algolia_fetch(
    limit: int,
    api_key: str = ALGOLIA_SEARCH_KEY,
) -> List[LotNormalized]:
    lots: List[LotNormalized] = []
    seen: set = set()

    hits_per_page = min(limit, 100)
    pages_needed = max(1, (limit + hits_per_page - 1) // hits_per_page)

    params = {
        "x-algolia-agent": ALGOLIA_AGENT,
        "x-algolia-api-key": api_key,
        "x-algolia-application-id": ALGOLIA_APP_ID,
    }

    async with httpx.AsyncClient(timeout=20) as client:
        for page in range(pages_needed):
            if len(lots) >= limit:
                break
            body = {
                "requests": [
                    {
                        "indexName": ALGOLIA_INDEX,
                        "params": (
                            f"hitsPerPage={hits_per_page}"
                            f"&page={page}"
                            f"&query="
                            f"&analytics=false"
                            f"&clickAnalytics=false"
                        ),
                    }
                ]
            }
            try:
                resp = await client.post(ALGOLIA_URL, params=params, json=body)
                if resp.status_code != 200:
                    logger.warning("artsper_algolia_error", status=resp.status_code)
                    break
                data = resp.json()
                hits = data.get("results", [{}])[0].get("hits", [])
                if not hits:
                    break
                for hit in hits:
                    lot = _hit_to_lot(hit)
                    if lot and lot.external_id not in seen:
                        seen.add(lot.external_id)
                        lots.append(lot)
                    if len(lots) >= limit:
                        break
            except Exception as e:
                logger.warning("artsper_algolia_request_error", error=str(e))
                break

    return lots


async def _refresh_algolia_key() -> Optional[str]:
    """Try to scrape a fresh Algolia search key from Artsper's page."""
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            resp = await client.get(
                f"{SITE_BASE}/us/contemporary-artworks/painting",
                headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"},
            )
            text = resp.text
            # Key appears in URL params: x-algolia-api-key=<32 hex chars>
            m = re.search(r'x-algolia-api-key[="\s:]+([a-f0-9]{32})', text, re.IGNORECASE)
            if m:
                return m.group(1)
    except Exception:
        pass

    # Playwright fallback for key extraction
    try:
        from playwright.async_api import async_playwright
        found_key: List[str] = []

        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True, args=["--no-sandbox", "--disable-gpu"]
            )
            page = await browser.new_page()

            async def on_request(request):
                if "algolia" in request.url:
                    m2 = re.search(r'x-algolia-api-key=([a-f0-9]{32})', request.url)
                    if m2:
                        found_key.append(m2.group(1))

            page.on("request", on_request)
            await page.goto(
                f"{SITE_BASE}/us/contemporary-artworks/painting",
                wait_until="domcontentloaded",
                timeout=20000,
            )
            await asyncio.sleep(3)
            await browser.close()

        return found_key[0] if found_key else None
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

async def fetch_lots(limit: int = 100) -> List[LotNormalized]:
    """Fetch artworks from Artsper via Algolia search API."""
    # Try with the known key
    lots = await _algolia_fetch(limit, api_key=ALGOLIA_SEARCH_KEY)

    if lots:
        logger.info("artsper_fetched", count=len(lots), method="algolia")
        return lots

    # Key might have rotated — try to refresh it
    logger.info("artsper_key_refresh_attempt")
    fresh_key = await _refresh_algolia_key()

    if fresh_key and fresh_key != ALGOLIA_SEARCH_KEY:
        logger.info("artsper_key_refreshed", new_key=fresh_key[:8] + "...")
        lots = await _algolia_fetch(limit, api_key=fresh_key)
        if lots:
            logger.info("artsper_fetched", count=len(lots), method="algolia_refreshed_key")
            return lots

    logger.warning("artsper_fetch_failed")
    return []
