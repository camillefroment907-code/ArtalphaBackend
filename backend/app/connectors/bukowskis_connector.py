"""
Bukowskis connector — Swedish/Finnish auction house (bukowskis.com).
No API key required. Scrapes the art category listing pages.

Each lot card on the listing page contains:
  - data-end-date: Unix timestamp of auction end
  - href="/en/lots/{id}-{slug}": lot URL and ID
  - alt="Artist, Title.": artist name and title from image alt
  - data-thumbnails="[url1,url2,...]": image URLs as JSON array

No individual lot page fetches needed — all data is in the listing.
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

BASE_URL = "https://www.bukowskis.com"
# Art category — /en/lots/category/18-art
ART_CATEGORY_URL = BASE_URL + "/en/lots/category/18-art"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

# Regex to match lot cards: anchored on the card wrapper attributes
_CARD_RE = re.compile(
    r'data-end-date="(\d+)"[^>]*data-lot-id="\d+"[^>]*>'  # end_date unix
    r'.*?href="(/en/lots/(\d+)-([^"?#]+))"'               # path, lot_id, slug
    r'.*?alt="([^"]*)"'                                    # alt text (Artist, Title)
    r'.*?data-thumbnails="(\[[^\]]*\])',                   # thumbnails JSON array
    re.DOTALL,
)


def _parse_price(text: str) -> Optional[float]:
    """Parse 'SEK 2 500' or '2\xa0500' style strings to float."""
    cleaned = re.sub(r'[^\d.]', '', text.replace('\xa0', '').replace(',', '').replace(' ', ''))
    try:
        return float(cleaned) if cleaned else None
    except ValueError:
        return None


def _parse_cards(html: str) -> List[LotNormalized]:
    lots: List[LotNormalized] = []
    seen: set = set()

    for m in _CARD_RE.finditer(html):
        try:
            end_date_unix = int(m.group(1))
            path = m.group(2)          # /en/lots/1694407-lars-pirak-reindeer
            lot_id = m.group(3)        # 1694407
            alt_text = m.group(5).strip()  # "Lars Pirak, Reindeer."
            thumbnails_raw = m.group(6)    # ["url1","url2",...]

            if lot_id in seen:
                continue
            seen.add(lot_id)

            # Auction date from Unix timestamp
            auction_date = datetime.utcfromtimestamp(end_date_unix)
            if auction_date < datetime.utcnow():
                continue  # already ended

            # Parse artist + title from alt "Artist, Title."
            alt_clean = alt_text.rstrip('.')
            if ',' in alt_clean:
                artist, title = alt_clean.split(',', 1)
                artist = artist.strip()
                title = title.strip()
            else:
                artist = None
                title = alt_clean

            if not title or len(title) < 2:
                continue

            # First thumbnail as image URL
            image_url: Optional[str] = None
            try:
                thumbs = _json.loads(thumbnails_raw + ']')
                if thumbs and isinstance(thumbs[0], str):
                    image_url = thumbs[0]
            except Exception:
                pass

            lots.append(LotNormalized(
                external_id=f"bukowskis-{lot_id}",
                source="other",
                title=title[:500],
                artist_name_raw=artist[:500] if artist else None,
                estimate_low=None,   # loaded async on lot pages, not in listing
                estimate_high=None,
                current_price=None,
                currency="SEK",
                auction_date=auction_date,
                auction_house_name="Bukowskis",
                image_url=image_url,
                url=BASE_URL + path,
                category="Fine Art",
                medium=None,
                dimensions=None,
                raw_data={"source": "bukowskis", "lot_id": lot_id},
            ))
        except Exception as e:
            logger.debug("bukowskis_parse_error", error=str(e))

    return lots


async def fetch_lots(limit: int = 300) -> List[LotNormalized]:
    """
    Fetch art lots from Bukowskis. No API key required.
    Scrapes /en/lots/category/18-art with pagination.
    """
    all_lots: List[LotNormalized] = []
    seen_ids: set = set()
    pages_needed = max(1, (limit // 80) + 1)

    try:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            for page in range(1, pages_needed + 1):
                if len(all_lots) >= limit:
                    break
                try:
                    url = ART_CATEGORY_URL if page == 1 else f"{ART_CATEGORY_URL}?page={page}"
                    resp = await client.get(url, headers=HEADERS, timeout=20)
                    if resp.status_code != 200:
                        logger.warning("bukowskis_listing_failed", page=page, status=resp.status_code)
                        break

                    page_lots = _parse_cards(resp.text)
                    if not page_lots:
                        break  # No more lots

                    added = 0
                    for lot in page_lots:
                        if lot.external_id not in seen_ids:
                            seen_ids.add(lot.external_id)
                            all_lots.append(lot)
                            added += 1

                    logger.debug("bukowskis_page", page=page, added=added)
                    await asyncio.sleep(0.5)

                except Exception as e:
                    logger.warning("bukowskis_page_error", page=page, error=str(e))
                    break

    except Exception as e:
        logger.warning("bukowskis_connector_failed", error=str(e))

    logger.info("bukowskis_fetched", total=len(all_lots))
    return all_lots[:limit]


CONNECTOR_META = {
    "name": "Bukowskis",
    "source": "other",
    "house_reputation_score": 0.82,
    "currency": "SEK",
    "country": "SE",
    "supports_real_time": True,
    "poll_interval_minutes": 60,
}
