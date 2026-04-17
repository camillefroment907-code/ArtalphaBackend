"""
ArtMarket API Connector
Fetches upcoming and recently sold auction lots from api.artmarketapi.com.
Covers Christie's, Sotheby's, Bonhams, Phillips, and other major houses.

Requires env var: ART_MARKET_API_KEY
Free plan: ~10 req/min → 0.5s sleep between requests.
"""
import asyncio
import os
from datetime import datetime
from typing import List, Optional
import structlog

import httpx

from app.models.schemas import LotNormalized, AuctionHouseEnum
from app.jobs.quality_filter import normalize_category

logger = structlog.get_logger().bind(connector="artmarketapi")

BASE_URL = "https://api.artmarketapi.com/api/v1"

# Map auction house names from API → our enum
_HOUSE_MAP = {
    "christie's": AuctionHouseEnum.CHRISTIES,
    "christies":  AuctionHouseEnum.CHRISTIES,
    "sotheby's":  AuctionHouseEnum.SOTHEBYS,
    "sothebys":   AuctionHouseEnum.SOTHEBYS,
    "bonhams":    AuctionHouseEnum.BONHAMS,
    "phillips":   AuctionHouseEnum.OTHER,
    "drouot":     AuctionHouseEnum.DROUOT,
}


def _resolve_source(house_name: str) -> AuctionHouseEnum:
    return _HOUSE_MAP.get((house_name or "").lower().strip(), AuctionHouseEnum.OTHER)


def _parse_date(val: Optional[str]) -> Optional[datetime]:
    if not val:
        return None
    try:
        return datetime.fromisoformat(val.replace("Z", "+00:00"))
    except Exception:
        return None


def _map_lot(record: dict) -> Optional[LotNormalized]:
    try:
        title = (record.get("title") or "").strip()
        if not title or len(title) < 3:
            return None

        artist_block = record.get("artist") or {}
        artist_name = (artist_block.get("name") or "").strip() or None

        auction_block = record.get("auction") or {}
        house_block = auction_block.get("auction_house") or {}
        house_name = (house_block.get("name") or "").strip()
        sale_title = (auction_block.get("name") or "").strip() or None

        source = _resolve_source(house_name)

        estimate_low  = record.get("estimate_low")  or None
        estimate_high = record.get("estimate_high") or None
        hammer_price  = record.get("hammer_price")  or None

        # Use estimate as current_price for upcoming; hammer for sold
        performance = record.get("lot_performance", "")
        if performance == "sold" and hammer_price:
            current_price = float(hammer_price)
        elif estimate_low:
            current_price = float(estimate_low)
        else:
            current_price = None

        currency = (
            record.get("estimate_currency")
            or record.get("hammer_currency")
            or "USD"
        )

        url = record.get("website_url") or ""
        if not url or not url.startswith("http"):
            return None

        medium_raw = record.get("medium") or record.get("category") or ""
        category = normalize_category(medium_raw) if medium_raw else None

        return LotNormalized(
            external_id=f"amapi-{record.get('_id') or record.get('id')}",
            source=source,
            title=title,
            artist_name_raw=artist_name,
            category=category,
            medium=medium_raw or None,
            estimate_low=float(estimate_low) if estimate_low else None,
            estimate_high=float(estimate_high) if estimate_high else None,
            current_price=current_price,
            currency=currency,
            auction_date=_parse_date(record.get("sale_date")),
            auction_house_name=house_name or None,
            auction_sale_title=sale_title,
            url=url,
            image_url=record.get("image_url") or None,
            raw_data={
                "source": "artmarketapi",
                "lot_performance": performance,
                "hammer_price": hammer_price,
                "is_signed": record.get("is_signed"),
                "is_framed": record.get("is_framed"),
                "auction_id": auction_block.get("_id"),
            },
        )
    except Exception as e:
        logger.warning("Failed to map artmarketapi record", error=str(e))
        return None


async def _fetch_page(
    client: httpx.AsyncClient,
    params: dict,
) -> tuple[List[dict], bool]:
    """Fetch one page. Returns (records, has_more)."""
    try:
        resp = await client.get(f"{BASE_URL}/auction_records", params=params, timeout=15.0)
        if resp.status_code == 429:
            logger.warning("ArtMarket API rate limited — sleeping 10s")
            await asyncio.sleep(10)
            resp = await client.get(f"{BASE_URL}/auction_records", params=params, timeout=15.0)
        if resp.status_code != 200:
            logger.warning("ArtMarket API bad status", status=resp.status_code)
            return [], False
        body = resp.json()
        records = body.get("data") or []
        # has_more: if we got a full page, assume there may be more
        has_more = len(records) >= params.get("limit", 100)
        return records, has_more
    except Exception as e:
        logger.warning("ArtMarket API fetch error", error=str(e))
        return [], False


# Search terms rotated across requests to satisfy the API's filter requirement
# while covering the full fine-art spectrum.
_ART_SEARCH_TERMS = [
    "painting", "oil on canvas", "watercolor", "acrylic",
    "sculpture", "drawing", "photograph", "print", "gouache", "pastel",
]


class ArtMarketAPIConnector:
    """Fetches upcoming and recently sold lots from ArtMarket API."""

    async def fetch_lots(self, limit: int = 500) -> List[LotNormalized]:
        api_key = os.getenv("ART_MARKET_API_KEY")
        if not api_key:
            logger.warning("ART_MARKET_API_KEY not set — skipping ArtMarket API")
            return []

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Accept": "application/json",
        }

        all_lots: List[LotNormalized] = []
        seen_ids: set = set()
        per_page = 100

        async with httpx.AsyncClient(headers=headers, follow_redirects=True) as client:
            for performance in ("upcoming", "sold"):
                for search_term in _ART_SEARCH_TERMS:
                    if len(all_lots) >= limit:
                        break

                    params: dict = {
                        "lot_performance": performance,
                        "search": search_term,
                        "limit": per_page,
                        "page": 1,
                    }
                    if performance == "sold":
                        params["sort"] = "sale_date:desc"

                    records, has_more = await _fetch_page(client, params)

                    if not records:
                        await asyncio.sleep(0.5)
                        continue

                    for rec in records:
                        lot = _map_lot(rec)
                        if lot and lot.external_id not in seen_ids:
                            seen_ids.add(lot.external_id)
                            all_lots.append(lot)

                    logger.info(
                        "ArtMarket API fetched",
                        performance=performance,
                        search=search_term,
                        records=len(records),
                        total=len(all_lots),
                    )

                    # Paginate if we got a full page and still need more
                    page = 2
                    while has_more and len(all_lots) < limit:
                        params["page"] = page
                        records, has_more = await _fetch_page(client, params)
                        for rec in records:
                            lot = _map_lot(rec)
                            if lot and lot.external_id not in seen_ids:
                                seen_ids.add(lot.external_id)
                                all_lots.append(lot)
                        page += 1
                        await asyncio.sleep(0.5)

                    await asyncio.sleep(7.0)  # 10 req/min free plan = 1 req/6s

        logger.info("ArtMarket API: done", total=len(all_lots))
        return all_lots[:limit]


CONNECTOR_META = {
    "name": "ArtMarket API",
    "source": AuctionHouseEnum.OTHER,
    "house_reputation_score": 0.90,
    "currency": "USD",
    "country": "US",
    "supports_real_time": True,
    "poll_interval_minutes": 60,
}
