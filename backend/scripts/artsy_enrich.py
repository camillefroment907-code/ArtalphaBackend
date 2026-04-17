"""
Artsy Artist Enrichment — before API shutdown.

For each artist in our DB:
  1. Search Artsy by name via GraphQL
  2. Pull: biography, nationality, birth/death year, movement genes, top artworks
  3. Store in Artist.external_ids["artsy"] + update structured fields

Run from backend/:
    python scripts/artsy_enrich.py [--limit 500]
"""

import asyncio
import json
import os
import re
import sys
import time
from typing import Optional

import httpx

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.config import get_settings
from app.models.db_models import Artist, Lot
import uuid

settings = get_settings()

ARTSY_GQL = "https://metaphysics-production.artsy.net/v2"
ARTSY_HEADERS = {"Content-Type": "application/json", "User-Agent": "Nautilus/1.0"}

# ── DB setup ──────────────────────────────────────────────────────────────────
def _make_async_url(url: str) -> tuple[str, dict]:
    connect_args: dict = {}
    for param in ("sslmode", "channel_binding"):
        url = re.sub(rf"[?&]{param}=[^&]*", "", url)
    url = url.rstrip("?&")
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    if "neon.tech" in url or "railway.app" in url:
        connect_args = {"ssl": "require"}
    return url, connect_args


_db_url, _connect_args = _make_async_url(settings.database_url)
engine = create_async_engine(_db_url, echo=False, pool_pre_ping=True, connect_args=_connect_args)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


# ── Artsy GraphQL query ────────────────────────────────────────────────────────
ARTIST_QUERY = """
query ArtistSearch($name: String!) {
  searchConnection(query: $name, first: 3, entities: [ARTIST]) {
    edges {
      node {
        ... on Artist {
          slug
          name
          nationality
          birthday
          deathday
          biographyBlurb { text }
          genes { name }
          artworksConnection(first: 20) {
            edges {
              node {
                title
                date
                medium
                image { url }
              }
            }
          }
        }
      }
    }
  }
}
"""


def _strip_md_links(text: str) -> str:
    """Remove markdown links: [text](/url) → text"""
    return re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text or "")


def _parse_year(val: str) -> Optional[int]:
    if not val:
        return None
    m = re.search(r"\b(\d{4})\b", str(val))
    return int(m.group(1)) if m else None


def _infer_movement(genes: list[dict]) -> Optional[str]:
    """Pick the most relevant movement gene (skip geographic/period genes)."""
    SKIP = {"1860–1969", "1918–1939", "1940–1979", "1980–1999", "2000–present",
            "France", "Russia", "Germany", "USA", "Italy", "Spain", "UK", "China",
            "Eastern Europe", "Western Europe", "North America", "South America"}
    for gene in genes:
        name = gene.get("name", "")
        if name and name not in SKIP and not re.match(r"^\d{4}", name):
            return name
    return None


async def fetch_artsy_artist(client: httpx.AsyncClient, name: str) -> Optional[dict]:
    """Query Artsy GraphQL for an artist by name. Returns best match or None."""
    try:
        resp = await client.post(
            ARTSY_GQL,
            json={"query": ARTIST_QUERY, "variables": {"name": name}},
            headers=ARTSY_HEADERS,
            timeout=15.0,
        )
        if resp.status_code != 200:
            return None
        data = resp.json()
        edges = data.get("data", {}).get("searchConnection", {}).get("edges", [])
        if not edges:
            return None

        # Pick best match — prefer exact name match (case-insensitive)
        name_lower = name.lower()
        for edge in edges:
            node = edge.get("node", {})
            if node.get("name", "").lower() == name_lower:
                return node
        # Fallback: first result
        return edges[0].get("node")
    except Exception as e:
        print(f"  ✗  Artsy API error for {name}: {e}")
        return None


# ── Main loop ─────────────────────────────────────────────────────────────────
async def main(limit: int = 2000):
    print("── Nautilus × Artsy artist enrichment ─────────────────────────────")
    print(f"   Max per run: {limit}")

    async with AsyncSessionLocal() as db:

        # Load all artists from DB, ordered by lot count (most active first)
        result = await db.execute(
            select(Artist)
            .order_by(Artist.created_at.asc())
        )
        artists = result.scalars().all()
        print(f"   Artists in DB: {len(artists)}\n")

        enriched_count = 0
        skipped = 0
        not_found = 0

        async with httpx.AsyncClient(follow_redirects=True) as client:
            for artist in artists:
                if enriched_count >= limit:
                    print(f"\nLimit of {limit} reached — stopping.")
                    break

                # Skip if already enriched from Artsy
                ext = artist.external_ids or {}
                if ext.get("artsy", {}).get("slug"):
                    skipped += 1
                    continue

                name = (artist.name or "").strip()
                if not name:
                    skipped += 1
                    continue

                data = await fetch_artsy_artist(client, name)

                if not data:
                    not_found += 1
                    print(f"  ✗  {name} — not found on Artsy")
                    await asyncio.sleep(0.2)
                    continue

                # Parse fields
                slug        = data.get("slug", "")
                nationality = data.get("nationality") or artist.nationality
                birth_year  = _parse_year(data.get("birthday")) or artist.birth_year
                death_year  = _parse_year(data.get("deathday")) or artist.death_year
                bio_raw     = (data.get("biographyBlurb") or {}).get("text", "")
                biography   = _strip_md_links(bio_raw).strip()
                genes       = data.get("genes") or []
                movement    = _infer_movement(genes) or artist.movement

                # Artworks list
                artworks = []
                for edge in (data.get("artworksConnection") or {}).get("edges", []):
                    node = edge.get("node", {})
                    artworks.append({
                        "title":  node.get("title"),
                        "date":   node.get("date"),
                        "medium": node.get("medium"),
                        "image":  (node.get("image") or {}).get("url"),
                    })

                # Build external_ids update
                new_ext = dict(ext)
                new_ext["artsy"] = {
                    "slug":       slug,
                    "biography":  biography,
                    "genes":      [g["name"] for g in genes],
                    "artworks":   artworks,
                    "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                }

                # Update artist
                artist.nationality   = nationality or artist.nationality
                artist.birth_year    = birth_year  or artist.birth_year
                artist.death_year    = death_year  or artist.death_year
                artist.movement      = movement    or artist.movement
                artist.external_ids  = new_ext
                artist.last_enriched_at = __import__("datetime").datetime.utcnow()

                await db.commit()

                enriched_count += 1
                print(f"  ✓  {name} → {slug} | {nationality} | {birth_year}–{death_year} | {movement} | {len(artworks)} artworks")

                # Respectful rate limit
                await asyncio.sleep(0.3)

    print(f"\n── Done ────────────────────────────────────────────────────────────")
    print(f"   Enriched: {enriched_count}")
    print(f"   Skipped (already done): {skipped}")
    print(f"   Not found on Artsy: {not_found}")


if __name__ == "__main__":
    limit = 2000
    for arg in sys.argv[1:]:
        if arg.startswith("--limit="):
            limit = int(arg.split("=")[1])
        elif arg.isdigit():
            limit = int(arg)
    asyncio.run(main(limit=limit))
