"""Artsper connector — emerging artists gallery platform."""
import httpx
import structlog
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
                "https://www.artsper.com/api/artworks",
                params={
                    "limit": min(limit, 100),
                    "offset": 0,
                    "sort": "trending",
                    "available": True,
                }
            )
            if resp.status_code != 200:
                resp = await client.get(
                    "https://api.artsper.com/v1/artworks",
                    params={"limit": min(limit, 50), "status": "available"}
                )
            if resp.status_code != 200:
                logger.warning("artsper_api_failed", status=resp.status_code)
                return []

            data = resp.json()
            items = data.get("artworks", data.get("results", data.get("data", [])))
            if isinstance(data, list):
                items = data

            for item in items[:limit]:
                try:
                    artwork_id = str(item.get("id") or item.get("artworkId") or item.get("slug", ""))
                    if not artwork_id:
                        continue

                    title = item.get("title") or item.get("name", "")

                    artist = item.get("artist") or item.get("artistName") or ""
                    if isinstance(artist, dict):
                        artist = artist.get("name") or artist.get("fullName") or artist.get("displayName", "")

                    price = None
                    for price_key in ["price", "sellingPrice", "priceEur", "currentPrice"]:
                        if item.get(price_key):
                            try:
                                price = float(
                                    str(item[price_key]).replace(",", "").replace("€", "").strip()
                                )
                                break
                            except Exception:
                                pass

                    currency = str(item.get("currency") or "EUR").upper()

                    image_url = (
                        item.get("imageUrl") or item.get("image") or
                        item.get("mainImage") or
                        (item.get("images", [{}])[0].get("url") if item.get("images") else None)
                    )

                    url = (
                        item.get("url") or item.get("artworkUrl") or
                        f"https://www.artsper.com/artwork/{artwork_id}"
                    )

                    category = item.get("category") or item.get("medium") or item.get("type", "")

                    lots.append(LotNormalized(
                        external_id=f"artsper-{artwork_id}",
                        source=AuctionHouseEnum.OTHER,
                        title=str(title)[:500] if title else "Untitled",
                        artist_name_raw=str(artist)[:500] if artist else None,
                        estimate_low=price,
                        estimate_high=price,
                        current_price=price,
                        currency=currency,
                        auction_date=None,
                        auction_house_name="Artsper",
                        image_url=str(image_url) if image_url else None,
                        url=str(url) if url else None,
                        category=str(category) if category else None,
                        medium=item.get("medium") or item.get("technique"),
                        raw_data=item,
                    ))
                except Exception as e:
                    logger.debug("artsper_lot_parse_error", error=str(e))
                    continue

    except Exception as e:
        logger.warning("artsper_fetch_failed", error=str(e))

    logger.info("artsper_fetched", count=len(lots))
    return lots
