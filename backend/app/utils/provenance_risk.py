"""
Provenance Risk Flag — surfaces due-diligence red flags visible from lot data.

Checks (each with a severity weight):
  RAPID_RESALE       [HIGH]   Same artist + matching title sold within 2 years
  NO_PROVENANCE      [HIGH]   Provenance field is empty — ownership chain unknown
  POOR_DOCUMENTATION [MEDIUM] No medium AND no dimensions listed
  NO_IMAGES          [LOW]    No condition images available
  PRICE_ANOMALY      [MEDIUM] Estimate >65% below artist's median hammer price

Overall level:
  score 0   → None (no block shown)
  score 1–2 → CAUTION
  score 3–4 → ELEVATED
  score 5+  → HIGH RISK
"""
from datetime import datetime, timedelta
from sqlalchemy import text
from app.utils.cache import get_cached, set_cached


async def get_provenance_risk(lot, db) -> dict | None:
    """lot is the ORM Lot object (has all fields)."""
    lot_id    = str(lot.id)
    artist    = lot.artist_name_raw or ""
    title     = lot.title or ""
    cache_key = f"prov:{lot_id}"

    cached = get_cached(cache_key, ttl=3600)
    if cached is not None:
        return cached if cached else None

    flags = []
    score = 0

    # ── 1. RAPID RESALE ───────────────────────────────────────────────────────
    if artist and title:
        # Use first 4 significant words of title for fuzzy match
        title_words = [w for w in title.split() if len(w) > 2][:4]
        title_pattern = "%" + " ".join(title_words[:2]) + "%" if title_words else None

        if title_pattern:
            resale_result = await db.execute(
                text("""
                    SELECT auction_house, sale_date
                    FROM hammer_prices
                    WHERE artist_name ILIKE :artist
                      AND artwork_title ILIKE :title
                      AND sale_date >= :cutoff
                    ORDER BY sale_date DESC
                    LIMIT 1
                """),
                {
                    "artist": f"%{artist}%",
                    "title":  title_pattern,
                    "cutoff": datetime.utcnow() - timedelta(days=730),
                },
            )
            resale_row = resale_result.one_or_none()
            if resale_row:
                yr = resale_row.sale_date.year if resale_row.sale_date else "recently"
                house = (resale_row.auction_house or "another house")[:40]
                flags.append({
                    "code": "RAPID_RESALE",
                    "severity": "HIGH",
                    "label": "Rapid resale detected",
                    "detail": f"Same work sold at {house} in {yr} — back at auction within 2 years",
                })
                score += 3

    # ── 2. NO PROVENANCE ──────────────────────────────────────────────────────
    if not (lot.provenance or "").strip():
        flags.append({
            "code": "NO_PROVENANCE",
            "severity": "HIGH",
            "label": "No provenance listed",
            "detail": "Ownership history not documented — verify chain of title before bidding",
        })
        score += 3

    # ── 3. POOR DOCUMENTATION ─────────────────────────────────────────────────
    if not (lot.medium or "").strip() and not (lot.dimensions or "").strip():
        flags.append({
            "code": "POOR_DOCUMENTATION",
            "severity": "MEDIUM",
            "label": "Limited documentation",
            "detail": "No medium or dimensions listed — physical characteristics unverified",
        })
        score += 2

    # ── 4. NO IMAGES ──────────────────────────────────────────────────────────
    if not (lot.image_url or "").strip():
        flags.append({
            "code": "NO_IMAGES",
            "severity": "LOW",
            "label": "No condition images",
            "detail": "Condition cannot be assessed remotely",
        })
        score += 1

    # ── 5. PRICE ANOMALY vs artist median ────────────────────────────────────
    if artist and lot.estimate_low and lot.estimate_low > 0:
        median_result = await db.execute(
            text("""
                SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY hammer_price_eur) AS median_price
                FROM hammer_prices
                WHERE artist_name ILIKE :artist
                  AND hammer_price_eur > 0
            """),
            {"artist": f"%{artist}%"},
        )
        median_row = median_result.one_or_none()
        if median_row and median_row.median_price and median_row.median_price > 0:
            ratio = lot.estimate_low / median_row.median_price
            if ratio < 0.25:    # estimate < 25% of median — unusual
                flags.append({
                    "code": "PRICE_ANOMALY",
                    "severity": "MEDIUM",
                    "label": "Estimate far below market median",
                    "detail": f"Estimate is {round(ratio * 100)}% of artist's median hammer (€{round(median_row.median_price / 1000)}K) — verify attribution",
                })
                score += 2

    if not flags:
        set_cached(cache_key, False)
        return None

    # ── Determine overall level ───────────────────────────────────────────────
    if score >= 5:
        level = "HIGH RISK"
        color = "#f87171"
    elif score >= 3:
        level = "ELEVATED"
        color = "#f59e0b"
    else:
        level = "CAUTION"
        color = "#94a3b8"

    data = {
        "level": level,
        "color": color,
        "score": score,
        "flags": flags,
        "flag_count": len(flags),
    }
    set_cached(cache_key, data)
    return data
