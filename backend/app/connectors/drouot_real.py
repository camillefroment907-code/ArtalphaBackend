"""
Drouot Real Connector
Scrapes the Drouot homepage which displays current highlighted lots.
Every lot returned has a verified real URL: https://www.drouot.com/fr/l/{id}-{slug}
"""
import asyncio
import json
import re
from datetime import datetime
from typing import List, Optional
import structlog

from app.models.schemas import LotNormalized, AuctionHouseEnum
from app.connectors.real_connector_base import RealConnector
from playwright_stealth import stealth_async

logger = structlog.get_logger().bind(connector="drouot_real")

_PLAYWRIGHT_ARGS = ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)
_BASE_URL = "https://www.drouot.com"

# Base pages — empty; we rely entirely on _discover_sale_urls for upcoming lots.
# The homepage only shows live countdown lots with garbage titles.
_BASE_SCRAPE_URLS: list = []

_FUTURE_SALES_URL = "https://www.drouot.com/en/auctions/future"


def _parse_price(text: str) -> Optional[float]:
    """Extract a price from messy text like 'Estimation2 000 €' or '8 000 €'."""
    if not text:
        return None
    # Remove thousands separators and currency symbols
    clean = re.sub(r"[€$£\s]", "", text).replace("\u202f", "").replace(",", "")
    try:
        return float(re.search(r"\d+(?:\.\d+)?", clean).group())
    except (AttributeError, ValueError):
        return None


_MONTHS = {
    # French
    "JANV": 1, "FÉVR": 2, "MARS": 3, "AVR": 4, "MAI": 5, "JUIN": 6,
    "JUIL": 7, "AOÛT": 8, "SEPT": 9, "OCT": 10, "NOV": 11, "DÉC": 12,
    # English
    "JAN": 1, "FEB": 2, "MAR": 3, "APR": 4, "MAY": 5, "JUN": 6,
    "JUL": 7, "AUG": 8, "SEP": 9, "OCT": 10, "NOV": 11, "DEC": 12,
    # Extra
    "FEV": 2,
}


def _parse_date(text: str) -> Optional[datetime]:
    """
    Parse dates in multiple formats:
    - French: '25 MARS - 13:00'
    - English: 'MAR 25 - 13:15'
    """
    t = text.upper().replace("AOÛT", "AOU").replace("FÉVR", "FEV")

    # Try English format: "MMM DD" — e.g. "MAR 25"
    m = re.search(r"([A-Z]{3})\s+(\d{1,2})", t)
    if m:
        month = _MONTHS.get(m.group(1))
        day = int(m.group(2))
        if month:
            year = datetime.utcnow().year
            try:
                dt = datetime(year, month, day)
                if (datetime.utcnow() - dt).days > 30:
                    dt = datetime(year + 1, month, day)
                return dt
            except ValueError:
                pass

    # Try French format: "25 MARS"
    m = re.search(r"(\d{1,2})\s+([A-Z]{3,4})", t)
    if m:
        day = int(m.group(1))
        month = _MONTHS.get(m.group(2)[:4])
        if month:
            year = datetime.utcnow().year
            try:
                dt = datetime(year, month, day)
                if (datetime.utcnow() - dt).days > 30:
                    dt = datetime(year + 1, month, day)
                return dt
            except ValueError:
                pass

    return None


_HTTPX_HEADERS = {
    "User-Agent": _USER_AGENT,
    "Accept-Language": "fr-FR,fr;q=0.9",
}


async def _fetch_lot_detail(url: str) -> dict:
    """Fetch real estimate and description from an individual Drouot lot page using httpx."""
    try:
        import httpx
        resp = None
        async with httpx.AsyncClient(headers=_HTTPX_HEADERS, follow_redirects=True, verify=False, timeout=15.0) as client:
            for attempt in range(2):
                try:
                    resp = await client.get(url, timeout=15.0)
                    break
                except Exception:
                    if attempt == 1:
                        return {}
                    await asyncio.sleep(2)
        if resp is None or resp.status_code != 200:
            return {}
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(resp.text, "lxml")
        result: dict = {}
        # JSON-LD: offers.price = low estimate, description
        for script in soup.select("script[type='application/ld+json']"):
            try:
                data = json.loads(script.string or "")
                if isinstance(data, list):
                    data = data[0] if data else {}
                offers = data.get("offers", {})
                if offers.get("price"):
                    result["estimate_low"] = float(str(offers["price"]).replace(",", "").replace(" ", ""))
                desc = data.get("description")
                if desc:
                    result["description"] = str(desc)[:2000]
            except Exception:
                pass
        # HTML: "Estimation 800 - 1 200 €" for the range
        page_text = soup.get_text()
        for pattern in [
            r"Estimation\s+([\d\s\u202f\u00a0]{2,10})\s*[-\u2013]\s*([\d\s\u202f\u00a0]{2,10})\s*\u20ac",
            r"([\d\s\u202f\u00a0]{3,10})\s*\u20ac\s*[-\u2013]\s*([\d\s\u202f\u00a0]{3,10})\s*\u20ac",
        ]:
            m = re.search(pattern, page_text)
            if m:
                try:
                    low = float(re.sub(r"[\s\u202f\u00a0]", "", m.group(1)))
                    high = float(re.sub(r"[\s\u202f\u00a0]", "", m.group(2)))
                    if 10 < low < 50_000_000 and low <= high * 1.2:
                        result["estimate_low"] = low
                        result["estimate_high"] = high
                        break
                except Exception:
                    pass
        if result.get("estimate_low") and not result.get("estimate_high"):
            result["estimate_high"] = round(result["estimate_low"] * 1.5, -1)
        return result
    except Exception:
        return {}


def _extract_lot_id(href: str) -> Optional[str]:
    """Extract numeric ID from '/fr/l/32722661-...' or '/en/l/32722661-...'."""
    m = re.search(r"/(?:fr|en)/l/(\d+)", href)
    return m.group(1) if m else None


async def _scrape_page(page, url: str, seen_ids: set = None) -> List[LotNormalized]:
    """Load a Drouot page and extract all lot cards."""
    from bs4 import BeautifulSoup

    if seen_ids is None:
        seen_ids = set()

    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=15000)
        await page.wait_for_timeout(2000)
    except Exception as e:
        logger.warning("Failed to load page", url=url, error=str(e))
        return []

    # Dismiss cookie banner
    try:
        await page.click(
            "#axeptio_btn_acceptAll, "
            "[data-testid='cookie-accept'], "
            ".cookie-accept, "
            "#accept-cookies, "
            "button:has-text('Accepter'), "
            "button:has-text('Tout accepter')",
            timeout=3000
        )
        await page.wait_for_timeout(500)
    except Exception:
        pass  # no banner, continue

    html = await page.content()
    soup = BeautifulSoup(html, "lxml")

    lots: List[LotNormalized] = []

    # Collect all lot <a> tags globally (deduplicated by lot_id)
    lot_pattern = re.compile(r"/(?:fr|en)/l/\d+")
    all_a_tags = soup.find_all("a", href=lot_pattern)

    # Build a global image list from the masonry container that holds all lots.
    # All lot <a> tags and all <img> tags live in the same flat container,
    # so we can match them positionally: images[i] belongs to all_a_tags[i].
    # Strategy: find the closest common ancestor of the first lot link, then
    # collect all imgs from it — but only those that are direct children of
    # immediate card wrappers (not logo/UI images).
    # Simpler approach: collect CDN images only (cdn.drouot.com or similar).
    # Collect actual lot photo URLs (pattern: cdn.drouot.com/d/image/lot?...)
    # These are distinct from category icons (cdn.drouot.com/assets?name=img_categories/...)
    cdn_imgs: List[Optional[str]] = []
    for img in soup.find_all("img"):
        src = img.get("src") or img.get("data-src") or ""
        if "cdn.drouot.com/d/image/lot" in src:
            # Upgrade to full resolution (ftall/small → full, 86KB vs 18KB)
            src = src.replace("size=ftall", "size=full").replace("size=small", "size=full")
            cdn_imgs.append(src)

    for idx, a_tag in enumerate(all_a_tags):
        href = a_tag.get("href", "")
        lot_id = _extract_lot_id(href)
        if not lot_id or lot_id in seen_ids:
            continue
        seen_ids.add(lot_id)

        full_url = (_BASE_URL + href) if href.startswith("/") else href
        # Normalize to French URL for consistency (both work)
        full_url = full_url.replace("/en/l/", "/fr/l/")

        # The link text contains: date, title, description, estimate
        # Collapse whitespace/newlines before parsing
        full_text = " ".join(a_tag.get_text(separator=" ", strip=True).split())

        # Strip leading countdown "01h 43m 26s" (with or without following lot number / date)
        cleaned = re.sub(r"^\d+h\s*\d+m\s*\d+s\s*", "", full_text).strip()
        # Strip leading lot number if still present: "54 - ARLES..." → "ARLES..."
        cleaned = re.sub(r"^\d{1,4}\s*[-–]\s*", "", cleaned).strip()
        # Strip leading date prefix "MAR 25 - 13:00" or "25 MARS - 13:00"
        cleaned = re.sub(
            r"^(?:[A-Z]{3}\s+\d{1,2}|\d{1,2}\s+[A-ZÉ]{3,4})\s*[-–]\s*\d{2}:\d{2}\s*",
            "",
            cleaned,
        ).strip()

        title_match = cleaned if cleaned else full_text
        title = title_match[:200]

        # Parse date
        auction_date = _parse_date(full_text)

        # Match image by position: cdn_imgs[idx] for this lot
        img_src = cdn_imgs[idx] if idx < len(cdn_imgs) else None

        if not title or len(title) < 3:
            continue

        # Try to extract estimate from the card text inline — avoids per-lot HTTP requests
        estimate_low: Optional[float] = None
        estimate_high: Optional[float] = None
        price_m = re.search(r"(\d[\d\s\u202f]{2,10})\s*€\s*[-–]\s*(\d[\d\s\u202f]{2,10})\s*€", full_text)
        if price_m:
            estimate_low = _parse_price(price_m.group(1) + "€")
            estimate_high = _parse_price(price_m.group(2) + "€")
        else:
            single_m = re.search(r"Estimation\s+([\d\s\u202f]{2,10})\s*€", full_text, re.IGNORECASE)
            if single_m:
                estimate_low = _parse_price(single_m.group(1) + "€")
                estimate_high = round(estimate_low * 1.5, -1) if estimate_low else None

        lot = LotNormalized(
            external_id=f"drouot-real-{lot_id}",
            source=AuctionHouseEnum.DROUOT,
            title=title,
            estimate_low=estimate_low,
            estimate_high=estimate_high,
            current_price=None,
            currency="EUR",
            auction_date=auction_date,
            auction_house_name="Hôtel Drouot — Paris",
            url=full_url,
            image_url=img_src,
            raw_data={"real": True, "lot_id": lot_id, "source_url": url},
        )
        lots.append(lot)

    return lots


async def _discover_sale_urls(page) -> List[str]:
    """Fetch /en/auctions/future and return upcoming sale page URLs (max 12)."""
    from bs4 import BeautifulSoup
    try:
        await page.goto(_FUTURE_SALES_URL, wait_until="domcontentloaded", timeout=15000)
        await page.wait_for_timeout(2000)
        # Dismiss cookie banner
        try:
            await page.click(
                "#axeptio_btn_acceptAll, "
                "[data-testid='cookie-accept'], "
                ".cookie-accept, "
                "#accept-cookies, "
                "button:has-text('Accepter'), "
                "button:has-text('Tout accepter')",
                timeout=3000
            )
            await page.wait_for_timeout(500)
        except Exception:
            pass  # no banner, continue
        html = await page.content()
        soup = BeautifulSoup(html, "lxml")
        sale_pattern = re.compile(r"/(?:fr|en)/v/\d+")
        seen: set = set()
        urls: List[str] = []
        for a in soup.find_all("a", href=sale_pattern):
            href = a["href"].split("?")[0]  # strip query params
            if not href.startswith("http"):
                href = _BASE_URL + href
            if href not in seen:
                seen.add(href)
                urls.append(href)
        logger.info("Discovered Drouot sale pages", count=len(urls))
        return urls[:12]
    except Exception as e:
        logger.warning("Could not discover sale URLs", error=str(e))
        return []


class DrouotRealConnector(RealConnector):
    """Scrapes the Drouot website for live lots with real URLs."""

    async def fetch_lots(self, limit: int = 500) -> List[LotNormalized]:
        try:
            from playwright.async_api import async_playwright
        except ImportError:
            logger.warning("Playwright not available")
            return []

        all_lots: List[LotNormalized] = []
        seen_ids: set = set()

        try:
            async with async_playwright() as pw:
                browser = await pw.chromium.launch(
                    headless=True,
                    args=_PLAYWRIGHT_ARGS,
                )
                ctx = await browser.new_context(
                    user_agent=_USER_AGENT,
                    viewport={"width": 1280, "height": 900},
                )

                # Discover upcoming sale pages dynamically
                discovery_page = await ctx.new_page()
                await stealth_async(discovery_page)
                try:
                    sale_urls = await _discover_sale_urls(discovery_page)
                finally:
                    await discovery_page.close()

                # Fallback: known art-category pages on Drouot if discovery yields nothing
                if not sale_urls:
                    sale_urls = [
                        "https://www.drouot.com/en/auctions?category=paintings",
                        "https://www.drouot.com/en/auctions?category=sculptures",
                        "https://www.drouot.com/en/auctions?category=prints",
                    ]
                    logger.warning("No sale URLs discovered — using fallback category pages")

                urls_to_scrape = _BASE_SCRAPE_URLS + sale_urls

                for url in urls_to_scrape:
                    if len(all_lots) >= limit:
                        break
                    page = await ctx.new_page()
                    await stealth_async(page)
                    try:
                        page_lots = await _scrape_page(page, url, seen_ids=seen_ids)
                        for lot in page_lots:
                            if self.validate_lot(lot):
                                all_lots.append(lot)
                    finally:
                        await page.close()

                    await asyncio.sleep(1.0)

                await browser.close()

        except Exception as e:
            logger.error("Drouot real connector failed", error=str(e))

        logger.info("Drouot real: fetched lots", count=len(all_lots))
        return all_lots[:limit]
