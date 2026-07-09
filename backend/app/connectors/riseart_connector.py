"""Rise Art connector — UK primary market gallery platform (riseart.com).

Extracts artwork records from the Apollo SSR state injected into the listing page
as window.RiseArt.initialApolloState. No API key required.

Each ArtFlat record in the Apollo cache contains:
  id, artistName, title, skuBuyPrice (USD), medium, style, subject, productId, canBuy
"""
import json
from typing import List, Optional

import httpx
import structlog

from app.models.schemas import LotNormalized

logger = structlog.get_logger()

BASE_URL = "https://www.riseart.com/art"
APOLLO_KEY = "window.RiseArt.initialApolloState = "

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

# USD → EUR approximate conversion factor
from app.lib.fx import to_eur as _fx_to_eur


def _parse_artflat(val: dict) -> Optional[LotNormalized]:
    try:
        art_id = str(val.get("id") or val.get("productId") or "")
        if not art_id:
            return None

        title = str(val.get("title") or "").strip()
        if not title or len(title) < 2:
            return None

        price_usd = float(val["skuBuyPrice"])
        if price_usd <= 0:
            return None

        current_price = _fx_to_eur(price_usd, "USD") or round(price_usd * 0.92, 2)
        estimate_high = round(current_price * 1.1, 2)

        return LotNormalized(
            external_id=f"riseart-{art_id}",
            source="other",
            title=title[:500],
            artist_name_raw=str(val.get("artistName") or "")[:500] or None,
            estimate_low=current_price,
            estimate_high=estimate_high,
            current_price=current_price,
            currency="EUR",
            auction_date=None,
            auction_house_name="Rise Art",
            image_url=None,
            url=f"https://www.riseart.com/art/{art_id}",
            category=val.get("medium"),
            medium=val.get("medium"),
            market_type="PRIMARY",
            is_buy_now=True,
            raw_data={"source": "riseart", "id": art_id},
        )
    except Exception as e:
        logger.debug("riseart_parse_error", error=str(e))
        return None


def _extract_artflats(html: str) -> List[dict]:
    """Extract ArtFlat records from window.RiseArt.initialApolloState."""
    idx = html.find(APOLLO_KEY)
    if idx == -1:
        return []
    try:
        json_start = html.index("{", idx)
        apollo_state, _ = json.JSONDecoder().raw_decode(html, json_start)
        return [
            val for val in apollo_state.values()
            if isinstance(val, dict)
            and val.get("__typename") == "ArtFlat"
            and val.get("canBuy")
            and val.get("skuBuyPrice")
        ]
    except Exception as e:
        logger.debug("riseart_apollo_parse_error", error=str(e))
        return []


async def fetch_lots(limit: int = 300) -> List[LotNormalized]:
    """Fetch primary market artworks from Rise Art via Apollo SSR state."""
    lots: List[LotNormalized] = []
    seen_ids: set = set()

    try:
        async with httpx.AsyncClient(
            headers=HEADERS, timeout=30.0, follow_redirects=True
        ) as client:
            for page in range(1, 21):  # up to 20 pages (~30 lots each = ~600 max)
                if len(lots) >= limit:
                    break
                url = BASE_URL if page == 1 else f"{BASE_URL}?page={page}"
                try:
                    resp = await client.get(url)
                    if resp.status_code != 200:
                        logger.warning("riseart_page_failed", page=page, status=resp.status_code)
                        break

                    artflats = _extract_artflats(resp.text)
                    if not artflats:
                        break  # no ArtFlat records — end of pagination

                    added = 0
                    for record in artflats:
                        lot = _parse_artflat(record)
                        if lot and lot.external_id not in seen_ids:
                            seen_ids.add(lot.external_id)
                            lots.append(lot)
                            added += 1
                            if len(lots) >= limit:
                                break

                    if not added:
                        break  # page returned records but none were new/valid

                    logger.debug("riseart_page", page=page, added=added)

                except Exception as e:
                    logger.warning("riseart_page_error", page=page, error=str(e))
                    break

    except Exception as e:
        logger.warning("riseart_connector_failed", error=str(e))

    logger.info("riseart_fetched", total=len(lots))
    return lots[:limit]


CONNECTOR_META = {
    "name": "Rise Art",
    "source": "other",
    "house_reputation_score": 0.65,
    "currency": "EUR",
    "country": "GB",
    "supports_real_time": True,
    "poll_interval_minutes": 60,
}
