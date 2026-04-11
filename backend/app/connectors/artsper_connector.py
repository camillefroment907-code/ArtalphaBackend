"""Artsper connector — French primary market, emerging artists."""
import httpx
import structlog
from typing import List, Optional
from app.models.schemas import LotNormalized, AuctionHouseEnum

logger = structlog.get_logger()

async def fetch_lots(limit: int = 100) -> List[LotNormalized]:
    lots = []
    try:
        async with httpx.AsyncClient(timeout=20, headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            "Accept": "application/json",
            "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
            "Referer": "https://www.artsper.com/",
        }) as client:
            endpoints = [
                "https://www.artsper.com/api/artworks?limit=50&sort=trending&available=true&type=painting",
                "https://www.artsper.com/api/v1/artworks?limit=50&available=true&medium=painting",
                "https://www.artsper.com/api/artworks?limit=50&category=peinture&disponible=true",
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
                logger.warning("artsper_all_endpoints_failed")
                return []

            items = (
                data.get("artworks") or data.get("results") or
                data.get("data") or data.get("items") or
                (data if isinstance(data, list) else [])
            )

            for item in items[:limit]:
                try:
                    artwork_id = str(item.get("id") or item.get("artwork_id") or item.get("slug", ""))
                    if not artwork_id:
                        continue

                    title = item.get("title") or item.get("name") or item.get("titre", "")
                    if not title:
                        continue

                    artist = item.get("artist") or item.get("artist_name") or item.get("artiste", "")
                    if isinstance(artist, dict):
                        artist = (
                            artist.get("name") or artist.get("full_name") or
                            artist.get("display_name") or artist.get("nom", "")
                        )

                    price = None
                    for k in ["price", "prix", "selling_price", "price_eur"]:
                        v = item.get(k)
                        if v:
                            try:
                                price = float(str(v).replace(",", "").replace("€", "").strip())
                                if price > 0:
                                    break
                            except Exception:
                                pass

                    if not price:
                        continue

                    currency = str(item.get("currency") or "EUR").upper()

                    image_url = (
                        item.get("image_url") or item.get("image") or
                        item.get("photo") or item.get("thumbnail")
                    )
                    if isinstance(image_url, dict):
                        image_url = (
                            image_url.get("large") or image_url.get("medium") or
                            image_url.get("url") or image_url.get("src")
                        )

                    url = item.get("url") or item.get("artwork_url") or f"https://www.artsper.com/artwork/{artwork_id}"

                    category = item.get("category") or item.get("medium") or item.get("categorie") or "Painting"

                    lots.append(LotNormalized(
                        external_id=f"artsper-{artwork_id}",
                        source=AuctionHouseEnum.OTHER,
                        title=str(title)[:500],
                        artist_name_raw=str(artist)[:500] if artist else None,
                        estimate_low=price,
                        estimate_high=price,
                        current_price=price,
                        currency=currency,
                        auction_date=None,
                        auction_house_name="Artsper",
                        image_url=str(image_url) if image_url else None,
                        url=str(url) if url else None,
                        category=str(category)[:200],
                        medium=item.get("medium") or item.get("technique"),
                        market_type="PRIMARY",
                        is_buy_now=True,
                        gallery_name="Artsper",
                        raw_data={"id": artwork_id, "title": str(title)[:200]},
                    ))
                except Exception as e:
                    logger.debug("artsper_parse_error", error=str(e))
                    continue

    except Exception as e:
        logger.warning("artsper_fetch_failed", error=str(e))

    logger.info("artsper_fetched", count=len(lots))
    return lots
