from fastapi import APIRouter, Depends, HTTPException, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, delete
from sqlalchemy.orm import selectinload
from typing import Any, Dict, Optional
from datetime import datetime, timedelta

from app.database import get_db, check_db_connection
from app.models.db_models import (
    Lot, User, Alert, LotStatus, Subscription, SubscriptionStatus,
    WaitlistEntry, RecommendationEvent, CollectorDNA,
)

router = APIRouter(prefix="/admin", tags=["admin"])

ADMIN_KEY = "hono-admin-2024"
ADMIN_EMAILS = {"camillefroment907@gmail.com"}

_bearer = HTTPBearer(auto_error=False)


def verify_admin(
    x_admin_key: Optional[str] = Header(None),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
):
    # Accept X-Admin-Key header
    if x_admin_key == ADMIN_KEY:
        return True
    # Accept Bearer JWT from known admin emails
    if credentials:
        try:
            from app.api.auth_utils import decode_token
            payload = decode_token(credentials.credentials)
            if payload.get("email") in ADMIN_EMAILS:
                return True
        except Exception:
            pass
    raise HTTPException(status_code=403, detail="Admin access denied")


@router.get("/stats")
async def admin_stats(
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin),
) -> Dict[str, Any]:
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = datetime.utcnow() - timedelta(days=7)

    total_lots = (await db.execute(select(func.count(Lot.id)))).scalar() or 0
    total_users = (await db.execute(select(func.count(User.id)))).scalar() or 0
    total_deals = (await db.execute(
        select(func.count(Lot.id)).where(Lot.is_deal == True)
    )).scalar() or 0
    lots_today = (await db.execute(
        select(func.count(Lot.id)).where(Lot.created_at >= today)
    )).scalar() or 0
    deals_today = (await db.execute(
        select(func.count(Lot.id)).where(and_(Lot.is_deal == True, Lot.created_at >= today))
    )).scalar() or 0
    lots_week = (await db.execute(
        select(func.count(Lot.id)).where(Lot.created_at >= week_ago)
    )).scalar() or 0
    avg_score = (await db.execute(
        select(func.avg(Lot.deal_score)).where(Lot.deal_score.isnot(None))
    )).scalar() or 0
    top_score = (await db.execute(select(func.max(Lot.deal_score)))).scalar() or 0
    total_alerts = (await db.execute(select(func.count(Alert.id)))).scalar() or 0
    alerts_today = (await db.execute(
        select(func.count(Alert.id)).where(Alert.sent_at >= today)
    )).scalar() or 0

    # Source distribution
    source_stmt = (
        select(Lot.source, func.count(Lot.id).label("cnt"))
        .group_by(Lot.source)
        .order_by(func.count(Lot.id).desc())
    )
    source_rows = (await db.execute(source_stmt)).all()
    sources = {row.source.value if hasattr(row.source, 'value') else str(row.source): row.cnt for row in source_rows}

    # Top 5 deals
    top_lots_stmt = (
        select(Lot)
        .options(selectinload(Lot.artist))
        .where(Lot.is_deal == True)
        .order_by(Lot.deal_score.desc())
        .limit(5)
    )
    top_lots = (await db.execute(top_lots_stmt)).scalars().all()

    return {
        "lots": {
            "total": total_lots,
            "today": lots_today,
            "this_week": lots_week,
            "deals_total": total_deals,
            "deals_today": deals_today,
            "deal_rate_pct": round(total_deals / total_lots * 100, 1) if total_lots else 0,
        },
        "scoring": {
            "avg_score": round(float(avg_score), 1),
            "top_score": round(float(top_score), 1),
        },
        "users": {"total": total_users},
        "alerts": {"total": total_alerts, "today": alerts_today},
        "sources": sources,
        "top_deals": [
            {
                "id": str(lot.id),
                "title": lot.title[:60],
                "deal_score": lot.deal_score,
                "artist": lot.artist.name if lot.artist else lot.artist_name_raw,
                "source": lot.source.value if hasattr(lot.source, 'value') else lot.source,
                "current_price": lot.current_price,
                "currency": lot.currency,
            }
            for lot in top_lots
        ],
        "generated_at": datetime.utcnow().isoformat(),
    }


# Keywords that identify non-art lots (jewelry, watches, silverware, etc.)
_JEWELRY_KEYWORDS = [
    "adam's", "adams fine art",
    "diamond", "brillant", "bague", "ring",
    "bracelet", "collier", "necklace",
    "montre", "watch", "rolex", "cartier watch",
    "silver", "argent", "vermeil", "goldsmith",
    "bijou", "bijoux", "jewelry", "jewellery",
    "sapphire", "ruby", "emerald", "pearl",
    "saphir", "rubis", "émeraude", "perle",
]

_JEWELRY_HOUSES = ["adam's", "adams"]


@router.delete("/cleanup-jewelry")
async def cleanup_jewelry(
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin),
) -> Dict[str, Any]:
    """Delete non-art lots: jewelry, watches, and Adam's auction house lots."""
    from sqlalchemy import or_
    from app.models.db_models import Lot as LotModel

    conditions = []

    # Auction house blacklist
    for house in _JEWELRY_HOUSES:
        conditions.append(func.lower(LotModel.auction_house_name).contains(house))

    # Title/category keyword blacklist
    for kw in _JEWELRY_KEYWORDS:
        conditions.append(func.lower(LotModel.title).contains(kw))

    if not conditions:
        return {"deleted": 0}

    stmt = select(func.count(LotModel.id)).where(or_(*conditions))
    count_before = (await db.execute(stmt)).scalar() or 0

    del_stmt = delete(LotModel).where(or_(*conditions))
    await db.execute(del_stmt)
    await db.commit()

    return {
        "deleted": count_before,
        "message": f"Removed {count_before} non-art lots",
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.post("/dedup-lots")
async def dedup_lots(
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin),
) -> Dict[str, Any]:
    """
    Remove duplicate lots using Python-side fingerprint computation.
    Keeps the oldest lot per unique (title, artist, estimate_low, estimate_high).
    Also backfills lot_fingerprint column for future prevention.
    """
    import hashlib
    from sqlalchemy import text as sa_text

    # Step 1: Add lot_fingerprint column if it doesn't exist yet
    try:
        await db.execute(sa_text("ALTER TABLE lots ADD COLUMN IF NOT EXISTS lot_fingerprint VARCHAR(64)"))
        await db.commit()
    except Exception:
        await db.rollback()

    # Step 2: Fetch all lots (id, title, artist, estimates, created_at) — no fingerprint column dependency
    rows = (await db.execute(
        sa_text("SELECT id, title, artist_name_raw, estimate_low, estimate_high, created_at FROM lots ORDER BY created_at ASC")
    )).fetchall()

    # Step 2: Compute fingerprints and find duplicates
    seen: dict = {}   # fingerprint -> first (oldest) id
    to_delete = []
    to_update = []    # (id, fingerprint) pairs needing backfill

    for row in rows:
        raw = (
            f"{(row.title or '').lower().strip()}|"
            f"{(row.artist_name_raw or '').lower().strip()}|"
            f"{int(round(row.estimate_low or 0))}|"
            f"{int(round(row.estimate_high or 0))}"
        )
        fp = hashlib.md5(raw.encode()).hexdigest() if row.title else None

        if fp:
            if row.lot_fingerprint is None:
                to_update.append((str(row.id), fp))
            if fp in seen:
                to_delete.append(str(row.id))
            else:
                seen[fp] = str(row.id)

    # Step 3: Backfill fingerprints in batches
    if to_update:
        for lot_id, fp in to_update:
            await db.execute(
                sa_text("UPDATE lots SET lot_fingerprint = :fp WHERE id = :id::uuid"),
                {"fp": fp, "id": lot_id}
            )
        await db.commit()

    # Step 4: Delete duplicates in a single IN query
    deleted = 0
    if to_delete:
        # Batch into chunks of 500 to avoid very long IN clauses
        for i in range(0, len(to_delete), 500):
            chunk = to_delete[i:i + 500]
            placeholders = ", ".join(f"'{lid}'::uuid" for lid in chunk)
            result = await db.execute(sa_text(f"DELETE FROM lots WHERE id IN ({placeholders})"))
            deleted += result.rowcount
        await db.commit()

    total_remaining = (await db.execute(select(func.count(Lot.id)))).scalar() or 0

    return {
        "deleted": deleted,
        "remaining": total_remaining,
        "fingerprints_backfilled": len(to_update),
        "message": f"Removed {deleted} duplicate lots. {total_remaining} unique lots remain.",
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.get("/health")
async def admin_health(
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin),
) -> Dict[str, Any]:
    """System health dashboard — DB, lots pipeline, scoring."""
    now = datetime.utcnow()
    since_1h  = now - timedelta(hours=1)
    since_24h = now - timedelta(hours=24)

    db_ok = await check_db_connection()
    total_lots = (await db.execute(select(func.count(Lot.id)))).scalar() or 0
    lots_24h   = (await db.execute(select(func.count(Lot.id)).where(Lot.created_at >= since_24h))).scalar() or 0
    lots_1h    = (await db.execute(select(func.count(Lot.id)).where(Lot.created_at >= since_1h))).scalar() or 0
    scored_pct = 0.0
    if total_lots:
        scored = (await db.execute(select(func.count(Lot.id)).where(Lot.deal_score.isnot(None)))).scalar() or 0
        scored_pct = round(scored / total_lots * 100, 1)
    avg_score  = (await db.execute(select(func.avg(Lot.deal_score)).where(Lot.deal_score.isnot(None)))).scalar() or 0
    top_score  = (await db.execute(select(func.max(Lot.deal_score)))).scalar() or 0

    # Latest ingested lot
    latest_result = await db.execute(select(Lot).order_by(Lot.created_at.desc()).limit(1))
    latest = latest_result.scalar_one_or_none()
    minutes_since_last = None
    if latest and latest.created_at:
        minutes_since_last = int((now - latest.created_at).total_seconds() / 60)

    total_users = (await db.execute(select(func.count(User.id)))).scalar() or 0

    return {
        "status": "healthy" if db_ok else "degraded",
        "database": "ok" if db_ok else "error",
        "pipeline": {
            "total_lots":         total_lots,
            "lots_last_1h":       lots_1h,
            "lots_last_24h":      lots_24h,
            "minutes_since_last": minutes_since_last,
            "scored_pct":         scored_pct,
        },
        "scoring": {
            "avg_score":  round(float(avg_score), 1),
            "top_score":  round(float(top_score), 1),
        },
        "users": {"total": total_users},
        "generated_at": now.isoformat(),
    }


@router.get("/launch")
async def admin_launch(
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin),
) -> Dict[str, Any]:
    """Launch readiness dashboard — waitlist, signups, subscriptions."""
    now = datetime.utcnow()
    since_7d = now - timedelta(days=7)

    # Waitlist
    waitlist_total   = (await db.execute(select(func.count(WaitlistEntry.id)))).scalar() or 0
    waitlist_7d      = (await db.execute(select(func.count(WaitlistEntry.id)).where(WaitlistEntry.joined_at >= since_7d))).scalar() or 0
    waitlist_with_ref = (await db.execute(select(func.count(WaitlistEntry.id)).where(WaitlistEntry.referred_by.isnot(None)))).scalar() or 0

    # Registered users
    total_users      = (await db.execute(select(func.count(User.id)))).scalar() or 0
    users_7d         = (await db.execute(select(func.count(User.id)).where(User.created_at >= since_7d))).scalar() or 0

    # Subscriptions by plan
    sub_result = await db.execute(
        select(Subscription.plan, func.count(Subscription.id))
        .where(Subscription.status == SubscriptionStatus.ACTIVE)
        .group_by(Subscription.plan)
    )
    subs_by_plan = {str(row[0].value if hasattr(row[0], 'value') else row[0]): row[1] for row in sub_result.all()}

    # DNA profiles (engagement depth)
    dna_count = (await db.execute(select(func.count(CollectorDNA.id)))).scalar() or 0

    # Launch target
    TARGET_USERS = 500
    days_to_launch = max(0, (datetime(2026, 5, 13) - now).days)

    return {
        "waitlist": {
            "total":        waitlist_total,
            "last_7_days":  waitlist_7d,
            "with_referral": waitlist_with_ref,
            "referral_rate_pct": round(waitlist_with_ref / waitlist_total * 100, 1) if waitlist_total else 0,
        },
        "users": {
            "total":       total_users,
            "last_7_days": users_7d,
            "with_dna":    dna_count,
        },
        "subscriptions": subs_by_plan,
        "launch": {
            "target_paying":   TARGET_USERS,
            "days_remaining":  days_to_launch,
            "launch_date":     "2026-05-13",
        },
        "generated_at": now.isoformat(),
    }


@router.get("/recommendations")
async def admin_recommendations(
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin),
) -> Dict[str, Any]:
    """Recommendation engine performance — impressions, reads, dismissals."""
    now = datetime.utcnow()
    since_7d = now - timedelta(days=7)

    total_events = (await db.execute(select(func.count(RecommendationEvent.id)))).scalar() or 0
    events_7d    = (await db.execute(select(func.count(RecommendationEvent.id)).where(RecommendationEvent.shown_at >= since_7d))).scalar() or 0
    reads        = (await db.execute(select(func.count(RecommendationEvent.id)).where(RecommendationEvent.read_at.isnot(None)))).scalar() or 0
    dismissals   = (await db.execute(select(func.count(RecommendationEvent.id)).where(RecommendationEvent.dismissed_at.isnot(None)))).scalar() or 0
    actions      = (await db.execute(select(func.count(RecommendationEvent.id)).where(RecommendationEvent.acted_at.isnot(None)))).scalar() or 0

    # By rec_type
    type_result = await db.execute(
        select(RecommendationEvent.rec_type, func.count(RecommendationEvent.id))
        .group_by(RecommendationEvent.rec_type)
        .order_by(func.count(RecommendationEvent.id).desc())
    )
    by_type = {row[0]: row[1] for row in type_result.all()}

    ctr = round(reads / total_events * 100, 1) if total_events else 0
    dismiss_rate = round(dismissals / total_events * 100, 1) if total_events else 0

    return {
        "events": {
            "total":      total_events,
            "last_7_days": events_7d,
            "reads":      reads,
            "dismissals": dismissals,
            "actions":    actions,
        },
        "rates": {
            "ctr_pct":          ctr,
            "dismiss_rate_pct": dismiss_rate,
            "action_rate_pct":  round(actions / total_events * 100, 1) if total_events else 0,
        },
        "by_type":     by_type,
        "generated_at": now.isoformat(),
    }


# ── Deal score backfill ───────────────────────────────────────────────────────

@router.post("/backfill-scores", dependencies=[Depends(verify_admin)])
async def backfill_deal_scores(db: AsyncSession = Depends(get_db)):
    """
    Backfill deal_score for all lots where it is NULL.
    Formula: based on current_price vs estimate_low/high.
    Safe to run multiple times (only updates NULL records).
    """
    from sqlalchemy import text
    sql = text("""
        UPDATE lots SET deal_score =
          CASE
            WHEN current_price IS NULL THEN 50
            WHEN estimate_low IS NOT NULL AND current_price < estimate_low * 0.70 THEN 85
            WHEN estimate_low IS NOT NULL AND current_price < estimate_low * 0.85 THEN 70
            WHEN estimate_low IS NOT NULL AND current_price <= estimate_low         THEN 55
            WHEN estimate_high IS NOT NULL AND current_price <= estimate_high        THEN 40
            ELSE 25
          END
        WHERE deal_score IS NULL
    """)
    result = await db.execute(sql)
    await db.commit()
    return {"updated": result.rowcount, "status": "ok"}


# ── Wikidata enrichment trigger ───────────────────────────────────────────────

@router.post("/enrich-artists", dependencies=[Depends(verify_admin)])
async def trigger_wikidata_enrichment():
    """Trigger one batch of Wikidata artist enrichment (background task)."""
    import asyncio
    from app.jobs.wikidata_enrichment import enrich_artists_batch
    asyncio.create_task(enrich_artists_batch())
    return {"status": "started", "message": "Wikidata enrichment running in background (1000 artists)"}


# ── Lot count stats ───────────────────────────────────────────────────────────

@router.get("/stats", dependencies=[Depends(verify_admin)])
async def get_db_stats(db: AsyncSession = Depends(get_db)):
    """Return current DB counts for TIMELINE_LOG."""
    from sqlalchemy import text
    lots = (await db.execute(text("SELECT COUNT(*) FROM lots"))).scalar() or 0
    users = (await db.execute(text("SELECT COUNT(*) FROM users"))).scalar() or 0
    waitlist = (await db.execute(text("SELECT COUNT(*) FROM waitlist_entries"))).scalar() or 0
    blog_posts = (await db.execute(text("SELECT COUNT(*) FROM blog_posts WHERE is_published = true"))).scalar() or 0
    scored = (await db.execute(text("SELECT COUNT(*) FROM lots WHERE deal_score IS NOT NULL"))).scalar() or 0
    return {
        "lots_total": lots,
        "lots_scored": scored,
        "users": users,
        "waitlist": waitlist,
        "blog_posts_published": blog_posts,
        "generated_at": datetime.utcnow().isoformat(),
    }

