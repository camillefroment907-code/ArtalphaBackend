"""
Enrich artist nationality from Artsy GraphQL.

For each artist in DB with NULL nationality:
  1. Search Artsy by name → get slug
  2. Fetch nationality + hometown from artist node
  3. UPDATE artists + lots tables

Usage:
    railway run python3 backend/app/scripts/enrich_artist_nationality.py
"""

import asyncio
import sys
import time
import httpx
import structlog

# ── bootstrap path so app.* imports work ────────────────────────────
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from sqlalchemy import text
from app.database import get_db

logger = structlog.get_logger()

GRAPHQL_URL = "https://metaphysics-production.artsy.net/v2"
SLEEP_BETWEEN = 0.2   # seconds between requests
BATCH_SIZE    = 50
LOG_EVERY     = 100


SEARCH_QUERY = """
query SearchArtist($name: String!) {
  searchConnection(query: $name, entities: [ARTIST], first: 1) {
    edges {
      node {
        ... on Artist {
          slug
          nationality
          hometown
        }
      }
    }
  }
}
"""

ARTIST_QUERY = """
query GetArtist($slug: String!) {
  artist(id: $slug) {
    nationality
    hometown
  }
}
"""


async def fetch_nationality(client: httpx.AsyncClient, artist_name: str) -> tuple[str | None, str | None]:
    """Return (nationality, hometown) or (None, None) on miss/error."""
    try:
        resp = await client.post(
            GRAPHQL_URL,
            json={"query": SEARCH_QUERY, "variables": {"name": artist_name}},
            timeout=10,
        )
        if resp.status_code == 429:
            await asyncio.sleep(5)
            return None, None
        if resp.status_code != 200:
            return None, None

        data = resp.json()
        edges = (
            data.get("data", {})
                .get("searchConnection", {})
                .get("edges", [])
        )
        if not edges:
            return None, None

        node = edges[0].get("node") or {}
        nationality = (node.get("nationality") or "").strip() or None
        hometown    = (node.get("hometown") or "").strip() or None

        # If nationality missing from search result, try fetching artist node directly
        if not nationality:
            slug = node.get("slug")
            if slug:
                resp2 = await client.post(
                    GRAPHQL_URL,
                    json={"query": ARTIST_QUERY, "variables": {"slug": slug}},
                    timeout=10,
                )
                if resp2.status_code == 200:
                    artist_node = resp2.json().get("data", {}).get("artist") or {}
                    nationality = (artist_node.get("nationality") or "").strip() or None
                    if not hometown:
                        hometown = (artist_node.get("hometown") or "").strip() or None

        return nationality, hometown

    except Exception as e:
        logger.debug("fetch_nationality_error", artist=artist_name, error=str(e))
        return None, None


async def main():
    enriched = 0
    not_found = 0
    errors = 0
    total_processed = 0
    start_time = time.time()

    async for db in get_db():
        # Count total work
        count_result = await db.execute(text(
            "SELECT COUNT(*) FROM artists WHERE nationality IS NULL AND name IS NOT NULL"
        ))
        total_to_enrich = count_result.scalar()
        print(f"\n{'='*60}")
        print(f"Artists without nationality: {total_to_enrich:,}")
        print(f"Batch size: {BATCH_SIZE} | Sleep: {SLEEP_BETWEEN}s between requests")
        print(f"{'='*60}\n")

        offset = 0

        async with httpx.AsyncClient(
            headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"},
            timeout=15,
        ) as client:

            while True:
                # Fetch next batch
                rows = (await db.execute(text(
                    "SELECT id, name FROM artists "
                    "WHERE nationality IS NULL AND name IS NOT NULL "
                    "ORDER BY name "
                    f"LIMIT {BATCH_SIZE} OFFSET {offset}"
                ))).fetchall()

                if not rows:
                    break

                for artist_id, artist_name in rows:
                    total_processed += 1

                    nationality, hometown = await fetch_nationality(client, artist_name)
                    await asyncio.sleep(SLEEP_BETWEEN)

                    if nationality:
                        # Update artists table
                        await db.execute(text(
                            "UPDATE artists SET nationality = :nat "
                            "WHERE id = :id"
                        ), {"nat": nationality, "id": str(artist_id)})

                        # Update lots table (denormalized field)
                        lot_result = await db.execute(text(
                            "UPDATE lots SET artist_nationality = :nat "
                            "WHERE artist_name_raw ILIKE :name "
                            "AND artist_nationality IS NULL"
                        ), {"nat": nationality, "name": artist_name})

                        lots_updated = lot_result.rowcount
                        enriched += 1

                        if total_processed % LOG_EVERY == 0 or enriched <= 5:
                            elapsed = time.time() - start_time
                            rate = total_processed / elapsed if elapsed > 0 else 0
                            remaining = total_to_enrich - total_processed
                            eta_s = remaining / rate if rate > 0 else 0
                            eta_min = eta_s / 60
                            print(
                                f"[{total_processed:>5}/{total_to_enrich}] "
                                f"✓ {artist_name[:40]:<40} → {nationality}"
                                f"  (lots: {lots_updated}) "
                                f"| rate: {rate:.1f}/s | ETA: {eta_min:.0f}m"
                            )
                    else:
                        not_found += 1
                        if total_processed % LOG_EVERY == 0:
                            elapsed = time.time() - start_time
                            rate = total_processed / elapsed if elapsed > 0 else 0
                            print(
                                f"[{total_processed:>5}/{total_to_enrich}] "
                                f"  {artist_name[:40]:<40} → not found "
                                f"| enriched so far: {enriched}"
                            )

                # Commit each batch
                await db.commit()
                offset += BATCH_SIZE

                # Progress checkpoint every batch
                elapsed = time.time() - start_time
                print(
                    f"\n--- Batch done (offset {offset}) | "
                    f"enriched: {enriched} | not_found: {not_found} | "
                    f"elapsed: {elapsed:.0f}s ---\n"
                )

        # Final summary
        elapsed = time.time() - start_time
        print(f"\n{'='*60}")
        print(f"DONE")
        print(f"  Total processed : {total_processed:,}")
        print(f"  Enriched        : {enriched:,}")
        print(f"  Not found       : {not_found:,}")
        print(f"  Errors          : {errors:,}")
        print(f"  Elapsed         : {elapsed:.0f}s ({elapsed/60:.1f}min)")
        if total_processed > 0:
            print(f"  Hit rate        : {enriched/total_processed*100:.1f}%")
        print(f"{'='*60}\n")
        break


if __name__ == "__main__":
    asyncio.run(main())
