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

import logging
_log = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])

ADMIN_KEY = "hono-admin-2024"
ADMIN_EMAILS = {"camillefroment907@gmail.com"}

# Module-level state for historical ingest tracking
_historical_status: Dict[str, Any] = {
    "running": False,
    "started_at": None,
    "finished_at": None,
    "lots_fetched": 0,
    "lots_inserted": 0,
    "error": None,
    "months_back": None,
}

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
    Remove duplicate lots — keep oldest per unique (title, artist, estimate_low, estimate_high).
    Uses a pure SQL CTE to identify and delete duplicates in one round-trip.
    """
    from sqlalchemy import text as sa_text
    import traceback

    try:
        # Single SQL: identify duplicates using ROW_NUMBER(), keep oldest, delete the rest
        dedup_sql = sa_text("""
            DELETE FROM lots
            WHERE id IN (
                SELECT id FROM (
                    SELECT
                        id,
                        ROW_NUMBER() OVER (
                            PARTITION BY
                                lower(coalesce(title, '')),
                                lower(coalesce(artist_name_raw, '')),
                                round(coalesce(estimate_low, 0)::numeric),
                                round(coalesce(estimate_high, 0)::numeric)
                            ORDER BY created_at ASC
                        ) AS rn
                    FROM lots
                    WHERE title IS NOT NULL
                ) t
                WHERE rn > 1
            )
        """)
        result = await db.execute(dedup_sql)
        deleted = result.rowcount
        await db.commit()

        total_remaining = (await db.execute(select(func.count(Lot.id)))).scalar() or 0

        return {
            "deleted": deleted,
            "remaining": total_remaining,
            "message": f"Removed {deleted} duplicate lots. {total_remaining} unique lots remain.",
            "timestamp": datetime.utcnow().isoformat(),
        }
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Dedup failed: {str(e)} | {traceback.format_exc()[-300:]}")


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

@router.post("/backfill-market-type", dependencies=[Depends(verify_admin)])
async def backfill_market_type(db: AsyncSession = Depends(get_db)):
    """Fix market_type=PRIMARY on artmarketapi lots that are actually auctions."""
    from sqlalchemy import text, update
    from app.models.db_models import Lot as LotModel, MarketType
    from sqlalchemy import or_
    # Use ORM update to avoid PostgreSQL enum casting issues with raw SQL
    stmt = (
        update(LotModel)
        .where(
            LotModel.market_type == MarketType.PRIMARY,
            LotModel.source.in_(["artmarketapi", "christies", "sothebys", "bonhams",
                                  "phillips", "roseberys", "heritage", "drouot"])
        )
        .values(market_type=MarketType.AUCTION)
    )
    result = await db.execute(stmt)
    await db.commit()
    return {"updated": result.rowcount, "status": "ok"}


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


# ── Poush artist sync ────────────────────────────────────────────────────────

@router.post("/poush/sync", dependencies=[Depends(verify_admin)])
async def trigger_poush_sync():
    """Scrape Poush Manifesto artists and upsert into artist_profiles."""
    from app.connectors.poush_connector import sync_to_db
    count = await sync_to_db()
    return {"status": "ok", "imported": count}


# ── Artsper enrichment trigger ───────────────────────────────────────────────

@router.post("/artsper-enrichment/trigger", dependencies=[Depends(verify_admin)])
async def trigger_artsper_enrichment(max_artists: int = 50):
    """Trigger Artsper artist enrichment pipeline (background task)."""
    import asyncio
    from app.jobs.artist_enrichment_job import run_artist_enrichment
    asyncio.create_task(run_artist_enrichment(max_artists=max_artists))
    return {"status": "started", "message": f"Artsper enrichment running in background (max {max_artists} artists)"}


# ── Wikidata enrichment trigger ───────────────────────────────────────────────

@router.post("/enrich-artists", dependencies=[Depends(verify_admin)])
async def trigger_wikidata_enrichment():
    """Trigger one batch of Wikidata artist enrichment (background task)."""
    import asyncio
    from app.jobs.wikidata_enrichment import enrich_artists_batch
    asyncio.create_task(enrich_artists_batch())
    return {"status": "started", "message": "Wikidata enrichment running in background (1000 artists)"}


# ── Artsper enrichment ────────────────────────────────────────────────────────

_artsper_enrich_status: Dict[str, Any] = {}


@router.get("/artsper-enrichment/status", dependencies=[Depends(verify_admin)])
async def artsper_enrichment_status() -> Dict[str, Any]:
    """Return the status of the last / running Artsper enrichment job."""
    return dict(_artsper_enrich_status) or {"status": "never_run"}


@router.post("/artsper-enrichment/trigger", dependencies=[Depends(verify_admin)])
async def trigger_artsper_enrichment(body: dict = None) -> Dict[str, Any]:
    """
    Trigger a full Artsper → artsper_artist_snapshots sync in the background.
    Optional body: { "max_artworks": 200000 }

    Progress and result available via GET /api/admin/artsper-enrichment/status
    """
    import asyncio as _asyncio
    from app.jobs.artsper_enrichment_job import run_artsper_enrichment

    if _artsper_enrich_status.get("running"):
        return {
            "status": "already_running",
            "started_at": _artsper_enrich_status.get("started_at"),
        }

    max_artworks = int((body or {}).get("max_artworks", 200_000))

    async def _run():
        _artsper_enrich_status.update({
            "running": True,
            "started_at": datetime.utcnow().isoformat(),
            "finished_at": None,
            "summary": None,
            "error": None,
        })
        try:
            summary = await run_artsper_enrichment(max_artworks=max_artworks)
            _artsper_enrich_status.update({
                "running": False,
                "finished_at": datetime.utcnow().isoformat(),
                "summary": summary,
            })
        except Exception as exc:
            _artsper_enrich_status.update({
                "running": False,
                "finished_at": datetime.utcnow().isoformat(),
                "error": str(exc),
            })

    _asyncio.create_task(_run())
    return {
        "status": "started",
        "max_artworks": max_artworks,
        "message": "Artsper enrichment running. Monitor via GET /api/admin/artsper-enrichment/status",
    }


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


# ── Set user plan (admin) ─────────────────────────────────────────────────────

@router.post("/set-plan", dependencies=[Depends(verify_admin)])
async def set_user_plan(body: dict, db: AsyncSession = Depends(get_db)):
    """
    Manually set a user's subscription plan. Used for demo accounts and comps.
    Body: { "email": "...", "plan": "institutional" }
    """
    from app.models.db_models import SubscriptionPlan

    email = body.get("email")
    plan_str = (body.get("plan") or "investor").upper()

    if not email:
        raise HTTPException(400, "email required")

    # Map aliases
    if plan_str == "FAMILY_OFFICE":
        plan_str = "INSTITUTIONAL"

    try:
        plan_enum = SubscriptionPlan(plan_str)
    except ValueError:
        raise HTTPException(400, f"Invalid plan: {plan_str}. Valid: {[p.value for p in SubscriptionPlan]}")

    # Fetch user
    user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if not user:
        raise HTTPException(404, f"User {email} not found")

    # Upsert subscription via ORM
    sub = (await db.execute(
        select(Subscription).where(Subscription.user_id == user.id)
    )).scalar_one_or_none()

    if sub:
        sub.plan = plan_enum
        sub.status = SubscriptionStatus.ACTIVE
        sub.updated_at = datetime.utcnow()
    else:
        sub = Subscription(
            user_id=user.id,
            plan=plan_enum,
            status=SubscriptionStatus.ACTIVE,
        )
        db.add(sub)

    await db.commit()

    return {"status": "ok", "email": email, "plan": plan_enum.value}


# ── Lot count by source ────────────────────────────────────────────────────────

@router.get("/lot-count", dependencies=[Depends(verify_admin)])
async def lot_count(db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    """Detailed lot count breakdown for monitoring bulk ingest progress."""
    from sqlalchemy import text as _text

    total = (await db.execute(select(func.count(Lot.id)))).scalar() or 0
    with_score = (await db.execute(
        select(func.count(Lot.id)).where(Lot.deal_score.isnot(None))
    )).scalar() or 0
    with_image = (await db.execute(
        select(func.count(Lot.id)).where(Lot.image_url.isnot(None))
    )).scalar() or 0
    deals = (await db.execute(
        select(func.count(Lot.id)).where(Lot.is_deal == True)
    )).scalar() or 0

    source_rows = (await db.execute(
        select(Lot.source, func.count(Lot.id).label("cnt"))
        .group_by(Lot.source)
        .order_by(func.count(Lot.id).desc())
    )).all()
    by_source = {
        (row.source.value if hasattr(row.source, "value") else str(row.source)): row.cnt
        for row in source_rows
    }

    market_rows = (await db.execute(
        select(Lot.market_type, func.count(Lot.id).label("cnt"))
        .group_by(Lot.market_type)
        .order_by(func.count(Lot.id).desc())
    )).all()
    by_market = {str(row.market_type): row.cnt for row in market_rows}

    return {
        "total": total,
        "deals": deals,
        "with_deal_score": with_score,
        "score_pct": round(with_score / total * 100, 1) if total else 0,
        "with_image": with_image,
        "image_pct": round(with_image / total * 100, 1) if total else 0,
        "by_source": by_source,
        "by_market": by_market,
        "milestones": {
            "5k": total >= 5000,
            "15k": total >= 15000,
            "30k": total >= 30000,
            "50k": total >= 50000,
        },
        "timestamp": datetime.utcnow().isoformat(),
    }


# ── Pipeline diagnostic ───────────────────────────────────────────────────────

@router.get("/debug-pipeline", dependencies=[Depends(verify_admin)])
async def debug_pipeline(db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    """
    Synchronous diagnostic: runs each connector with limit=10 and reports
    what was fetched, what passed quality filter, and how many are new vs existing.
    Takes ~60s. Use to diagnose why lot count isn't growing.
    """
    import os, traceback
    from app.jobs.quality_filter import filter_and_deduplicate

    results = {}

    # 1. ArtMarket API
    try:
        from app.connectors.artmarketapi_connector import ArtMarketAPIConnector
        amapi = ArtMarketAPIConnector()
        lots = await amapi.fetch_lots(limit=10)
        filtered, stats = filter_and_deduplicate(lots)
        results["artmarketapi"] = {"fetched": len(lots), "after_filter": len(filtered), "filter_stats": stats, "error": None}
    except Exception as e:
        results["artmarketapi"] = {"fetched": 0, "error": str(e)[:200]}

    # 2. Phillips
    try:
        from app.connectors.phillips_connector import fetch_lots as ph_fetch
        lots = await ph_fetch(10)
        filtered, stats = filter_and_deduplicate(lots)
        results["phillips"] = {"fetched": len(lots), "after_filter": len(filtered), "filter_stats": stats, "error": None}
    except Exception as e:
        results["phillips"] = {"fetched": 0, "error": str(e)[:200]}

    # 3. Artsy
    try:
        from app.connectors.artsy_connector import fetch_lots as artsy_fetch
        import asyncio as _aio
        lots = await _aio.wait_for(artsy_fetch(10), timeout=30)
        filtered, stats = filter_and_deduplicate(lots)
        results["artsy"] = {"fetched": len(lots), "after_filter": len(filtered), "filter_stats": stats, "error": None}
    except Exception as e:
        results["artsy"] = {"fetched": 0, "error": str(e)[:200]}

    # 4. eBay
    try:
        from app.connectors.ebay_connector import fetch_lots as ebay_fetch
        lots = await ebay_fetch(20)
        filtered, stats = filter_and_deduplicate(lots)
        results["ebay"] = {"fetched": len(lots), "after_filter": len(filtered), "filter_stats": stats, "error": None}
    except Exception as e:
        results["ebay"] = {"fetched": 0, "error": str(e)[:200]}

    # 5. Artcurial
    try:
        from app.connectors.artcurial_connector import fetch_lots as art_fetch
        lots = await art_fetch(10)
        filtered, stats = filter_and_deduplicate(lots)
        results["artcurial"] = {"fetched": len(lots), "after_filter": len(filtered), "filter_stats": stats, "error": None}
    except Exception as e:
        results["artcurial"] = {"fetched": 0, "error": str(e)[:200]}

    # 6. Bonhams
    try:
        from app.connectors.bonhams_connector import fetch_lots as bon_fetch
        lots = await bon_fetch(10)
        filtered, stats = filter_and_deduplicate(lots)
        results["bonhams"] = {"fetched": len(lots), "after_filter": len(filtered), "filter_stats": stats, "error": None}
    except Exception as e:
        results["bonhams"] = {"fetched": 0, "error": str(e)[:200]}

    # 7. Drouot (ScraperAPI)
    try:
        from app.connectors.drouot_scraperapi_connector import fetch_lots as drouot_fetch
        import asyncio as _aio
        lots = await _aio.wait_for(drouot_fetch(10), timeout=90)
        filtered, stats = filter_and_deduplicate(lots)
        results["drouot_scraperapi"] = {"fetched": len(lots), "after_filter": len(filtered), "filter_stats": stats, "error": None}
    except Exception as e:
        results["drouot_scraperapi"] = {"fetched": 0, "error": str(e)[:200]}

    # 8. LiveAuctioneers
    try:
        from app.connectors.liveauctioneers_connector import fetch_lots as la_fetch
        import asyncio as _aio
        lots = await _aio.wait_for(la_fetch(20), timeout=60)
        filtered, stats = filter_and_deduplicate(lots)
        results["liveauctioneers"] = {"fetched": len(lots), "after_filter": len(filtered), "filter_stats": stats, "error": None}
    except Exception as e:
        results["liveauctioneers"] = {"fetched": 0, "error": str(e)[:200]}

    # 8. Catawiki
    try:
        from app.connectors.catawiki_connector import fetch_lots as cata_fetch
        import asyncio as _aio
        lots = await _aio.wait_for(cata_fetch(10), timeout=60)
        filtered, stats = filter_and_deduplicate(lots)
        results["catawiki"] = {"fetched": len(lots), "after_filter": len(filtered), "filter_stats": stats, "error": None}
    except Exception as e:
        results["catawiki"] = {"fetched": 0, "error": str(e)[:200]}

    # Check env vars
    env_check = {
        "ART_MARKET_API_KEY": bool(os.getenv("ART_MARKET_API_KEY")),
        "EBAY_CLIENT_ID": bool(os.getenv("EBAY_CLIENT_ID")),
        "EBAY_CLIENT_SECRET": bool(os.getenv("EBAY_CLIENT_SECRET")),
        "APIFY_API_TOKEN": bool(os.getenv("APIFY_API_TOKEN")),
        "SCRAPERAPI_KEY": bool(os.getenv("SCRAPERAPI_KEY")),
    }

    # DB dedup check — how many of the total existing lots would block new inserts
    total_in_db = (await db.execute(select(func.count(Lot.id)))).scalar() or 0

    return {
        "connectors": results,
        "env_vars": env_check,
        "total_in_db": total_in_db,
        "generated_at": datetime.utcnow().isoformat(),
    }


# ── Force test insert ─────────────────────────────────────────────────────────

@router.post("/test-insert", dependencies=[Depends(verify_admin)])
async def test_insert(db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    """
    Insert 3 guaranteed-new test lots to confirm the INSERT pipeline works.
    Uses UUID-based external_ids so they're always new.
    Returns before/after counts.
    """
    import uuid as _uuid
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    from app.models.db_models import Lot as LotModel, LotStatus, AuctionHouse

    before = (await db.execute(select(func.count(LotModel.id)))).scalar() or 0

    inserted = 0
    for i in range(3):
        test_id = f"test-{_uuid.uuid4()}"
        try:
            stmt = pg_insert(LotModel).values(
                id=_uuid.uuid4(),
                external_id=test_id,
                source=AuctionHouse.OTHER,
                title=f"Test Lot {i+1} — pipeline check",
                estimate_low=1000.0,
                estimate_high=2000.0,
                current_price=1000.0,
                currency="EUR",
                auction_house_name="Test Pipeline",
                status=LotStatus.UPCOMING,
                deal_score=50.0,
                is_deal=False,
                category="Paintings",
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            ).on_conflict_do_nothing()
            await db.execute(stmt)
            inserted += 1
        except Exception as e:
            return {"error": str(e), "before": before, "inserted": 0}

    await db.commit()
    after = (await db.execute(select(func.count(LotModel.id)))).scalar() or 0

    # Cleanup — remove the test lots
    from sqlalchemy import delete as sa_delete
    await db.execute(sa_delete(LotModel).where(LotModel.auction_house_name == "Test Pipeline"))
    await db.commit()

    final = (await db.execute(select(func.count(LotModel.id)))).scalar() or 0

    return {
        "pipeline_works": after == before + 3,
        "before": before,
        "after_insert": after,
        "after_cleanup": final,
        "inserted": inserted,
        "message": "INSERT pipeline is working correctly" if after == before + 3 else "INSERT FAILED — pipeline is broken",
    }


@router.get("/check-enum", dependencies=[Depends(verify_admin)])
async def check_enum(db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    """Check which enum values exist in PostgreSQL for auctionhouse type."""
    from sqlalchemy import text
    import uuid as _uuid
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    from app.models.db_models import Lot as LotModel, LotStatus, AuctionHouse

    # Read current enum values from pg_enum
    result = await db.execute(text(
        "SELECT enumlabel FROM pg_enum WHERE enumtypid = 'auctionhouse'::regtype ORDER BY enumsortorder"
    ))
    pg_values = [row[0] for row in result.fetchall()]

    # Try inserting a lot with source=liveauctioneers to test if enum is usable
    test_id = f"enumtest-{_uuid.uuid4()}"
    insert_ok = False
    insert_error = None
    try:
        stmt = pg_insert(LotModel).values(
            id=_uuid.uuid4(),
            external_id=test_id,
            source=AuctionHouse.LIVEAUCTIONEERS,
            title="Enum test lot",
            currency="USD",
            auction_house_name="EnumTest",
            status=LotStatus.UPCOMING,
            deal_score=50.0,
            is_deal=False,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        ).on_conflict_do_nothing()
        await db.execute(stmt)
        await db.commit()
        insert_ok = True
        # Cleanup
        from sqlalchemy import delete as sa_delete
        await db.execute(sa_delete(LotModel).where(LotModel.external_id == test_id))
        await db.commit()
    except Exception as e:
        insert_error = str(e)
        await db.rollback()

    return {
        "auctionhouse_enum_values_in_pg": pg_values,
        "liveauctioneers_in_pg": "liveauctioneers" in pg_values,
        "artsy_in_pg": "artsy" in pg_values,
        "catawiki_in_pg": "catawiki" in pg_values,
        "artcurial_in_pg": "artcurial" in pg_values,
        "test_insert_liveauctioneers": insert_ok,
        "test_insert_error": insert_error,
    }


@router.post("/ingest-connector/{connector}", dependencies=[Depends(verify_admin)])
async def ingest_connector(connector: str, db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    """
    Fetch from a single connector, run quality filter, and insert into DB.
    Returns how many lots were inserted.
    """
    import asyncio as _asyncio
    import uuid as _uuid
    import hashlib
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    from app.models.db_models import Lot as LotModel, LotStatus, AuctionHouse
    from app.jobs.quality_filter import filter_and_deduplicate

    connector_map = {
        "liveauctioneers": ("app.connectors.liveauctioneers_connector", "fetch_lots", 100),
        "artcurial":       ("app.connectors.artcurial_connector",        "fetch_lots", 100),
        "catawiki":        ("app.connectors.catawiki_connector",         "fetch_lots", 50),
        "artsy":           ("app.connectors.artsy_connector",            "fetch_lots", 50),
    }
    if connector not in connector_map:
        raise HTTPException(status_code=400, detail=f"Unknown. Use: {list(connector_map)}")

    mod_path, fn_name, limit = connector_map[connector]
    try:
        import importlib
        mod = importlib.import_module(mod_path)
        fn = getattr(mod, fn_name)
        lots = await _asyncio.wait_for(fn(limit), timeout=90)
        passed, stats = filter_and_deduplicate(lots)
    except Exception as e:
        return {"connector": connector, "error": f"Fetch failed: {e}", "fetched": 0}

    before = (await db.execute(select(func.count(LotModel.id)))).scalar() or 0
    inserted = 0
    errors = []
    for lot in passed:
        try:
            _fp = hashlib.md5(f"{(lot.title or '').lower()}|{round(lot.estimate_low or 0)}".encode()).hexdigest()
            stmt = pg_insert(LotModel).values(
                id=_uuid.uuid4(),
                external_id=lot.external_id,
                source=lot.source,
                title=lot.title,
                estimate_low=lot.estimate_low,
                estimate_high=lot.estimate_high,
                current_price=lot.current_price,
                currency=lot.currency or "USD",
                auction_date=lot.auction_date,
                auction_house_name=lot.auction_house_name or connector,
                status=LotStatus.UPCOMING,
                market_type=lot.market_type or "AUCTION",
                is_buy_now=False,
                deal_score=50.0,
                is_deal=False,
                image_url=lot.image_url,
                url=lot.url,
                lot_fingerprint=_fp,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            ).on_conflict_do_nothing()
            await db.execute(stmt)
            inserted += 1
        except Exception as e:
            errors.append(str(e)[:100])
    await db.commit()
    after = (await db.execute(select(func.count(LotModel.id)))).scalar() or 0

    return {
        "connector": connector,
        "fetched": len(lots),
        "passed_filter": len(passed),
        "filter_stats": stats,
        "attempted_inserts": inserted,
        "actually_inserted": after - before,
        "errors": errors[:5],
    }


@router.get("/test-connector/{connector}", dependencies=[Depends(verify_admin)])
async def test_connector(connector: str) -> Dict[str, Any]:
    """
    Run a single connector and report how many lots it returns.
    connector: liveauctioneers | artsy | artcurial | catawiki | phillips | drouot
    """
    import asyncio as _asyncio

    connector_map = {
        "liveauctioneers": ("app.connectors.liveauctioneers_connector", "fetch_lots", 50),
        "artsy":           ("app.connectors.artsy_connector",            "fetch_lots", 50),
        "artcurial":       ("app.connectors.artcurial_connector",        "fetch_lots", 50),
        "catawiki":        ("app.connectors.catawiki_connector",         "fetch_lots", 20),
        "phillips":        ("app.connectors.phillips_connector",          "fetch_lots", 20),
    }
    if connector not in connector_map:
        raise HTTPException(status_code=400, detail=f"Unknown connector. Use: {list(connector_map)}")

    mod_path, fn_name, limit = connector_map[connector]
    try:
        import importlib
        from app.jobs.quality_filter import filter_and_deduplicate
        mod = importlib.import_module(mod_path)
        fn = getattr(mod, fn_name)
        lots = await _asyncio.wait_for(fn(limit), timeout=60)
        passed, _stats = filter_and_deduplicate(lots)
        sample = [{"id": l.external_id, "title": (l.title or "")[:60], "source": str(l.source)} for l in passed[:5]]
        return {
            "connector": connector,
            "fetched": len(lots),
            "passed_quality_filter": len(passed),
            "filter_stats": _stats,
            "sample": sample,
        }
    except Exception as e:
        return {"connector": connector, "error": str(e), "fetched": 0}


# ── Bulk ingest trigger ────────────────────────────────────────────────────────

@router.post("/bulk-ingest", dependencies=[Depends(verify_admin)])
async def bulk_ingest(body: dict = None) -> Dict[str, Any]:
    """
    Trigger a full bulk ingest from all enabled connectors.
    Runs _poll_and_score_async in the background with expanded limits.
    body: { "limit_per_source": 5000 }
    """
    import asyncio as _asyncio

    limit_per_source = int((body or {}).get("limit_per_source", 5000))
    skip_purge = bool((body or {}).get("skip_purge", True))  # default: don't purge during bulk ingest

    async def _run():
        try:
            from app.jobs.tasks import _poll_and_score_async
            await _poll_and_score_async(
                lots_per_source=limit_per_source,
                skip_purge=skip_purge,
                skip_rationale=True,  # never generate per-lot rationales during bulk ingest
            )
            logger.info("bulk_ingest_complete", limit_per_source=limit_per_source)
        except Exception as e:
            logger.error("bulk_ingest_failed", error=str(e))

    _asyncio.create_task(_run())

    return {
        "status": "started",
        "limit_per_source": limit_per_source,
        "skip_purge": skip_purge,
        "message": "Bulk ingest running in background. Poll GET /api/admin/lot-count to monitor progress.",
    }


@router.get("/historical-ingest/status", dependencies=[Depends(verify_admin)])
async def historical_ingest_status() -> Dict[str, Any]:
    """Return the status of the last historical ingest run."""
    return dict(_historical_status)


@router.post("/historical-ingest", dependencies=[Depends(verify_admin)])
async def historical_ingest(body: dict = None) -> Dict[str, Any]:
    """
    Trigger historical lot ingest: ArtMarket API (24 months back) + Invaluable past lots.
    These are NOT in the regular 2x/day cycle — run this once to bulk-populate the DB.
    body: { "limit_per_source": 5000, "months_back": 24 }
    """
    import asyncio as _asyncio

    if _historical_status.get("running"):
        return {"status": "already_running", "started_at": _historical_status["started_at"]}

    limit_per_source = int((body or {}).get("limit_per_source", 5000))
    months_back = int((body or {}).get("months_back", 24))

    async def _run_historical():
        from app.models.schemas import LotNormalized

        _historical_status.update({
            "running": True,
            "started_at": datetime.utcnow().isoformat(),
            "finished_at": None,
            "lots_fetched": 0,
            "lots_inserted": 0,
            "error": None,
            "months_back": months_back,
        })
        _log.info("historical_ingest_start", extra={"limit": limit_per_source, "months_back": months_back})

        try:
            all_lots: list[LotNormalized] = []
            seen_ids: set = set()

            # ArtMarket API — historical sold lots
            try:
                from app.connectors.artmarketapi_connector import ArtMarketAPIConnector
                amapi = ArtMarketAPIConnector()
                hist_lots = await _asyncio.wait_for(
                    amapi.fetch_historical_lots(limit_per_source, months_back=months_back),
                    timeout=120,
                )
                for lot in hist_lots:
                    if lot.external_id not in seen_ids:
                        seen_ids.add(lot.external_id)
                        all_lots.append(lot)
                logger.info("historical_ingest_artmarketapi", count=len(all_lots))
            except Exception as e:
                _log.error(f"historical-ingest ArtMarket API FAILED: {e}", exc_info=True)
                logger.error("historical_ingest_artmarketapi_failed", error=str(e))

            # Invaluable — past sold lots
            try:
                from app.connectors.invaluable_connector import fetch_past_lots as inv_past
                past_lots = await inv_past(limit_per_source)
                added = 0
                for lot in past_lots:
                    if lot.external_id not in seen_ids:
                        seen_ids.add(lot.external_id)
                        all_lots.append(lot)
                        added += 1
                logger.info("historical_ingest_invaluable_past", count=added)
            except Exception as e:
                _log.warning(f"historical-ingest Invaluable skipped: {e}", exc_info=True)
                logger.warning("historical_ingest_invaluable_past_skipped", error=str(e))

            _historical_status["lots_fetched"] = len(all_lots)

            if not all_lots:
                logger.info("historical_ingest_complete", inserted=0, reason="no_new_lots")
                return

            # Monkey-patch aggregator and run main pipeline
            import app.connectors.aggregator as _agg
            from app.jobs.tasks import _poll_and_score_async as _psa
            _orig = _agg.fetch_all_lots

            async def _patched_fetch(*args, **kwargs):
                return all_lots

            _agg.fetch_all_lots = _patched_fetch
            try:
                await _psa(lots_per_source=limit_per_source, skip_purge=True, skip_rationale=True)
            finally:
                _agg.fetch_all_lots = _orig

            logger.info("historical_ingest_complete", candidates=len(all_lots))

        except Exception as e:
            _log.error(f"historical-ingest FAILED: {e}", exc_info=True)
            logger.error("historical_ingest_failed", error=str(e))
            _historical_status["error"] = str(e)
        finally:
            _historical_status["running"] = False
            _historical_status["finished_at"] = datetime.utcnow().isoformat()

    _asyncio.create_task(_run_historical())

    return {
        "status": "started",
        "limit_per_source": limit_per_source,
        "months_back": months_back,
        "message": "Historical ingest running in background. Monitor via GET /api/admin/historical-ingest/status.",
    }

