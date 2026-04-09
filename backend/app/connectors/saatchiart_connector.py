"""Saatchi Art connector — primary market, emerging artists."""
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
        }) as client:
            endpoints = [
                "https://www.saatchiart.com/api/v1/artworks/featured",
                "https://www.saatchiart.com/api/artworks?limit=100&sort=trending",
                "https://api.saatchiart.com/artworks?limit=100&available=true",
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
                logger.warning("saatchiart_all_endpoints_failed")
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
                        artist = artist.get("name") or artist.get("fullName") or ""

                    price = None
                    for k in ["price", "sellingPrice", "priceUsd", "currentPrice"]:
                        if item.get(k):
                            try:
                                price = float(
                                    str(item[k]).replace(",", "").replace("$", "").strip()
                                )
                                break
                            except Exception:
                                pass

                    currency = str(item.get("currency") or "USD").upper()

                    image_url = (
                        item.get("imageUrl") or item.get("image") or
                        item.get("mainImage") or
                        (item.get("images", [{}])[0].get("url") if item.get("images") else None)
                    )

                    url = item.get("url") or f"https://www.saatchiart.com/art/{artwork_id}"

                    lots.append(LotNormalized(
                        external_id=f"saatchi-{artwork_id}",
                        source=AuctionHouseEnum.OTHER,
                        title=str(title)[:500],
                        artist_name_raw=str(artist)[:500] if artist else None,
                        estimate_low=price,
                        estimate_high=price,
                        current_price=price,
                        currency=currency,
                        auction_date=None,
                        auction_house_name="Saatchi Art",
                        image_url=str(image_url) if image_url else None,
                        url=str(url) if url else None,
                        category=item.get("category") or item.get("medium"),
                        medium=item.get("medium") or item.get("materials"),
                        market_type="primary",
                        is_buy_now=True,
                        raw_data=item,
                    ))
                except Exception as e:
                    logger.debug("saatchi_parse_error", error=str(e))
                    continue

    except Exception as e:
        logger.warning("saatchiart_fetch_failed", error=str(e))

    logger.info("saatchiart_fetched", count=len(lots))
    return lots
