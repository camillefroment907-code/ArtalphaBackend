"""
Backfill hammer_prices: signed, edition_number, edition_size, is_ea.

Parses artwork_title + medium for each row and writes:
  - signed         : True if any signature keyword found
  - edition_number : first group of r'(\d+)\s*/\s*(\d+)'
  - edition_size   : second group (ignored if > 999 or number > size)
  - is_ea          : True if EA / AP / HC / artist proof detected

Usage:
    python -m app.scripts.backfill_hammer_signatures

Env:
    DATABASE_URL  — Postgres connection string
    BATCH_SIZE    — rows per batch (default 10000)
    DRY_RUN       — set to 1 to count matches without writing
"""
import asyncio
import os
import re
import ssl
import logging
from urllib.parse import urlparse, urlencode, parse_qs, urlunparse

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

BATCH_SIZE = int(os.getenv("BATCH_SIZE", "10000"))
DRY_RUN    = os.getenv("DRY_RUN", "0") == "1"

# ── Patterns ──────────────────────────────────────────────────────────────────

_SIGN_WORDS = re.compile(
    r'\b(sign[eéé]?[dredt]?|signé|signerad|signiert|signato|signed)\b',
    re.IGNORECASE,
)

_EDITION_RE = re.compile(r'(\d+)\s*/\s*(\d+)')

_EA_RE = re.compile(
    r"\b(ea|ap|hc|artist\s+proof|[eé]preuve\s+d['\u2019]?artiste)\b",
    re.IGNORECASE,
)


def _parse(title: str | None, medium: str | None) -> dict:
    """Return dict with signed, edition_number, edition_size, is_ea."""
    haystack = " ".join(filter(None, [title, medium]))

    signed = bool(_SIGN_WORDS.search(haystack)) or None

    edition_number = None
    edition_size   = None
    m = _EDITION_RE.search(haystack)
    if m:
        n, s = int(m.group(1)), int(m.group(2))
        if s <= 999 and n <= s:
            edition_number = n
            edition_size   = s

    is_ea = bool(_EA_RE.search(haystack)) or None

    return {
        "signed":         signed,
        "edition_number": edition_number,
        "edition_size":   edition_size,
        "is_ea":          is_ea,
    }


# ── DB helpers ────────────────────────────────────────────────────────────────

def _parse_db_url() -> tuple[str, dict]:
    raw = os.getenv("DATABASE_URL")
    if not raw:
        from app.config import settings
        raw = settings.database_url

    parsed   = urlparse(raw)
    params   = parse_qs(parsed.query, keep_blank_values=True)
    needs_ssl = params.pop("sslmode", [""])[0] in ("require", "verify-ca", "verify-full")
    params.pop("channel_binding", None)

    clean_query = urlencode({k: v[0] for k, v in params.items()})
    clean_url   = urlunparse(parsed._replace(query=clean_query))
    clean_url   = clean_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    clean_url   = clean_url.replace("postgresql+psycopg2://", "postgresql+asyncpg://", 1)

    connect_args: dict = {}
    if needs_ssl:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode    = ssl.CERT_NONE
        connect_args["ssl"] = ctx

    return clean_url, connect_args


# ── Main ──────────────────────────────────────────────────────────────────────

async def run() -> None:
    db_url, connect_args = _parse_db_url()
    engine        = create_async_engine(db_url, connect_args=connect_args, pool_pre_ping=True)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        total_res = await session.execute(text("SELECT COUNT(*) FROM hammer_prices"))
        total = total_res.scalar_one()
        log.info(f"Total rows: {total:,}")

        if DRY_RUN:
            # Sample 50 000 rows to estimate match rates
            sample = (await session.execute(
                text("SELECT artwork_title, medium FROM hammer_prices LIMIT 50000")
            )).fetchall()
            signed_n = edition_n = ea_n = 0
            for title, medium in sample:
                r = _parse(title, medium)
                if r["signed"]:         signed_n  += 1
                if r["edition_number"]: edition_n += 1
                if r["is_ea"]:          ea_n      += 1
            log.info(
                f"DRY_RUN sample (50k): signed={signed_n:,} "
                f"with_edition={edition_n:,} is_ea={ea_n:,}"
            )
            log.info("DRY_RUN=1 — exiting without writing.")
            return

        processed  = 0
        signed_cnt = 0
        edition_cnt = 0
        ea_cnt     = 0
        last_id    = None   # cursor-based pagination — avoids OFFSET double-skip

        while True:
            if last_id is None:
                rows = (await session.execute(
                    text(
                        "SELECT id, artwork_title, medium FROM hammer_prices "
                        "ORDER BY id LIMIT :limit"
                    ),
                    {"limit": BATCH_SIZE},
                )).fetchall()
            else:
                rows = (await session.execute(
                    text(
                        "SELECT id, artwork_title, medium FROM hammer_prices "
                        "WHERE id > :last_id "
                        "ORDER BY id LIMIT :limit"
                    ),
                    {"last_id": last_id, "limit": BATCH_SIZE},
                )).fetchall()

            if not rows:
                break

            # Build per-field update lists to minimise round-trips
            signed_ids:       list[str] = []
            edition_rows:     list[dict] = []   # {id, n, s}
            ea_ids:           list[str] = []

            for row_id, title, medium in rows:
                r = _parse(title, medium)
                sid = str(row_id)
                if r["signed"]:
                    signed_ids.append(sid)
                if r["edition_number"] is not None:
                    edition_rows.append({"id": sid, "n": r["edition_number"], "s": r["edition_size"]})
                if r["is_ea"]:
                    ea_ids.append(sid)

            if signed_ids:
                await session.execute(
                    text("UPDATE hammer_prices SET signed = TRUE WHERE id = ANY(:ids)"),
                    {"ids": signed_ids},
                )
            if ea_ids:
                await session.execute(
                    text("UPDATE hammer_prices SET is_ea = TRUE WHERE id = ANY(:ids)"),
                    {"ids": ea_ids},
                )
            for er in edition_rows:
                await session.execute(
                    text(
                        "UPDATE hammer_prices "
                        "SET edition_number = :n, edition_size = :s "
                        "WHERE id = :id"
                    ),
                    er,
                )

            await session.commit()

            processed   += len(rows)
            signed_cnt  += len(signed_ids)
            edition_cnt += len(edition_rows)
            ea_cnt      += len(ea_ids)
            last_id      = rows[-1][0]

            log.info(
                f"  {processed:,}/{total:,} rows — "
                f"signed={signed_cnt:,} edition={edition_cnt:,} ea={ea_cnt:,}"
            )

        log.info(
            f"Done — {processed:,} rows processed | "
            f"signed={signed_cnt:,} | with_edition={edition_cnt:,} | is_ea={ea_cnt:,}"
        )

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(run())
