"""
Bonhams connector — major UK/US auction house.
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
    "Referer": "https://www.bonhams.com/",
}

ART_DEPARTMENTS = ["paintings", "prints-multiples", "drawings", "sculpture", "photographs"]


def _safe_float(val) -> Optional[float]:
    if val is None:
        return None
    try:
        return float(str(val).replace(",", "").replace("£", "").replace("$", "").replace("€", "").strip())
    except (ValueError, TypeError):
        return None


def _safe_date(val) -> Optional[datetime]:
    if not val:
        return None
    if isinstance(val, datetime):
        return val
    try:
        s = str(val).strip()
        return datetime.fromisoformat(s[:19].replace("Z", "").replace("+00:00", ""))
    except Exception:
        pass
    try:
        ts = int(val)
        return datetime.fromtimestamp(ts / 1000 if ts > 1e10 else ts)
    except Exception:
        return None


def _parse_lot(lot: dict) -> Optional[LotNormalized]:
    try:
        lot_id = str(
            lot.get("id") or lot.get("lot_id") or lot.get("lotId") or
            lot.get("reference") or lot.get("slug") or ""
        )
        if not lot_id:
            return None

        title = (
            lot.get("title") or lot.get("description") or
            lot.get("lot_title") or lot.get("name") or ""
        )
        if not title or len(str(title).strip()) < 3:
            return None

        artist = (
            lot.get("artist") or lot.get("artist_name") or lot.get("artistName") or
            lot.get("maker") or lot.get("author") or ""
        )
        if isinstance(artist, dict):
            artist = artist.get("name") or artist.get("full_name") or ""

        estimate_low = (
            _safe_float(lot.get("estimate_low")) or
            _safe_float(lot.get("low_estimate")) or
            _safe_float(lot.get("estimateLow")) or
            _safe_float(lot.get("price_from")) or
            _safe_float(lot.get("price"))
        )
        estimate_high = (
            _safe_float(lot.get("estimate_high")) or
            _safe_float(lot.get("high_estimate")) or
            _safe_float(lot.get("estimateHigh")) or
            _safe_float(lot.get("price_to"))
        )

        currency = str(lot.get("currency") or lot.get("currency_code") or "GBP").upper()
        auction_date = _safe_date(
            lot.get("sale_date") or lot.get("auction_date") or
            lot.get("end_date") or lot.get("date")
        )
        if auction_date and auction_date < datetime.utcnow():
            auction_date = None

        image_url = (
            lot.get("image_url") or lot.get("thumbnail") or
            lot.get("photo") or lot.get("image") or
            lot.get("primary_image")
        )
        if isinstance(image_url, dict):
            image_url = image_url.get("url") or image_url.get("src")

        lot_url = lot.get("url") or lot.get("lot_url") or f"https://www.bonhams.com/lot/{lot_id}"
        if lot_url and not lot_url.startswith("http"):
            lot_url = "https://www.bonhams.com" + lot_url

        return LotNormalized(
            external_id=f"bonhams-{lot_id}",
            source=AuctionHouseEnum.OTHER,
            title=str(title).strip()[:500],
            artist_name_raw=str(artist).strip()[:500] if artist else None,
            estimate_low=estimate_low,
            estimate_high=estimate_high,
            current_price=estimate_low,
            currency=currency,
            auction_date=auction_date,
            auction_house_name="Bonhams",
            image_url=str(image_url) if image_url else None,
            url=lot_url,
            category=lot.get("category") or lot.get("department") or "Fine Art",
            medium=lot.get("medium") or lot.get("technique"),
            raw_data={"source": "bonhams", "id": lot_id},
        )
    except Exception as e:
        logger.debug("bonhams_parse_error", error=str(e))
        return None


async def fetch_lots(limit: int = 100) -> List[LotNormalized]:
    """Fetch upcoming lots from Bonhams. Tries multiple endpoints."""
    lots: List[LotNormalized] = []
    seen: set = set()

    endpoints = [
        # Primary: Bonhams search API
        {
            "url": "https://www.bonhams.com/api2/search/",
            "params": {"q": "painting", "lots_only": "true", "upcoming": "true", "page_size": min(limit, 60)},
        },
        # Alternative: department search
        {
            "url": "https://www.bonhams.com/api/search/",
            "params": {"q": "fine art", "type": "lot", "status": "upcoming", "size": min(limit, 60)},
        },
        # Bonhams new site API
        {
            "url": "https://www.bonhams.com/api/v1/lots/",
            "params": {"status": "upcoming", "category": "paintings", "per_page": min(limit, 50)},
        },
        # Bonhams search with JSON accept header
        {
            "url": "https://www.bonhams.com/search/",
            "params": {"q": "painting oil canvas", "upcoming": "1", "per_page": min(limit, 50)},
        },
    ]

    try:
        async with httpx.AsyncClient(
            headers=HEADERS, timeout=20, follow_redirects=True
        ) as client:
            for ep in endpoints:
                if len(lots) >= limit:
                    break
                try:
                    resp = await client.get(ep["url"], params=ep["params"])
                    if resp.status_code != 200:
                        logger.debug("bonhams_endpoint_failed", url=ep["url"], status=resp.status_code)
                        continue

                    data = resp.json()
                    raw_lots = (
                        data.get("lots") or data.get("results") or
                        data.get("items") or data.get("data") or
                        (data if isinstance(data, list) else [])
                    )

                    for lot in raw_lots:
                        parsed = _parse_lot(lot)
                        if parsed and parsed.external_id not in seen:
                            seen.add(parsed.external_id)
                            lots.append(parsed)
                            if len(lots) >= limit:
                                break

                    if lots:
                        logger.info("bonhams_fetched", count=len(lots), endpoint=ep["url"])
                        break

                except Exception as e:
                    logger.debug("bonhams_endpoint_error", url=ep["url"], error=str(e))
                    continue

    except Exception as e:
        logger.warning("bonhams_connector_failed", error=str(e))

    logger.info("bonhams_total", count=len(lots))
    return lots[:limit]


CONNECTOR_META = {
    "name": "Bonhams",
    "source": AuctionHouseEnum.OTHER,
    "house_reputation_score": 0.88,
    "currency": "GBP",
    "country": "GB",
    "supports_real_time": False,
    "poll_interval_minutes": 60,
}
