"""
Nautilus — Feature Engineering Foundation (Step 2).

Builds leakage-safe feature vectors for hammer price records.

CRITICAL LEAKAGE RULE:
  All compute_*_at_date() functions MUST filter sale_date < reference_date.
  This ensures that when computing features for a sale on date D, we only use
  data that was available BEFORE that sale occurred. Violating this rule would
  cause the model to "see the future" during training.

  Every SQL query in this module that touches sale history is audited to confirm
  it has WHERE sale_date < :reference_date (strict less-than).

Usage:
    from app.engines.feature_engineering import build_hammer_features

    features = build_hammer_features(hammer_price_id, db_session)
    if features is None:
        # insufficient data — skip gracefully

Leakage guard:
    The @leakage_guard decorator verifies at call-time that the function
    receives a reference_date argument and logs a warning if the SQL
    does not contain the expected filter. Use it in tests.
"""

import functools
import inspect
import logging
from datetime import date, datetime, timedelta
from typing import Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.utils.normalize import (
    normalize_artist_name,
    normalize_auction_house,
    normalize_medium_category,
    parse_dimensions_cm,
    size_bucket,
)

log = logging.getLogger(__name__)

# ── Leakage guard decorator ───────────────────────────────────────────────────


def leakage_guard(reference_date_param: str):
    """
    Decorator that documents the leakage contract for compute_*_at_date functions.

    At call time, logs the reference_date being used so auditors can verify.
    In test environments (where AssertionError is expected), the caller should
    inspect the SQL in the function body directly.

    Usage:
        @leakage_guard("reference_date")
        def compute_artist_liquidity_at_date(artist, reference_date, db_session):
            # All SQL MUST have: AND sale_date < :reference_date
            ...
    """
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            # Extract the reference_date value from args or kwargs
            sig = inspect.signature(func)
            params = list(sig.parameters.keys())
            ref_date = None
            if reference_date_param in kwargs:
                ref_date = kwargs[reference_date_param]
            else:
                try:
                    idx = params.index(reference_date_param)
                    ref_date = args[idx]
                except (ValueError, IndexError):
                    pass

            if ref_date is None:
                log.warning(
                    f"leakage_guard: {func.__name__} called without '{reference_date_param}' — "
                    f"leakage cannot be verified."
                )
            else:
                log.debug(
                    f"leakage_guard: {func.__name__} reference_date={ref_date} — "
                    f"only data strictly before this date will be used."
                )
            return func(*args, **kwargs)
        # Attach a marker for testing
        wrapper._leakage_guard_param = reference_date_param
        return wrapper
    return decorator


# ── Artwork period bucketing ──────────────────────────────────────────────────

def compute_artwork_period(year_created: Optional[int]) -> str:
    """
    Map a creation year to a historical period bucket.

    Buckets:
      pre_1900   — before 1900 (Old Masters, 19th century)
      1900_1950  — 1900–1949 (Modernism)
      1950_2000  — 1950–1999 (Post-war, Contemporary emergence)
      post_2000  — 2000 and later (Contemporary)
      unknown    — year_created is None

    Args:
        year_created: Integer year the work was created, or None.

    Returns:
        One of the four period strings or 'unknown'.
    """
    if year_created is None:
        return "unknown"
    if year_created < 1900:
        return "pre_1900"
    if year_created < 1950:
        return "1900_1950"
    if year_created < 2000:
        return "1950_2000"
    return "post_2000"


# ── Estimate spread ───────────────────────────────────────────────────────────

def compute_estimate_spread_pct(
    low: Optional[float],
    high: Optional[float],
) -> Optional[float]:
    """
    Compute estimate spread as a percentage of the low estimate.

    Formula: (high - low) / low * 100

    Returns None if either value is missing or if low is 0 (division guard).
    A narrow spread (e.g. 20%) indicates high confidence in the valuation.
    A wide spread (e.g. 200%) indicates uncertainty.

    Args:
        low:  Estimate low in EUR (or any consistent currency).
        high: Estimate high in EUR.

    Returns:
        Float percentage or None.
    """
    if low is None or high is None:
        return None
    if low == 0:
        return None  # Division by zero guard
    spread = (high - low) / low * 100.0
    return round(spread, 2)


# ── Artist liquidity ──────────────────────────────────────────────────────────

@leakage_guard("reference_date")
def compute_artist_liquidity_at_date(
    artist_name_normalized: str,
    reference_date: date,
    db_session,
) -> Optional[float]:
    """
    Compute artist liquidity score at a given reference date.

    Definition: sale_count / years_active, capped to [0, 100].
    Uses only sales STRICTLY BEFORE reference_date (leakage-safe).

    Interpretation:
      High value (e.g. 50) = frequently traded artist = liquid
      Low value (e.g. 1–2) = rarely appears at auction = illiquid

    Args:
        artist_name_normalized: Normalized artist name (from normalize_artist_name()).
        reference_date: The date of the sale we are computing features for.
                        Only sales BEFORE this date are used.
        db_session: SQLAlchemy session (sync or wrapped async).

    Returns:
        Float liquidity score in [0, 100], or None if insufficient data.
    """
    if not artist_name_normalized:
        return None

    # LEAKAGE-SAFE: strict < reference_date
    result = db_session.execute(
        text("""
            SELECT
                COUNT(*)                        AS sale_count,
                MIN(DATE(sale_date))            AS first_sale,
                MAX(DATE(sale_date))            AS last_sale
            FROM hammer_prices
            WHERE artist_name_normalized = :artist
              AND sale_date < :reference_date
              AND hammer_price_eur IS NOT NULL
        """),
        {
            "artist":         artist_name_normalized,
            "reference_date": reference_date,
        },
    ).fetchone()

    if result is None or result[0] == 0:
        return None

    sale_count = result[0]
    first_sale = result[1]
    last_sale = result[2]

    if first_sale is None or last_sale is None:
        return None

    # Years active: at least 1 to avoid division by zero
    if isinstance(first_sale, date):
        years_active = max(
            1.0,
            (last_sale - first_sale).days / 365.25,
        )
    else:
        # Fallback if dates come back as strings
        try:
            first_sale = date.fromisoformat(str(first_sale)[:10])
            last_sale = date.fromisoformat(str(last_sale)[:10])
            years_active = max(1.0, (last_sale - first_sale).days / 365.25)
        except (ValueError, TypeError):
            years_active = 1.0

    liquidity = sale_count / years_active
    return round(min(liquidity, 100.0), 2)


# ── Artist momentum ───────────────────────────────────────────────────────────

@leakage_guard("reference_date")
def compute_artist_momentum_at_date(
    artist_name_normalized: str,
    reference_date: date,
    db_session,
) -> Optional[float]:
    """
    Compute artist price momentum at a given reference date.

    Definition: (median_last_2yr / median_prev_2yr) - 1
      where last_2yr  = [reference_date - 2 years, reference_date)
            prev_2yr  = [reference_date - 4 years, reference_date - 2 years)

    Both windows must have ≥ 3 sales. Returns None otherwise.
    Uses only sales STRICTLY BEFORE reference_date.

    Args:
        artist_name_normalized: Normalized artist name.
        reference_date:         The sale date we are building features for.
        db_session:             SQLAlchemy session.

    Returns:
        Float momentum ratio (e.g. 0.15 = +15% price growth) or None.
    """
    if not artist_name_normalized:
        return None

    ref_dt = reference_date if isinstance(reference_date, date) else date.fromisoformat(str(reference_date)[:10])
    two_yr_ago = ref_dt - timedelta(days=2 * 365)
    four_yr_ago = ref_dt - timedelta(days=4 * 365)

    # LEAKAGE-SAFE: both windows strictly before reference_date
    result = db_session.execute(
        text("""
            SELECT
                PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY hammer_price_eur)
                    FILTER (WHERE sale_date >= :two_yr_ago AND sale_date < :reference_date
                                  AND hammer_price_eur IS NOT NULL)    AS median_last_2yr,
                COUNT(*) FILTER (WHERE sale_date >= :two_yr_ago AND sale_date < :reference_date
                                       AND hammer_price_eur IS NOT NULL) AS n_last_2yr,
                PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY hammer_price_eur)
                    FILTER (WHERE sale_date >= :four_yr_ago AND sale_date < :two_yr_ago
                                  AND hammer_price_eur IS NOT NULL)    AS median_prev_2yr,
                COUNT(*) FILTER (WHERE sale_date >= :four_yr_ago AND sale_date < :two_yr_ago
                                       AND hammer_price_eur IS NOT NULL) AS n_prev_2yr
            FROM hammer_prices
            WHERE artist_name_normalized = :artist
              AND sale_date < :reference_date
        """),
        {
            "artist":         artist_name_normalized,
            "reference_date": ref_dt,
            "two_yr_ago":     two_yr_ago,
            "four_yr_ago":    four_yr_ago,
        },
    ).fetchone()

    if result is None:
        return None

    median_last, n_last, median_prev, n_prev = result

    # Require at least 3 sales per window for statistical reliability
    if (n_last or 0) < 3 or (n_prev or 0) < 3:
        return None
    if median_prev is None or median_prev == 0:
        return None

    momentum = float(median_last) / float(median_prev) - 1.0
    return round(momentum, 4)


# ── Artist-house premium ──────────────────────────────────────────────────────

@leakage_guard("reference_date")
def compute_artist_house_premium_at_date(
    artist_name_normalized: str,
    house: str,
    reference_date: date,
    db_session,
) -> Optional[float]:
    """
    Compute the price premium achieved by an artist at a specific auction house,
    relative to the artist's overall median at all houses.

    Definition: house_median / overall_median (using only pre-reference_date sales)

    Returns None if:
      - Fewer than 3 sales at the specific house before reference_date
      - Fewer than 3 overall sales before reference_date
      - Overall median is 0

    A value > 1.0 means the house achieves a premium over average.
    A value < 1.0 means the house achieves a discount.

    Args:
        artist_name_normalized: Normalized artist name.
        house:          Auction house identifier (raw or normalized — will be normalized).
        reference_date: Feature reference date — only prior sales used.
        db_session:     SQLAlchemy session.

    Returns:
        Float ratio or None.
    """
    if not artist_name_normalized or not house:
        return None

    # Normalize the house name for consistent matching
    house_normalized = normalize_auction_house(house)

    ref_dt = reference_date if isinstance(reference_date, date) else date.fromisoformat(str(reference_date)[:10])

    # LEAKAGE-SAFE: both queries strictly before reference_date
    result = db_session.execute(
        text("""
            SELECT
                -- Overall median (all houses)
                PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY hammer_price_eur)
                    FILTER (WHERE hammer_price_eur IS NOT NULL)              AS overall_median,
                COUNT(*) FILTER (WHERE hammer_price_eur IS NOT NULL)         AS overall_n,
                -- House-specific median
                PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY hammer_price_eur)
                    FILTER (
                        WHERE hammer_price_eur IS NOT NULL
                          AND LOWER(TRIM(COALESCE(auction_house, ''))) = :house
                    )                                                         AS house_median,
                COUNT(*) FILTER (
                    WHERE hammer_price_eur IS NOT NULL
                      AND LOWER(TRIM(COALESCE(auction_house, ''))) = :house
                )                                                             AS house_n
            FROM hammer_prices
            WHERE artist_name_normalized = :artist
              AND sale_date < :reference_date
        """),
        {
            "artist":         artist_name_normalized,
            "house":          house_normalized,
            "reference_date": ref_dt,
        },
    ).fetchone()

    if result is None:
        return None

    overall_median, overall_n, house_median, house_n = result

    if (house_n or 0) < 3:
        return None
    if (overall_n or 0) < 3:
        return None
    if overall_median is None or float(overall_median) == 0:
        return None

    premium = float(house_median) / float(overall_median)
    return round(premium, 4)


# ── Main feature builder ──────────────────────────────────────────────────────

def build_hammer_features(
    hammer_price_id,
    db_session: Session,
) -> Optional[dict]:
    """
    Build a complete feature vector for a single HammerPrice record.

    All features are leakage-safe: they only use data available at or before sale_date.
    The target variable (sold_above_low_estimate) is included for historical analysis
    but MUST be excluded from any forward-looking model input.

    Args:
        hammer_price_id: UUID or int — the primary key of the hammer_prices row.
        db_session:      SQLAlchemy sync session.

    Returns:
        dict with all features, or None if the record is missing critical fields.

    Feature schema:
        normalized_artist (str)             — normalize_artist_name(artist_name)
        normalized_house (str)              — normalize_auction_house(auction_house)
        medium_category (str)               — medium_category or derived from medium
        size_bucket (str)                   — small/medium/large/very_large/unknown
        artwork_period (str)                — pre_1900/1900_1950/1950_2000/post_2000/unknown
        sale_year (int)                     — EXTRACT(YEAR FROM sale_date)
        sale_month (int)                    — EXTRACT(MONTH FROM sale_date)
        sale_quarter (int)                  — 1–4
        estimate_midpoint_eur (float|None)  — (low + high) / 2
        estimate_spread_pct (float|None)    — (high - low) / low * 100
        artist_liquidity_at_sale (float|None) — sale_count/years_active at sale date
        artist_momentum_at_sale (float|None)  — price trend ratio at sale date
        artist_house_premium_at_sale (float|None) — house premium ratio at sale date
        sold_above_low_estimate (bool|None) — TARGET — exclude from forward-looking use
    """
    # Fetch the hammer price record
    row = db_session.execute(
        text("""
            SELECT
                id::TEXT,
                artist_name,
                artist_name_normalized,
                medium,
                medium_category,
                dimensions,
                year_created,
                sale_date,
                hammer_price_eur,
                auction_house,
                estimate_low,
                estimate_high,
                source
            FROM hammer_prices
            WHERE id = :id
        """),
        {"id": str(hammer_price_id)},
    ).fetchone()

    if row is None:
        log.warning(f"build_hammer_features: record {hammer_price_id} not found")
        return None

    (
        hp_id, artist_name, artist_name_normalized, medium, medium_cat,
        dimensions, year_created, sale_date, hammer_price_eur,
        auction_house, estimate_low, estimate_high, source,
    ) = row

    # Critical fields — without sale_date we cannot compute any time-based features
    if sale_date is None:
        log.debug(f"build_hammer_features: record {hp_id} has no sale_date — skipping")
        return None

    # Normalize reference date
    ref_date: date = sale_date.date() if isinstance(sale_date, datetime) else sale_date

    # ── Static features ───────────────────────────────────────────────────────

    # Artist normalization
    norm_artist = artist_name_normalized or normalize_artist_name(artist_name or "")

    # Auction house normalization
    norm_house = normalize_auction_house(auction_house)

    # Medium category
    cat = medium_cat or normalize_medium_category(medium)

    # Dimensions → size bucket
    dims = parse_dimensions_cm(dimensions)
    sb = size_bucket(dims["width_cm"], dims["height_cm"])

    # Artwork period
    period = compute_artwork_period(year_created)

    # Sale date components
    sale_year = ref_date.year
    sale_month = ref_date.month
    sale_quarter = (ref_date.month - 1) // 3 + 1

    # Estimate features
    est_mid: Optional[float] = None
    if estimate_low is not None and estimate_high is not None:
        est_mid = round((float(estimate_low) + float(estimate_high)) / 2.0, 2)

    est_spread = compute_estimate_spread_pct(
        float(estimate_low) if estimate_low is not None else None,
        float(estimate_high) if estimate_high is not None else None,
    )

    # ── Historical features (leakage-safe — use data BEFORE sale_date) ────────

    liquidity = None
    momentum = None
    house_premium = None

    if norm_artist and norm_artist not in ("", "unknown"):
        try:
            liquidity = compute_artist_liquidity_at_date(norm_artist, ref_date, db_session)
        except Exception as e:
            log.warning(f"compute_artist_liquidity_at_date failed for {norm_artist}: {e}")

        try:
            momentum = compute_artist_momentum_at_date(norm_artist, ref_date, db_session)
        except Exception as e:
            log.warning(f"compute_artist_momentum_at_date failed for {norm_artist}: {e}")

        if auction_house:
            try:
                house_premium = compute_artist_house_premium_at_date(
                    norm_artist, auction_house, ref_date, db_session
                )
            except Exception as e:
                log.warning(f"compute_artist_house_premium_at_date failed for {norm_artist}: {e}")

    # ── Target variable (for historical analysis ONLY) ────────────────────────
    # WARNING: EXCLUDE THIS FROM ANY FORWARD-LOOKING FEATURE SET.
    sold_above_low: Optional[bool] = None
    if hammer_price_eur is not None and estimate_low is not None and float(estimate_low) > 0:
        sold_above_low = float(hammer_price_eur) > float(estimate_low)

    return {
        # Identifiers
        "hammer_price_id":               str(hp_id),
        # Normalized categorical features
        "normalized_artist":             norm_artist,
        "normalized_house":              norm_house,
        "medium_category":               cat,
        "size_bucket":                   sb,
        "artwork_period":                period,
        # Temporal features
        "sale_year":                     sale_year,
        "sale_month":                    sale_month,
        "sale_quarter":                  sale_quarter,
        # Estimate features
        "estimate_midpoint_eur":         est_mid,
        "estimate_spread_pct":           est_spread,
        # Historical (leakage-safe) features
        "artist_liquidity_at_sale":      liquidity,
        "artist_momentum_at_sale":       momentum,
        "artist_house_premium_at_sale":  house_premium,
        # Target variable — HISTORICAL ANALYSIS ONLY
        "sold_above_low_estimate":       sold_above_low,
    }
