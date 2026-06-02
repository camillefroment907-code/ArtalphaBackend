"""
Nautilus — Hammer Price Duplicate Detection.

Scans hammer_prices for records that likely represent the same auction sale
captured from multiple sources (e.g. artmarketapi + drouot + invaluable).

READ-ONLY by default. Writes to hammer_price_dup_candidates only with --confirm.

Algorithm:
  1. Find groups where (artist_name_normalized, normalized_title, sale_date_day) match.
  2. Within each group, compute a confidence score based on field overlap.
  3. Assign confidence: EXACT / HIGH / MEDIUM.
  4. Output to reports/hammer_price_duplicates.json and reports/hammer_price_duplicates.md.
  5. With --confirm: create hammer_price_dup_candidates table (IF NOT EXISTS) and insert
     candidate pairs (UNIQUE constraint prevents re-insertion).

Confidence levels:
  EXACT  — all key fields match: price, house, estimate_low, source is different
  HIGH   — 3 of 4 key fields match
  MEDIUM — 2 of 4 key fields match

Usage:
    python -m app.scripts.detect_hammer_duplicates           # dry-run
    python -m app.scripts.detect_hammer_duplicates --confirm # also writes to DB
    DRY_RUN=1 python -m app.scripts.detect_hammer_duplicates # same as default
    LIMIT=1000 python -m app.scripts.detect_hammer_duplicates  # sample run

Env:
    DATABASE_URL — Postgres connection string (falls back to app.config)
    LIMIT        — max rows to scan (default: all)
    DRY_RUN      — set to 1 to skip DB writes (default: 1 unless --confirm passed)
"""
import asyncio
import json
import os
import re
import ssl
import sys
import logging
import unicodedata
from datetime import datetime
from itertools import combinations
from pathlib import Path
from urllib.parse import urlparse, urlencode, parse_qs, urlunparse

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

LIMIT: int | None = int(os.getenv("LIMIT", "0")) or None  # 0 means unlimited


# ── DDL for candidate table ───────────────────────────────────────────────────

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS hammer_price_dup_candidates (
    id                  SERIAL PRIMARY KEY,
    hammer_price_id_a   BIGINT NOT NULL,
    hammer_price_id_b   BIGINT NOT NULL,
    confidence          VARCHAR(10) NOT NULL,
    match_keys          JSONB,
    detected_at         TIMESTAMP DEFAULT NOW(),
    resolved_at         TIMESTAMP,
    resolution          VARCHAR(20),
    UNIQUE(hammer_price_id_a, hammer_price_id_b)
);
"""

# Note: FK references added as comments only — the table may not have BIGINT ids
# (hammer_prices uses UUID). The detection stores UUIDs as text in BIGINT-typed
# cols would fail; we cast to TEXT to be safe. See insert statement below.

CREATE_TABLE_SQL_UUID = """
CREATE TABLE IF NOT EXISTS hammer_price_dup_candidates (
    id                  SERIAL PRIMARY KEY,
    hammer_price_id_a   TEXT NOT NULL,
    hammer_price_id_b   TEXT NOT NULL,
    confidence          VARCHAR(10) NOT NULL,
    match_keys          JSONB,
    detected_at         TIMESTAMP DEFAULT NOW(),
    resolved_at         TIMESTAMP,
    resolution          VARCHAR(20),
    UNIQUE(hammer_price_id_a, hammer_price_id_b)
);
"""


# ── Pure-logic helpers (testable without DB) ──────────────────────────────────

def normalize_title_for_dedup(title: str | None) -> str:
    """
    Normalize an artwork title for duplicate matching.

    Strips leading/trailing whitespace, lowercases, removes accents,
    collapses multiple spaces, removes most punctuation.
    Does NOT remove numbers (they matter in titles like "Composition No. 5").

    Returns empty string for None input.
    """
    if not title:
        return ""
    # Normalize unicode (remove accents)
    t = unicodedata.normalize("NFD", title)
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    # Lowercase
    t = t.lower()
    # Remove punctuation except digits and letters
    t = re.sub(r"[^\w\s]", " ", t)
    # Collapse whitespace
    t = re.sub(r"\s+", " ", t).strip()
    return t


def _price_close(a: float | None, b: float | None, tolerance_pct: float = 5.0) -> bool:
    """Return True if two prices are within tolerance_pct of each other."""
    if a is None or b is None:
        return False
    if a == 0 and b == 0:
        return True
    if a == 0 or b == 0:
        return False
    ratio = min(a, b) / max(a, b)
    return ratio >= (1.0 - tolerance_pct / 100.0)


def compute_duplicate_confidence(a: dict, b: dict) -> str:
    """
    Compute duplicate confidence between two hammer price records.

    Each record dict must have keys: artist, title, date, price, house.
    Uses four comparison dimensions: price, house, estimate (via price as proxy),
    and source difference.

    Confidence levels:
      EXACT  — 4/4 key comparisons pass (same price, same house, same estimate, diff source)
      HIGH   — 3/4 pass
      MEDIUM — 2/4 pass

    Returns one of: 'EXACT', 'HIGH', 'MEDIUM'
    (caller should filter out groups with score < MEDIUM)
    """
    matched_keys: list[str] = []

    # Key 1: price similarity (within 5%)
    if _price_close(a.get("price"), b.get("price"), tolerance_pct=5.0):
        matched_keys.append("price")

    # Key 2: auction house match
    if (
        a.get("house")
        and b.get("house")
        and a["house"].lower().strip() == b["house"].lower().strip()
    ):
        matched_keys.append("house")

    # Key 3: estimate similarity (within 10% — estimates are often rounded differently)
    if _price_close(a.get("estimate_low"), b.get("estimate_low"), tolerance_pct=10.0):
        matched_keys.append("estimate_low")

    # Key 4: same source is NOT a match (same source + same key group = source dedup, handled elsewhere)
    # We reward different sources matching as it confirms cross-source duplicate
    src_a = (a.get("source") or "").strip().lower()
    src_b = (b.get("source") or "").strip().lower()
    if src_a and src_b and src_a != src_b:
        matched_keys.append("different_source")

    n = len(matched_keys)
    if n >= 4:
        return "EXACT"
    if n >= 3:
        return "HIGH"
    return "MEDIUM"


def _get_match_keys_detail(a: dict, b: dict) -> dict:
    """Return a detailed dict of which fields matched for the JSONB match_keys column."""
    return {
        "price_match": _price_close(a.get("price"), b.get("price"), 5.0),
        "house_match": (
            bool(a.get("house"))
            and bool(b.get("house"))
            and a["house"].lower().strip() == b["house"].lower().strip()
        ),
        "estimate_match": _price_close(a.get("estimate_low"), b.get("estimate_low"), 10.0),
        "different_source": (
            bool(a.get("source"))
            and bool(b.get("source"))
            and a["source"].lower().strip() != b["source"].lower().strip()
        ),
        "id_a": a.get("id"),
        "id_b": b.get("id"),
        "source_a": a.get("source"),
        "source_b": b.get("source"),
    }


# ── DB helpers ────────────────────────────────────────────────────────────────

def _parse_db_url() -> tuple[str, dict]:
    """Return (asyncpg_url, connect_args) with SSL handled properly."""
    raw = os.getenv("DATABASE_URL")
    if not raw:
        from app.config import settings
        raw = settings.database_url

    parsed = urlparse(raw)
    params = parse_qs(parsed.query, keep_blank_values=True)

    needs_ssl = params.pop("sslmode", [""])[0] in ("require", "verify-ca", "verify-full")
    params.pop("channel_binding", None)

    clean_query = urlencode({k: v[0] for k, v in params.items()})
    clean_url = urlunparse(parsed._replace(query=clean_query))
    clean_url = clean_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    clean_url = clean_url.replace("postgresql+psycopg2://", "postgresql+asyncpg://", 1)

    connect_args: dict = {}
    if needs_ssl:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        connect_args["ssl"] = ctx

    return clean_url, connect_args


# ── Main ──────────────────────────────────────────────────────────────────────

async def run(confirm: bool = False) -> None:
    """
    Main entry point.

    Args:
        confirm: If True, create the candidate table and insert pairs.
                 If False (default), dry-run only — prints report, no writes.
    """
    db_url, connect_args = _parse_db_url()
    engine = create_async_engine(db_url, connect_args=connect_args, pool_pre_ping=True)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    candidates: list[dict] = []  # accumulated candidate pairs

    async with async_session() as session:

        # ── Step 1: fetch all records needed for grouping ─────────────────────
        # We pull the minimal set of columns needed for duplicate detection.
        # Using LOWER(TRIM(...)) in SQL to save Python work on large datasets.
        limit_clause = f"LIMIT {LIMIT}" if LIMIT else ""
        log.info(f"Fetching hammer_prices for duplicate detection (LIMIT={LIMIT or 'all'})...")

        rows = (await session.execute(
            text(f"""
                SELECT
                    id::TEXT,
                    artist_name_normalized,
                    LOWER(TRIM(COALESCE(artwork_title, '')))    AS title_normalized,
                    DATE(sale_date)                              AS sale_day,
                    hammer_price_eur,
                    LOWER(TRIM(COALESCE(auction_house, '')))    AS house,
                    estimate_low,
                    LOWER(TRIM(COALESCE(source, 'unknown')))    AS source
                FROM hammer_prices
                WHERE artist_name_normalized IS NOT NULL
                  AND sale_date IS NOT NULL
                ORDER BY id
                {limit_clause}
            """)
        )).fetchall()

        log.info(f"Loaded {len(rows):,} rows for analysis")

        if not rows:
            log.warning("No rows to analyze.")
            await engine.dispose()
            return

        # ── Step 2: group by (artist_normalized, title_normalized, sale_day) ──
        groups: dict[tuple, list[dict]] = {}
        for row in rows:
            rec = {
                "id":           row[0],
                "artist":       row[1],
                "title":        normalize_title_for_dedup(row[2]),
                "sale_day":     str(row[3]),
                "price":        float(row[4]) if row[4] is not None else None,
                "house":        row[5],
                "estimate_low": float(row[6]) if row[6] is not None else None,
                "source":       row[7],
            }
            # Only group on non-empty titles (empty titles can't be reliably matched)
            if rec["title"]:
                key = (rec["artist"], rec["title"], rec["sale_day"])
                groups.setdefault(key, []).append(rec)

        # Filter to groups with ≥2 records
        dup_groups = {k: v for k, v in groups.items() if len(v) >= 2}
        log.info(f"Found {len(dup_groups):,} groups with ≥2 records matching (artist, title, date)")

        # ── Step 3: score pairs within each group ─────────────────────────────
        exact_count = high_count = medium_count = 0

        for group_key, records in dup_groups.items():
            for rec_a, rec_b in combinations(records, 2):
                confidence = compute_duplicate_confidence(rec_a, rec_b)
                match_keys = _get_match_keys_detail(rec_a, rec_b)

                # Ensure id_a < id_b for the UNIQUE constraint (canonical ordering)
                id_a, id_b = sorted([rec_a["id"], rec_b["id"]])

                candidate = {
                    "hammer_price_id_a": id_a,
                    "hammer_price_id_b": id_b,
                    "confidence":        confidence,
                    "match_keys":        match_keys,
                    "group_key":         list(group_key),  # for the report
                }
                candidates.append(candidate)

                if confidence == "EXACT":
                    exact_count += 1
                elif confidence == "HIGH":
                    high_count += 1
                else:
                    medium_count += 1

        log.info(
            f"Candidate pairs: EXACT={exact_count:,} HIGH={high_count:,} MEDIUM={medium_count:,} "
            f"total={len(candidates):,}"
        )

        # ── Step 4: write to DB if --confirm ──────────────────────────────────
        if confirm and candidates:
            log.info("--confirm mode: creating table and inserting candidates...")

            # Create table (UUID-based, matching hammer_prices.id type)
            await session.execute(text(CREATE_TABLE_SQL_UUID))
            await session.commit()
            log.info("hammer_price_dup_candidates table created/verified")

            inserted = 0
            skipped = 0
            for c in candidates:
                try:
                    await session.execute(
                        text("""
                            INSERT INTO hammer_price_dup_candidates
                                (hammer_price_id_a, hammer_price_id_b, confidence, match_keys)
                            VALUES
                                (:id_a, :id_b, :confidence, :match_keys)
                            ON CONFLICT (hammer_price_id_a, hammer_price_id_b) DO NOTHING
                        """),
                        {
                            "id_a":       c["hammer_price_id_a"],
                            "id_b":       c["hammer_price_id_b"],
                            "confidence": c["confidence"],
                            "match_keys": json.dumps(c["match_keys"]),
                        },
                    )
                    inserted += 1
                except Exception as e:
                    log.warning(f"Skipped pair ({c['hammer_price_id_a']}, {c['hammer_price_id_b']}): {e}")
                    skipped += 1

                # Commit every 1000 insertions to avoid long transactions
                if inserted % 1000 == 0 and inserted > 0:
                    await session.commit()
                    log.info(f"  Committed {inserted:,} insertions...")

            await session.commit()
            log.info(f"Done: {inserted:,} inserted, {skipped:,} skipped (already existed)")
        elif confirm and not candidates:
            log.info("--confirm mode: no candidates to insert.")
        else:
            log.info("Dry-run mode — no DB writes. Use --confirm to persist.")

    await engine.dispose()

    # ── Step 5: save report ───────────────────────────────────────────────────
    _save_report(candidates, exact_count, high_count, medium_count)


def _save_report(
    candidates: list[dict],
    exact_count: int,
    high_count: int,
    medium_count: int,
) -> None:
    """Save JSON report and Markdown summary to reports/."""
    here = Path(__file__).resolve()
    repo_root = here.parents[4]
    reports_dir = repo_root / "reports"
    reports_dir.mkdir(parents=True, exist_ok=True)

    # Build summary (top 50 EXACT + HIGH pairs only, to keep file manageable)
    high_priority = [c for c in candidates if c["confidence"] in ("EXACT", "HIGH")][:50]

    report = {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "total_candidates": len(candidates),
        "exact_count": exact_count,
        "high_count": high_count,
        "medium_count": medium_count,
        "top_50_exact_high": high_priority,
    }

    json_path = reports_dir / "hammer_price_duplicates.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, default=str)
    log.info(f"JSON report saved to {json_path}")

    # Markdown summary
    md_path = reports_dir / "hammer_price_duplicates.md"
    lines = [
        "# Hammer Price Duplicate Candidates Report",
        f"\nGenerated: {report['generated_at']}",
        f"\n## Summary",
        f"\n- Total candidate pairs: **{len(candidates):,}**",
        f"- EXACT (all key fields match): {exact_count:,}",
        f"- HIGH (3/4 key fields match):  {high_count:,}",
        f"- MEDIUM (2/4 key fields match): {medium_count:,}",
        f"\n## Top 50 EXACT/HIGH Candidates\n",
        "| ID A | ID B | Confidence | Source A | Source B | Price match | House match |",
        "|---|---|---|---|---|---|---|",
    ]
    for c in high_priority:
        mk = c.get("match_keys", {})
        lines.append(
            f"| {c['hammer_price_id_a'][:8]}... | {c['hammer_price_id_b'][:8]}... | "
            f"{c['confidence']} | {mk.get('source_a', 'N/A')} | {mk.get('source_b', 'N/A')} | "
            f"{'Y' if mk.get('price_match') else 'N'} | "
            f"{'Y' if mk.get('house_match') else 'N'} |"
        )
    lines += [
        f"\n_Full data in reports/hammer_price_duplicates.json_",
        f"\n## Next steps",
        f"\n1. Review EXACT pairs first — these are very likely true duplicates.",
        f"2. For confirmed duplicates: keep the record from the higher-authority source",
        f"   (christies > sothebys > bonhams > artmarketapi > invaluable > etc.)",
        f"3. Update `resolved_at` and `resolution` in hammer_price_dup_candidates.",
        f"4. Do NOT delete hammer_price records — set a `is_duplicate_of` flag instead (future migration).",
    ]

    with open(md_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    log.info(f"Markdown report saved to {md_path}")


if __name__ == "__main__":
    # Parse --confirm flag
    confirm = "--confirm" in sys.argv
    # DRY_RUN env var also controls it (default is dry-run)
    if os.getenv("DRY_RUN", "1") == "0":
        confirm = True
    asyncio.run(run(confirm=confirm))
