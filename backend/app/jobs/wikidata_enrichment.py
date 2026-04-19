"""
Wikidata Artist Enrichment Job
Enriches artists table with nationality, birth/death year, art movement.

Run: python -m app.jobs.wikidata_enrichment
Or call enrich_artists_batch() from startup_beat.py (every 6 hours).

Rate limit: max 5 requests/second via asyncio semaphore.
Processes 1000 artists per batch.
"""
import asyncio
import httpx
import structlog
from sqlalchemy import select, update, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models.db_models import Artist

logger = structlog.get_logger().bind(job="wikidata_enrichment")

WIKIDATA_SEARCH = "https://www.wikidata.org/w/api.php"
_SEM = asyncio.Semaphore(5)  # max 5 concurrent requests
_BATCH_SIZE = 1000


async def _fetch_wikidata(client: httpx.AsyncClient, artist_name: str) -> dict:
    """Search Wikidata for an artist. Returns extracted metadata or {}."""
    async with _SEM:
        try:
            params = {
                "action": "wbsearchentities",
                "search": artist_name,
                "language": "en",
                "format": "json",
                "limit": 3,
                "type": "item",
            }
            resp = await client.get(WIKIDATA_SEARCH, params=params, timeout=8.0)
            if resp.status_code != 200:
                return {}
            data = resp.json()
            search_results = data.get("search", [])
            if not search_results:
                return {}

            # Take first result — most relevant
            entity_id = search_results[0].get("id")
            if not entity_id:
                return {}

            # Fetch entity details
            entity_resp = await client.get(
                WIKIDATA_SEARCH,
                params={
                    "action": "wbgetentities",
                    "ids": entity_id,
                    "languages": "en",
                    "format": "json",
                    "props": "claims|labels",
                },
                timeout=10.0,
            )
            if entity_resp.status_code != 200:
                return {}

            entity_data = entity_resp.json()
            entities = entity_data.get("entities", {})
            entity = entities.get(entity_id, {})
            claims = entity.get("claims", {})

            def _get_claim_value(prop: str) -> str | None:
                items = claims.get(prop, [])
                if not items:
                    return None
                mv = items[0].get("mainsnak", {}).get("datavalue", {}).get("value")
                if isinstance(mv, dict):
                    # time value
                    t = mv.get("time", "")
                    if t:
                        try:
                            year = int(t[1:5])
                            return str(year) if year > 0 else None
                        except Exception:
                            return None
                    return mv.get("id")  # entity reference
                return str(mv) if mv else None

            nationality_id = _get_claim_value("P27")  # country of citizenship
            birth_year = _get_claim_value("P569")      # date of birth
            death_year = _get_claim_value("P570")      # date of death
            movement_id = _get_claim_value("P135")     # movement

            # Resolve nationality label
            nationality = None
            if nationality_id and nationality_id.startswith("Q"):
                try:
                    label_resp = await client.get(
                        WIKIDATA_SEARCH,
                        params={"action": "wbgetentities", "ids": nationality_id, "languages": "en", "format": "json", "props": "labels"},
                        timeout=6.0,
                    )
                    if label_resp.status_code == 200:
                        ldata = label_resp.json()
                        nationality = (
                            ldata.get("entities", {})
                            .get(nationality_id, {})
                            .get("labels", {})
                            .get("en", {})
                            .get("value")
                        )
                except Exception:
                    pass

            # Resolve movement label
            movement = None
            if movement_id and movement_id.startswith("Q"):
                try:
                    label_resp = await client.get(
                        WIKIDATA_SEARCH,
                        params={"action": "wbgetentities", "ids": movement_id, "languages": "en", "format": "json", "props": "labels"},
                        timeout=6.0,
                    )
                    if label_resp.status_code == 200:
                        ldata = label_resp.json()
                        movement = (
                            ldata.get("entities", {})
                            .get(movement_id, {})
                            .get("labels", {})
                            .get("en", {})
                            .get("value")
                        )
                except Exception:
                    pass

            return {
                "nationality": nationality,
                "birth_year": int(birth_year) if birth_year and birth_year.isdigit() else None,
                "death_year": int(death_year) if death_year and death_year.isdigit() else None,
                "movement": movement,
            }

        except Exception as e:
            logger.debug("wikidata_fetch_failed", artist=artist_name, error=str(e))
            return {}


async def enrich_artists_batch(batch_size: int = _BATCH_SIZE) -> int:
    """
    Enrich artists that have not yet been enriched.
    Uses a flag column 'enrichment_attempted' — creates it if missing.
    Returns count of artists processed.
    """
    async with AsyncSessionLocal() as db:
        # Ensure enrichment_attempted column exists
        try:
            await db.execute(text(
                "ALTER TABLE artists ADD COLUMN IF NOT EXISTS enrichment_attempted BOOLEAN DEFAULT FALSE"
            ))
            await db.commit()
        except Exception:
            pass

        # Fetch unenriched artists
        result = await db.execute(
            select(Artist)
            .where(
                (Artist.enrichment_attempted.is_(None)) |  # type: ignore[operator]
                (Artist.enrichment_attempted == False)      # noqa: E712
            )
            .limit(batch_size)
        )
        artists = result.scalars().all()

        if not artists:
            logger.info("wikidata_enrichment: no artists to process")
            return 0

        logger.info("wikidata_enrichment: starting batch", count=len(artists))
        processed = 0

        async with httpx.AsyncClient(
            headers={"User-Agent": "NautilusArtDB/1.0 (https://get-nautilus.com; art market data)"},
            follow_redirects=True,
        ) as client:
            tasks = [_fetch_wikidata(client, a.name) for a in artists]
            results = await asyncio.gather(*tasks, return_exceptions=True)

        for artist, enrichment in zip(artists, results):
            if isinstance(enrichment, Exception) or not enrichment:
                enrichment = {}

            try:
                # Update only if we found data and field is currently empty
                if enrichment.get("nationality") and not artist.nationality:
                    artist.nationality = enrichment["nationality"]
                if enrichment.get("birth_year") and not artist.birth_year:
                    artist.birth_year = enrichment["birth_year"]
                if enrichment.get("death_year") and not artist.death_year:
                    artist.death_year = enrichment["death_year"]
                if enrichment.get("movement") and not artist.movement:
                    artist.movement = enrichment["movement"]

                artist.enrichment_attempted = True  # type: ignore[attr-defined]
                processed += 1
            except Exception as e:
                logger.warning("enrichment_update_failed", artist=artist.name, error=str(e))

        try:
            await db.commit()
        except Exception as e:
            logger.error("enrichment_commit_failed", error=str(e))

        logger.info("wikidata_enrichment: batch complete", processed=processed)
        return processed


if __name__ == "__main__":
    import sys
    count = asyncio.run(enrich_artists_batch())
    print(f"Enriched {count} artists")
    sys.exit(0)
