"""
Drouot Connector via ScraperAPI (render=true)
Replaces the Playwright-based drouot_real.py which can't run on Railway.

Uses ScraperAPI's headless Chrome (render=true) to bypass Cloudflare and
render the Next.js frontend, then parses the resulting HTML with the same
logic as the original Playwright scraper.

Cost: ~10 ScraperAPI credits per page (250K credits/month on $29 plan).
Requires SCRAPERAPI_KEY environment variable.
"""
import asyncio
import os
import re
import json
from datetime import datetime
from typing import List, Optional
from urllib.parse import quote_plus, urlencode
import httpx
import structlog
from bs4 import BeautifulSoup

from app.models.schemas import LotNormalized, AuctionHouseEnum

logger = structlog.get_logger().bind(connector="drouot_scraperapi")

SCRAPERAPI_KEY = os.getenv("SCRAPERAPI_KEY")
SCRAPERAPI_URL = "https://api.scraperapi.com/"
BASE_URL = "https://www.drouot.com"

# Pages to scrape
DROUOT_URLS = [
    f"{BASE_URL}/en/auctions/future",        # upcoming sales list
    f"{BASE_URL}/en/lots?status=upcoming",   # all upcoming lots, page 1
]

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
}

_MONTHS = {
    "JANV": 1, "FÉVR": 2, "MARS": 3, "AVR": 4, "MAI": 5, "JUIN": 6,
    "JUIL": 7, "AOÛT": 8, "SEPT": 9, "OCT": 10, "NOV": 11, "DÉC": 12,
    "JAN": 1, "FEB": 2, "MAR": 3, "APR": 4, "MAY": 5, "JUN": 6,
    "JUL": 7, "AUG": 8, "SEP": 9, "DEC": 12, "FEV": 2, "AOU": 8,
}


def _parse_date(text: str) -> Optional[datetime]:
    t = text.upper().replace("AOÛT", "AOU").replace("FÉVR", "FEV")
    for pattern in [
        r"([A-Z]{3,4})\s+(\d{1,2})",   # English/short French: "MAR 25"
        r"(\d{1,2})\s+([A-ZÉ]{3,4})",  # French: "25 MARS"
    ]:
        m = re.search(pattern, t)
        if m:
            try:
                if m.group(1).isdigit():
                    day, mon_str = int(m.group(1)), m.group(2)[:4]
                else:
                    mon_str, day = m.group(1)[:4], int(m.group(2))
                month = _MONTHS.get(mon_str)
                if month:
                    year = datetime.utcnow().year
                    dt = datetime(year, month, day)
                    if (datetime.utcnow() - dt).days > 30:
                        dt = datetime(year + 1, month, day)
                    return dt
            except (ValueError, KeyError):
                continue
    return None


def _parse_price(text: str) -> Optional[float]:
    clean = re.sub(r"[€$£\s\u202f\u00a0]", "", text).replace(",", "")
    try:
        return float(re.search(r"\d+(?:\.\d+)?", clean).group())
    except (AttributeError, ValueError):
        return None


def _extract_lot_id(href: str) -> Optional[str]:
    m = re.search(r"/(?:fr|en)/l/(\d+)", href)
    return m.group(1) if m else None


def _parse_lots_from_html(html: str, seen_ids: set) -> List[LotNormalized]:
    """Parse Drouot lot cards from rendered HTML. Same logic as drouot_real.py."""
    soup = BeautifulSoup(html, "lxml")
    lots: List[LotNormalized] = []

    # Collect CDN lot images (distinct from UI icons)
    cdn_imgs: List[str] = []
    for img in soup.find_all("img"):
        src = img.get("src") or img.get("data-src") or ""
        if "cdn.drouot.com/d/image/lot" in src:
            # Upgrade to full resolution
            src = src.replace("size=ftall", "size=full").replace("size=small", "size=full")
            cdn_imgs.append(src)

    lot_pattern = re.compile(r"/(?:fr|en)/l/\d+")
    all_a_tags = soup.find_all("a", href=lot_pattern)

    for idx, a_tag in enumerate(all_a_tags):
        href = a_tag.get("href", "")
        lot_id = _extract_lot_id(href)
        if not lot_id or lot_id in seen_ids:
            continue
        seen_ids.add(lot_id)

        full_url = (BASE_URL + href) if href.startswith("/") else href
        full_text = " ".join(a_tag.get_text(separator=" ", strip=True).split())

        # Strip countdown timer prefix "01h 43m 26s"
        cleaned = re.sub(r"^\d+h\s*\d+m\s*\d+s\s*", "", full_text).strip()
        # Strip lot number prefix "54 - "
        cleaned = re.sub(r"^\d{1,4}\s*[-–]\s*", "", cleaned).strip()
        # Strip date prefix "MAR 25 - 13:00" or "25 MARS - 13:00"
        cleaned = re.sub(
            r"^(?:[A-Z]{3,4}\s+\d{1,2}|\d{1,2}\s+[A-ZÉ]{3,4})\s*[-–]\s*\d{2}:\d{2}\s*",
            "",
            cleaned,
        ).strip()

        title = (cleaned or full_text)[:200]
        if not title or len(title) < 4:
            continue

        # Parse date from full card text
        auction_date = _parse_date(full_text)

        # Inline estimate: "800 € - 1 200 €" or "Estimation 800 €"
        estimate_low: Optional[float] = None
        estimate_high: Optional[float] = None
        price_m = re.search(
            r"(\d[\d\s\u202f\u00a0]{2,10})\s*€\s*[-–]\s*(\d[\d\s\u202f\u00a0]{2,10})\s*€",
            full_text,
        )
        if price_m:
            estimate_low = _parse_price(price_m.group(1) + "€")
            estimate_high = _parse_price(price_m.group(2) + "€")
        else:
            single_m = re.search(
                r"[Ee]stimation\s+([\d\s\u202f\u00a0]{2,10})\s*€", full_text
            )
            if single_m:
                estimate_low = _parse_price(single_m.group(1) + "€")
                estimate_high = round(estimate_low * 1.5, -1) if estimate_low else None

        # Also check JSON-LD on the page for structured price data
        # (only available on detail pages, skip on listing pages)

        img_src = cdn_imgs[idx] if idx < len(cdn_imgs) else None

        lots.append(LotNormalized(
            external_id=f"drouot-{lot_id}",
            source=AuctionHouseEnum.DROUOT,
            title=title,
            estimate_low=estimate_low,
            estimate_high=estimate_high,
            current_price=estimate_low,
            currency="EUR",
            auction_date=auction_date,
            auction_house_name="Drouot",
            url=full_url,
            image_url=img_src,
            market_type="AUCTION",
            raw_data={"source": "drouot_scraperapi", "lot_id": lot_id},
        ))

    return lots


async def _fetch_via_scraperapi(
    client: httpx.AsyncClient,
    target_url: str,
    render: bool = True,
) -> Optional[str]:
    """Fetch a Drouot URL through ScraperAPI, returning rendered HTML."""
    params: dict = {
        "api_key": SCRAPERAPI_KEY,
        "url": target_url,
        "country_code": "fr",  # French IP — more likely to work for Drouot
    }
    if render:
        params["render"] = "true"

    try:
        resp = await client.get(SCRAPERAPI_URL, params=params, timeout=60.0)
        if resp.status_code == 200 and len(resp.text) > 2000:
            return resp.text
        logger.warning("scraperapi_bad_response", url=target_url,
                       status=resp.status_code, size=len(resp.text))
    except httpx.TimeoutException:
        logger.warning("scraperapi_timeout", url=target_url)
    except Exception as e:
        logger.warning("scraperapi_error", url=target_url, error=str(e))
    return None


async def fetch_lots(limit: int = 200) -> List[LotNormalized]:
    """
    Fetch upcoming fine art lots from Drouot via ScraperAPI headless rendering.
    Returns [] if SCRAPERAPI_KEY is not set.
    """
    return []  # temporarily disabled
    if not SCRAPERAPI_KEY:
        logger.info("drouot_scraperapi_skipped", reason="SCRAPERAPI_KEY not set")
        return []

    lots: List[LotNormalized] = []
    seen_ids: set = set()
    pages_to_try = max(1, limit // 24)  # ~24 lots per page

    async with httpx.AsyncClient(headers=HEADERS, follow_redirects=True, verify=False) as client:

        # 1. Scrape /en/auctions/future for upcoming sale pages, then follow into lots
        future_html = await _fetch_via_scraperapi(client, f"{BASE_URL}/en/auctions/future")
        if future_html:
            page_lots = _parse_lots_from_html(future_html, seen_ids)
            lots.extend(page_lots)
            logger.debug("drouot_future_page", found=len(page_lots))

        await asyncio.sleep(1)

        # 2. Scrape /en/lots?status=upcoming pages for the lot grid
        for page_num in range(1, pages_to_try + 1):
            if len(lots) >= limit:
                break

            page_url = f"{BASE_URL}/en/lots?status=upcoming&page={page_num}"
            html = await _fetch_via_scraperapi(client, page_url)
            if not html:
                break

            page_lots = _parse_lots_from_html(html, seen_ids)
            if not page_lots:
                logger.debug("drouot_empty_page", page=page_num)
                break

            lots.extend(page_lots)
            logger.debug("drouot_page", page=page_num, found=len(page_lots), total=len(lots))

            await asyncio.sleep(1.5)  # polite + ScraperAPI render time

    # Filter out lots with no pricing — can still be useful even without estimates
    # (Drouot sometimes omits estimates, title alone is enough for deal scoring)
    result = lots[:limit]
    logger.info("drouot_scraperapi_fetched", count=len(result), proxy="scraperapi")
    return result
