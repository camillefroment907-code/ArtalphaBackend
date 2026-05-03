"""
Auctionet Connector
Public API — no key required.
Covers 300+ European auction houses (Sweden, UK, Spain, Germany, etc.)
~6,800 active art lots + 34K total lots across all categories.

API docs: https://auctionet.com/api/v2/items
"""
import asyncio
import re
from datetime import datetime, timezone
from typing import List, Optional
import httpx
import structlog

from app.models.schemas import LotNormalized, AuctionHouseEnum
from app.jobs.quality_filter import normalize_category

logger = structlog.get_logger().bind(connector="auctionet")

BASE_URL = "https://auctionet.com/api/v2"

# Art category IDs on Auctionet
ART_CATEGORIES = {
    28: "Paintings",
    27: "Engravings & Prints",
    119: "Drawings",
    29: "Sculptures & Bronzes",
    26: "Photography",
    30: "Other Art",
}

CONNECTOR_META = {
    "name": "Auctionet",
    "source": AuctionHouseEnum.AUCTIONET,
    "house_reputation_score": 0.70,
    "currency": "SEK",
    "country": "SE",
    "supports_real_time": True,
    "poll_interval_minutes": 60,
}

# Pattern: "ARTIST NAME. Title, medium..."
# e.g. "AXEL HENNIX. \"Grekisk ö\", olja på pannå, signerad."
# e.g. "MARTIN ÅBERG (Sverige, född 1888). Sommarlandskap..."
_ARTIST_RE = re.compile(
    r"^([A-ZÅÄÖÉÈÀÜÏËÆØÑ][A-ZÅÄÖa-zåäöéèàüïëæøñ\-\'\.]+(?:\s+[A-ZÅÄÖÉÈÀÜÏËÆØÑ][A-ZÅÄÖa-zåäöéèàüïëæøñ\-\'\.]+){1,4})"
    r"\s*[\.\(]"
)


def _extract_artist(title: str) -> Optional[str]:
    """Extract artist name from Auctionet title string."""
    if not title:
        return None
    m = _ARTIST_RE.match(title.strip())
    if m:
        candidate = m.group(1).strip()
        # Filter out false positives (medium/technique keywords)
        skip = {"OLJA", "AKVARELL", "LITOGRAFI", "BRONZE", "GOUACHE",
                "OIL", "WATERCOLOR", "ETCHING", "PENCIL", "PRINT", "PHOTO"}
        if candidate.upper() in skip or len(candidate) < 4:
            return None
        return candidate
    return None


def _parse_ends_at(ts: Optional[int]) -> Optional[datetime]:
    if not ts:
        return None
    try:
        return datetime.fromtimestamp(ts, tz=timezone.utc)
    except Exception:
        return None


def _get_current_price(item: dict) -> Optional[float]:
    """
    For live/hammered lots, use the highest bid.
    For not-yet-bid lots, use starting_bid_amount.
    """
    bids = item.get("bids") or []
    if bids:
        try:
            return float(max(b.get("amount", 0) for b in bids))
        except Exception:
            pass
    sb = item.get("starting_bid_amount")
    return float(sb) if sb else None


def _map_lot(item: dict, cat_name: str) -> Optional[LotNormalized]:
    try:
        title_raw = (item.get("title") or "").strip()
        if not title_raw or len(title_raw) < 5:
            return None

        artist = _extract_artist(title_raw)

        # Strip HTML from description
        desc_html = item.get("description") or ""
        desc = re.sub(r"<[^>]+>", " ", desc_html).strip() or None

        estimate_low = float(item["estimate"]) if item.get("estimate") else None
        estimate_high = float(item["upper_estimate"]) if item.get("upper_estimate") else None
        currency = item.get("currency") or "SEK"
        current_price = _get_current_price(item)

        # Choose the better price field
        if not current_price and estimate_low:
            current_price = estimate_low

        images = item.get("images") or []
        image_url = images[0].get("w640") if images else None

        return LotNormalized(
            external_id=f"auctionet-{item['id']}",
            source=AuctionHouseEnum.AUCTIONET,
            title=title_raw,
            artist_name_raw=artist,
            description=desc,
            category=normalize_category(cat_name),
            medium=cat_name,
            estimate_low=estimate_low,
            estimate_high=estimate_high,
            current_price=current_price,
            currency=currency,
            auction_date=_parse_ends_at(item.get("ends_at")),
            auction_house_name=item.get("house") or None,
            url=item.get("url") or None,
            image_url=image_url,
            market_type="AUCTION",
            raw_data={
                "source": "auctionet",
                "location": item.get("location"),
                "hammered": item.get("hammered"),
                "state": item.get("state"),
                "category_id": item.get("category_id"),
                "bid_count": len(item.get("bids") or []),
            },
        )
    except Exception as e:
        logger.warning("Failed to map auctionet item", error=str(e), item_id=item.get("id"))
        return None


async def fetch_lots(limit: int = 5000) -> List[LotNormalized]:
    """
    Fetch art lots from Auctionet across all art categories.
    No authentication required. Returns live + upcoming lots.
    """
    all_lots: List[LotNormalized] = []
    seen_ids: set = set()
    per_page = 100

    async with httpx.AsyncClient(follow_redirects=True, timeout=20.0) as client:
        for cat_id, cat_name in ART_CATEGORIES.items():
            if len(all_lots) >= limit:
                break

            page = 1
            while len(all_lots) < limit:
                try:
                    resp = await client.get(
                        f"{BASE_URL}/items",
                        params={
                            "per_page": per_page,
                            "page": page,
                            "category_id": cat_id,
                            "sort": "ends_at",
                            "order": "asc",
                        },
                    )
                    if resp.status_code != 200:
                        logger.warning("Auctionet bad status", status=resp.status_code, category=cat_name)
                        break

                    body = resp.json()
                    items = body.get("items") or []
                    if not items:
                        break

                    added = 0
                    for item in items:
                        ext_id = f"auctionet-{item['id']}"
                        if ext_id in seen_ids:
                            continue
                        lot = _map_lot(item, cat_name)
                        if lot:
                            seen_ids.add(ext_id)
                            all_lots.append(lot)
                            added += 1

                    pagination = body.get("pagination") or {}
                    total_pages = pagination.get("total_pages", 1)

                    logger.info(
                        "Auctionet page fetched",
                        category=cat_name,
                        page=page,
                        total_pages=total_pages,
                        items=len(items),
                        added=added,
                        total=len(all_lots),
                    )

                    if page >= total_pages or page >= 20:  # cap at 20 pages per category
                        break

                    page += 1
                    await asyncio.sleep(0.3)

                except Exception as e:
                    logger.warning("Auctionet fetch error", error=str(e), category=cat_name, page=page)
                    break

    logger.info("Auctionet: done", total=len(all_lots))
    return all_lots[:limit]
