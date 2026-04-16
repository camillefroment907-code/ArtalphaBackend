"""
Consignment Volume Alert — flags when an artist has unusually many lots
coming to auction simultaneously, a signal of supply glut / estate sale.

Logic:
  - Count upcoming lots (next 90 days) for the same artist, excluding current lot
  - Levels:
      1–2  → None (normal)
      3–5  → ELEVATED
      6+   → HIGH VOLUME (bearish supply signal)
"""
from datetime import datetime, timedelta
from sqlalchemy import text
from app.utils.cache import get_cached, set_cached


async def get_consignment_alert(
    artist_name: str | None,
    current_lot_id: str | None,
    db,
) -> dict | None:
    if not artist_name:
        return None

    cache_key = f"consign:{artist_name.lower()[:60]}"
    cached = get_cached(cache_key, ttl=900)   # 15-min TTL — lots change fast
    if cached is not None:
        return cached if cached else None

    now = datetime.utcnow()
    window_end = now + timedelta(days=90)

    result = await db.execute(
        text("""
            SELECT
                id::text,
                title,
                auction_house_name,
                auction_date,
                estimate_low,
                estimate_high,
                current_price,
                source
            FROM lots
            WHERE artist_name_raw ILIKE :name
              AND auction_date >= :now
              AND auction_date <= :end
              AND id::text != :current_id
            ORDER BY auction_date
            LIMIT 20
        """),
        {
            "name": f"%{artist_name}%",
            "now": now,
            "end": window_end,
            "current_id": current_lot_id or "",
        },
    )

    rows = result.fetchall()
    count = len(rows)

    if count < 3:
        set_cached(cache_key, False)
        return None

    if count >= 6:
        level = "HIGH VOLUME"
        color = "#f87171"
        signal = "bearish"
        headline = f"{count} works coming to market in 90 days"
        interpretation = "Heavy supply — price pressure likely. Negotiate hard or wait for post-sale."
    else:
        level = "ELEVATED"
        color = "#f59e0b"
        signal = "caution"
        headline = f"{count} works coming to market in 90 days"
        interpretation = "Above-average supply — monitor sell-through rates before committing."

    # Build a compact list of upcoming lots
    upcoming = []
    for r in rows[:6]:  # show max 6 in UI
        est = r.estimate_low or r.current_price
        upcoming.append({
            "id": r.id,
            "title": (r.title or "Untitled")[:60],
            "house": (r.auction_house_name or "").split("—")[0].strip()[:30],
            "date": r.auction_date.strftime("%d %b %Y") if r.auction_date else None,
            "estimate_low": round(est) if est else None,
        })

    data = {
        "level": level,
        "color": color,
        "signal": signal,
        "count": count,
        "headline": headline,
        "interpretation": interpretation,
        "upcoming": upcoming,
    }
    set_cached(cache_key, data)
    return data
