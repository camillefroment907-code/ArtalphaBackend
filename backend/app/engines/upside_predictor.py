"""
Nautilus — Upside Prediction Engine (Step 3).

Loads the active upside model from DB + disk.
Generates predictions for individual lots or batches.

SAFETY CONTRACT:
  - If model unavailable → returns None gracefully (never raises 500)
  - Predictions are stored ONLY — they do NOT influence deal scores, rankings,
    or recommendations (Phase 1 constraint)
  - All predictions reference the model_version_id that produced them

Usage:
    predictor = UpsidePredictor()
    await predictor.load_active_model(db_session)
    pred = await predictor.predict_lot(features_dict)
    if pred is None:
        # model not available — skip
"""

from __future__ import annotations

import logging
import math
import os
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any, Optional

import joblib
import numpy as np
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

log = logging.getLogger(__name__)


# ── Signal translation ────────────────────────────────────────────────────────

def upside_signal_label(prob: float, lang: str = "en") -> str:
    """
    Convert predicted probability to a human-readable signal label.

    Thresholds:
        >= 0.80 → "High upside signal"
        >= 0.60 → "Moderate upside signal"
        < 0.60  → "Limited upside signal"

    Args:
        prob: Float probability in [0, 1] from the model.
        lang: 'en' or 'fr'

    Returns:
        Human-readable signal label string.
    """
    if prob >= 0.80:
        return "High upside signal" if lang == "en" else "Signal haussier fort"
    elif prob >= 0.60:
        return "Moderate upside signal" if lang == "en" else "Signal haussier modéré"
    else:
        return "Limited upside signal" if lang == "en" else "Signal haussier limité"


def upside_signal_explanation(
    prob: float,
    top_features: Optional[list[str]] = None,
    lang: str = "en",
) -> str:
    """
    Generate a short 1–2 sentence explanation for the upside signal.

    Uses top contributing features when available to give a concrete reason.

    Args:
        prob:          Float probability in [0, 1].
        top_features:  List of top feature names (by importance) for this prediction.
        lang:          'en' or 'fr'

    Returns:
        One to two sentence explanation string.
    """
    top_features = top_features or []
    pct = f"{prob:.0%}"

    # Build context from top features
    feature_context_en = ""
    feature_context_fr = ""
    if top_features:
        # Map internal feature names to human-readable descriptions
        _EN = {
            "artist_sold_above_pct_before": "strong historical sell-above rate for this artist",
            "artist_total_sales_before": "substantial auction history",
            "artist_median_premium_before": "consistent price premium over estimates",
            "medium_sold_above_pct_before": "strong performance in this medium",
            "house_sold_above_pct_before": "favourable track record at this auction house",
            "estimate_spread_pct": "estimate pricing",
            "log_estimate_low_eur": "price level",
            "is_signed": "signed artwork",
            "size_bucket": "artwork format",
            "auction_house_norm": "auction house selection",
            "medium_category": "medium type",
            "sale_season": "sale timing",
            "cycle_fit_score": "optimal cycle alignment",
        }
        _FR = {
            "artist_sold_above_pct_before": "un fort taux historique de dépassement d'estimation",
            "artist_total_sales_before": "un historique de ventes solide",
            "artist_median_premium_before": "une prime de prix constante",
            "medium_sold_above_pct_before": "une forte performance dans ce médium",
            "house_sold_above_pct_before": "un bon bilan dans cette maison de vente",
            "estimate_spread_pct": "le positionnement de l'estimation",
            "log_estimate_low_eur": "le niveau de prix",
            "is_signed": "une œuvre signée",
            "size_bucket": "le format de l'œuvre",
            "auction_house_norm": "le choix de la maison de vente",
            "medium_category": "le type de médium",
            "sale_season": "le calendrier de la vente",
            "cycle_fit_score": "un alignement optimal du cycle",
        }
        feats = [_EN.get(f, f) for f in top_features[:2]]
        feats_fr = [_FR.get(f, f) for f in top_features[:2]]
        if feats:
            feature_context_en = f" Key drivers: {', '.join(feats)}."
            feature_context_fr = f" Facteurs clés : {', '.join(feats_fr)}."

    if prob >= 0.80:
        if lang == "en":
            return (
                f"The model assigns a {pct} probability of selling above the low estimate "
                f"— a strong signal.{feature_context_en}"
            )
        else:
            return (
                f"Le modèle attribue une probabilité de {pct} de vente au-dessus de "
                f"l'estimation basse — un signal fort.{feature_context_fr}"
            )
    elif prob >= 0.60:
        if lang == "en":
            return (
                f"The model assigns a {pct} probability of selling above the low estimate "
                f"— a moderate signal.{feature_context_en}"
            )
        else:
            return (
                f"Le modèle attribue une probabilité de {pct} de vente au-dessus de "
                f"l'estimation basse — un signal modéré.{feature_context_fr}"
            )
    else:
        if lang == "en":
            return (
                f"The model assigns a {pct} probability of selling above the low estimate "
                f"— a limited signal.{feature_context_en}"
            )
        else:
            return (
                f"Le modèle attribue une probabilité de {pct} de vente au-dessus de "
                f"l'estimation basse — un signal limité.{feature_context_fr}"
            )


# ── Prediction dataclass ──────────────────────────────────────────────────────

@dataclass
class UpsidePrediction:
    """Result of a single lot prediction."""
    lot_id: str
    model_version_id: str
    upside_prob: float
    confidence_score: Optional[float]
    signal_label: str
    feature_snapshot: dict


# ── UpsidePredictor ───────────────────────────────────────────────────────────

class UpsidePredictor:
    """
    Loads the active upside model from DB + disk and generates predictions.

    Usage:
        predictor = UpsidePredictor()
        await predictor.load_active_model(db)
        pred = await predictor.predict_lot(lot_features_dict)
        if pred is None:
            # model not available — return null to caller
    """

    def __init__(self):
        self._model = None                      # sklearn pipeline
        self._preprocessing_config: dict = {}   # label encoders + imputation values
        self._feature_list: list[str] = []      # ordered feature names
        self._model_version_id: Optional[str] = None
        self._model_version_str: Optional[str] = None
        self._loaded = False

    # ── Loading ───────────────────────────────────────────────────────────────

    async def load_active_model(self, db: AsyncSession) -> bool:
        """
        Load the active model version from DB + disk.

        Returns True if loaded successfully, False otherwise.
        Logs warnings but never raises.
        """
        try:
            result = await db.execute(
                text("""
                    SELECT id::TEXT, version, artifact_path, feature_list
                    FROM upside_model_versions
                    WHERE is_active = TRUE
                    ORDER BY created_at DESC
                    LIMIT 1
                """)
            )
            row = result.fetchone()
            if row is None:
                log.info("UpsidePredictor: no active model version in DB")
                return False

            model_version_id, version_str, artifact_path, feature_list = row

            # Resolve artifact path relative to repo root
            base_dir = os.path.dirname(
                os.path.dirname(  # backend/
                    os.path.dirname(  # app/
                        os.path.dirname(os.path.abspath(__file__))  # engines/
                    )
                )
            )
            full_path = os.path.join(base_dir, artifact_path)

            if not os.path.exists(full_path):
                log.warning(
                    "UpsidePredictor: artifact not found at %s (version=%s)",
                    full_path, version_str,
                )
                return False

            artifact = joblib.load(full_path)
            self._model = artifact["model"]
            self._preprocessing_config = artifact.get("preprocessing_config", {})
            self._feature_list = feature_list if isinstance(feature_list, list) else list(feature_list)
            self._model_version_id = model_version_id
            self._model_version_str = version_str
            self._loaded = True

            log.info(
                "UpsidePredictor: loaded model version=%s from %s",
                version_str, full_path,
            )
            return True

        except Exception as exc:
            log.warning("UpsidePredictor.load_active_model failed: %s", exc)
            return False

    @property
    def is_loaded(self) -> bool:
        return self._loaded and self._model is not None

    # ── Feature preparation ───────────────────────────────────────────────────

    def _prepare_features(self, lot_features: dict) -> Optional[np.ndarray]:
        """
        Transform raw lot features into a model-ready numpy array.

        Applies the same preprocessing used during training:
          - Label encoding for categoricals
          - Median imputation for numerics
          - Fills unknown categoricals with the 'unknown' label

        Returns None if any critical error occurs.
        """
        try:
            config = self._preprocessing_config
            label_encoders = config.get("label_encoders", {})
            medians = config.get("medians", {})
            log_features = config.get("log_features", [])

            row = []
            for feat in self._feature_list:
                val = lot_features.get(feat)

                # Log-transform selected numeric features
                if feat in log_features:
                    if val is not None and val > 0:
                        val = math.log(val)
                    else:
                        val = None

                # Categorical encoding
                if feat in label_encoders:
                    le = label_encoders[feat]
                    str_val = str(val).lower() if val is not None else "unknown"
                    if str_val in le:
                        val = le[str_val]
                    elif "unknown" in le:
                        val = le["unknown"]
                    else:
                        val = 0  # fallback

                # Numeric imputation
                if val is None:
                    val = medians.get(feat, 0.0)

                row.append(float(val))

            return np.array(row, dtype=np.float64).reshape(1, -1)

        except Exception as exc:
            log.warning("UpsidePredictor._prepare_features failed: %s", exc)
            return None

    # ── Prediction ────────────────────────────────────────────────────────────

    async def predict_lot(self, lot_features: dict) -> Optional[UpsidePrediction]:
        """
        Generate a prediction for a single lot.

        Args:
            lot_features: Dict of feature name → value (raw, before preprocessing).
                          Must contain the features in self._feature_list.

        Returns:
            UpsidePrediction or None if model unavailable or error occurs.
        """
        if not self.is_loaded:
            return None

        try:
            X = self._prepare_features(lot_features)
            if X is None:
                return None

            prob = float(self._model.predict_proba(X)[0, 1])
            prob = max(0.0, min(1.0, prob))

            # Confidence score: distance from 0.5 (more confident when further from 0.5)
            confidence = abs(prob - 0.5) * 2.0

            label = upside_signal_label(prob, lang="en")

            return UpsidePrediction(
                lot_id=str(lot_features.get("lot_id", "")),
                model_version_id=self._model_version_id,
                upside_prob=round(prob, 4),
                confidence_score=round(confidence, 4),
                signal_label=label,
                feature_snapshot={
                    k: lot_features.get(k)
                    for k in self._feature_list
                    if lot_features.get(k) is not None
                },
            )

        except Exception as exc:
            log.warning("UpsidePredictor.predict_lot failed: %s", exc)
            return None

    async def predict_batch(
        self,
        rows: list[dict],
    ) -> list[Optional[UpsidePrediction]]:
        """
        Batch prediction for efficiency.

        Args:
            rows: List of feature dicts. Each must have 'lot_id' key.

        Returns:
            List of UpsidePrediction (or None) in same order as input.
        """
        if not self.is_loaded or not rows:
            return [None] * len(rows)

        try:
            prepared = []
            valid_indices = []
            for i, row in enumerate(rows):
                X = self._prepare_features(row)
                if X is not None:
                    prepared.append(X[0])
                    valid_indices.append(i)

            if not prepared:
                return [None] * len(rows)

            X_batch = np.array(prepared, dtype=np.float64)
            probs = self._model.predict_proba(X_batch)[:, 1]
            probs = np.clip(probs, 0.0, 1.0)

            results: list[Optional[UpsidePrediction]] = [None] * len(rows)
            for batch_i, orig_i in enumerate(valid_indices):
                prob = float(probs[batch_i])
                confidence = abs(prob - 0.5) * 2.0
                row = rows[orig_i]
                results[orig_i] = UpsidePrediction(
                    lot_id=str(row.get("lot_id", "")),
                    model_version_id=self._model_version_id,
                    upside_prob=round(prob, 4),
                    confidence_score=round(confidence, 4),
                    signal_label=upside_signal_label(prob, lang="en"),
                    feature_snapshot={
                        k: row.get(k)
                        for k in self._feature_list
                        if row.get(k) is not None
                    },
                )

            return results

        except Exception as exc:
            log.warning("UpsidePredictor.predict_batch failed: %s", exc)
            return [None] * len(rows)


# ── Module-level singleton (lazy-loaded per request in async context) ─────────
# Do not import at module level — the predictor is created per-request or
# held at app lifespan level. See upside.py router for usage pattern.
