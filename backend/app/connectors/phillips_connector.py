"""Phillips auction connector — public JSON API."""
import httpx
import structlog
from datetime import datetime
from typing import List
from app.models.schemas import LotNormalized, AuctionHouseEnum

logger = structlog.get_logger()


async def fetch_lots(limit: int = 100) -> List[LotNormalized]:
    lots = []
    try:
        async with httpx.AsyncClient(timeout=20, headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            "Accept": "application/json",
        }) as client:
            params = {
                "upcoming": "true",
                "size": min(limit, 100),
                "from": 0,
                "sort": "saleDate",
            }
            resp = await client.get("https://www.phillips.com/api/search/lots", params=params)
            if resp.status_code != 200:
                logger.warning("phillips_api_failed", status=resp.status_code)
                return []

            data = resp.json()
            items = data.get("results", data.get("lots", data.get("hits", {}).get("hits", [])))

            for item in items[:limit]:
                try:
                    src = item.get("_source", item)

                    lot_id = str(src.get("lotId") or src.get("id") or src.get("lotNumber", ""))
                    if not lot_id:
                        continue

                    title = src.get("title") or src.get("lotTitle") or src.get("description", "")
                    artist = src.get("makerName") or src.get("artistName") or src.get("maker", "")

                    estimate_low = None
                    estimate_high = None
                    low = src.get("estimateLow") or src.get("lowEstimate")
                    high = src.get("estimateHigh") or src.get("highEstimate")
                    if low:
                        try:
                            estimate_low = float(str(low).replace(",", ""))
                        except Exception:
                            pass
                    if high:
                        try:
                            estimate_high = float(str(high).replace(",", ""))
                        except Exception:
                            pass

                    auction_date = None
                    date_str = src.get("saleDate") or src.get("auctionDate")
                    if date_str:
                        try:
                            auction_date = datetime.fromisoformat(str(date_str)[:19])
                        except Exception:
                            pass

                    currency = str(src.get("currency") or src.get("currencyCode") or "USD").upper()

                    image_url = (
                        src.get("imageUrl") or
                        src.get("primaryImage") or
                        (src.get("images", [{}])[0].get("url") if src.get("images") else None)
                    )

                    sale_id = src.get("saleId") or src.get("saleNumber", "")
                    url = src.get("url") or (
                        f"https://www.phillips.com/lot/{sale_id}/{lot_id}" if sale_id else None
                    )

                    lots.append(LotNormalized(
                        external_id=f"phillips-{lot_id}",
                        source=AuctionHouseEnum.OTHER,
                        title=str(title)[:500] if title else "Untitled",
                        artist_name_raw=str(artist)[:500] if artist else None,
                        estimate_low=estimate_low,
                        estimate_high=estimate_high,
                        current_price=estimate_low,
                        currency=currency,
                        auction_date=auction_date,
                        auction_house_name="Phillips",
                        image_url=str(image_url) if image_url else None,
                        url=url,
                        category=src.get("category") or src.get("medium"),
                        medium=src.get("medium") or src.get("materials"),
                        raw_data=src,
                    ))
                except Exception as e:
                    logger.debug("phillips_lot_parse_error", error=str(e))
                    continue

    except Exception as e:
        logger.warning("phillips_fetch_failed", error=str(e))

    logger.info("phillips_fetched", count=len(lots))
    return lots
