"""
ArtAlpha n8n Integration Endpoints
Called by n8n workflows — no auth required (protected by API key header).
"""
from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from datetime import datetime, timedelta
from typing import Optional
import json

from app.database import get_db
from app.config import get_settings

router = APIRouter(prefix="/n8n", tags=["n8n"])


def _check_api_key(x_api_key: Optional[str] = Header(None)):
    settings = get_settings()
    expected = settings.n8n_api_key
    if not expected:
        return  # No key configured — skip check
    if x_api_key != expected:
        raise HTTPException(401, "Invalid API key")


# ── 1. TRIGGER SCRAPING ───────────────────────────────────────────────────
@router.post("/trigger-scraping")
async def trigger_scraping(
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_check_api_key),
):
    """
    Called by n8n every 15 minutes.
    Runs scraping synchronously with a 5-minute timeout.
    Railway single-worker uvicorn — no Celery, no background tasks.
    """
    import asyncio

    start = datetime.utcnow()

    # Count before
    count_before = (await db.execute(text("SELECT COUNT(*) FROM lots"))).scalar() or 0

    try:
        from app.jobs.tasks import _poll_and_score_async

        # Run with timeout — 4 minutes max (n8n times out at 5min)
        await asyncio.wait_for(
            _poll_and_score_async(),
            timeout=550
        )

        status = "completed"
        error = None

    except asyncio.TimeoutError:
        status = "timeout"
        error = "Scraping timed out after 4 minutes — partial results saved"
    except Exception as e:
        status = "error"
        error = str(e)

    # Count after
    count_after = (await db.execute(text("SELECT COUNT(*) FROM lots"))).scalar() or 0

    duration = (datetime.utcnow() - start).total_seconds()
    new_lots = count_after - count_before

    return {
        "status": status,
        "triggered": True,
        "duration_seconds": round(duration),
        "lots_before": count_before,
        "lots_after": count_after,
        "new_lots_added": new_lots,
        "error": error,
        "timestamp": datetime.utcnow().isoformat(),
    }


# ── 2. GET HOT DEALS (for email alerts) ──────────────────────────────────
@router.get("/hot-deals")
async def get_hot_deals(
    min_score: int = 75,
    since_minutes: int = 15,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_check_api_key),
):
    """Returns new hot deals since last check. Called every 15min by n8n."""
    since = datetime.utcnow() - timedelta(minutes=since_minutes)

    result = await db.execute(text('''
        SELECT
            id, title, artist_name_raw, deal_score,
            estimate_low, estimate_high, current_price,
            currency, category, auction_house_name,
            auction_date, url, image_url,
            pct_below_low_estimate, source
        FROM lots
        WHERE deal_score >= :min_score
          AND created_at >= :since
          AND (auction_date IS NULL OR auction_date >= NOW())
          AND url IS NOT NULL
        ORDER BY deal_score DESC
        LIMIT 20
    '''), {"min_score": min_score, "since": since})

    deals = [
        {
            "id": str(row.id),
            "title": row.title,
            "artist": row.artist_name_raw,
            "score": row.deal_score,
            "estimate_low": row.estimate_low,
            "estimate_high": row.estimate_high,
            "current_price": row.current_price,
            "currency": row.currency or "EUR",
            "category": row.category,
            "auction_house": row.auction_house_name,
            "auction_date": row.auction_date.isoformat() if row.auction_date else None,
            "url": row.url,
            "image_url": row.image_url,
            "pct_below": row.pct_below_low_estimate,
            "source": str(row.source),
        }
        for row in result.fetchall()
    ]

    return {
        "count": len(deals),
        "since": since.isoformat(),
        "min_score": min_score,
        "deals": deals,
    }


# ── 3. GET USERS WITH ALERTS ENABLED ─────────────────────────────────────
@router.get("/alert-subscribers")
async def get_alert_subscribers(
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_check_api_key),
):
    """Returns users who have alerts enabled and their preferences."""
    # notify_email, alert_email, min_deal_score, categories are on preferences table
    result = await db.execute(text('''
        SELECT
            u.id,
            u.email,
            COALESCE(p.alert_email, u.email) AS alert_email,
            COALESCE(p.min_deal_score, 70)   AS min_deal_score,
            p.categories                      AS preferred_categories,
            s.plan,
            s.status
        FROM users u
        LEFT JOIN preferences p  ON p.user_id = u.id
        LEFT JOIN subscriptions s ON s.user_id = u.id
        WHERE u.is_active  = true
          AND p.is_alerts_enabled = true
          AND (
              s.status IN ('ACTIVE', 'TRIALING')
              OR s.plan IS NULL
              OR s.plan = 'FREE'
          )
        ORDER BY s.plan DESC NULLS LAST
    '''))

    subscribers = []
    for row in result.fetchall():
        cats = row.preferred_categories or []
        if isinstance(cats, str):
            try:
                cats = json.loads(cats)
            except Exception:
                cats = []

        subscribers.append({
            "user_id": str(row.id),
            "email": row.alert_email,
            "min_score": row.min_deal_score,
            "preferred_categories": cats,
            "plan": (row.plan or "free").lower(),
        })

    return {"count": len(subscribers), "subscribers": subscribers}


# ── 4. DAILY REPORT DATA ──────────────────────────────────────────────────
@router.get("/daily-report")
async def get_daily_report(
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_check_api_key),
):
    """Returns daily report data. Called once per day by n8n."""
    yesterday = datetime.utcnow() - timedelta(hours=24)

    new_lots = (await db.execute(text(
        "SELECT COUNT(*) FROM lots WHERE created_at >= :since AND (auction_date IS NULL OR auction_date >= NOW())"
    ), {"since": yesterday})).scalar() or 0

    top_deals_result = await db.execute(text('''
        SELECT title, artist_name_raw, deal_score,
               current_price, currency, url, image_url,
               auction_house_name, pct_below_low_estimate
        FROM lots
        WHERE deal_score >= 60
          AND created_at >= :since
          AND (auction_date IS NULL OR auction_date >= NOW())
        ORDER BY deal_score DESC
        LIMIT 5
    '''), {"since": yesterday})

    top_deals = [
        {
            "title": (r.title or "")[:60],
            "artist": r.artist_name_raw,
            "score": r.deal_score,
            "price": r.current_price,
            "currency": r.currency or "EUR",
            "url": r.url,
            "image_url": r.image_url,
            "house": r.auction_house_name,
            "pct_below": r.pct_below_low_estimate,
        }
        for r in top_deals_result.fetchall()
    ]

    new_users = (await db.execute(text(
        "SELECT COUNT(*) FROM users WHERE created_at >= :since"
    ), {"since": yesterday})).scalar() or 0

    new_subs = (await db.execute(text(
        "SELECT COUNT(*) FROM subscriptions WHERE created_at >= :since AND plan != 'FREE'"
    ), {"since": yesterday})).scalar() or 0

    total_paid = (await db.execute(text(
        "SELECT COUNT(*) FROM subscriptions WHERE status IN ('ACTIVE','TRIALING') AND plan != 'FREE'"
    ))).scalar() or 0

    return {
        "date": datetime.utcnow().strftime("%B %d, %Y"),
        "new_lots": new_lots,
        "new_users": new_users,
        "new_subscriptions": new_subs,
        "total_paid_subscribers": total_paid,
        "top_deals": top_deals,
        "generated_at": datetime.utcnow().isoformat(),
    }


# ── 5. HEALTH CHECK FOR MONITORING ───────────────────────────────────────
@router.get("/health-check")
async def health_check(
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_check_api_key),
):
    """Called every 5 min by n8n to monitor backend health."""
    try:
        lot_count = (await db.execute(text("SELECT COUNT(*) FROM lots"))).scalar()
        last_created = (await db.execute(text("SELECT MAX(created_at) FROM lots"))).scalar()

        minutes_since_scrape = None
        is_stale = False
        if last_created:
            delta = datetime.utcnow() - last_created
            minutes_since_scrape = int(delta.total_seconds() / 60)
            is_stale = minutes_since_scrape > 30

        return {
            "status": "healthy",
            "lot_count": lot_count,
            "last_scrape_minutes_ago": minutes_since_scrape,
            "is_stale": is_stale,
            "timestamp": datetime.utcnow().isoformat(),
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat(),
        }


# ── 6. NEW USER NOTIFICATION DATA ────────────────────────────────────────
@router.get("/new-users")
async def get_new_users(
    since_minutes: int = 60,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_check_api_key),
):
    """Returns users who signed up recently."""
    since = datetime.utcnow() - timedelta(minutes=since_minutes)

    result = await db.execute(text('''
        SELECT u.email, u.created_at, s.plan
        FROM users u
        LEFT JOIN subscriptions s ON s.user_id = u.id
        WHERE u.created_at >= :since
        ORDER BY u.created_at DESC
    '''), {"since": since})

    users = [
        {
            "email": row.email,
            "signed_up_at": row.created_at.isoformat() if row.created_at else None,
            "plan": (row.plan or "free").lower(),
        }
        for row in result.fetchall()
    ]

    return {"count": len(users), "users": users}
