"""
Sotheby's connector — blue-chip auction house.
Tries multiple public endpoints and fails gracefully.
"""
import httpx
import structlog
from datetime import datetime
from typing import List, Optional
from app.models.schemas import LotNormalized, AuctionHouseEnum

logger = structlog.get_logger()

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.sothebys.com/",
}


def _safe_float(val) -> Optional[float]:
    if val is None:
        return None
    try:
        return float(str(val).replace(",", "").replace("$", "").replace("€", "").replace("£", "").strip())
    except (ValueError, TypeError):
        return None


def _safe_date(val) -> Optional[datetime]:
    if not val:
        return None
    if isinstance(val, datetime):
        return val
    try:
        return datetime.fromisoformat(str(val)[:19].replace("Z", ""))
    except Exception:
        pass
    try:
        ts = int(val)
        return datetime.fromtimestamp(ts / 1000 if ts > 1e10 else ts)
    except Exception:
        return None


def _extract_image(lot: dict) -> Optional[str]:
    """Extract best image URL from Sotheby's response."""
    for path in [
        ["primaryImage", "url"],
        ["primaryImage", "src"],
        ["images", 0, "url"],
        ["images", 0, "src"],
        ["imageUrl"],
        ["image_url"],
        ["photo"],
    ]:
        try:
            val = lot
            for key in path:
                if isinstance(key, int):
                    val = val[key]
                else:
                    val = val.get(key, {}) if isinstance(val, dict) else None
            if isinstance(val, str) and val.startswith("http"):
                return val
        except (KeyError, IndexError, TypeError):
            continue
    return None


def _parse_lot(lot: dict) -> Optional[LotNormalized]:
    try:
        lot_id = str(lot.get("id") or lot.get("lotId") or lot.get("lotRef") or lot.get("_id") or "")
        if not lot_id:
            return None

        title = (
            lot.get("title") or
            lot.get("objectTitle") or
            lot.get("lotTitle") or
            lot.get("description", "")
        )
        if not title or len(str(title).strip()) < 3:
            return None

        artist = (
            lot.get("artistName") or
            lot.get("makerName") or
            lot.get("artist") or
            lot.get("maker") or ""
        )
        if isinstance(artist, dict):
            artist = artist.get("name") or artist.get("displayName") or ""

        estimate_low = (
            _safe_float(lot.get("estimateLow")) or
            _safe_float(lot.get("lowEstimate")) or
            _safe_float(lot.get("estimate", {}).get("low") if isinstance(lot.get("estimate"), dict) else None)
        )
        estimate_high = (
            _safe_float(lot.get("estimateHigh")) or
            _safe_float(lot.get("highEstimate")) or
            _safe_float(lot.get("estimate", {}).get("high") if isinstance(lot.get("estimate"), dict) else None)
        )

        currency = str(lot.get("currency") or lot.get("currencyCode") or "USD").upper()
        auction_date = _safe_date(lot.get("saleDate") or lot.get("auctionDate") or lot.get("startDate"))

        # Skip past lots
        if auction_date and auction_date < datetime.utcnow():
            auction_date = None

        sale_code = lot.get("saleCode") or lot.get("saleNumber") or ""
        lot_url = (
            lot.get("url") or lot.get("lotUrl") or
            f"https://www.sothebys.com/en/buy/auction/{sale_code}/lots/{lot_id}" if sale_code
            else f"https://www.sothebys.com/buy/lot/{lot_id}"
        )
        if lot_url and not lot_url.startswith("http"):
            lot_url = "https://www.sothebys.com" + lot_url

        return LotNormalized(
            external_id=f"sothebys-{lot_id}",
            source=AuctionHouseEnum.SOTHEBYS,
            title=str(title).strip()[:500],
            artist_name_raw=str(artist).strip()[:500] if artist else None,
            estimate_low=estimate_low,
            estimate_high=estimate_high,
            current_price=estimate_low,
            currency=currency,
            auction_date=auction_date,
            auction_house_name="Sotheby's",
            image_url=_extract_image(lot),
            url=lot_url,
            category=lot.get("medium") or lot.get("objectType") or lot.get("category"),
            dimensions=lot.get("dimensions"),
            raw_data={"source": "sothebys", "id": lot_id},
        )
    except Exception as e:
        logger.debug("sothebys_parse_error", error=str(e))
        return None


async def fetch_lots(limit: int = 100) -> List[LotNormalized]:
    """Fetch upcoming lots from Sotheby's public API."""
    lots: List[LotNormalized] = []
    seen: set = set()

    # Multiple endpoints to try in order
    endpoints = [
        {
            "url": "https://www.sothebys.com/api/lots/search",
            "params": {"query": "", "status": "upcoming", "pageSize": min(limit, 48), "page": 0},
        },
        {
            "url": "https://www.sothebys.com/api/lots/search",
            "params": {"query": "painting", "pageSize": min(limit, 48), "page": 0},
        },
        {
            "url": "https://search.sothebys.com/api/search/lots",
            "params": {"q": "painting", "upcoming": "true", "size": min(limit, 48)},
        },
    ]

    try:
        async with httpx.AsyncClient(headers=HEADERS, timeout=25, follow_redirects=True) as client:
            for ep in endpoints:
                if len(lots) >= limit:
                    break
                try:
                    resp = await client.get(ep["url"], params=ep["params"])
                    if resp.status_code != 200:
                        logger.debug("sothebys_endpoint_failed", url=ep["url"], status=resp.status_code)
                        continue

                    data = resp.json()
                    raw_lots = (
                        data.get("lots") or
                        data.get("hits", {}).get("hits") if isinstance(data.get("hits"), dict) else None or
                        data.get("items") or
                        data.get("results") or
                        []
                    )
                    # Handle Elasticsearch _source wrapper
                    if raw_lots and isinstance(raw_lots[0], dict) and "_source" in raw_lots[0]:
                        raw_lots = [h.get("_source", h) for h in raw_lots]

                    for lot in raw_lots:
                        parsed = _parse_lot(lot)
                        if parsed and parsed.external_id not in seen:
                            seen.add(parsed.external_id)
                            lots.append(parsed)
                            if len(lots) >= limit:
                                break

                    if lots:
                        logger.info("sothebys_fetched", count=len(lots), endpoint=ep["url"])
                        break

                except Exception as e:
                    logger.debug("sothebys_endpoint_error", url=ep["url"], error=str(e))
                    continue

    except Exception as e:
        logger.warning("sothebys_connector_failed", error=str(e))

    logger.info("sothebys_total", count=len(lots))
    return lots[:limit]


CONNECTOR_META = {
    "name": "Sotheby's",
    "source": AuctionHouseEnum.SOTHEBYS,
    "house_reputation_score": 0.95,
    "currency": "MULTI",
    "country": "INTL",
    "supports_real_time": False,
    "poll_interval_minutes": 60,
}
