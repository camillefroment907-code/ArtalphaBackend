"""
Bruun Rasmussen connector — Danish auction house (bruun-rasmussen.dk).
No API key required. Scrapes HTML listing pages then parses JSON-LD per lot.

Each lot page exposes a schema.org/Product JSON-LD block with:
  name, description, sku, image[], offers.price, offers.priceCurrency,
  offers.priceValidUntil, offers.url

Artist is extracted from the title prefix before the first ':'.
"""
import asyncio
import re
import json as _json
import structlog
from datetime import datetime
from typing import List, Optional
import httpx
from app.models.schemas import LotNormalized

logger = structlog.get_logger()

BASE_URL = "https://bruun-rasmussen.dk"
LISTING_URL = BASE_URL + "/m/lots"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}
# Max concurrent lot-page fetches — be polite
_SEMAPHORE_SIZE = 8


def _extract_lot_urls(html: str) -> List[str]:
    """Return unique /m/lots/{SKU} paths from a listing page."""
    return list(dict.fromkeys(
        re.findall(r'href="(/m/lots/[A-Z0-9]{8,})"', html)
    ))


def _parse_lot_html(html: str, path: str) -> Optional[LotNormalized]:
    """Parse JSON-LD from an individual lot page."""
    try:
        blocks = re.findall(
            r'<script type="application/ld\+json">(.*?)</script>',
            html, re.DOTALL
        )
        data: Optional[dict] = None
        for block in blocks:
            try:
                d = _json.loads(block)
                if d.get("@type") == "Product":
                    data = d
                    break
            except Exception:
                continue

        if not data:
            return None

        sku = str(data.get("sku") or path.rsplit("/", 1)[-1])
        raw_name = str(data.get("name") or "").strip()
        if not raw_name or len(raw_name) < 3:
            return None

        # Artist is the part before the first ':'  ("Rolex: A watch..." → "Rolex")
        if ":" in raw_name:
            artist = raw_name.split(":", 1)[0].strip()
            title = raw_name
        else:
            artist = None
            title = raw_name

        description = str(data.get("description") or "").strip() or None

        offers = data.get("offers") or {}
        price_str = offers.get("price")
        try:
            price = float(str(price_str).replace(",", "").strip()) if price_str else None
        except (ValueError, TypeError):
            price = None

        currency = str(offers.get("priceCurrency") or "DKK").upper()

        # priceValidUntil is the auction end date ("2026-05-27")
        date_str = offers.get("priceValidUntil")
        auction_date: Optional[datetime] = None
        if date_str:
            try:
                auction_date = datetime.fromisoformat(str(date_str)[:10])
            except Exception:
                pass

        # Skip lots whose auction has already ended
        if auction_date and auction_date < datetime.utcnow():
            return None

        images = data.get("image") or []
        if isinstance(images, str):
            images = [images]
        image_url = images[0] if images else None

        lot_url = offers.get("url") or f"{BASE_URL}{path}"

        return LotNormalized(
            external_id=f"br-{sku}",
            source="other",
            title=title[:500],
            artist_name_raw=artist[:500] if artist else None,
            estimate_low=price,
            estimate_high=None,
            current_price=price,
            currency=currency,
            auction_date=auction_date,
            auction_house_name="Bruun Rasmussen",
            image_url=image_url,
            url=lot_url,
            category="Fine Art",
            medium=None,
            dimensions=None,
            raw_data={"source": "bruun_rasmussen", "sku": sku},
        )
    except Exception as e:
        logger.debug("br_parse_error", path=path, error=str(e))
        return None


async def _fetch_lot(
    client: httpx.AsyncClient,
    sem: asyncio.Semaphore,
    path: str,
) -> Optional[LotNormalized]:
    async with sem:
        try:
            resp = await client.get(BASE_URL + path, headers=HEADERS, timeout=20)
            if resp.status_code == 200:
                return _parse_lot_html(resp.text, path)
        except Exception as e:
            logger.debug("br_lot_fetch_error", path=path, error=str(e))
        return None


async def fetch_lots(limit: int = 300) -> List[LotNormalized]:
    """
    Fetch lots from Bruun Rasmussen. No API key required.
    Paginates listing pages then fetches each lot concurrently.
    """
    collected_paths: list[str] = []
    pages_needed = max(1, (limit // 60) + 1)

    try:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            # --- Phase 1: collect lot paths from listing pages ---
            for page in range(1, pages_needed + 1):
                if len(collected_paths) >= limit:
                    break
                try:
                    url = LISTING_URL if page == 1 else f"{LISTING_URL}?page={page}"
                    resp = await client.get(url, headers=HEADERS, timeout=20)
                    if resp.status_code != 200:
                        logger.warning("br_listing_failed", page=page, status=resp.status_code)
                        break
                    paths = _extract_lot_urls(resp.text)
                    if not paths:
                        break  # No more lots
                    for p in paths:
                        if p not in collected_paths:
                            collected_paths.append(p)
                    logger.debug("br_listing_page", page=page, found=len(paths))
                    await asyncio.sleep(0.5)
                except Exception as e:
                    logger.warning("br_listing_error", page=page, error=str(e))
                    break

            collected_paths = collected_paths[:limit]
            logger.info("br_paths_collected", count=len(collected_paths))

            if not collected_paths:
                return []

            # --- Phase 2: fetch each lot page concurrently ---
            sem = asyncio.Semaphore(_SEMAPHORE_SIZE)
            tasks = [_fetch_lot(client, sem, path) for path in collected_paths]
            results = await asyncio.gather(*tasks, return_exceptions=True)

    except Exception as e:
        logger.warning("br_connector_failed", error=str(e))
        return []

    lots: List[LotNormalized] = []
    for r in results:
        if isinstance(r, LotNormalized):
            lots.append(r)

    logger.info("br_fetched", total=len(lots))
    return lots


CONNECTOR_META = {
    "name": "Bruun Rasmussen",
    "source": "other",
    "house_reputation_score": 0.80,
    "currency": "DKK",
    "country": "DK",
    "supports_real_time": True,
    "poll_interval_minutes": 60,
}
