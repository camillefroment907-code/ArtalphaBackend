"""
Interencheres Auction Connector
Covers hundreds of French regional auction houses.
HTTP scraping with Playwright fallback.
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

logger = structlog.get_logger().bind(connector="interencheres")
settings = get_settings()

BASE_URL = "https://www.interencheres.com"
SEARCH_URL = f"{BASE_URL}/fr/recherche/"
HOUSE_REPUTATION = 0.72

MOCK_REGIONAL_HOUSES = [
    "Maître Dupont — Lyon",
    "Étude Blanchard — Bordeaux",
    "SVV Rossini — Paris",
    "Maison de Ventes Anjou — Angers",
    "Enchères Provence — Marseille",
    "SVV Millon — Paris",
    "Ventes aux enchères Strasbourg",
    "Cabinet Brest Enchères",
    "SVV Rouillac — Tours",
]

MOCK_CATEGORIES = {
    "Mobilier": [
        {"artist": "Louis XVI Style", "base_price": 1200},
        {"artist": "Art Déco Canapé", "base_price": 800},
        {"artist": "Bergère d'époque Napoléon III", "base_price": 450},
    ],
    "Bijoux": [
        {"artist": "Bague diamants anciens", "base_price": 3500},
        {"artist": "Collier perles naturelles", "base_price": 2800},
        {"artist": "Montre Cartier Tank", "base_price": 4500},
        {"artist": "Broche Art Nouveau", "base_price": 900},
    ],
    "Arts d'Asie": [
        {"artist": "Vase porcelaine Chine", "base_price": 2000},
        {"artist": "Netsuke ivoire Japon", "base_price": 650},
        {"artist": "Statuette bronze Bouddha", "base_price": 1500},
    ],
    "Livres & Manuscrits": [
        {"artist": "Édition originale Proust", "base_price": 800},
        {"artist": "Manuscrit enluminé XVe", "base_price": 5000},
        {"artist": "Reliure maroquin XVIIIe", "base_price": 350},
    ],
    "Argenterie": [
        {"artist": "Service de table Christofle", "base_price": 1800},
        {"artist": "Couverts argent massif", "base_price": 600},
    ],
    "Tableaux Anciens": [
        {"artist": "École Flamande XVIIe", "base_price": 4500},
        {"artist": "Portrait XVIIIe non signé", "base_price": 1200},
        {"artist": "Nature morte hollandaise", "base_price": 6500},
    ],
}


def _generate_mock_lot(index: int) -> LotNormalized:
    category = random.choice(list(MOCK_CATEGORIES.keys()))
    item_data = random.choice(MOCK_CATEGORIES[category])
    base = item_data["base_price"]

    variance = random.uniform(0.6, 1.5)
    est_low = round(base * variance * random.uniform(0.6, 1.0), -1)
    est_high = round(est_low * random.uniform(1.15, 1.6), -1)

    is_deal = random.random() < 0.25
    if is_deal:
        current = round(est_low * random.uniform(0.30, 0.75), -1)
    else:
        current = round(est_low * random.uniform(0.80, 1.35), -1)

    house = random.choice(MOCK_REGIONAL_HOUSES)
    auction_date = datetime.utcnow() + timedelta(days=random.randint(0, 30))
    lot_num = str(random.randint(1, 300)).zfill(3)

    return LotNormalized(
        external_id=f"ie-{auction_date.strftime('%Y%m%d')}-{lot_num}",
        source=AuctionHouseEnum.INTERENCHERES,
        title=f"{item_data['artist']}",
        artist_name_raw=item_data["artist"] if category == "Tableaux Anciens" else None,
        description=f"Lot n°{lot_num}. {category}. Vente organisée par {house}.",
        lot_number=lot_num,
        category=category,
        estimate_low=est_low,
        estimate_high=est_high,
        current_price=current,
        currency="EUR",
        auction_date=auction_date,
        auction_house_name=house,
        auction_sale_title=f"Vente aux enchères — {house.split('—')[-1].strip()}",
        url=build_url("interencheres", item_data['artist']),
        image_url=f"https://picsum.photos/seed/ie{index}/600/400",
        raw_data={"source": "mock", "category": category},
    )


def _parse_lot_card(card) -> Optional[LotNormalized]:
    """Parse a BeautifulSoup card into LotNormalized."""
    title_el = card.select_one(
        "h2, h3, h4, [class*='title'], [class*='Title'], [class*='lot-title'], "
        "[class*='designation'], [class*='libelle']"
    )
    if not title_el:
        return None

    title = title_el.get_text(strip=True)
    if not title:
        return None

    def parse_price(text: str) -> Optional[float]:
        clean = text.replace("€", "").replace("\u202f", "").replace(" ", "").replace(",", ".").strip()
        try:
            return float("".join(c for c in clean if c.isdigit() or c == "."))
        except ValueError:
            return None

    # Estimate extraction
    est_el = card.select_one(
        "[class*='estimate'], [class*='Estimate'], [class*='estimation'], "
        "[class*='fourchette'], [class*='prix']"
    )
    est_low = est_high = None
    if est_el:
        est_text = est_el.get_text(strip=True)
        # Format: "100 – 200 €" or "100/200"
        for sep in ["–", "-", "/", "à"]:
            if sep in est_text:
                parts = est_text.split(sep)
                if len(parts) >= 2:
                    est_low = parse_price(parts[0])
                    est_high = parse_price(parts[1])
                    break

    link_el = card.select_one("a[href]")
    href = link_el.get("href") if link_el else None
    if href and href.startswith("/"):
        href = BASE_URL + href

    img_el = card.select_one("img")
    img_src = img_el.get("src") or img_el.get("data-src") if img_el else None
    if img_src and img_src.startswith("/"):
        img_src = BASE_URL + img_src

    house_el = card.select_one(
        "[class*='house'], [class*='etude'], [class*='operateur'], [class*='vendeur']"
    )
    house_name = house_el.get_text(strip=True) if house_el else None

    date_el = card.select_one("[class*='date'], time")
    auction_date = None
    if date_el:
        date_text = date_el.get("datetime") or date_el.get_text(strip=True)
        try:
            auction_date = datetime.fromisoformat(date_text.replace("Z", "+00:00"))
        except (ValueError, AttributeError):
            pass

    lot_id = card.get("data-lot-id") or card.get("data-id") or card.get("id")

    # Use real lot URL if available, else fall back to verified search URL
    if href and "/lot/" in href and href.startswith("http"):
        final_url = href
    elif lot_id and not str(lot_id).startswith("ie-"):
        final_url = build_lot_url("interencheres", str(lot_id))
    else:
        final_url = build_url("interencheres", None)

    return LotNormalized(
        external_id=lot_id,
        source=AuctionHouseEnum.INTERENCHERES,
        title=title,
        auction_house_name=house_name,
        estimate_low=est_low,
        estimate_high=est_high,
        currency="EUR",
        auction_date=auction_date,
        url=final_url,
        image_url=img_src,
        raw_data={"html": str(card)[:500], "source": "real_http"},
    )


async def _fetch_via_http(limit: int) -> List[LotNormalized]:
    """Direct HTTP scrape of interencheres.com."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
    }

    lots: List[LotNormalized] = []

    async with httpx.AsyncClient(headers=headers, timeout=30.0, follow_redirects=True) as client:
        try:
            resp = await client.get(
                SEARCH_URL,
                params={"tri": "date_asc", "enchere_type": "upcoming"},
            )
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "lxml")

            lot_cards = soup.select(
                ".lot-card, [class*='lot-card'], [class*='LotCard'], "
                "[class*='objet'], [data-lot-id], article.lot, "
                "[class*='result-item'], [class*='vente-lot']"
            )
            logger.info("Interenchères HTTP scrape", found=len(lot_cards), status=resp.status_code)

            for card in lot_cards[:limit]:
                try:
                    lot = _parse_lot_card(card)
                    if lot:
                        lots.append(lot)
                except Exception as e:
                    logger.warning("Failed to parse IE card", error=str(e))

        except httpx.HTTPError as e:
            logger.warning("Interenchères HTTP error", error=str(e))

    return lots


async def _fetch_via_playwright(limit: int) -> List[LotNormalized]:
    """Playwright fallback for JS-rendered content."""
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        logger.warning("Playwright not installed — skipping")
        return []

    lots: List[LotNormalized] = []
    logger.info("Interenchères: launching Playwright")

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
            )
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                viewport={"width": 1280, "height": 900},
                locale="fr-FR",
            )
            page = await context.new_page()

            try:
                await page.goto(
                    f"{SEARCH_URL}?tri=date_asc&enchere_type=upcoming",
                    wait_until="networkidle",
                    timeout=45000,
                )
                await page.wait_for_timeout(3000)

                # Accept cookie banner if present
                try:
                    await page.click("[id*='cookie'] button, [class*='cookie'] button", timeout=3000)
                except Exception:
                    pass

                html = await page.content()
                soup = BeautifulSoup(html, "lxml")

                lot_cards = soup.select(
                    ".lot-card, [class*='lot-card'], [class*='LotCard'], "
                    "[class*='objet'], [data-lot-id], article.lot, "
                    "[class*='result-item'], [class*='vente-lot']"
                )
                logger.info("Interenchères Playwright scrape", found=len(lot_cards))

                for card in lot_cards[:limit]:
                    try:
                        lot = _parse_lot_card(card)
                        if lot:
                            lots.append(lot)
                    except Exception as e:
                        logger.warning("Failed to parse IE Playwright card", error=str(e))

            except Exception as e:
                logger.warning("Interenchères Playwright page error", error=str(e))
            finally:
                await browser.close()

    except Exception as e:
        logger.warning("Interenchères Playwright launch error", error=str(e))

    return lots


async def fetch_lots(limit: int = 50) -> List[LotNormalized]:
    """
    Main entry point.
    1. Try HTTP scraping
    2. Fall back to Playwright if < 3 results
    3. Fall back to mock data
    """
    logger.info("Interenchères: starting HTTP scrape")
    lots = await _fetch_via_http(limit)

    if len(lots) < 3:
        logger.info("Interenchères: HTTP returned few results, trying Playwright", count=len(lots))
        pw_lots = await _fetch_via_playwright(limit)
        if pw_lots:
            lots = pw_lots

    if len(lots) < 3:
        logger.info("Interenchères: falling back to mock data", real_count=len(lots))
        await asyncio.sleep(0.1)
        return [_generate_mock_lot(i) for i in range(limit)]

    logger.info("Interenchères: returning real lots", count=len(lots))
    return lots[:limit]


CONNECTOR_META = {
    "name": "Interenchères",
    "source": AuctionHouseEnum.INTERENCHERES,
    "house_reputation_score": HOUSE_REPUTATION,
    "currency": "EUR",
    "country": "FR",
    "supports_real_time": False,
    "poll_interval_minutes": 20,
}
