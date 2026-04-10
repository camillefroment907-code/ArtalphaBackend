"""Singulart connector — primary market, curated emerging artists."""
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
            endpoints = [
                "https://www.singulart.com/api/v2/artworks?limit=100&sort=trending&available=true",
                "https://www.singulart.com/api/artworks?limit=100&status=available",
                "https://api.singulart.com/v1/artworks?limit=100",
            ]
            data = None
            for url in endpoints:
                try:
                    resp = await client.get(url, timeout=10)
                    if resp.status_code == 200:
                        data = resp.json()
                        break
                except Exception:
                    continue

            if not data:
                logger.warning("singulart_all_endpoints_failed")
                return []

            items = data.get("artworks", data.get("results", data.get("data", [])))
            if isinstance(data, list):
                items = data

            for item in items[:limit]:
                try:
                    artwork_id = str(item.get("id") or item.get("artworkId") or item.get("slug", ""))
                    if not artwork_id:
                        continue

                    title = item.get("title") or item.get("name", "Untitled")
                    artist = item.get("artist") or item.get("artistName") or ""
                    if isinstance(artist, dict):
                        artist = artist.get("name") or artist.get("fullName") or artist.get("displayName", "")

                    price = None
                    for k in ["price", "sellingPrice", "priceEur", "currentPrice"]:
                        if item.get(k):
                            try:
                                price = float(
                                    str(item[k]).replace(",", "").replace("€", "").strip()
                                )
                                break
                            except Exception:
                                pass

                    currency = str(item.get("currency") or "EUR").upper()

                    image_url = (
                        item.get("imageUrl") or item.get("image") or item.get("mainImage") or
                        (item.get("images", [{}])[0].get("url") if item.get("images") else None)
                    )

                    url = item.get("url") or f"https://www.singulart.com/artwork/{artwork_id}"

                    lots.append(LotNormalized(
                        external_id=f"singulart-{artwork_id}",
                        source=AuctionHouseEnum.OTHER,
                        title=str(title)[:500],
                        artist_name_raw=str(artist)[:500] if artist else None,
                        estimate_low=price,
                        estimate_high=price,
                        current_price=price,
                        currency=currency,
                        auction_date=None,
                        auction_house_name="Singulart",
                        image_url=str(image_url) if image_url else None,
                        url=str(url) if url else None,
                        category=item.get("category") or item.get("discipline"),
                        medium=item.get("medium") or item.get("technique"),
                        market_type="PRIMARY",
                        is_buy_now=True,
                        raw_data=item,
                    ))
                except Exception as e:
                    logger.debug("singulart_parse_error", error=str(e))
                    continue

    except Exception as e:
        logger.warning("singulart_fetch_failed", error=str(e))

    logger.info("singulart_fetched", count=len(lots))
    return lots
