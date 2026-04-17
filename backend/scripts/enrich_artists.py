"""
Enrich artist records with GPT-4o-mini data.

For each unique artist name in the Lot table:
  1. Find or create an Artist row
  2. If nationality / movement / biography is missing, call GPT-4o-mini
  3. Update the Artist row with the result
  4. Link all lots with that artist_name_raw to the Artist row

Run from backend/ directory:
    python scripts/enrich_artists.py
"""

import asyncio
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select, update, func, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.config import get_settings
from app.models.db_models import Artist, Lot
import uuid

settings = get_settings()

# ── DB engine (mirrors app/database.py SSL handling) ──────────────────────────
def _make_async_url(url: str) -> tuple[str, dict]:
    import re
    connect_args: dict = {}
    for param in ("sslmode", "channel_binding"):
        url = re.sub(rf"[?&]{param}=[^&]*", "", url)
    url = url.rstrip("?&")
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    if "neon.tech" in url:
        connect_args = {"ssl": "require"}
    return url, connect_args

_db_url, _connect_args = _make_async_url(settings.database_url)

engine = create_async_engine(
    _db_url,
    echo=False,
    pool_pre_ping=True,
    connect_args=_connect_args,
)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


# ── GPT enrichment ────────────────────────────────────────────────────────────
async def enrich_via_gpt(name: str, retries: int = 3) -> dict | None:
    from openai import AsyncOpenAI, RateLimitError
    api_key = settings.openai_api_key or os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print(f"  ✗  No OpenAI API key — skipping GPT for {name}")
        return None

    client = AsyncOpenAI(api_key=api_key)
    prompt = (
        f"You are an art market expert. For the artist {name}, "
        "provide in JSON: nationality, birth_year (integer or null), death_year (integer or null), "
        "movement (e.g. Cubism, Surrealism, Abstract Expressionism), "
        "bio (2 sentences max, investment-focused). "
        "Use null for unknown years, never strings like 'Unknown'. "
        "Return only valid JSON, no markdown."
    )

    for attempt in range(retries):
        try:
            resp = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=300,
                temperature=0.2,
                response_format={"type": "json_object"},
            )
            raw = resp.choices[0].message.content.strip()
            return json.loads(raw)
        except RateLimitError as e:
            wait = 10 * (attempt + 1)
            print(f"  ⏳  Rate limit for {name} — waiting {wait}s (attempt {attempt+1}/{retries})…")
            await asyncio.sleep(wait)
        except Exception as e:
            print(f"  ✗  GPT error for {name}: {e}")
            return None

    print(f"  ✗  Gave up on {name} after {retries} retries")
    return None


# ── Main enrichment loop ──────────────────────────────────────────────────────
async def main():
    print("── Nautilus artist enrichment ──────────────────────────")

    async with AsyncSessionLocal() as db:

        # 1. All distinct artist names in the Lot table
        result = await db.execute(
            select(Lot.artist_name_raw, func.count(Lot.id).label("n"))
            .where(Lot.artist_name_raw.isnot(None))
            .group_by(Lot.artist_name_raw)
            .order_by(func.count(Lot.id).desc())
        )
        artist_rows = result.all()
        print(f"Found {len(artist_rows)} distinct artist names in lots\n")

        enriched_count = 0
        skipped = 0

        for row in artist_rows:
            name: str = (row.artist_name_raw or "").strip()
            if not name:
                continue

            # Stop after 500 GPT calls per run
            if enriched_count >= 500:
                print("Daily limit reached, stopping")
                break

            # 2. Find existing Artist row (case-insensitive)
            artist_result = await db.execute(
                select(Artist).where(func.lower(Artist.name) == name.lower()).limit(1)
            )
            artist: Artist | None = artist_result.scalar_one_or_none()

            # Only enrich artists where fields are still missing
            if artist is not None and artist.nationality and artist.movement and artist.biography:
                print(f"Skipping {artist.name} — already enriched")
                skipped += 1
                continue

            print(f"  →  {name} ({row.n} lots) — fetching from GPT…")
            data = await enrich_via_gpt(name)

            if not data:
                skipped += 1
                await asyncio.sleep(0.5)
                continue

            nationality   = str(data.get("nationality") or "").strip() or None
            movement      = str(data.get("movement") or "").strip() or None

            def _safe_year(val) -> int | None:
                try:
                    return int(val) if val and str(val).strip().lstrip('-').isdigit() else None
                except (ValueError, TypeError):
                    return None

            birth_year = _safe_year(data.get("birth_year"))
            death_year = _safe_year(data.get("death_year"))

            # 3. Create or update Artist row
            if artist is None:
                artist = Artist(
                    id=uuid.uuid4(),
                    name=name,
                    name_normalized=name.lower(),
                    nationality=nationality,
                    birth_year=birth_year,
                    death_year=death_year,
                    movement=movement,
                )
                db.add(artist)
                await db.flush()  # get the id
                print(f"     Created Artist row  id={artist.id}")
            else:
                artist.nationality = nationality or artist.nationality
                artist.birth_year  = birth_year  or artist.birth_year
                artist.death_year  = death_year  or artist.death_year
                artist.movement    = movement    or artist.movement
                print(f"     Updated Artist row  id={artist.id}")

            # 4. Link all lots with this artist_name_raw to the Artist row
            await db.execute(
                update(Lot)
                .where(func.lower(Lot.artist_name_raw) == name.lower())
                .where(Lot.artist_id.is_(None))
                .values(artist_id=artist.id)
            )
            await db.commit()

            print(f"     ✓  nationality={nationality}  movement={movement}  birth={birth_year}")
            enriched_count += 1

            await asyncio.sleep(0.5)  # rate-limit GPT calls

    print(f"\n── Done — enriched {enriched_count}, skipped {skipped} ──────────────")


if __name__ == "__main__":
    asyncio.run(main())
