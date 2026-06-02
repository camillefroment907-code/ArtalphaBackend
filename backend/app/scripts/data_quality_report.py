"""
Nautilus — Data Quality Report for hammer_prices table.

READ-ONLY script. Makes ZERO database modifications.

Analyzes:
  - Total row count
  - Field coverage (% non-null) per key column
  - Year breakdown: count, % with estimate, % with medium_category
  - Source breakdown: count, % with hammer_price_eur, % with medium_category
  - Auction house breakdown (top 20): count, avg price, % with estimates
  - Duplicate candidate count (same artist_name_normalized + artwork_title + sale_date)
  - Missing artist_name_normalized (has artist_name but no normalized form)

Output:
  - reports/data_quality_report.json
  - Markdown summary printed to stdout

Coverage classification:
  GREEN  ≥ 80%
  YELLOW 50–79%
  RED    < 50%

Usage:
    python -m app.scripts.data_quality_report

Env:
    DATABASE_URL — Postgres connection string (falls back to app.config)
"""
import asyncio
import json
import os
import ssl
import sys
import logging
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse, urlencode, parse_qs, urlunparse

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

# ── Coverage classification ───────────────────────────────────────────────────

def classify_coverage(pct: float | None) -> str:
    """Return GREEN / YELLOW / RED based on coverage percentage."""
    if pct is None:
        return "RED"
    if pct >= 80.0:
        return "GREEN"
    if pct >= 50.0:
        return "YELLOW"
    return "RED"


def _pct(num: int, denom: int) -> float | None:
    """Safe percentage calculation."""
    if denom == 0:
        return None
    return round(num / denom * 100, 1)


# ── DB connection (same pattern as backfill_hammer_signatures.py) ─────────────

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


# ── Report generation ─────────────────────────────────────────────────────────

async def run() -> None:
    db_url, connect_args = _parse_db_url()
    engine = create_async_engine(db_url, connect_args=connect_args, pool_pre_ping=True)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    report: dict = {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "table": "hammer_prices",
    }

    async with async_session() as session:

        # ── Total row count ───────────────────────────────────────────────────
        total_res = await session.execute(text("SELECT COUNT(*) FROM hammer_prices"))
        total: int = total_res.scalar_one()
        report["total_rows"] = total
        log.info(f"Total rows: {total:,}")

        if total == 0:
            log.warning("Table is empty — report will have no meaningful data.")
            report["warning"] = "Table is empty"
            _save_report(report)
            await engine.dispose()
            return

        # ── Field coverage ────────────────────────────────────────────────────
        coverage_fields = [
            "hammer_price_eur",
            "estimate_low",
            "estimate_high",
            "medium",
            "medium_category",
            "dimensions",
            "artist_name_normalized",
            "signed",
            "edition_number",
        ]

        coverage: dict[str, dict] = {}
        for field in coverage_fields:
            res = await session.execute(
                text(f"SELECT COUNT(*) FROM hammer_prices WHERE {field} IS NOT NULL")
            )
            count_non_null: int = res.scalar_one()
            pct = _pct(count_non_null, total)
            coverage[field] = {
                "count_non_null": count_non_null,
                "coverage_pct": pct,
                "status": classify_coverage(pct),
            }
            log.info(f"  Coverage {field}: {count_non_null:,}/{total:,} = {pct}% [{coverage[field]['status']}]")

        report["field_coverage"] = coverage

        # ── Breakdown by year ─────────────────────────────────────────────────
        year_rows = (await session.execute(
            text("""
                SELECT
                    EXTRACT(YEAR FROM sale_date)::INT  AS year,
                    COUNT(*)                            AS cnt,
                    COUNT(estimate_low)                 AS with_estimate,
                    COUNT(medium_category)              AS with_medium_category
                FROM hammer_prices
                WHERE sale_date IS NOT NULL
                GROUP BY 1
                ORDER BY 1
            """)
        )).fetchall()

        by_year = []
        for row in year_rows:
            yr, cnt, est, med = row
            by_year.append({
                "year": yr,
                "count": cnt,
                "pct_with_estimate": _pct(est, cnt),
                "pct_with_medium_category": _pct(med, cnt),
            })
        report["by_year"] = by_year
        log.info(f"Year breakdown: {len(by_year)} distinct years")

        # Count rows without sale_date
        no_date_res = await session.execute(
            text("SELECT COUNT(*) FROM hammer_prices WHERE sale_date IS NULL")
        )
        report["rows_without_sale_date"] = no_date_res.scalar_one()

        # ── Breakdown by source ───────────────────────────────────────────────
        source_rows = (await session.execute(
            text("""
                SELECT
                    COALESCE(source, 'unknown')     AS src,
                    COUNT(*)                         AS cnt,
                    COUNT(hammer_price_eur)          AS with_price_eur,
                    COUNT(medium_category)           AS with_medium_category
                FROM hammer_prices
                GROUP BY 1
                ORDER BY 2 DESC
            """)
        )).fetchall()

        by_source = []
        for row in source_rows:
            src, cnt, price, med = row
            by_source.append({
                "source": src,
                "count": cnt,
                "pct_with_hammer_price_eur": _pct(price, cnt),
                "pct_with_medium_category": _pct(med, cnt),
            })
        report["by_source"] = by_source
        log.info(f"Source breakdown: {len(by_source)} distinct sources")

        # ── Breakdown by auction house (top 20) ───────────────────────────────
        house_rows = (await session.execute(
            text("""
                SELECT
                    COALESCE(auction_house, 'unknown')  AS house,
                    COUNT(*)                             AS cnt,
                    ROUND(AVG(hammer_price_eur)::NUMERIC, 2)   AS avg_price_eur,
                    COUNT(estimate_low)                  AS with_estimates
                FROM hammer_prices
                GROUP BY 1
                ORDER BY 2 DESC
                LIMIT 20
            """)
        )).fetchall()

        by_house = []
        for row in house_rows:
            house, cnt, avg_price, est = row
            by_house.append({
                "auction_house": house,
                "count": cnt,
                "avg_hammer_price_eur": float(avg_price) if avg_price is not None else None,
                "pct_with_estimates": _pct(est, cnt),
            })
        report["by_auction_house_top20"] = by_house
        log.info(f"Auction house breakdown: top 20 shown")

        # ── Duplicate candidate count ─────────────────────────────────────────
        # Same (artist_name_normalized, artwork_title, sale_date as date) — potential same sale
        _dup_res = await session.execute(
            text("""
                SELECT COUNT(*) FROM (
                    SELECT
                        artist_name_normalized,
                        LOWER(TRIM(artwork_title))  AS title_key,
                        DATE(sale_date)              AS sale_day
                    FROM hammer_prices
                    WHERE artist_name_normalized IS NOT NULL
                      AND artwork_title IS NOT NULL
                      AND sale_date IS NOT NULL
                    GROUP BY 1, 2, 3
                    HAVING COUNT(*) > 1
                ) AS dup_groups
            """)
        )
        dup_res = _dup_res.scalar_one()
        report["duplicate_candidate_groups"] = dup_res
        log.info(f"Duplicate candidate groups (same artist+title+date): {dup_res:,}")

        # Total rows involved in duplicates
        _dup_row_res = await session.execute(
            text("""
                SELECT COALESCE(SUM(cnt), 0) FROM (
                    SELECT COUNT(*) AS cnt
                    FROM hammer_prices
                    WHERE artist_name_normalized IS NOT NULL
                      AND artwork_title IS NOT NULL
                      AND sale_date IS NOT NULL
                    GROUP BY
                        artist_name_normalized,
                        LOWER(TRIM(artwork_title)),
                        DATE(sale_date)
                    HAVING COUNT(*) > 1
                ) AS dup_groups
            """)
        )
        dup_row_res = _dup_row_res.scalar_one()
        report["duplicate_candidate_rows"] = int(dup_row_res) if dup_row_res else 0
        log.info(f"Total rows in duplicate groups: {report['duplicate_candidate_rows']:,}")

        # ── Missing artist_name_normalized ────────────────────────────────────
        # Has artist_name (non-null) but artist_name_normalized is missing
        _missing_norm_res = await session.execute(
            text("""
                SELECT COUNT(*)
                FROM hammer_prices
                WHERE artist_name IS NOT NULL
                  AND artist_name != ''
                  AND artist_name_normalized IS NULL
            """)
        )
        missing_norm_res = _missing_norm_res.scalar_one()
        report["missing_artist_name_normalized"] = missing_norm_res
        pct_missing_norm = _pct(missing_norm_res, total)
        report["pct_missing_artist_name_normalized"] = pct_missing_norm
        log.info(
            f"Missing artist_name_normalized: {missing_norm_res:,} "
            f"({pct_missing_norm}% of total)"
        )

    await engine.dispose()

    # ── Compute overall health ────────────────────────────────────────────────
    critical_fields = ["hammer_price_eur", "artist_name_normalized", "medium_category"]
    critical_statuses = [
        report["field_coverage"][f]["status"]
        for f in critical_fields
        if f in report["field_coverage"]
    ]
    if "RED" in critical_statuses:
        report["overall_health"] = "RED"
    elif "YELLOW" in critical_statuses:
        report["overall_health"] = "YELLOW"
    else:
        report["overall_health"] = "GREEN"

    _save_report(report)
    _print_markdown_summary(report)


def _save_report(report: dict) -> None:
    """Save report to reports/data_quality_report.json."""
    # Determine repo root (script is at backend/app/scripts/data_quality_report.py)
    here = Path(__file__).resolve()
    repo_root = here.parents[4]  # backend/app/scripts → backend/app → backend → repo root
    reports_dir = repo_root / "reports"
    reports_dir.mkdir(parents=True, exist_ok=True)

    out_path = reports_dir / "data_quality_report.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, default=str)
    log.info(f"Report saved to {out_path}")


def _print_markdown_summary(report: dict) -> None:
    """Print a human-readable Markdown summary to stdout."""
    total = report.get("total_rows", 0)
    overall = report.get("overall_health", "UNKNOWN")

    print()
    print("# Nautilus — Hammer Prices Data Quality Report")
    print(f"Generated: {report.get('generated_at', 'N/A')}")
    print(f"**Overall Health:** {overall}")
    print()
    print(f"## Summary")
    print(f"- Total rows: **{total:,}**")
    print(f"- Rows without sale_date: {report.get('rows_without_sale_date', 'N/A'):,}")
    print(f"- Duplicate candidate groups: {report.get('duplicate_candidate_groups', 'N/A'):,}")
    print(f"- Rows in duplicate groups: {report.get('duplicate_candidate_rows', 'N/A'):,}")
    print(f"- Missing artist_name_normalized: {report.get('missing_artist_name_normalized', 'N/A'):,}")
    print()

    print("## Field Coverage")
    print("| Field | Non-null Count | Coverage % | Status |")
    print("|---|---|---|---|")
    for field, data in report.get("field_coverage", {}).items():
        print(
            f"| {field} | {data['count_non_null']:,} | "
            f"{data['coverage_pct']}% | {data['status']} |"
        )
    print()

    print("## Breakdown by Source")
    print("| Source | Count | % with EUR price | % with medium_category |")
    print("|---|---|---|---|")
    for row in report.get("by_source", []):
        print(
            f"| {row['source']} | {row['count']:,} | "
            f"{row['pct_with_hammer_price_eur']}% | "
            f"{row['pct_with_medium_category']}% |"
        )
    print()

    print("## Top 20 Auction Houses")
    print("| Auction House | Count | Avg Price (EUR) | % with Estimates |")
    print("|---|---|---|---|")
    for row in report.get("by_auction_house_top20", []):
        avg = f"{row['avg_hammer_price_eur']:,.0f}" if row["avg_hammer_price_eur"] else "N/A"
        print(
            f"| {row['auction_house']} | {row['count']:,} | "
            f"{avg} | {row['pct_with_estimates']}% |"
        )
    print()

    by_year = report.get("by_year", [])
    if by_year:
        print("## Breakdown by Year (recent 10)")
        print("| Year | Count | % with Estimate | % with medium_category |")
        print("|---|---|---|---|")
        for row in by_year[-10:]:
            print(
                f"| {row['year']} | {row['count']:,} | "
                f"{row['pct_with_estimate']}% | "
                f"{row['pct_with_medium_category']}% |"
            )
    print()
    print("_Full report saved to reports/data_quality_report.json_")


if __name__ == "__main__":
    asyncio.run(run())
