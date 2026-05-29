"""
Weekly portfolio snapshot job.

Runs every Sunday at 20:00 UTC.
For every user who has portfolio items, writes one row to portfolio_snapshots
with today's total value, cost, item count, health score and dimension breakdown.

Upsert on (user_id, snapshot_date) so re-runs are idempotent.
"""
from __future__ import annotations

import logging
import math
from datetime import date, datetime

from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.database import BgSessionLocal
from app.engines.projections import get_artist_tier
from app.models.db_models import Artist, PortfolioItem, PortfolioSnapshot

logger = logging.getLogger(__name__)

# ── Health scoring constants (mirrors collection_os.py) ──────────────────────

def _normalize(name: str | None) -> str:
    return name.lower().strip() if name else ""


def _compute_health(
    items: list[PortfolioItem],
    liquidity_map: dict[str, float],
    trend_map: dict[str, str],
    now: datetime,
) -> tuple[int, dict]:
    """Return (total_score 0-100, breakdown dict). Mirrors collection_os health logic."""
    n = len(items)
    if n == 0:
        return 0, {}

    # Dimension 1 — Diversification (0-20)
    artist_counts: dict[str, int] = {}
    for i in items:
        name = _normalize(i.artist_name) or "unknown"
        artist_counts[name] = artist_counts.get(name, 0) + 1
    hhi = sum((c / n) ** 2 for c in artist_counts.values())
    hhi_ideal = 1 / max(n, 5)
    diversification = round(max(0.0, 20.0 * (1 - (hhi - hhi_ideal) / (1 - hhi_ideal + 1e-9))))

    # Dimension 2 — Liquidity (0-20)
    scores = [liquidity_map.get(_normalize(i.artist_name), 50.0) for i in items if i.artist_name]
    avg_liq = sum(scores) / len(scores) if scores else 50.0
    liquidity_dim = round((avg_liq / 100) * 20)

    # Dimension 3 — Documentation (0-20)
    doc_scores = []
    for i in items:
        pts = 0
        if i.medium:                            pts += 5
        if i.dimensions:                        pts += 5
        if i.image_url:                         pts += 5
        if getattr(i, "provenance", None):      pts += 5
        doc_scores.append(pts)
    documentation = round(sum(doc_scores) / (len(doc_scores) * 20) * 20) if doc_scores else 0

    # Dimension 4 — Momentum (0-20)
    trend_scores = []
    for i in items:
        t = trend_map.get(_normalize(i.artist_name), "stable")
        trend_scores.append(20 if t == "up" else 10 if t == "stable" else 0)
    momentum = round(sum(trend_scores) / len(trend_scores)) if trend_scores else 10

    # Dimension 5 — Valuation freshness (0-20)
    val_scores = []
    for i in items:
        if i.last_valuation_at:
            age = (now - i.last_valuation_at).days
            if age <= 30:   val_scores.append(20)
            elif age <= 90: val_scores.append(12)
            elif age <= 180:val_scores.append(6)
            else:           val_scores.append(2)
        elif i.estimated_current_value_eur:
            val_scores.append(6)
        else:
            val_scores.append(0)
    valuation_dim = round(sum(val_scores) / len(val_scores)) if val_scores else 0

    total = diversification + liquidity_dim + documentation + momentum + valuation_dim
    breakdown = {
        "diversification": diversification,
        "liquidity":       liquidity_dim,
        "documentation":   documentation,
        "momentum":        momentum,
        "valuation":       valuation_dim,
    }
    return total, breakdown


# ── Main job ──────────────────────────────────────────────────────────────────

async def run_portfolio_snapshots() -> dict:
    """
    Snapshot every user's portfolio. Returns a summary dict.
    Safe to run multiple times on the same day (upsert).
    """
    today = date.today()
    now   = datetime.utcnow()
    written = 0
    skipped = 0
    errors  = 0

    async with BgSessionLocal() as db:
        # ── 1. Load all portfolio items grouped by user ───────────────────────
        result = await db.execute(select(PortfolioItem))
        all_items: list[PortfolioItem] = result.scalars().all()

        # Group by user_id
        by_user: dict[str, list[PortfolioItem]] = {}
        for item in all_items:
            by_user.setdefault(str(item.user_id), []).append(item)

        if not by_user:
            logger.info("[portfolio_snapshot] no portfolio items found — nothing to snapshot")
            return {"written": 0, "skipped": 0, "errors": 0}

        # ── 2. Pre-load artist data for all unique artist names ───────────────
        all_artist_names = list({
            _normalize(i.artist_name)
            for items in by_user.values()
            for i in items
            if i.artist_name
        })

        artists_result = await db.execute(
            select(Artist).where(Artist.name_normalized.in_(all_artist_names))
        )
        artists_db = artists_result.scalars().all()

        liquidity_map = {_normalize(a.name): a.liquidity_score or 50.0 for a in artists_db}
        trend_map = {
            _normalize(a.name): (
                a.trend.value if hasattr(a.trend, "value") else str(a.trend or "stable")
            ).lower()
            for a in artists_db
        }

        # ── 3. Compute snapshot for each user ─────────────────────────────────
        for user_id, items in by_user.items():
            try:
                total_value = sum(
                    (i.estimated_current_value_eur or i.purchase_price_eur or 0)
                    for i in items
                )
                purchase_cost = sum(i.purchase_price_eur or 0 for i in items)
                item_count = len(items)

                health_score, breakdown = _compute_health(items, liquidity_map, trend_map, now)

                stmt = pg_insert(PortfolioSnapshot).values(
                    user_id=user_id,
                    snapshot_date=today,
                    total_value_eur=round(total_value, 2),
                    purchase_cost_eur=round(purchase_cost, 2),
                    item_count=item_count,
                    health_score=health_score,
                    health_breakdown=breakdown,
                ).on_conflict_do_update(
                    constraint="uq_portfolio_snapshot_user_date",
                    set_={
                        "total_value_eur":  round(total_value, 2),
                        "purchase_cost_eur": round(purchase_cost, 2),
                        "item_count":       item_count,
                        "health_score":     health_score,
                        "health_breakdown": breakdown,
                    },
                )
                await db.execute(stmt)
                written += 1

            except Exception as e:
                logger.error(f"[portfolio_snapshot] error for user {user_id}: {e}")
                errors += 1

        await db.commit()

    logger.info(
        f"[portfolio_snapshot] done — {written} written, {skipped} skipped, {errors} errors",
        date=str(today),
    )
    return {"written": written, "skipped": skipped, "errors": errors, "date": str(today)}
