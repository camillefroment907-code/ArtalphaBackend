"""
Nautilus — Upside Predictions Generation Script (Step 3).

Fetches live/upcoming lots without existing predictions for the active model,
generates and stores upside predictions.

Usage:
    python -m app.scripts.generate_upside_predictions --dry-run
    python -m app.scripts.generate_upside_predictions --confirm
    python -m app.scripts.generate_upside_predictions --confirm --batch-size 500

Arguments:
    --dry-run       Show how many lots would be scored, no DB writes.
    --confirm       Generate and store predictions.
    --batch-size N  Lots per batch (default: 200).

SAFETY RULES:
    - ADDITIVE ONLY: only inserts into lot_upside_predictions
    - Does NOT modify lots, deal scores, rankings, or recommendations
    - If model unavailable → logs warning and exits cleanly
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import math
import os
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

log = logging.getLogger("generate_upside_predictions")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)


# ── Feature engineering helpers ───────────────────────────────────────────────

_MONTH_TO_SEASON = {
    12: "winter", 1: "winter", 2: "winter",
    3: "spring",  4: "spring", 5: "spring",
    6: "summer",  7: "summer", 8: "summer",
    9: "autumn", 10: "autumn", 11: "autumn",
}

_SIZE_THRESHOLDS = [(900, "small"), (5000, "medium"), (15000, "large")]


def _size_bucket(dimensions: Optional[str]) -> str:
    if not dimensions:
        return "unknown"
    import re
    nums = re.findall(r"[\d.]+", dimensions.replace(",", "."))
    floats = [float(n) for n in nums if n]
    if len(floats) >= 2:
        area = floats[0] * floats[1]
        for threshold, label in _SIZE_THRESHOLDS:
            if area < threshold:
                return label
        return "very_large"
    return "unknown"


def _build_lot_features(lot_row: dict, artist_history: dict, cycle_stats: dict) -> dict:
    """
    Build features for a single live lot from pre-fetched artist history and cycle stats.

    Args:
        lot_row:        Dict with lot fields (estimate_low, estimate_high, medium, etc.)
        artist_history: Dict with pre-aggregated artist stats (sold_above_pct, etc.)
        cycle_stats:    Dict from artist_cycle_stats (is_eligible, best_medium_wilson, etc.)

    Returns:
        Feature dict ready for UpsidePredictor.predict_lot()
    """
    est_low = lot_row.get("estimate_low")
    est_high = lot_row.get("estimate_high")
    sale_date = lot_row.get("auction_date")

    # Estimate features
    estimate_spread_pct = None
    if est_low and est_low > 0 and est_high and est_high > 0:
        estimate_spread_pct = (est_high - est_low) / est_low

    estimate_midpoint_eur = est_low
    if est_low and est_high:
        estimate_midpoint_eur = (est_low + est_high) / 2.0

    log_estimate_low_eur = None
    if est_low and est_low > 0:
        log_estimate_low_eur = math.log(max(est_low, 1e-6))

    # Temporal
    sale_month = None
    sale_quarter = None
    sale_season = "unknown"
    if sale_date:
        try:
            if hasattr(sale_date, "month"):
                sale_month = sale_date.month
                sale_quarter = (sale_date.month - 1) // 3 + 1
                sale_season = _MONTH_TO_SEASON.get(sale_date.month, "unknown")
        except Exception:
            pass

    # Size
    size_bucket = _size_bucket(lot_row.get("dimensions"))

    return {
        "lot_id": str(lot_row.get("id", "")),
        # Artist history
        "artist_total_sales_before": artist_history.get("total_sales", 0),
        "artist_sold_above_pct_before": artist_history.get("sold_above_pct", None),
        "artist_median_premium_before": artist_history.get("median_premium", None),
        # Medium history
        "medium_sold_above_pct_before": artist_history.get("medium_sold_above_pct", None),
        "medium_sales_count_before": artist_history.get("medium_sales_count", 0),
        # House history
        "house_sold_above_pct_before": artist_history.get("house_sold_above_pct", None),
        "house_sales_count_before": artist_history.get("house_sales_count", 0),
        # Estimate features
        "estimate_spread_pct": estimate_spread_pct,
        "estimate_midpoint_eur": estimate_midpoint_eur,
        "log_estimate_low_eur": log_estimate_low_eur,
        # Categorical
        "medium_category": (lot_row.get("category") or "other").lower()[:20],
        "auction_house_norm": (lot_row.get("auction_house_name") or "unknown").lower().strip(),
        "sale_month": sale_month,
        "sale_quarter": sale_quarter,
        "sale_season": sale_season,
        # Artwork attributes
        "is_signed": 0,  # lots table doesn't have signed column
        "is_ea": 0,
        "has_edition": 0,
        "size_bucket": size_bucket,
        # Cycle intelligence
        "cycle_fit_score": cycle_stats.get("best_medium_wilson"),
        "artist_cycle_eligible": 1 if cycle_stats.get("is_eligible") else 0,
    }


# ── Main async logic ──────────────────────────────────────────────────────────

async def run(dry_run: bool, batch_size: int):
    """Main async entry point."""
    import importlib
    import sys

    # Ensure backend/ is on path
    backend_dir = Path(__file__).resolve().parents[2]
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))

    # Load env
    env_path = backend_dir.parent / ".env"
    if env_path.exists():
        from dotenv import load_dotenv
        load_dotenv(env_path)
        log.info("Loaded .env from %s", env_path)

    from app.database import BgSessionLocal
    from app.engines.upside_predictor import UpsidePredictor
    from sqlalchemy import text

    async with BgSessionLocal() as db:
        # ── Load active model ─────────────────────────────────────────────────
        predictor = UpsidePredictor()
        loaded = await predictor.load_active_model(db)
        if not loaded:
            log.warning("No active model found. Run train_upside_model.py --confirm first.")
            return

        log.info(
            "Loaded model version: %s",
            predictor._model_version_str,
        )

        # ── Count unpredicted lots ────────────────────────────────────────────
        count_result = await db.execute(
            text("""
                SELECT COUNT(*)
                FROM lots l
                WHERE l.status IN ('upcoming', 'live')
                  AND l.estimate_low IS NOT NULL
                  AND l.estimate_low > 0
                  AND NOT EXISTS (
                      SELECT 1 FROM lot_upside_predictions lup
                      WHERE lup.lot_id = l.id
                        AND lup.model_version_id = :model_version_id::UUID
                  )
            """),
            {"model_version_id": predictor._model_version_id},
        )
        total_unpredicted = count_result.scalar()
        log.info("Lots needing prediction: %d", total_unpredicted)

        if dry_run:
            log.info("--- DRY RUN complete. Use --confirm to generate predictions. ---")
            return

        if total_unpredicted == 0:
            log.info("All lots already predicted for this model version. Nothing to do.")
            return

        # ── Batch loop ────────────────────────────────────────────────────────
        offset = 0
        total_inserted = 0
        total_skipped = 0

        while True:
            # Fetch batch of lots
            lots_result = await db.execute(
                text("""
                    SELECT
                        l.id::TEXT AS id,
                        l.artist_id::TEXT AS artist_id,
                        l.artist_name_raw,
                        l.estimate_low,
                        l.estimate_high,
                        l.medium,
                        l.dimensions,
                        l.auction_date,
                        l.auction_house_name,
                        l.category
                    FROM lots l
                    WHERE l.status IN ('upcoming', 'live')
                      AND l.estimate_low IS NOT NULL
                      AND l.estimate_low > 0
                      AND NOT EXISTS (
                          SELECT 1 FROM lot_upside_predictions lup
                          WHERE lup.lot_id = l.id
                            AND lup.model_version_id = :model_version_id::UUID
                      )
                    ORDER BY l.auction_date ASC NULLS LAST, l.id
                    LIMIT :batch_size OFFSET :offset
                """),
                {
                    "model_version_id": predictor._model_version_id,
                    "batch_size": batch_size,
                    "offset": offset,
                },
            )
            lots = lots_result.mappings().fetchall()

            if not lots:
                break

            log.info(
                "Processing batch: %d lots (offset=%d, total=%d)",
                len(lots), offset, total_unpredicted,
            )

            # Fetch artist histories for this batch
            artist_ids = list({
                str(lot["artist_id"])
                for lot in lots
                if lot["artist_id"]
            })

            # Get artist cycle stats
            cycle_stats_map: dict[str, dict] = {}
            if artist_ids:
                cycle_result = await db.execute(
                    text("""
                        SELECT
                            acs.artist_id::TEXT,
                            acs.is_eligible,
                            acs.best_medium_wilson
                        FROM artist_cycle_stats acs
                        WHERE acs.artist_id::TEXT = ANY(:ids)
                    """),
                    {"ids": artist_ids},
                )
                for row in cycle_result.mappings().fetchall():
                    cycle_stats_map[row["artist_id"]] = dict(row)

            # Get artist hammer history (using normalized names)
            artist_names = list({
                (lot["artist_name_raw"] or "").lower().strip()
                for lot in lots
                if lot["artist_name_raw"]
            })

            history_map: dict[str, dict] = {}
            if artist_names:
                # Batch fetch artist stats from hammer_prices
                hist_result = await db.execute(
                    text("""
                        SELECT
                            LOWER(TRIM(artist_name)) AS artist_key,
                            COUNT(*) AS total_sales,
                            AVG(CASE WHEN hammer_price_eur >= estimate_low THEN 1.0 ELSE 0.0 END)
                                AS sold_above_pct,
                            PERCENTILE_CONT(0.5) WITHIN GROUP (
                                ORDER BY hammer_price_eur / NULLIF(estimate_low, 0)
                            ) AS median_premium
                        FROM hammer_prices
                        WHERE LOWER(TRIM(artist_name)) = ANY(:names)
                          AND hammer_price_eur IS NOT NULL
                          AND estimate_low IS NOT NULL
                          AND estimate_low > 0
                        GROUP BY LOWER(TRIM(artist_name))
                    """),
                    {"names": artist_names},
                )
                for row in hist_result.mappings().fetchall():
                    history_map[row["artist_key"]] = {
                        "total_sales": row["total_sales"] or 0,
                        "sold_above_pct": row["sold_above_pct"],
                        "median_premium": row["median_premium"],
                        "medium_sold_above_pct": None,
                        "medium_sales_count": 0,
                        "house_sold_above_pct": None,
                        "house_sales_count": 0,
                    }

            # Build features and predict batch
            features_batch = []
            for lot in lots:
                artist_key = (lot["artist_name_raw"] or "").lower().strip()
                artist_hist = history_map.get(artist_key, {})
                artist_cycle = cycle_stats_map.get(str(lot["artist_id"]) if lot["artist_id"] else "", {})
                features = _build_lot_features(dict(lot), artist_hist, artist_cycle)
                features_batch.append(features)

            predictions = await predictor.predict_batch(features_batch)

            # Insert predictions
            inserted_count = 0
            for lot, pred in zip(lots, predictions):
                if pred is None:
                    total_skipped += 1
                    continue

                try:
                    await db.execute(
                        text("""
                            INSERT INTO lot_upside_predictions (
                                lot_id, model_version_id, upside_prob,
                                confidence_score, signal_label, feature_snapshot
                            )
                            VALUES (
                                :lot_id::UUID, :model_version_id::UUID, :upside_prob,
                                :confidence_score, :signal_label, :feature_snapshot::jsonb
                            )
                            ON CONFLICT (lot_id, model_version_id) DO NOTHING
                        """),
                        {
                            "lot_id": lot["id"],
                            "model_version_id": predictor._model_version_id,
                            "upside_prob": pred.upside_prob,
                            "confidence_score": pred.confidence_score,
                            "signal_label": pred.signal_label,
                            "feature_snapshot": __import__("json").dumps(pred.feature_snapshot),
                        },
                    )
                    inserted_count += 1
                except Exception as exc:
                    log.warning("Failed to insert prediction for lot %s: %s", lot["id"], exc)
                    total_skipped += 1

            await db.commit()
            total_inserted += inserted_count
            log.info(
                "Batch done: inserted=%d, skipped=%d, running_total=%d",
                inserted_count, len(lots) - inserted_count, total_inserted,
            )

            offset += batch_size
            if len(lots) < batch_size:
                break  # last batch

        log.info(
            "Complete. Total inserted: %d, skipped: %d",
            total_inserted, total_skipped,
        )


def main():
    parser = argparse.ArgumentParser(
        description="Generate Nautilus upside predictions for live lots"
    )
    parser.add_argument("--dry-run", action="store_true", help="Count lots, no DB writes")
    parser.add_argument("--confirm", action="store_true", help="Generate and store predictions")
    parser.add_argument(
        "--batch-size", type=int, default=200, help="Lots per batch (default: 200)"
    )
    args = parser.parse_args()

    if not args.dry_run and not args.confirm:
        parser.print_help()
        sys.exit(1)

    asyncio.run(run(dry_run=args.dry_run, batch_size=args.batch_size))


if __name__ == "__main__":
    main()
