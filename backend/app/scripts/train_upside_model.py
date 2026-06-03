"""
Nautilus — Upside Model Training Script (Step 3).

Trains a GradientBoostingClassifier to predict sold_above_low_estimate.
Uses a temporal train/val/test split — NEVER random split.

Usage:
    python -m app.scripts.train_upside_model --dry-run
    python -m app.scripts.train_upside_model --confirm
    python -m app.scripts.train_upside_model --confirm --min-train-size 2000

Arguments:
    --dry-run           Print dataset stats and feature distributions, no training.
    --confirm           Train model, evaluate, and (if promoted) save artifact + DB record.
    --min-train-size N  Abort if training set < N rows (default: 1000).
    --notes TEXT        Optional notes stored alongside the model version.

CRITICAL SAFETY RULES:
    - This script is ADDITIVE ONLY. It does not modify existing tables.
    - The trained model does NOT influence existing scores, rankings, or recommendations.
    - Predictions are stored in lot_upside_predictions (separate table).
    - All features use sale_date < reference_date (leakage-safe window functions).

Data source: hammer_prices table (psycopg2 sync connection — training is CPU-bound).
"""

from __future__ import annotations

import argparse
import json
import logging
import math
import os
import sys
from datetime import date, datetime
from pathlib import Path
from typing import Any, Optional

import joblib
import numpy as np
import pandas as pd
import psycopg2
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)

# ── Logging setup ─────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger("train_upside_model")

# ── Temporal split cutoffs ────────────────────────────────────────────────────

TRAIN_CUTOFF = date(2023, 12, 31)       # train: sale_date <= 2023-12-31
VAL_CUTOFF_START = date(2024, 1, 1)     # val:   2024-01-01 to 2024-06-30
VAL_CUTOFF_END = date(2024, 6, 30)
TEST_CUTOFF_START = date(2024, 7, 1)    # test:  sale_date >= 2024-07-01

# ── Feature list (ORDER MATTERS — must match preprocessing) ───────────────────

FEATURE_NAMES = [
    # Artist history
    "artist_total_sales_before",
    "artist_sold_above_pct_before",
    "artist_median_premium_before",
    # Medium-specific history
    "medium_sold_above_pct_before",
    "medium_sales_count_before",
    # House-specific history
    "house_sold_above_pct_before",
    "house_sales_count_before",
    # Estimate features
    "estimate_spread_pct",
    "estimate_midpoint_eur",
    "log_estimate_low_eur",
    # Categorical
    "medium_category",
    "auction_house_norm",
    "sale_month",
    "sale_quarter",
    "sale_season",
    # Artwork attributes
    "is_signed",
    "is_ea",
    "has_edition",
    "size_bucket",
    # Cycle intelligence
    "cycle_fit_score",
    "artist_cycle_eligible",
]

CATEGORICAL_FEATURES = ["medium_category", "auction_house_norm", "sale_season", "size_bucket"]
LOG_FEATURES = ["estimate_midpoint_eur"]  # log_estimate_low_eur is already log-transformed at query time

# ── Season mapping ─────────────────────────────────────────────────────────────

_MONTH_TO_SEASON = {
    12: "winter", 1: "winter", 2: "winter",
    3: "spring",  4: "spring", 5: "spring",
    6: "summer",  7: "summer", 8: "summer",
    9: "autumn", 10: "autumn", 11: "autumn",
}

_SIZE_THRESHOLDS = [
    (900, "small"),
    (5000, "medium"),
    (15000, "large"),
]


def _size_bucket(dimensions) -> str:
    """Parse dimensions string → size bucket."""
    if not dimensions or not isinstance(dimensions, str):
        return "unknown"
    import re
    nums = re.findall(r"[\d.]+", dimensions.replace(",", "."))
    floats = []
    for n in nums:
        try:
            floats.append(float(n))
        except ValueError:
            pass
    if len(floats) >= 2:
        area = floats[0] * floats[1]
        for threshold, label in _SIZE_THRESHOLDS:
            if area < threshold:
                return label
        return "very_large"
    return "unknown"


# ── Dataset loading ───────────────────────────────────────────────────────────

TRAINING_QUERY = """
WITH base AS (
    SELECT
        hp.id::TEXT                                                             AS hammer_price_id,
        hp.artist_name_normalized,
        LOWER(COALESCE(hp.medium_category, 'other'))                           AS medium_category,
        hp.dimensions,
        hp.sale_date::DATE                                                     AS sale_date,
        hp.hammer_price_eur,
        hp.estimate_low,
        hp.estimate_high,
        LOWER(TRIM(COALESCE(hp.auction_house, 'unknown')))                     AS auction_house_raw,
        COALESCE(hp.signed::INT, 0)                                            AS is_signed,
        COALESCE(hp.is_ea::INT, 0)                                             AS is_ea,
        CASE WHEN hp.edition_number IS NOT NULL THEN 1 ELSE 0 END              AS has_edition,
        CASE WHEN hp.hammer_price_eur >= hp.estimate_low THEN 1 ELSE 0 END     AS target,

        -- Artist history (leakage-safe: ROWS UNBOUNDED PRECEDING excludes current row)
        COUNT(hp.id) OVER w_artist_before - 1                                  AS artist_total_sales_before,
        AVG(
            CASE WHEN hp.hammer_price_eur >= hp.estimate_low THEN 1.0 ELSE 0.0 END
        ) OVER w_artist_before_excl                                             AS artist_sold_above_pct_before,
        AVG(
            hp.hammer_price_eur / NULLIF(hp.estimate_low, 0)
        ) OVER w_artist_before_excl                                             AS artist_median_premium_before,

        -- Medium-specific history (leakage-safe)
        COUNT(hp.id) OVER w_artist_medium_before - 1                          AS medium_sales_count_before,
        AVG(
            CASE WHEN hp.hammer_price_eur >= hp.estimate_low THEN 1.0 ELSE 0.0 END
        ) OVER w_artist_medium_before_excl                                      AS medium_sold_above_pct_before,

        -- House-specific history (leakage-safe)
        COUNT(hp.id) OVER w_artist_house_before - 1                           AS house_sales_count_before,
        AVG(
            CASE WHEN hp.hammer_price_eur >= hp.estimate_low THEN 1.0 ELSE 0.0 END
        ) OVER w_artist_house_before_excl                                       AS house_sold_above_pct_before,

        -- Cycle intelligence
        acs.is_eligible::INT                                                    AS artist_cycle_eligible,
        acs.best_medium_wilson                                                  AS cycle_fit_score

    FROM hammer_prices hp
    LEFT JOIN artists a ON a.name_normalized = hp.artist_name_normalized
    LEFT JOIN artist_cycle_stats acs ON acs.artist_id = a.id

    WHERE hp.hammer_price_eur IS NOT NULL
      AND hp.hammer_price_eur > 0
      AND hp.estimate_low IS NOT NULL
      AND hp.estimate_low > 0
      AND hp.sale_date IS NOT NULL

    WINDOW
        w_artist_before AS (
            PARTITION BY hp.artist_name_normalized
            ORDER BY hp.sale_date, hp.id
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ),
        w_artist_before_excl AS (
            PARTITION BY hp.artist_name_normalized
            ORDER BY hp.sale_date, hp.id
            ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
        ),
        w_artist_medium_before AS (
            PARTITION BY hp.artist_name_normalized, hp.medium_category
            ORDER BY hp.sale_date, hp.id
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ),
        w_artist_medium_before_excl AS (
            PARTITION BY hp.artist_name_normalized, hp.medium_category
            ORDER BY hp.sale_date, hp.id
            ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
        ),
        w_artist_house_before AS (
            PARTITION BY hp.artist_name_normalized,
                LOWER(TRIM(COALESCE(hp.auction_house, 'unknown')))
            ORDER BY hp.sale_date, hp.id
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ),
        w_artist_house_before_excl AS (
            PARTITION BY hp.artist_name_normalized,
                LOWER(TRIM(COALESCE(hp.auction_house, 'unknown')))
            ORDER BY hp.sale_date, hp.id
            ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
        )
)
SELECT * FROM base
ORDER BY sale_date ASC
"""


def load_dataset(db_url: str, connect_kwargs: dict | None = None) -> pd.DataFrame:
    """
    Load and engineer training features from hammer_prices via sync psycopg2.

    Returns a DataFrame with feature columns + 'target' + 'sale_date'.
    """
    log.info("Connecting to database...")
    conn = psycopg2.connect(db_url, **(connect_kwargs or {}))
    try:
        log.info("Loading training dataset (window functions)...")
        df = pd.read_sql(TRAINING_QUERY, conn)
    finally:
        conn.close()

    log.info("Raw dataset: %d rows", len(df))

    # ── Post-process columns not available in SQL ─────────────────────────────

    # Estimate features
    df["estimate_spread_pct"] = np.where(
        (df["estimate_high"].notna()) & (df["estimate_low"] > 0),
        (df["estimate_high"] - df["estimate_low"]) / df["estimate_low"],
        np.nan,
    )
    df["estimate_midpoint_eur"] = np.where(
        df["estimate_high"].notna(),
        (df["estimate_low"] + df["estimate_high"]) / 2.0,
        df["estimate_low"],
    )
    df["log_estimate_low_eur"] = np.log(df["estimate_low"].clip(lower=1e-6))

    # Size bucket from dimensions string
    df["size_bucket"] = df["dimensions"].apply(_size_bucket)

    # Season and temporal features
    df["sale_date"] = pd.to_datetime(df["sale_date"])
    df["sale_month"] = df["sale_date"].dt.month
    df["sale_quarter"] = df["sale_date"].dt.quarter
    df["sale_season"] = df["sale_month"].map(_MONTH_TO_SEASON).fillna("unknown")

    # Auction house normalization (lowercase + strip already done in SQL)
    df["auction_house_norm"] = df["auction_house_raw"].fillna("unknown")

    # Correct artist_total_sales_before: COUNT OVER includes current row → subtract 1
    # (already done in SQL via COUNT - 1)
    df["artist_total_sales_before"] = df["artist_total_sales_before"].fillna(0).clip(lower=0)
    df["medium_sales_count_before"] = df["medium_sales_count_before"].fillna(0).clip(lower=0)
    df["house_sales_count_before"] = df["house_sales_count_before"].fillna(0).clip(lower=0)

    return df


# ── Preprocessing pipeline ────────────────────────────────────────────────────

def build_preprocessing_config(df_train: pd.DataFrame) -> dict:
    """
    Build preprocessing config from training data ONLY.
    Never fit on validation or test data.

    Returns:
        {
            "label_encoders": {feature_name: {str_val: int_code}},
            "medians": {feature_name: float},
            "log_features": [feature_names to log-transform at inference],
        }
    """
    config: dict[str, Any] = {
        "label_encoders": {},
        "medians": {},
        "log_features": LOG_FEATURES,
    }

    # Label encode categoricals (fit on train, consistent at inference)
    for feat in CATEGORICAL_FEATURES:
        if feat in df_train.columns:
            vals = df_train[feat].fillna("unknown").astype(str).str.lower().unique()
            vals = sorted(vals)
            if "unknown" not in vals:
                vals = list(vals) + ["unknown"]
            config["label_encoders"][feat] = {v: i for i, v in enumerate(vals)}

    # Compute medians for numeric imputation (train only)
    numeric_features = [f for f in FEATURE_NAMES if f not in CATEGORICAL_FEATURES]
    for feat in numeric_features:
        if feat in df_train.columns:
            median_val = df_train[feat].median()
            config["medians"][feat] = float(median_val) if not math.isnan(float(median_val if median_val == median_val else 0)) else 0.0

    return config


def apply_preprocessing(df: pd.DataFrame, config: dict) -> np.ndarray:
    """
    Apply preprocessing config to a DataFrame.
    Returns a numpy array with shape (n_rows, n_features).
    """
    label_encoders = config["label_encoders"]
    medians = config["medians"]
    log_features = config["log_features"]

    result = []
    for feat in FEATURE_NAMES:
        if feat not in df.columns:
            # Feature missing entirely — use median or 0
            col = np.full(len(df), medians.get(feat, 0.0))
        else:
            col = df[feat].copy()

            # Log-transform
            if feat in log_features:
                col = col.clip(lower=1e-6)
                col = np.log(col)

            # Categorical encoding
            if feat in label_encoders:
                le = label_encoders[feat]
                unk_code = le.get("unknown", 0)
                col = col.fillna("unknown").astype(str).str.lower()
                col = col.map(lambda v: le.get(v, unk_code))

            # Numeric imputation
            fill_val = medians.get(feat, 0.0)
            col = col.fillna(fill_val)

        result.append(col.values if hasattr(col, "values") else col)

    return np.column_stack(result).astype(np.float64)


# ── Baselines ─────────────────────────────────────────────────────────────────

class BaselineAlwaysPositive:
    """Predicts sold_above_low=1 for every lot."""
    name = "AlwaysPositive"

    def fit(self, X, y):
        self.positive_rate_ = float(y.mean())
        return self

    def predict_proba(self, X):
        n = len(X)
        return np.column_stack([np.zeros(n), np.ones(n)])

    def predict(self, X):
        return np.ones(len(X), dtype=int)


class BaselineArtistAvg:
    """Predicts artist's historical sold_above_low rate from training data."""
    name = "ArtistAvg"

    def fit(self, df_train: pd.DataFrame):
        self.artist_rates_ = (
            df_train.groupby("artist_name_normalized")["target"].mean().to_dict()
        )
        self.global_rate_ = float(df_train["target"].mean())
        return self

    def predict_proba_df(self, df: pd.DataFrame) -> np.ndarray:
        probs = df["artist_name_normalized"].map(self.artist_rates_).fillna(self.global_rate_).values
        return np.column_stack([1 - probs, probs])

    def predict_df(self, df: pd.DataFrame) -> np.ndarray:
        return (self.predict_proba_df(df)[:, 1] >= 0.5).astype(int)


class BaselineArtistMediumAvg:
    """Predicts artist+medium historical rate from training data."""
    name = "ArtistMediumAvg"

    def fit(self, df_train: pd.DataFrame):
        self.rates_ = (
            df_train.groupby(["artist_name_normalized", "medium_category"])["target"]
            .mean()
            .to_dict()
        )
        self.artist_rates_ = (
            df_train.groupby("artist_name_normalized")["target"].mean().to_dict()
        )
        self.global_rate_ = float(df_train["target"].mean())
        return self

    def predict_proba_df(self, df: pd.DataFrame) -> np.ndarray:
        probs = []
        for _, row in df[["artist_name_normalized", "medium_category"]].iterrows():
            key = (row["artist_name_normalized"], row["medium_category"])
            if key in self.rates_:
                probs.append(self.rates_[key])
            elif row["artist_name_normalized"] in self.artist_rates_:
                probs.append(self.artist_rates_[row["artist_name_normalized"]])
            else:
                probs.append(self.global_rate_)
        probs = np.array(probs)
        return np.column_stack([1 - probs, probs])

    def predict_df(self, df: pd.DataFrame) -> np.ndarray:
        return (self.predict_proba_df(df)[:, 1] >= 0.5).astype(int)


# ── Evaluation ────────────────────────────────────────────────────────────────

def precision_at_k(y_true: np.ndarray, y_prob: np.ndarray, pct: float = 0.10) -> float:
    """
    Precision@K: among the top K% of lots by predicted probability,
    what fraction actually sold above estimate?
    """
    n = len(y_true)
    k = max(1, int(n * pct))
    top_indices = np.argsort(y_prob)[::-1][:k]
    return float(y_true[top_indices].mean())


def evaluate_model(
    y_true: np.ndarray,
    y_prob: np.ndarray,
    name: str = "model",
) -> dict:
    """Compute full evaluation metrics."""
    y_pred = (y_prob >= 0.5).astype(int)

    # Precision at top 10% and 20% by probability
    p_at_10 = precision_at_k(y_true, y_prob, pct=0.10)
    p_at_20 = precision_at_k(y_true, y_prob, pct=0.20)

    # Premium ratio comparison: top vs bottom decile
    n = len(y_true)
    k = max(1, int(n * 0.10))
    sorted_idx = np.argsort(y_prob)
    top_decile_actual = float(y_true[sorted_idx[::-1][:k]].mean())
    bottom_decile_actual = float(y_true[sorted_idx[:k]].mean())

    try:
        auc = float(roc_auc_score(y_true, y_prob))
    except Exception:
        auc = 0.5

    return {
        "model": name,
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "precision": float(precision_score(y_true, y_pred, zero_division=0)),
        "recall": float(recall_score(y_true, y_pred, zero_division=0)),
        "f1": float(f1_score(y_true, y_pred, zero_division=0)),
        "roc_auc": auc,
        "precision_at_10": p_at_10,
        "precision_at_20": p_at_20,
        "top_decile_actual_rate": top_decile_actual,
        "bottom_decile_actual_rate": bottom_decile_actual,
    }


# ── Promotion rule ────────────────────────────────────────────────────────────

def should_promote(metrics: dict, baseline_metrics: list[dict]) -> bool:
    """
    Decide whether the trained model should be promoted to active.

    Promotion requires ALL of:
      1. precision_at_10 > best baseline precision_at_10
      2. roc_auc >= 0.55
      3. train_size >= 1000
    """
    best_baseline_p10 = max(b.get("precision_at_10", 0.0) for b in baseline_metrics)
    return (
        metrics.get("precision_at_10", 0.0) > best_baseline_p10
        and metrics.get("roc_auc", 0.0) >= 0.55
        and metrics.get("train_size", 0) >= 1000
    )


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Train Nautilus Upside Prediction Model")
    parser.add_argument("--dry-run", action="store_true", help="Print stats, no training")
    parser.add_argument("--confirm", action="store_true", help="Train and save model")
    parser.add_argument(
        "--min-train-size", type=int, default=1000,
        help="Minimum training set size (default: 1000)",
    )
    parser.add_argument("--notes", type=str, default=None, help="Notes for model version")
    args = parser.parse_args()

    if not args.dry_run and not args.confirm:
        parser.print_help()
        sys.exit(1)

    # ── Database URL ──────────────────────────────────────────────────────────
    # Load from environment (same as backend)
    db_url = os.environ.get("DATABASE_URL", "")
    if not db_url:
        # Try loading from .env file
        env_path = Path(__file__).resolve().parents[3] / ".env"
        if env_path.exists():
            from dotenv import load_dotenv
            load_dotenv(env_path)
            db_url = os.environ.get("DATABASE_URL", "")

    if not db_url:
        log.error("DATABASE_URL not set. Set it in environment or .env file.")
        sys.exit(1)

    # asyncpg URL → psycopg2 URL
    if "postgresql+asyncpg://" in db_url:
        db_url = db_url.replace("postgresql+asyncpg://", "postgresql://")
    # Sanitize query string: remove params psycopg2 doesn't understand,
    # keep sslmode (as a connect_arg below), strip channel_binding entirely.
    from urllib.parse import urlparse, urlencode, parse_qs, urlunparse
    _p = urlparse(db_url)
    _qs = parse_qs(_p.query, keep_blank_values=True)
    _needs_ssl = _qs.pop("sslmode", [""])[0] in ("require", "verify-ca", "verify-full")
    _qs.pop("channel_binding", None)
    db_url = urlunparse(_p._replace(query=urlencode({k: v[0] for k, v in _qs.items()})))
    _connect_kwargs = {"sslmode": "require"} if _needs_ssl else {}

    # ── Load dataset ──────────────────────────────────────────────────────────
    df = load_dataset(db_url, _connect_kwargs)

    if len(df) == 0:
        log.error("No eligible rows found in hammer_prices. Check data quality.")
        sys.exit(1)

    # ── Temporal split ────────────────────────────────────────────────────────
    sale_dates = pd.to_datetime(df["sale_date"]).dt.date

    df_train = df[sale_dates <= TRAIN_CUTOFF].copy()
    df_val = df[(sale_dates >= VAL_CUTOFF_START) & (sale_dates <= VAL_CUTOFF_END)].copy()
    df_test = df[sale_dates >= TEST_CUTOFF_START].copy()

    log.info("Dataset splits:")
    log.info("  Train : %d rows (≤ %s), positive rate: %.1f%%",
             len(df_train), TRAIN_CUTOFF,
             100 * df_train["target"].mean() if len(df_train) > 0 else 0)
    log.info("  Val   : %d rows (%s – %s), positive rate: %.1f%%",
             len(df_val), VAL_CUTOFF_START, VAL_CUTOFF_END,
             100 * df_val["target"].mean() if len(df_val) > 0 else 0)
    log.info("  Test  : %d rows (≥ %s), positive rate: %.1f%%",
             len(df_test), TEST_CUTOFF_START,
             100 * df_test["target"].mean() if len(df_test) > 0 else 0)
    log.info("  Total : %d rows, positive rate: %.1f%%",
             len(df), 100 * df["target"].mean())

    if args.dry_run:
        log.info("--- DRY RUN complete. Use --confirm to train. ---")
        # Print feature distributions
        log.info("\nFeature null rates (train):")
        for feat in FEATURE_NAMES:
            if feat in df_train.columns:
                null_pct = df_train[feat].isna().mean() * 100
                log.info("  %-40s %.1f%% null", feat, null_pct)
        return

    # ── Size guard ────────────────────────────────────────────────────────────
    if len(df_train) < args.min_train_size:
        log.error(
            "Training set too small: %d rows (minimum: %d). "
            "Adjust --min-train-size or add more data.",
            len(df_train), args.min_train_size,
        )
        sys.exit(1)

    # ── Preprocessing ─────────────────────────────────────────────────────────
    log.info("Building preprocessing config from training data...")
    preprocessing_config = build_preprocessing_config(df_train)

    X_train = apply_preprocessing(df_train, preprocessing_config)
    y_train = df_train["target"].values.astype(int)

    X_val = apply_preprocessing(df_val, preprocessing_config) if len(df_val) > 0 else np.empty((0, len(FEATURE_NAMES)))
    y_val = df_val["target"].values.astype(int) if len(df_val) > 0 else np.array([])

    X_test = apply_preprocessing(df_test, preprocessing_config) if len(df_test) > 0 else np.empty((0, len(FEATURE_NAMES)))
    y_test = df_test["target"].values.astype(int) if len(df_test) > 0 else np.array([])

    log.info("Feature matrix shapes: train=%s, val=%s, test=%s",
             X_train.shape, X_val.shape, X_test.shape)

    # ── Baselines ─────────────────────────────────────────────────────────────
    log.info("Computing baselines...")
    baseline_results = []

    b1 = BaselineAlwaysPositive().fit(X_test, y_test)
    b1_probs = b1.predict_proba(X_test if len(X_test) > 0 else X_train)[:, 1]
    b1_metrics = evaluate_model(
        y_test if len(y_test) > 0 else y_train,
        b1_probs,
        name="AlwaysPositive",
    )
    baseline_results.append(b1_metrics)

    b2 = BaselineArtistAvg().fit(df_train)
    b2_probs = b2.predict_proba_df(df_test if len(df_test) > 0 else df_train)[:, 1]
    b2_metrics = evaluate_model(
        y_test if len(y_test) > 0 else y_train,
        b2_probs,
        name="ArtistAvg",
    )
    baseline_results.append(b2_metrics)

    b3 = BaselineArtistMediumAvg().fit(df_train)
    b3_probs = b3.predict_proba_df(df_test if len(df_test) > 0 else df_train)[:, 1]
    b3_metrics = evaluate_model(
        y_test if len(y_test) > 0 else y_train,
        b3_probs,
        name="ArtistMediumAvg",
    )
    baseline_results.append(b3_metrics)

    for bm in baseline_results:
        log.info(
            "Baseline %-20s  AUC=%.3f  P@10=%.3f  P@20=%.3f",
            bm["model"], bm["roc_auc"], bm["precision_at_10"], bm["precision_at_20"],
        )

    # ── Model training ────────────────────────────────────────────────────────
    log.info("Training GradientBoostingClassifier...")
    model = GradientBoostingClassifier(
        n_estimators=200,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.8,
        min_samples_leaf=20,
        random_state=42,
    )
    model.fit(X_train, y_train)
    log.info("Training complete.")

    # ── Evaluation ────────────────────────────────────────────────────────────
    if len(y_test) > 0:
        eval_y = y_test
        eval_X = X_test
        eval_label = "test"
    elif len(y_val) > 0:
        eval_y = y_val
        eval_X = X_val
        eval_label = "validation (no test data)"
    else:
        eval_y = y_train
        eval_X = X_train
        eval_label = "train (no test/val data)"

    log.info("Evaluating on %s set...", eval_label)
    model_probs = model.predict_proba(eval_X)[:, 1]
    model_metrics = evaluate_model(eval_y, model_probs, name="GBM")
    model_metrics["train_size"] = int(len(df_train))
    model_metrics["eval_set"] = eval_label

    log.info(
        "GBM  AUC=%.3f  Acc=%.3f  P=%.3f  R=%.3f  F1=%.3f  P@10=%.3f  P@20=%.3f",
        model_metrics["roc_auc"],
        model_metrics["accuracy"],
        model_metrics["precision"],
        model_metrics["recall"],
        model_metrics["f1"],
        model_metrics["precision_at_10"],
        model_metrics["precision_at_20"],
    )

    # ── Feature importance ────────────────────────────────────────────────────
    importances = model.feature_importances_
    feat_importance = sorted(
        zip(FEATURE_NAMES, importances),
        key=lambda x: x[1],
        reverse=True,
    )
    log.info("Feature importances (top 10):")
    for fname, imp in feat_importance[:10]:
        log.info("  %-40s %.4f", fname, imp)

    # ── Promotion decision ────────────────────────────────────────────────────
    promoted = should_promote(model_metrics, baseline_results)
    log.info("Promotion decision: %s", "PROMOTED" if promoted else "NOT promoted")
    if not promoted:
        log.warning(
            "Model did NOT meet promotion criteria. "
            "precision_at_10=%.3f, roc_auc=%.3f, train_size=%d",
            model_metrics.get("precision_at_10", 0),
            model_metrics.get("roc_auc", 0),
            model_metrics.get("train_size", 0),
        )

    # ── Save artifact ─────────────────────────────────────────────────────────
    version = f"v1.0.0-{datetime.utcnow().strftime('%Y-%m-%d')}"
    artifact_dir = Path(__file__).resolve().parents[3] / "models" / "upside"
    artifact_dir.mkdir(parents=True, exist_ok=True)
    artifact_path = artifact_dir / f"{version}.joblib"

    if artifact_path.exists():
        # Never overwrite — add timestamp suffix
        ts = datetime.utcnow().strftime("%H%M%S")
        version = f"v1.0.0-{datetime.utcnow().strftime('%Y-%m-%d')}-{ts}"
        artifact_path = artifact_dir / f"{version}.joblib"

    artifact = {
        "model": model,
        "preprocessing_config": preprocessing_config,
        "feature_list": FEATURE_NAMES,
        "version": version,
        "trained_at": datetime.utcnow().isoformat(),
        "feature_importances": {
            fname: float(imp)
            for fname, imp in zip(FEATURE_NAMES, importances)
        },
    }
    joblib.dump(artifact, artifact_path)
    log.info("Artifact saved: %s", artifact_path)

    # Relative path for DB storage (relative to backend/ dir)
    relative_path = f"models/upside/{version}.joblib"

    # ── Write DB record ───────────────────────────────────────────────────────
    conn = psycopg2.connect(db_url, **_connect_kwargs)
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO upside_model_versions (
                    version, artifact_path, feature_list, metrics,
                    baseline_metrics, train_size, val_size, test_size,
                    train_cutoff, val_cutoff, test_cutoff,
                    promoted, is_active, notes
                ) VALUES (
                    %s, %s, %s::jsonb, %s::jsonb,
                    %s::jsonb, %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, %s
                )
                """,
                (
                    version,
                    relative_path,
                    json.dumps(FEATURE_NAMES),
                    json.dumps(model_metrics),
                    json.dumps(baseline_results),
                    int(len(df_train)),
                    int(len(df_val)),
                    int(len(df_test)),
                    str(TRAIN_CUTOFF),
                    str(VAL_CUTOFF_END),
                    str(TEST_CUTOFF_START),
                    promoted,
                    promoted,  # is_active = promoted
                    args.notes,
                ),
            )
            # If this model is promoted and set active, deactivate previous versions
            if promoted:
                cur.execute(
                    """
                    UPDATE upside_model_versions
                    SET is_active = FALSE
                    WHERE version != %s AND is_active = TRUE
                    """,
                    (version,),
                )
            conn.commit()
        log.info("Model version '%s' recorded in DB (promoted=%s, is_active=%s)",
                 version, promoted, promoted)
    finally:
        conn.close()

    # ── Update feature importance doc ─────────────────────────────────────────
    docs_path = Path(__file__).resolve().parents[4] / "docs" / "UPSIDE_FEATURE_IMPORTANCE.md"
    if docs_path.exists():
        importance_rows = "\n".join(
            f"| {i+1} | {fname} | {imp:.4f} | {'history' if 'before' in fname else 'estimate' if 'estimate' in fname else 'categorical' if fname in CATEGORICAL_FEATURES else 'artwork'} |"
            for i, (fname, imp) in enumerate(feat_importance)
        )
        with open(docs_path, "w") as f:
            f.write(f"""# Upside Feature Importance — Phase 7

## Model: {version}
## Trained: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}

## Feature Importance (sorted descending)

| Rank | Feature | Importance | Category |
|------|---------|-----------|---------|
{importance_rows}

## Summary
- Total features: {len(FEATURE_NAMES)}
- Model ROC AUC: {model_metrics['roc_auc']:.3f}
- Model P@10: {model_metrics['precision_at_10']:.3f}
- Promoted: {promoted}
""")
        log.info("Updated docs/UPSIDE_FEATURE_IMPORTANCE.md")

    log.info("Training complete. Version: %s", version)


if __name__ == "__main__":
    main()
