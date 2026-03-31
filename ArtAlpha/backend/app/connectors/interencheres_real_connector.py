"""
Interenchères Real Connector — Playwright-based scraping.
Only scrapes pages that have been confirmed to return real lot data.
Wraps Cloudflare gracefully: returns [] if page is challenged.

Real lot URLs: https://www.interencheres.com/art-decoration/{sale}/lot-{id}.html
"""
import asyncio
import re
from datetime import datetime, timedelta
from typing import List, Optional
import structlog

from app.models.schemas import LotNormalized, AuctionHouseEnum

logger = structlog.get_logger().bind(connector="interencheres_real")

_BASE_URL = "https://www.interencheres.com"
_PLAYWRIGHT_ARGS = ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

# Category pages confirmed to serve real lot cards via Playwright
_CATEGORY_URLS = [
    "/art-decoration/peintures-et-dessins/",
]

# Cloudflare challenge pages are ~31KB; real pages are 400KB+
_MIN_PAGE_SIZE = 100_000


def _parse_price(text: str) -> Optional[float]:
    """Extract numeric value from price strings like '500 €' or '1 200 €'."""
    if not text:
        return None
    clean = re.sub(r"[€$£\s\xa0\u202f]", "", text)
    try:
        return float(re.search(r"\d+(?:[.,]\d+)?", clean).group().replace(",", "."))
    except (AttributeError, ValueError):
        return None


def _parse_cards(html: str, source_url: str) -> List[LotNormalized]:
    """Parse lot cards from a fully-rendered Interenchères category page."""
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, "lxml")
    lots: List[LotNormalized] = []
    seen_ids: set = set()

    lot_pat = re.compile(r"/(?:art-decoration|mobilier|bijoux|vehicules|biens)[^\"']+/lot-(\d+)\.html")

    # Each card is a div.autoqa-sale-details-item containing exactly one lot <a>
    cards = soup.select("div.autoqa-sale-details-item")

    for card in cards:
        a_tag = card.select_one("a[href]")
        if not a_tag:
            continue

        href = a_tag.get("href", "")
        m = lot_pat.search(href)
        if not m:
            continue

        lot_id = m.group(1)
        if lot_id in seen_ids:
            continue
        seen_ids.add(lot_id)

        full_url = _BASE_URL + href if href.startswith("/") else href

        # Title — .autoqa-itemcard-title > div
        title_el = card.select_one(".autoqa-itemcard-title div")
        if not title_el:
            title_el = card.select_one("[class*=title]")
        title = title_el.get_text(strip=True) if title_el else ""
        if not title or len(title) < 3:
            # Fallback: use link text
            title = a_tag.get_text(strip=True)[:200]
        if not title or len(title) < 3:
            continue

        # Estimate — inside .autoqa-itemcard-adjudicated-amount
        est_el = card.select_one(".autoqa-itemcard-adjudicated-amount span.mx-1")
        estimate_low = _parse_price(est_el.get_text()) if est_el else None
        estimate_high = round(estimate_low * 1.5, -1) if estimate_low else None

        # Image
        img = card.select_one("img")
        image_url = None
        if img:
            src = img.get("src") or img.get("data-src") or ""
            if src:
                if src.startswith("//"):
                    src = "https:" + src
                elif src.startswith("/"):
                    src = _BASE_URL + src
                image_url = src if src.startswith("http") else None

        # External ID from the <a id="..."> attribute (the lot numeric id)
        ext_id = a_tag.get("id") or lot_id

        lots.append(
            LotNormalized(
                external_id=f"ie-{ext_id}",
                source=AuctionHouseEnum.INTERENCHERES,
                title=title[:500],
                estimate_low=estimate_low,
                estimate_high=estimate_high,
                current_price=estimate_low,
                currency="EUR",
                # Default to 14 days out; enricher can refine if needed
                auction_date=datetime.utcnow() + timedelta(days=14),
                auction_house_name="Interenchères",
                url=full_url,
                image_url=image_url,
                raw_data={"real": True, "source": "interencheres", "source_page": source_url},
            )
        )

    return lots


async def fetch_lots(limit: int = 100) -> List[LotNormalized]:
    """Scrape Interenchères category pages with Playwright. Returns [] if Cloudflare blocks."""
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        logger.warning("Playwright not available")
        return []

    all_lots: List[LotNormalized] = []
    seen_ids: set = set()

    try:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=True, args=_PLAYWRIGHT_ARGS)
            ctx = await browser.new_context(
                user_agent=_USER_AGENT,
                viewport={"width": 1280, "height": 900},
                locale="fr-FR",
            )

            for cat_path in _CATEGORY_URLS:
                if len(all_lots) >= limit:
                    break

                page = await ctx.new_page()
                try:
                    url = _BASE_URL + cat_path
                    await page.goto(url, wait_until="domcontentloaded", timeout=25000)
                    await page.wait_for_timeout(4000)

                    html = await page.content()

                    if len(html) < _MIN_PAGE_SIZE:
                        logger.warning("Cloudflare challenge detected, skipping", url=url, size=len(html))
                        continue

                    page_lots = _parse_cards(html, url)
                    for lot in page_lots:
                        if lot.external_id not in seen_ids and len(all_lots) < limit:
                            seen_ids.add(lot.external_id)
                            all_lots.append(lot)

                    logger.info("IE page scraped", url=cat_path, found=len(page_lots), total=len(all_lots))

                except Exception as e:
                    logger.warning("IE page failed", url=cat_path, error=str(e))
                finally:
                    await page.close()

                await asyncio.sleep(1.5)

            await browser.close()

    except Exception as e:
        logger.error("Interenchères real connector failed", error=str(e))

    logger.info("Interenchères real: fetched lots", count=len(all_lots))
    return all_lots[:limit]
