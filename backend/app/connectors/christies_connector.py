"""
Christie's connector — blue-chip auction house.
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
    "Referer": "https://www.christies.com/",
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
        # Try millisecond timestamp
        ts = int(val)
        return datetime.fromtimestamp(ts / 1000 if ts > 1e10 else ts)
    except Exception:
        return None


def _extract_artist(lot: dict) -> str:
    """Extract artist name from Christie's nested response structure."""
    for path in [
        ["artistName"],
        ["makerName"],
        ["primaryMaker", "name"],
        ["makers", 0, "name"],
        ["object", "makerName"],
    ]:
        try:
            val = lot
            for key in path:
                if isinstance(key, int):
                    val = val[key]
                else:
                    val = val.get(key, {}) if isinstance(val, dict) else None
            if isinstance(val, str) and val.strip():
                return val.strip()
        except (KeyError, IndexError, TypeError):
            continue
    return ""


def _extract_image(lot: dict) -> Optional[str]:
    """Extract best image URL from Christie's response."""
    for path in [
        ["primaryImage", "src"],
        ["primaryImage", "url"],
        ["images", 0, "src"],
        ["images", 0, "url"],
        ["imageSrc"],
        ["imageUrl"],
        ["image_url"],
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


def _parse_lot(lot: dict, lot_id: str) -> Optional[LotNormalized]:
    try:
        title = (
            lot.get("title") or
            lot.get("lotTitle") or
            lot.get("object", {}).get("title", "")
        )
        if not title or len(str(title).strip()) < 3:
            return None

        estimate = lot.get("estimate", {})
        estimate_low = _safe_float(estimate.get("low") if isinstance(estimate, dict) else None) \
            or _safe_float(lot.get("estimateLow")) \
            or _safe_float(lot.get("lowEstimate"))
        estimate_high = _safe_float(estimate.get("high") if isinstance(estimate, dict) else None) \
            or _safe_float(lot.get("estimateHigh")) \
            or _safe_float(lot.get("highEstimate"))

        currency = str(lot.get("currency") or lot.get("estimateCurrency") or "GBP").upper()
        auction_date = _safe_date(lot.get("saleDate") or lot.get("startDate") or lot.get("auctionDate"))

        # Skip past lots
        if auction_date and auction_date < datetime.utcnow():
            auction_date = None

        lot_url = (
            lot.get("url") or
            f"https://www.christies.com/lot/lot-{lot_id}"
        )
        if lot_url and not lot_url.startswith("http"):
            lot_url = "https://www.christies.com" + lot_url

        return LotNormalized(
            external_id=f"christies-{lot_id}",
            source=AuctionHouseEnum.CHRISTIES,
            title=str(title).strip()[:500],
            artist_name_raw=_extract_artist(lot) or None,
            estimate_low=estimate_low,
            estimate_high=estimate_high,
            current_price=estimate_low,
            currency=currency,
            auction_date=auction_date,
            auction_house_name="Christie's",
            image_url=_extract_image(lot),
            url=lot_url,
            category=lot.get("medium") or lot.get("category") or lot.get("objectType"),
            dimensions=lot.get("dimensions"),
            raw_data={"source": "christies", "id": lot_id},
        )
    except Exception as e:
        logger.debug("christies_parse_error", error=str(e))
        return None


async def fetch_lots(limit: int = 100) -> List[LotNormalized]:
    """Fetch upcoming lots from Christie's public search API."""
    lots: List[LotNormalized] = []
    seen: set = set()

    endpoints = [
        # Primary: discoverfeed search API
        {
            "method": "GET",
            "url": "https://www.christies.com/api/discoverfeed/search/lots",
            "params": {
                "keyword": "painting",
                "pageSize": min(limit, 48),
                "pageNumber": 1,
                "language": "en",
                "auctionStatus": "upcoming",
            },
        },
        # Fallback: search API with different structure
        {
            "method": "GET",
            "url": "https://www.christies.com/api/discoverfeed/search/lots",
            "params": {
                "keyword": "",
                "pageSize": min(limit, 24),
                "pageNumber": 1,
                "language": "en",
            },
        },
    ]

    try:
        async with httpx.AsyncClient(headers=HEADERS, timeout=25, follow_redirects=True) as client:
            for ep in endpoints:
                if len(lots) >= limit:
                    break
                try:
                    resp = await client.request(
                        ep["method"],
                        ep["url"],
                        params=ep.get("params"),
                        json=ep.get("json"),
                    )
                    if resp.status_code != 200:
                        logger.debug("christies_endpoint_failed", url=ep["url"], status=resp.status_code)
                        continue

                    data = resp.json()
                    # Handle nested lot structure
                    raw_lots = (
                        data.get("lots", {}).get("items") if isinstance(data.get("lots"), dict) else None
                    ) or data.get("lots") or data.get("items") or data.get("results") or []

                    for lot in raw_lots:
                        lot_id = str(
                            lot.get("lotId") or lot.get("id") or lot.get("lotNumber", "")
                        )
                        if not lot_id or lot_id in seen:
                            continue
                        parsed = _parse_lot(lot, lot_id)
                        if parsed:
                            seen.add(lot_id)
                            lots.append(parsed)
                            if len(lots) >= limit:
                                break

                    if lots:
                        logger.info("christies_fetched", count=len(lots), endpoint=ep["url"])
                        break

                except Exception as e:
                    logger.debug("christies_endpoint_error", url=ep["url"], error=str(e))
                    continue

    except Exception as e:
        logger.warning("christies_connector_failed", error=str(e))

    logger.info("christies_total", count=len(lots))
    return lots[:limit]


CONNECTOR_META = {
    "name": "Christie's",
    "source": AuctionHouseEnum.CHRISTIES,
    "house_reputation_score": 0.95,
    "currency": "MULTI",
    "country": "INTL",
    "supports_real_time": False,
    "poll_interval_minutes": 60,
}
