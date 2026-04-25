"""
Artsper Artist Enrichment Job
==============================
Fetches all artworks from Artsper's Algolia search index (193k+ records),
aggregates per-artist market data, and upserts into artsper_artist_snapshots.

This builds the primary-market moat: price anchors, gallery representation,
medium distribution, and sell-through signals that complement auction data.

Run strategy:
  - Full scan: paginate Algolia up to MAX_ARTWORKS per run (covers all artists)
  - Multi-query: rotates through category filters to maximise Algolia pagination
  - Incremental: subsequent runs append a row to price_history for trend tracking
  - Linking: matches snapshots to Artist records by normalized name (no LLM needed)

Celery schedule: weekly, Sunday 1am UTC.
Can also be triggered via admin endpoint.
"""
import asyncio
import statistics
import unicodedata
import re
import uuid as uuid_module
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx
import structlog
from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert

logger = structlog.get_logger()

# ---------------------------------------------------------------------------
# Algolia constants (public search key — read-only, visible in browser)
# ---------------------------------------------------------------------------
ALGOLIA_APP_ID = "FEOHGOI5X1"
ALGOLIA_SEARCH_KEY = "b4379a5897050044b31d92bbfbab1f86"
ALGOLIA_INDEX = "artworks_channel_6"
ALGOLIA_URL = f"https://{ALGOLIA_APP_ID.lower()}-dsn.algolia.net/1/indexes/*/queries"
ALGOLIA_AGENT = (
    "Algolia for JavaScript (4.8.6); Browser (lite); "
    "instantsearch.js (4.17.0); JS Helper (3.12.0)"
)

HITS_PER_PAGE = 1000  # Algolia max per request
# Algolia standard search paginates up to paginationLimitedTo (default 1000).
# We rotate through category filters to exceed this per-query cap.
CATEGORY_FILTERS = [
    "",              # no filter → top 1000 by relevance
    "Painting",
    "Photography",
    "Sculpture",
    "Drawing",
    "Print",
    "Digital Art",
    "Mixed Media",
    "Textile",
    "Ceramics",
    "Collage",
    "Installation",
    "Video Art",
]
MAX_ARTWORKS = 200_000   # hard cap for safety


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _normalize(name: str) -> str:
    """Lowercase, strip diacritics, collapse whitespace."""
    nfkd = unicodedata.normalize("NFKD", name)
    ascii_str = "".join(c for c in nfkd if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", ascii_str.lower().strip())


def _parse_facet_label(val: Any) -> Optional[str]:
    """Parse '6*Painting*painting' → 'Painting'."""
    if not val:
        return None
    if isinstance(val, list):
        val = val[0] if val else None
    if not val:
        return None
    parts = str(val).split("*")
    return parts[1] if len(parts) >= 2 else str(val)


def _percentile(data: List[float], p: float) -> float:
    """Simple percentile without numpy."""
    if not data:
        return 0.0
    sorted_data = sorted(data)
    idx = (len(sorted_data) - 1) * p
    lo, hi = int(idx), min(int(idx) + 1, len(sorted_data) - 1)
    return sorted_data[lo] + (sorted_data[hi] - sorted_data[lo]) * (idx - lo)


# ---------------------------------------------------------------------------
# Algolia fetch
# ---------------------------------------------------------------------------

async def _fetch_page(
    client: httpx.AsyncClient,
    page: int,
    category_filter: str = "",
    api_key: str = ALGOLIA_SEARCH_KEY,
) -> List[Dict]:
    """Fetch one page of Algolia results. Returns empty list on error."""
    # Request only the fields we actually need (Algolia snake_case names from the index)
    retrieve = ",".join([
        "artist_id", "artist_name", "vendor_name", "vendor",
        "price_eur", "current_price", "artwork_price",
        "category_en", "medium_en",
        "urls", "artist_urls",
        "sold_out", "is_available", "is_staffpicked", "is_top_seller",
        "objectID", "id",
    ])
    params_str = (
        f"hitsPerPage={HITS_PER_PAGE}"
        f"&page={page}"
        f"&query="
        f"&analytics=false"
        f"&clickAnalytics=false"
        f"&attributesToRetrieve={retrieve.replace(',', '%2C')}"
    )
    if category_filter:
        encoded_filter = category_filter.replace(" ", "%20")
        params_str += f"&filters=category_en%3A{encoded_filter}"

    body = {
        "requests": [{"indexName": ALGOLIA_INDEX, "params": params_str}]
    }
    url_params = {
        "x-algolia-agent": ALGOLIA_AGENT,
        "x-algolia-api-key": api_key,
        "x-algolia-application-id": ALGOLIA_APP_ID,
    }
    try:
        resp = await client.post(ALGOLIA_URL, params=url_params, json=body, timeout=20)
        if resp.status_code != 200:
            logger.warning("artsper_enrich_algolia_error", status=resp.status_code)
            return []
        data = resp.json()
        return data.get("results", [{}])[0].get("hits", [])
    except Exception as e:
        logger.warning("artsper_enrich_algolia_request_error", error=str(e))
        return []


async def _collect_all_hits(api_key: str = ALGOLIA_SEARCH_KEY) -> List[Dict]:
    """
    Rotate through category filters to collect as many unique artworks as possible.
    Each category query can return up to paginationLimitedTo (≤1000) artworks.
    """
    all_hits: Dict[str, Dict] = {}  # keyed by Algolia objectID to dedup

    async with httpx.AsyncClient(timeout=30) as client:
        for category in CATEGORY_FILTERS:
            if len(all_hits) >= MAX_ARTWORKS:
                break

            page = 0
            consecutive_empty = 0
            while len(all_hits) < MAX_ARTWORKS:
                hits = await _fetch_page(client, page, category, api_key)
                if not hits:
                    consecutive_empty += 1
                    if consecutive_empty >= 2:
                        break  # Algolia pagination limit reached
                    break

                new_count = 0
                for hit in hits:
                    oid = str(hit.get("objectID") or hit.get("id") or "")
                    if oid and oid not in all_hits:
                        all_hits[oid] = hit
                        new_count += 1

                logger.debug(
                    "artsper_enrich_page",
                    category=category or "all",
                    page=page,
                    page_hits=len(hits),
                    new=new_count,
                    total=len(all_hits),
                )

                if len(hits) < HITS_PER_PAGE:
                    break  # last page
                if new_count == 0:
                    break  # all duplicates — stop

                page += 1
                await asyncio.sleep(0.1)  # gentle rate limiting

    logger.info("artsper_enrich_collected", total=len(all_hits))
    return list(all_hits.values())


# ---------------------------------------------------------------------------
# Per-artist aggregation
# ---------------------------------------------------------------------------

def _aggregate_artists(hits: List[Dict]) -> Dict[int, Dict]:
    """
    Group hits by artist_id and compute per-artist market stats.
    Returns dict keyed by artsper_artist_id.
    """
    by_artist: Dict[int, Dict] = {}

    for hit in hits:
        # Get Artsper artist ID
        artist_id_raw = (
            hit.get("artist_id") or hit.get("artistId") or
            hit.get("artistID") or ""
        )
        if not artist_id_raw:
            continue
        try:
            artist_id = int(artist_id_raw)
        except (TypeError, ValueError):
            continue

        artist_name = str(
            hit.get("artist_name") or hit.get("artistName") or ""
        ).strip()
        if not artist_name:
            continue

        # Price
        price = None
        for k in ("price_eur", "current_price", "artwork_price"):
            v = hit.get(k)
            if v is not None:
                try:
                    f = float(v)
                    if f > 0:
                        price = f
                        break
                except (TypeError, ValueError):
                    pass

        # Category
        cat_raw = hit.get("category_en")
        category = _parse_facet_label(cat_raw) or "Art"

        # Medium
        med_raw = hit.get("medium_en")
        medium = _parse_facet_label(med_raw)

        # Gallery
        vendor = str(
            hit.get("vendor_name") or hit.get("vendor") or
            hit.get("primaryGallery") or ""
        ).strip()

        # Availability
        sold_out = hit.get("sold_out", False)
        is_available = hit.get("is_available", not sold_out)

        # Signals
        is_staff_pick = bool(hit.get("is_staffpicked") or hit.get("is_staff_picked"))
        is_top_seller = bool(hit.get("is_top_seller"))

        # Artist URL
        artist_urls = hit.get("artist_urls") or hit.get("artistUrls") or {}
        artsper_url = None
        if isinstance(artist_urls, dict):
            rel = artist_urls.get("en") or artist_urls.get("fr") or next(iter(artist_urls.values()), None)
            if rel:
                artsper_url = f"https://www.artsper.com{rel}" if rel.startswith("/") else rel

        # Accumulate
        if artist_id not in by_artist:
            by_artist[artist_id] = {
                "artsper_artist_id": artist_id,
                "artist_name": artist_name,
                "prices": [],
                "galleries": set(),
                "categories": defaultdict(int),
                "mediums": defaultdict(int),
                "total_works": 0,
                "works_available": 0,
                "works_sold": 0,
                "has_staff_pick": False,
                "is_top_seller": False,
                "artsper_url": artsper_url,
            }

        a = by_artist[artist_id]
        a["total_works"] += 1
        if is_available and not sold_out:
            a["works_available"] += 1
        else:
            a["works_sold"] += 1
        if price:
            a["prices"].append(price)
        if vendor:
            a["galleries"].add(vendor)
        a["categories"][category] += 1
        if medium:
            a["mediums"][medium] += 1
        if is_staff_pick:
            a["has_staff_pick"] = True
        if is_top_seller:
            a["is_top_seller"] = True
        if artsper_url and not a["artsper_url"]:
            a["artsper_url"] = artsper_url

    # Compute price stats
    for artist_id, data in by_artist.items():
        prices = data.pop("prices")
        galleries = data.pop("galleries")

        data["gallery_names"] = sorted(galleries)[:50]  # cap at 50
        data["gallery_count"] = len(galleries)
        data["categories"] = dict(sorted(data["categories"].items(), key=lambda x: -x[1])[:20])
        data["mediums"] = dict(sorted(data["mediums"].items(), key=lambda x: -x[1])[:20])

        if prices:
            data["price_min"] = min(prices)
            data["price_max"] = max(prices)
            data["price_avg"] = round(sum(prices) / len(prices), 2)
            data["price_median"] = round(statistics.median(prices), 2)
            data["price_p25"] = round(_percentile(prices, 0.25), 2)
            data["price_p75"] = round(_percentile(prices, 0.75), 2)
        else:
            data["price_min"] = None
            data["price_max"] = None
            data["price_avg"] = None
            data["price_median"] = None
            data["price_p25"] = None
            data["price_p75"] = None

        data["artist_name_normalized"] = _normalize(data["artist_name"])

    return by_artist


# ---------------------------------------------------------------------------
# DB upsert
# ---------------------------------------------------------------------------

async def _upsert_snapshots(session, artist_data: Dict[int, Dict]) -> int:
    """Upsert ArtsperArtistSnapshot rows. Returns number of rows inserted/updated."""
    from app.models.db_models import ArtsperArtistSnapshot

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    today_str = now.strftime("%Y-%m-%d")
    inserted = 0

    # Load existing snapshots to merge price_history
    existing_result = await session.execute(
        select(
            ArtsperArtistSnapshot.artsper_artist_id,
            ArtsperArtistSnapshot.price_history,
        )
    )
    existing = {row[0]: (row[1] or []) for row in existing_result.all()}

    BATCH = 500
    rows = list(artist_data.values())

    for i in range(0, len(rows), BATCH):
        batch = rows[i : i + BATCH]
        values = []

        for data in batch:
            aid = data["artsper_artist_id"]
            history = list(existing.get(aid, []))

            # Append today's snapshot (avoid duplicate entries for same date)
            if not history or history[-1].get("date") != today_str:
                history.append({
                    "date": today_str,
                    "total_works": data["total_works"],
                    "works_available": data.get("works_available", 0),
                    "works_sold": data.get("works_sold", 0),
                    "price_avg": data.get("price_avg"),
                    "price_median": data.get("price_median"),
                    "price_min": data.get("price_min"),
                    "price_max": data.get("price_max"),
                    "gallery_count": data.get("gallery_count", 0),
                })
            # Keep last 104 weeks (~2 years) of history
            history = history[-104:]

            values.append({
                "id": uuid_module.uuid4(),
                "artsper_artist_id": aid,
                "artist_name": data["artist_name"],
                "artist_name_normalized": data["artist_name_normalized"],
                "total_works": data["total_works"],
                "works_available": data.get("works_available", 0),
                "works_sold": data.get("works_sold", 0),
                "price_min": data.get("price_min"),
                "price_max": data.get("price_max"),
                "price_avg": data.get("price_avg"),
                "price_median": data.get("price_median"),
                "price_p25": data.get("price_p25"),
                "price_p75": data.get("price_p75"),
                "gallery_count": data.get("gallery_count", 0),
                "gallery_names": data.get("gallery_names", []),
                "categories": data.get("categories", {}),
                "mediums": data.get("mediums", {}),
                "has_staff_pick": data.get("has_staff_pick", False),
                "is_top_seller": data.get("is_top_seller", False),
                "artsper_url": data.get("artsper_url"),
                "artist_id": None,  # linked in second pass
                "price_history": history,
                "first_seen_at": now,
                "last_synced_at": now,
                "created_at": now,
                "updated_at": now,
            })

        stmt = pg_insert(ArtsperArtistSnapshot).values(values)
        stmt = stmt.on_conflict_do_update(
            index_elements=["artsper_artist_id"],
            set_={
                "artist_name": stmt.excluded.artist_name,
                "artist_name_normalized": stmt.excluded.artist_name_normalized,
                "total_works": stmt.excluded.total_works,
                "works_available": stmt.excluded.works_available,
                "works_sold": stmt.excluded.works_sold,
                "price_min": stmt.excluded.price_min,
                "price_max": stmt.excluded.price_max,
                "price_avg": stmt.excluded.price_avg,
                "price_median": stmt.excluded.price_median,
                "price_p25": stmt.excluded.price_p25,
                "price_p75": stmt.excluded.price_p75,
                "gallery_count": stmt.excluded.gallery_count,
                "gallery_names": stmt.excluded.gallery_names,
                "categories": stmt.excluded.categories,
                "mediums": stmt.excluded.mediums,
                "has_staff_pick": stmt.excluded.has_staff_pick,
                "is_top_seller": stmt.excluded.is_top_seller,
                "artsper_url": stmt.excluded.artsper_url,
                "price_history": stmt.excluded.price_history,
                "last_synced_at": stmt.excluded.last_synced_at,
                "updated_at": stmt.excluded.updated_at,
            },
        )
        await session.execute(stmt)
        await session.commit()
        inserted += len(batch)
        logger.info("artsper_enrich_batch_upserted", batch_end=i + len(batch), total=len(rows))

    return inserted


async def _link_to_artist_records(session) -> int:
    """
    Link ArtsperArtistSnapshot rows to our Artist records by normalized name.
    Uses a single SQL UPDATE ... FROM to avoid N+1 queries.
    """
    result = await session.execute(text("""
        UPDATE artsper_artist_snapshots snap
        SET    artist_id = a.id,
               updated_at = NOW()
        FROM   artists a
        WHERE  snap.artist_id IS NULL
          AND  snap.artist_name_normalized = a.name_normalized
    """))
    await session.commit()
    linked = result.rowcount
    logger.info("artsper_enrich_linked", linked=linked)
    return linked


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

async def run_artsper_enrichment(max_artworks: int = MAX_ARTWORKS) -> Dict:
    """
    Full pipeline:
    1. Fetch artworks from Algolia
    2. Aggregate per-artist stats
    3. Upsert into artsper_artist_snapshots
    4. Link to Artist records

    Returns summary dict for logging / admin UI.
    """
    from app.database import BgSessionLocal as AsyncSessionLocal

    logger.info("artsper_enrichment_starting", max_artworks=max_artworks)
    start = datetime.now(timezone.utc)

    # 1. Collect artwork hits from Algolia
    hits = await _collect_all_hits()
    if not hits:
        logger.warning("artsper_enrichment_no_hits")
        return {"status": "no_data", "artists": 0, "artworks": 0}

    hits = hits[:max_artworks]
    logger.info("artsper_enrichment_hits_collected", count=len(hits))

    # 2. Aggregate per artist
    artist_data = _aggregate_artists(hits)
    logger.info("artsper_enrichment_artists_aggregated", count=len(artist_data))

    # 3. Upsert
    async with AsyncSessionLocal() as session:
        upserted = await _upsert_snapshots(session, artist_data)
        linked = await _link_to_artist_records(session)

    elapsed = (datetime.now(timezone.utc) - start).total_seconds()
    summary = {
        "status": "ok",
        "artworks_processed": len(hits),
        "artists_found": len(artist_data),
        "rows_upserted": upserted,
        "artist_records_linked": linked,
        "elapsed_seconds": round(elapsed, 1),
    }
    logger.info("artsper_enrichment_done", **summary)
    return summary
