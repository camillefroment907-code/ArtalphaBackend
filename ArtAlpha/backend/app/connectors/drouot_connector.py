"""
Drouot Auction House Connector
Real HTTP scraping with Playwright JS-render fallback and mock fallback for development.
"""
import httpx
import asyncio
from bs4 import BeautifulSoup
from datetime import datetime, timedelta
from typing import List, Optional
from urllib.parse import quote_plus
import random
import structlog

from app.models.schemas import LotNormalized, AuctionHouseEnum
from app.config import get_settings
from app.utils.auction_urls import build_url, build_lot_url

logger = structlog.get_logger().bind(connector="drouot")
settings = get_settings()

BASE_URL = "https://www.drouot.com"
SEARCH_URL = f"{BASE_URL}/lots"

HOUSE_REPUTATION = 0.82

MOCK_ARTISTS = [
    {"name": "Bernard Buffet", "category": "Paintings", "base_price": 1800},
    {"name": "Fernand Léger", "category": "Paintings", "base_price": 45000},
    {"name": "Niki de Saint Phalle", "category": "Sculptures", "base_price": 12000},
    {"name": "Jean Dubuffet", "category": "Paintings", "base_price": 28000},
    {"name": "César Baldaccini", "category": "Sculptures", "base_price": 8500},
    {"name": "Yves Klein", "category": "Paintings", "base_price": 120000},
    {"name": "Pierre Soulages", "category": "Paintings", "base_price": 85000},
    {"name": "Zao Wou-Ki", "category": "Paintings", "base_price": 35000},
    {"name": "Raymond Moretti", "category": "Prints", "base_price": 400},
    {"name": "Michel Ciry", "category": "Drawings", "base_price": 650},
    {"name": "Gustave Moreau", "category": "Paintings", "base_price": 18000},
    {"name": "Henri Fantin-Latour", "category": "Paintings", "base_price": 9000},
    {"name": "Albert Marquet", "category": "Paintings", "base_price": 22000},
    {"name": "Jean-Baptiste Carpeaux", "category": "Sculptures", "base_price": 15000},
    {"name": "Théophile Steinlen", "category": "Prints", "base_price": 1200},
]

MOCK_MEDIUMS = [
    "Huile sur toile", "Aquarelle sur papier", "Lithographie signée",
    "Bronze patiné", "Pastel sur papier", "Dessin au fusain",
    "Gravure originale", "Sérigraphie numérotée", "Technique mixte sur toile",
]

MOCK_AUCTION_SALES = [
    "Art Moderne & Contemporain — Paris",
    "Importants Tableaux Anciens",
    "Sculptures XIXe et XXe siècles",
    "Collection Privée Parisienne",
    "Estampes & Livres Illustrés",
    "Arts Décoratifs & Design",
]


def _generate_mock_lot(index: int) -> LotNormalized:
    artist_data = random.choice(MOCK_ARTISTS)
    base = artist_data["base_price"]

    variance = random.uniform(0.7, 1.4)
    est_low = round(base * variance * random.uniform(0.5, 0.9), -1)
    est_high = round(est_low * random.uniform(1.2, 1.8), -1)

    is_deal = random.random() < 0.30
    if is_deal:
        current = round(est_low * random.uniform(0.40, 0.80), -1)
    else:
        current = round(est_low * random.uniform(0.85, 1.30), -1)

    auction_offset_days = random.randint(1, 45)
    auction_date = datetime.utcnow() + timedelta(days=auction_offset_days)
    medium = random.choice(MOCK_MEDIUMS)
    sale = random.choice(MOCK_AUCTION_SALES)

    h = random.randint(20, 120)
    w = random.randint(15, 90)
    dims = f"{h} × {w} cm"
    lot_num = str(random.randint(1, 400)).zfill(3)

    return LotNormalized(
        external_id=f"drouot-{auction_date.strftime('%Y%m%d')}-{lot_num}",
        source=AuctionHouseEnum.DROUOT,
        title=f"{artist_data['name']} — {medium.split()[0].capitalize()} original",
        artist_name_raw=artist_data["name"],
        description=(
            f"Œuvre originale de {artist_data['name']}. {medium}. "
            f"Dimensions : {dims}. Lot n°{lot_num} de la vente \"{sale}\"."
        ),
        lot_number=lot_num,
        category=artist_data["category"],
        medium=medium,
        dimensions=dims,
        estimate_low=est_low,
        estimate_high=est_high,
        current_price=current,
        currency="EUR",
        auction_date=auction_date,
        auction_house_name="Hôtel Drouot — Paris",
        auction_sale_title=sale,
        url=build_url("drouot", artist_data['name']),
        image_url=f"https://picsum.photos/seed/drouot{index}/600/400",
        raw_data={"source": "mock", "lot_number": lot_num},
    )


def _parse_lot_card(card) -> Optional[LotNormalized]:
    title_el = card.select_one(".lot-title, h2, h3, [class*='title']")
    if not title_el:
        return None

    title = title_el.get_text(strip=True)
    if not title:
        return None

    def get_price(selector: str) -> Optional[float]:
        el = card.select_one(selector)
        if not el:
            return None
        text = el.get_text(strip=True).replace("€", "").replace("\u202f", "").replace(" ", "").replace(",", "")
        try:
            return float("".join(c for c in text if c.isdigit() or c == "."))
        except ValueError:
            return None

    est_el = card.select_one(".estimate, [class*='estimate']")
    est_text = est_el.get_text(strip=True) if est_el else ""
    est_parts = [p.strip().replace("€", "").replace(",", "").replace("\u202f", "") for p in est_text.split("–")]

    try:
        est_low = float(est_parts[0]) if est_parts and est_parts[0] else None
        est_high = float(est_parts[1]) if len(est_parts) > 1 and est_parts[1] else None
    except (ValueError, IndexError):
        est_low = est_high = None

    link_el = card.select_one("a")
    href = link_el.get("href") if link_el else None
    if href and href.startswith("/"):
        href = BASE_URL + href

    img_el = card.select_one("img")
    img_src = img_el.get("src") or img_el.get("data-src") if img_el else None

    lot_id = card.get("data-lot-id") or card.get("data-id") or card.get("id")

    # Use real lot URL if available, else fall back to verified search URL
    if href and "/lot/" in href and href.startswith("http"):
        final_url = href
    elif lot_id:
        final_url = build_lot_url("drouot", lot_id)
    else:
        final_url = build_url("drouot", title.split("—")[0].strip() if "—" in title else None)

    return LotNormalized(
        external_id=lot_id,
        source=AuctionHouseEnum.DROUOT,
        title=title,
        estimate_low=est_low,
        estimate_high=est_high,
        current_price=get_price(".current-price, .hammer-price, [class*='price']"),
        currency="EUR",
        url=final_url,
        image_url=img_src,
        raw_data={"html": str(card)[:500], "source": "real_http"},
    )


async def _fetch_via_http(limit: int) -> List[LotNormalized]:
    """Direct HTTP scrape with BeautifulSoup."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
    }

    lots: List[LotNormalized] = []

    async with httpx.AsyncClient(headers=headers, timeout=30.0, follow_redirects=True) as client:
        try:
            resp = await client.get(SEARCH_URL, params={"sort": "date_asc", "limit": limit})
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "lxml")

            lot_cards = soup.select(
                ".lot-card, [data-lot-id], .auction-lot, "
                "[class*='LotCard'], [class*='lot-item'], article[class*='lot']"
            )
            logger.info("Drouot HTTP scrape", found=len(lot_cards), url=str(resp.url))

            for card in lot_cards[:limit]:
                try:
                    lot = _parse_lot_card(card)
                    if lot:
                        lots.append(lot)
                except Exception as e:
                    logger.warning("Failed to parse lot card", error=str(e))

        except httpx.HTTPError as e:
            logger.warning("Drouot HTTP error", error=str(e))

    return lots


async def _fetch_via_playwright(limit: int) -> List[LotNormalized]:
    """Playwright fallback for JS-rendered content."""
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        logger.warning("Playwright not installed — skipping")
        return []

    lots: List[LotNormalized] = []
    logger.info("Drouot: launching Playwright")

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
            )
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                viewport={"width": 1280, "height": 900},
            )
            page = await context.new_page()

            try:
                await page.goto(SEARCH_URL, wait_until="domcontentloaded", timeout=30000)
                await page.wait_for_timeout(2500)

                html = await page.content()
                soup = BeautifulSoup(html, "lxml")
                lot_cards = soup.select(
                    ".lot-card, [data-lot-id], .auction-lot, "
                    "[class*='LotCard'], [class*='lot-item'], article[class*='lot']"
                )
                logger.info("Drouot Playwright scrape", found=len(lot_cards))

                for card in lot_cards[:limit]:
                    try:
                        lot = _parse_lot_card(card)
                        if lot:
                            lots.append(lot)
                    except Exception as e:
                        logger.warning("Failed to parse Playwright card", error=str(e))

            except Exception as e:
                logger.warning("Drouot Playwright page error", error=str(e))
            finally:
                await browser.close()

    except Exception as e:
        logger.warning("Drouot Playwright launch error", error=str(e))

    return lots


async def fetch_lots(limit: int = 50) -> List[LotNormalized]:
    """
    Main entry point.
    1. Try HTTP scraping
    2. Fall back to Playwright if < 3 results
    3. Fall back to mock data
    """
    logger.info("Drouot: starting HTTP scrape")
    lots = await _fetch_via_http(limit)

    if len(lots) < 3:
        logger.info("Drouot: HTTP returned few results, trying Playwright", count=len(lots))
        pw_lots = await _fetch_via_playwright(limit)
        if pw_lots:
            lots = pw_lots

    if len(lots) < 3:
        logger.info("Drouot: falling back to mock data", real_count=len(lots))
        await asyncio.sleep(0.1)
        return [_generate_mock_lot(i) for i in range(limit)]

    logger.info("Drouot: returning real lots", count=len(lots))
    return lots[:limit]


CONNECTOR_META = {
    "name": "Drouot",
    "source": AuctionHouseEnum.DROUOT,
    "house_reputation_score": HOUSE_REPUTATION,
    "currency": "EUR",
    "country": "FR",
    "supports_real_time": False,
    "poll_interval_minutes": 15,
}
