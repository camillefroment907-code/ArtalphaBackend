"""
Poush Manifesto connector — scrapes https://poush.fr/fr/artistes/
Stores artists in artist_profiles (is_pre_auction=True, source=poush).
"""
import uuid
import logging
from datetime import datetime
from typing import List, Dict, Any

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

ARTISTS_URL = "https://poush.fr/fr/artistes/"

_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
}


async def scrape_artists() -> List[Dict[str, Any]]:
    """Fetch and parse the Poush artist list page."""
    async with httpx.AsyncClient(headers=_HEADERS, follow_redirects=True, timeout=20) as client:
        resp = await client.get(ARTISTS_URL)
        resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "html.parser")
    artists = []

    for card in soup.select(".item-repeater--artist"):
        try:
            name_el = card.select_one("h3.item-repeater__title span")
            if not name_el:
                continue
            name = name_el.get_text(strip=True)
            if not name:
                continue

            btn = card.select_one("button.modal__open[data-src][data-href]")
            photo_url = btn["data-src"] if btn and btn.get("data-src") else None
            artist_page = btn["data-href"] if btn and btn.get("data-href") else None

            bio_el = card.select_one(".current-text p")
            bio = bio_el.get_text(strip=True) if bio_el else None

            is_current = "now" in card.get("data-status", "")

            artists.append({
                "name": name,
                "photo_url": photo_url,
                "artist_page": artist_page,
                "bio": bio,
                "is_current": is_current,
            })
        except Exception as e:
            logger.debug("poush_parse_error error=%s", e)
            continue

    logger.info("poush_scraped count=%d", len(artists))
    return artists


async def sync_to_db() -> int:
    """Upsert scraped Poush artists into artist_profiles. Returns count upserted."""
    from app.database import BgSessionLocal
    from app.models.db_models import ArtistProfile
    from sqlalchemy import select

    artists = await scrape_artists()
    if not artists:
        logger.warning("poush_no_artists_scraped")
        return 0

    imported = 0
    async with BgSessionLocal() as session:
        # Load existing profile names for dedup (any source)
        existing_result = await session.execute(select(ArtistProfile.name))
        existing_names = {row[0].lower() for row in existing_result.all()}

        for a in artists:
            name_lower = a["name"].lower()
            raw = {
                "source": "poush",
                "artist_page": a.get("artist_page"),
                "photo_url": a.get("photo_url"),
                "is_current_resident": a.get("is_current"),
                "scraped_at": datetime.utcnow().isoformat(),
            }

            if name_lower in existing_names:
                # Update existing profile
                existing = await session.execute(
                    select(ArtistProfile).where(
                        ArtistProfile.name.ilike(a["name"]),
                    )
                )
                profile = existing.scalar_one_or_none()
                if profile:
                    profile.biography = a.get("bio") or profile.biography
                    profile.image_url = a.get("photo_url") or profile.image_url
                    profile.artsy_url = a.get("artist_page") or profile.artsy_url
                    profile.raw_data = raw
                    profile.updated_at = datetime.utcnow()
            else:
                session.add(ArtistProfile(
                    id=uuid.uuid4(),
                    artsy_id=None,
                    name=a["name"],
                    biography=a.get("bio"),
                    image_url=a.get("photo_url"),
                    is_pre_auction=True,
                    investment_tier="emerging",
                    artsy_url=a.get("artist_page"),
                    raw_data=raw,
                    updated_at=datetime.utcnow(),
                ))
                existing_names.add(name_lower)

            imported += 1

        await session.commit()

    logger.info("poush_sync_done imported=%d", imported)
    return imported
