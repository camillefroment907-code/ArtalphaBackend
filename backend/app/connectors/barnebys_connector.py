"""Barnebys connector — European auction aggregator, 2000+ houses."""
import httpx
import structlog
from datetime import datetime
from typing import List, Optional
from app.models.schemas import LotNormalized, AuctionHouseEnum

logger = structlog.get_logger()

async def fetch_lots(limit: int = 100) -> List[LotNormalized]:
    lots = []
    try:
        async with httpx.AsyncClient(timeout=20, headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            "Accept": "application/json",
            "Accept-Language": "en-US,en;q=0.9",
        }) as client:
            endpoints = [
                "https://www.barnebys.com/api/lots?category=paintings&status=upcoming&per_page=50",
                "https://www.barnebys.com/api/search?q=painting&type=lot&status=upcoming&size=50",
                "https://api.barnebys.com/v1/lots?category=fine-art&limit=50",
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
                logger.warning("barnebys_all_endpoints_failed")
                return []

            items = (
                data.get("lots") or data.get("results") or
                data.get("items") or data.get("data") or
                (data if isinstance(data, list) else [])
            )

            for item in items[:limit]:
                try:
                    lot_id = str(item.get("id") or item.get("lot_id") or item.get("slug", ""))
                    if not lot_id:
                        continue

                    title = item.get("title") or item.get("name") or item.get("description", "")
                    if not title:
                        continue

                    artist = item.get("artist") or item.get("artist_name") or item.get("maker", "")
                    if isinstance(artist, dict):
                        artist = artist.get("name") or artist.get("full_name", "")

                    price = None
                    for k in ["estimate_low", "low_estimate", "starting_bid", "price", "current_bid"]:
                        v = item.get(k)
                        if v:
                            try:
                                price = float(str(v).replace(",", "").replace("€", "").replace("$", "").strip())
                                break
                            except Exception:
                                pass

                    if not price:
                        continue

                    estimate_high = None
                    for k in ["estimate_high", "high_estimate"]:
                        v = item.get(k)
                        if v:
                            try:
                                estimate_high = float(str(v).replace(",", "").replace("€", "").replace("$", "").strip())
                                break
                            except Exception:
                                pass

                    image_url = (
                        item.get("image_url") or item.get("image") or
                        item.get("thumbnail") or item.get("photo")
                    )
                    if isinstance(image_url, dict):
                        image_url = image_url.get("url") or image_url.get("src")

                    url = item.get("url") or item.get("lot_url") or f"https://www.barnebys.com/lot/{lot_id}"

                    auction_date = None
                    for df in ["end_date", "auction_date", "ends_at", "closing_date"]:
                        if item.get(df):
                            try:
                                auction_date = datetime.fromisoformat(str(item[df])[:19])
                                break
                            except Exception:
                                pass

                    currency = str(item.get("currency") or item.get("currency_code") or "EUR").upper()
                    auction_house = item.get("auction_house") or item.get("house") or item.get("seller", "Barnebys")
                    if isinstance(auction_house, dict):
                        auction_house = auction_house.get("name", "Barnebys")

                    lots.append(LotNormalized(
                        external_id=f"barnebys-{lot_id}",
                        source='other',
                        title=str(title)[:500],
                        artist_name_raw=str(artist)[:500] if artist else None,
                        estimate_low=price,
                        estimate_high=estimate_high or price,
                        current_price=price,
                        currency=currency,
                        auction_date=auction_date,
                        auction_house_name=str(auction_house)[:300],
                        image_url=str(image_url) if image_url else None,
                        url=str(url) if url else None,
                        category=item.get("category") or "Fine Art",
                        medium=item.get("medium") or item.get("technique"),
                        raw_data={"id": lot_id, "title": str(title)[:200]},
                    ))
                except Exception as e:
                    logger.debug("barnebys_parse_error", error=str(e))
                    continue

    except Exception as e:
        logger.warning("barnebys_fetch_failed", error=str(e))

    logger.info("barnebys_fetched", count=len(lots))
    return lots
