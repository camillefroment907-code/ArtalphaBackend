"""Artcurial connector — public JSON API."""
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
            "Accept-Language": "fr-FR,fr;q=0.9",
        }) as client:
            resp = await client.get(
                "https://www.artcurial.com/api/lots",
                params={"status": "upcoming", "limit": min(limit, 100), "offset": 0, "lang": "fr"}
            )
            if resp.status_code != 200:
                resp = await client.get(
                    "https://www.artcurial.com/en/results",
                    params={"type": "lot", "limit": min(limit, 50)}
                )
            if resp.status_code != 200:
                logger.warning("artcurial_api_failed", status=resp.status_code)
                return []

            data = resp.json()
            items = data.get("lots", data.get("results", data.get("items", [])))
            if isinstance(data, list):
                items = data

            for item in items[:limit]:
                try:
                    lot_id = str(item.get("id") or item.get("lotId") or item.get("ref", ""))
                    if not lot_id:
                        continue

                    title = item.get("title") or item.get("designation") or item.get("name", "")
                    artist = item.get("artist") or item.get("author") or item.get("artistName", "")
                    if isinstance(artist, dict):
                        artist = artist.get("name") or artist.get("fullName", "")

                    estimate_low = None
                    estimate_high = None
                    for key_low in ["estimateLow", "estimate_low", "minEstimate", "estimationMin"]:
                        if item.get(key_low):
                            try:
                                estimate_low = float(item[key_low])
                                break
                            except Exception:
                                pass
                    for key_high in ["estimateHigh", "estimate_high", "maxEstimate", "estimationMax"]:
                        if item.get(key_high):
                            try:
                                estimate_high = float(item[key_high])
                                break
                            except Exception:
                                pass

                    auction_date = None
                    for date_key in ["saleDate", "auctionDate", "date", "saleStartDate"]:
                        if item.get(date_key):
                            try:
                                auction_date = datetime.fromisoformat(str(item[date_key])[:19])
                                break
                            except Exception:
                                pass

                    image_url = (
                        item.get("imageUrl") or item.get("image") or item.get("thumbnail") or
                        (item.get("images", [{}])[0].get("url") if item.get("images") else None)
                    )

                    url = item.get("url") or item.get("lotUrl") or f"https://www.artcurial.com/en/lot-{lot_id}"

                    lots.append(LotNormalized(
                        external_id=f"artcurial-{lot_id}",
                        source=AuctionHouseEnum.OTHER,
                        title=str(title)[:500] if title else "Untitled",
                        artist_name_raw=str(artist)[:500] if artist else None,
                        estimate_low=estimate_low,
                        estimate_high=estimate_high,
                        current_price=estimate_low,
                        currency="EUR",
                        auction_date=auction_date,
                        auction_house_name="Artcurial",
                        image_url=str(image_url) if image_url else None,
                        url=str(url) if url else None,
                        category=item.get("category") or item.get("discipline"),
                        medium=item.get("medium") or item.get("technique"),
                        raw_data=item,
                    ))
                except Exception as e:
                    logger.debug("artcurial_lot_parse_error", error=str(e))
                    continue

    except Exception as e:
        logger.warning("artcurial_fetch_failed", error=str(e))

    logger.info("artcurial_fetched", count=len(lots))
    return lots
