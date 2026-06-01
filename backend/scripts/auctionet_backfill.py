"""
Auctionet Backfill — fetch past auction results and populate lots.hammer_price.

For each lot with:
  source = 'auctionet'
  auction_date < NOW() - 6h (give auctions time to close)
  hammer_price IS NULL

Fetches the Auctionet item page, extracts window.vipDataAtPageLoad JSON,
and records the hammer price (or marks as unsold).

Usage:
    python3 scripts/auctionet_backfill.py                   # dry run, 100 lots
    python3 scripts/auctionet_backfill.py --limit 500       # dry run, 500 lots
    python3 scripts/auctionet_backfill.py --commit          # WRITE to DB (100 lots)
    python3 scripts/auctionet_backfill.py --commit --limit 0  # all lots (no limit)

SAFETY: --commit is required for any DB write. Default is dry-run.
"""

import argparse
import asyncio
import json
import logging
import os
import re
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone

import httpx

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.database import BgSessionLocal

# ── Logging ────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("auctionet_backfill")

# ── Constants ──────────────────────────────────────────────────────────────────
RATE_LIMIT_S    = 1.0        # seconds between requests
TIMEOUT_S       = 15         # httpx timeout per request
MAX_RETRIES     = 2          # retries on 5xx / network error
RETRY_WAIT_S    = 3          # wait between retries
DEFAULT_LIMIT   = 100        # lots processed when --limit not specified

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9,sv;q=0.8",
}

# Known Auctionet item states
STATE_SOLD       = "sold"
STATE_NOT_SOLD   = "not_sold"
STATE_PUBLISHED  = "published"   # auction still live
STATE_ACTIVE     = "active"      # auction still live
STATE_WITHDRAWN  = "withdrawn"

LIVE_STATES = {STATE_PUBLISHED, STATE_ACTIVE}

SEP  = "═" * 72
SEP2 = "─" * 72


# ── Data classes ───────────────────────────────────────────────────────────────
@dataclass
class LotRecord:
    lot_id:       str
    external_id:  str
    url:          str
    title:        str
    auction_date: datetime
    estimate_low: float | None
    db_currency:  str | None


@dataclass
class FetchResult:
    lot_id:          str
    external_id:     str
    url:             str
    status:          str           # sold | not_sold | live | not_found | parse_error | error
    hammer_price:    float | None  = None
    currency:        str | None    = None
    estimate_eur:    float | None  = None   # item.estimate from page — always EUR
    n_bids:          int           = 0
    state:           str | None    = None
    error_msg:       str | None    = None


# ── HTML parsing ───────────────────────────────────────────────────────────────
_VIP_PATTERN = re.compile(
    r'window\.vipDataAtPageLoad\s*=\s*(\{.*?\})\s*(?:\n|;)',
    re.DOTALL,
)


def extract_vip_data(html: str) -> dict | None:
    """Extract and parse window.vipDataAtPageLoad from Auctionet page HTML."""
    m = _VIP_PATTERN.search(html)
    if not m:
        return None
    try:
        return json.loads(m.group(1))
    except json.JSONDecodeError:
        return None


def parse_outcome(data: dict) -> FetchResult | None:
    """
    Parse vipDataAtPageLoad into a FetchResult.
    Returns None if data structure is unexpected.
    """
    item = data.get("item")
    if not item or not isinstance(item, dict):
        return None

    state        = item.get("state")
    currency     = item.get("currency") or item.get("original_currency")
    bids         = item.get("bids") or []
    item_id      = item.get("id")
    # item.estimate is always in EUR — Auctionet converts all currencies to EUR for display
    estimate_eur = float(item["estimate"]) if item.get("estimate") is not None else None

    # Auction still live — don't record yet
    if state in LIVE_STATES:
        return FetchResult(
            lot_id="",  # filled by caller
            external_id="",
            url="",
            status="live",
            state=state,
            n_bids=len(bids),
        )

    # Sold: hammer = highest bid
    if state == STATE_SOLD and bids:
        hammer = max(float(b["amount"]) for b in bids if "amount" in b)
        return FetchResult(
            lot_id="",
            external_id="",
            url="",
            status="sold",
            state=state,
            hammer_price=hammer,
            currency=currency,
            estimate_eur=estimate_eur,
            n_bids=len(bids),
        )

    # Sold but no bids recorded — data anomaly
    if state == STATE_SOLD and not bids:
        return FetchResult(
            lot_id="", external_id="", url="",
            status="sold_no_bids",
            state=state, currency=currency, estimate_eur=estimate_eur, n_bids=0,
        )

    # Not sold / withdrawn
    return FetchResult(
        lot_id="", external_id="", url="",
        status="not_sold",
        state=state,
        n_bids=len(bids),
        currency=currency,
        estimate_eur=estimate_eur,
    )


def build_item_url(external_id: str, fallback_url: str) -> str:
    """
    Build canonical Auctionet item URL from external_id.
    Auctionet redirects /en/{item_id}-anyslug to the canonical URL.
    Falls back to the stored URL if external_id doesn't match pattern.
    """
    m = re.match(r'^auctionet-(\d+)$', external_id)
    if m:
        item_id = m.group(1)
        return f"https://auctionet.com/en/{item_id}"
    # Fallback: use stored URL (format-1 works fine, format-2 redirects OK)
    return fallback_url


# ── HTTP fetch with retry ─────────────────────────────────────────────────────
def fetch_lot_page(client: httpx.Client, url: str) -> tuple[int, str]:
    """Fetch URL with retries. Returns (status_code, html_text)."""
    last_exc = None
    for attempt in range(MAX_RETRIES + 1):
        try:
            resp = client.get(url, follow_redirects=True)
            if resp.status_code == 429:
                retry_after = int(resp.headers.get("Retry-After", 30))
                log.warning(f"  429 rate-limited, sleeping {retry_after}s")
                time.sleep(retry_after)
                continue
            if resp.status_code >= 500 and attempt < MAX_RETRIES:
                log.warning(f"  {resp.status_code} server error, retry {attempt+1}/{MAX_RETRIES}")
                time.sleep(RETRY_WAIT_S)
                continue
            return resp.status_code, resp.text
        except (httpx.TimeoutException, httpx.NetworkError) as e:
            last_exc = e
            if attempt < MAX_RETRIES:
                log.warning(f"  Network error ({e}), retry {attempt+1}/{MAX_RETRIES}")
                time.sleep(RETRY_WAIT_S)
    raise last_exc or RuntimeError("Max retries exceeded")


# ── DB queries ────────────────────────────────────────────────────────────────
async def fetch_lots(db, limit: int) -> list[LotRecord]:
    """Fetch lots needing backfill from DB."""
    limit_clause = f"LIMIT {limit}" if limit > 0 else ""
    sql = f"""
        SELECT
            id::text            AS lot_id,
            external_id,
            url,
            title,
            auction_date,
            estimate_low,
            currency            AS db_currency
        FROM lots
        WHERE source::text = 'auctionet'
          AND auction_date < NOW() - INTERVAL '6 hours'
          AND hammer_price IS NULL
          AND url IS NOT NULL
        ORDER BY auction_date DESC
        {limit_clause}
    """
    r = await db.execute(text(sql))
    rows = r.mappings().all()
    return [LotRecord(**dict(row)) for row in rows]


async def write_hammer_price(
    lot_id: str, hammer_price: float, currency: str,
    estimate_eur: float | None = None,
    retries: int = 3,
) -> None:
    """
    Update lots.hammer_price + currency in its own session + immediate commit.
    Also rewrites estimate_low and currency to EUR values from the Auctionet page,
    ensuring hammer/estimate ratio is always computed in the same currency.
    Retries on connection errors (NullPool connections can be dropped by Neon).
    """
    for attempt in range(retries):
        try:
            async with BgSessionLocal() as db:
                if estimate_eur is not None:
                    await db.execute(
                        text("""
                            UPDATE lots
                            SET hammer_price = :hp,
                                estimate_low = :est_eur,
                                currency     = :cur,
                                updated_at   = NOW()
                            WHERE id = CAST(:lid AS uuid)
                        """),
                        {"hp": hammer_price, "est_eur": estimate_eur, "cur": currency, "lid": lot_id},
                    )
                else:
                    await db.execute(
                        text("""
                            UPDATE lots
                            SET hammer_price = :hp,
                                currency     = COALESCE(currency, :cur),
                                updated_at   = NOW()
                            WHERE id = CAST(:lid AS uuid)
                        """),
                        {"hp": hammer_price, "cur": currency, "lid": lot_id},
                    )
                await db.commit()
            return  # success
        except Exception as e:
            if attempt < retries - 1:
                log.warning(f"  DB write failed (attempt {attempt+1}/{retries}): {e} — retrying in 2s")
                await asyncio.sleep(2)
            else:
                raise


# ── Main logic ────────────────────────────────────────────────────────────────
async def run(commit: bool, limit: int) -> None:
    mode = "COMMIT" if commit else "DRY RUN"
    print(f"\n{SEP}")
    print(f"  AUCTIONET BACKFILL  —  {mode}  —  limit={'all' if limit == 0 else limit}")
    print(SEP)

    async with BgSessionLocal() as db:
        lots = await fetch_lots(db, limit)
        total = len(lots)
        print(f"\n  Lots to process: {total:,}")
        if total == 0:
            print("  Nothing to do.")
            return

        print(f"\n{'─'*72}")
        print(f"  {'Status':<14} {'Lot ID':<10} {'Hammer':>10} {'Curr':>5}  {'Title / Note'}")
        print(f"{'─'*72}")

        # Counters
        stats: dict[str, int] = {
            "sold": 0, "not_sold": 0, "live": 0,
            "sold_no_bids": 0, "not_found": 0, "parse_error": 0, "error": 0,
        }
        results: list[FetchResult] = []

        with httpx.Client(timeout=TIMEOUT_S, headers=HEADERS) as client:
            for i, lot in enumerate(lots):
                fetch_url = build_item_url(lot.external_id, lot.url)

                result = FetchResult(
                    lot_id=lot.lot_id,
                    external_id=lot.external_id,
                    url=fetch_url,
                    status="error",
                )

                try:
                    status_code, html = fetch_lot_page(client, fetch_url)

                    if status_code == 404:
                        result.status = "not_found"
                        result.error_msg = "HTTP 404"

                    elif status_code == 200:
                        vip = extract_vip_data(html)
                        if vip is None:
                            result.status = "parse_error"
                            result.error_msg = "vipDataAtPageLoad not found"
                        else:
                            parsed = parse_outcome(vip)
                            if parsed is None:
                                result.status = "parse_error"
                                result.error_msg = "Unexpected item structure"
                            else:
                                result = parsed
                                result.lot_id      = lot.lot_id
                                result.external_id = lot.external_id
                                result.url         = fetch_url

                    else:
                        result.status    = "error"
                        result.error_msg = f"HTTP {status_code}"

                except Exception as e:
                    result.status    = "error"
                    result.error_msg = str(e)[:80]

                # Log
                stats[result.status] = stats.get(result.status, 0) + 1
                results.append(result)

                ext_short = lot.external_id.replace("auctionet-", "")[:10]
                title_short = lot.title[:35] if lot.title else ""
                if result.status == "sold" and result.hammer_price:
                    note = f"{title_short}"
                    print(f"  {'✓ sold':<14} {ext_short:<10} {result.hammer_price:>10,.0f} {result.currency or '?':>5}  {note}")
                elif result.status == "not_sold":
                    print(f"  {'✗ not_sold':<14} {ext_short:<10} {'—':>10} {'—':>5}  {title_short}")
                elif result.status == "live":
                    print(f"  {'~ live':<14} {ext_short:<10} {'—':>10} {'—':>5}  {title_short} [{result.state}]")
                elif result.status in ("not_found", "parse_error", "error"):
                    print(f"  {'⚠ ' + result.status:<14} {ext_short:<10} {'—':>10} {'—':>5}  {result.error_msg}")

                # Write to DB if --commit and sold
                if commit and result.status == "sold" and result.hammer_price:
                    await write_hammer_price(
                        result.lot_id,
                        result.hammer_price,
                        result.currency or "EUR",
                        result.estimate_eur,
                    )

                # Rate limit
                time.sleep(RATE_LIMIT_S)

        # ── Summary ──────────────────────────────────────────────────────────
        print(f"\n{SEP}")
        print(f"  SUMMARY  —  {mode}")
        print(SEP)
        sold_count  = stats.get("sold", 0)
        total_done  = sum(stats.values())
        hammers     = [r.hammer_price for r in results if r.status == "sold" and r.hammer_price]
        avg_hammer  = sum(hammers) / len(hammers) if hammers else 0
        print(f"\n  Total processed   : {total_done:,}")
        print(f"  ✓  sold           : {sold_count:,}")
        print(f"  ✗  not_sold       : {stats.get('not_sold', 0):,}")
        print(f"  ~  live (skip)    : {stats.get('live', 0):,}")
        print(f"  ⚠  not_found      : {stats.get('not_found', 0):,}")
        print(f"  ⚠  parse_error    : {stats.get('parse_error', 0):,}")
        print(f"  ⚠  error          : {stats.get('error', 0):,}")
        print(f"\n  Avg hammer price  : {avg_hammer:,.0f} (sold lots only)")
        if hammers:
            print(f"  Min hammer        : {min(hammers):,.0f}")
            print(f"  Max hammer        : {max(hammers):,.0f}")

        if not commit:
            print(f"\n  [DRY RUN] No changes written to DB.")
            print(f"  Re-run with --commit to persist {sold_count} hammer prices.")
        else:
            print(f"\n  [COMMIT] {sold_count} hammer prices written to DB.")

        print(SEP)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Auctionet hammer price backfill")
    parser.add_argument(
        "--commit", action="store_true",
        help="Write results to DB. Without this flag, runs in dry-run mode.",
    )
    parser.add_argument(
        "--limit", type=int, default=DEFAULT_LIMIT,
        help=f"Max lots to process (default: {DEFAULT_LIMIT}). Use 0 for all.",
    )
    args = parser.parse_args()

    asyncio.run(run(commit=args.commit, limit=args.limit))
