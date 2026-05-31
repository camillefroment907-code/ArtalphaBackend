"""
Direct async scheduler — no Redis/Celery broker needed.
Runs poll_and_score, rescore, and cleanup directly in background threads
using asyncio.run(), bypassing the Celery broker entirely.

Schedule:
  - poll_and_score_lots : every 15 minutes
  - rescore_live_lots   : every 60 minutes (offset 5 min)
  - daily_cleanup       : daily at 03:00 UTC
  - dedup_cleanup       : every Monday at 02:00 UTC
"""
import asyncio
import threading
import time
import logging
import httpx
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# ── schedule config ───────────────────────────────────────────
POLL_INTERVAL_S      = 12 * 60 * 60  # 12h — 2 runs per day
RESCORE_INTERVAL_S   = 60 * 60   # 60 min
RESCORE_OFFSET_S     =  5 * 60   # start rescore 5 min after first poll
RATIONALE_INTERVAL_S = 30 * 60   # 30 min
RATIONALE_OFFSET_S   = 60 * 60   # start rationale 60s after launch


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _run(coro_factory, name: str):
    """
    Run an async coroutine in a dedicated event loop, isolated from uvicorn's loop.
    Jobs use app.database.BgSessionLocal (NullPool) — no patching of AsyncSessionLocal,
    so the API connection pool is never disrupted.
    """
    try:
        logger.info(f"[scheduler] starting {name}")
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        try:
            loop.run_until_complete(coro_factory())
        finally:
            loop.close()

        logger.info(f"[scheduler] {name} complete")
    except Exception as e:
        logger.error(f"[scheduler] {name} failed: {e}", exc_info=True)


def _poll_loop():
    """Poll every 12h indefinitely — 2000 lots per source per run."""
    from app.jobs.tasks import _poll_and_score_async
    while True:
        _run(lambda: _poll_and_score_async(lots_per_source=5000, skip_rationale=True), "poll_and_score_lots")
        time.sleep(POLL_INTERVAL_S)


def _rescore_loop():
    """Rescore every 60 min, starting 5 min after launch."""
    from app.jobs.tasks import _rescore_live_async
    time.sleep(RESCORE_OFFSET_S)
    while True:
        _run(_rescore_live_async, "rescore_live_lots")
        time.sleep(RESCORE_INTERVAL_S)


def _cleanup_loop():
    """Daily cleanup at 03:00 UTC."""
    from app.jobs.tasks import _daily_cleanup_async
    while True:
        now = _utcnow()
        # seconds until next 03:00 UTC
        target = now.replace(hour=3, minute=0, second=0, microsecond=0)
        if now >= target:
            # already past 03:00 today — wait until tomorrow
            target = target.replace(day=target.day + 1)
        wait = (target - now).total_seconds()
        logger.info(f"[scheduler] daily_cleanup sleeping {wait/3600:.1f}h until 03:00 UTC")
        time.sleep(wait)
        _run(_daily_cleanup_async, "daily_cleanup")


def _rationale_loop():
    """Generate GPT rationales every 30 min, starting 60s after launch."""
    from app.jobs.tasks import _generate_rationales_async
    time.sleep(RATIONALE_OFFSET_S)
    while True:
        _run(_generate_rationales_async, "generate_rationales")
        time.sleep(RATIONALE_INTERVAL_S)


def _artist_enrichment_loop():
    """Enrich artist profiles from Artsy every 6 hours, starting 2 min after launch."""
    from app.jobs.artist_enrichment_job import run_artist_enrichment
    time.sleep(120)  # Start 2 min after launch
    while True:
        _run(lambda: run_artist_enrichment(max_artists=20), "artist_enrichment")
        time.sleep(6 * 3600)  # Every 6 hours


def _weekly_report_loop():
    """Check every hour whether it's Monday 8am UTC and fire the weekly report."""
    from app.jobs.weekly_report import maybe_send_weekly_report
    while True:
        now = datetime.now(timezone.utc)
        # Sleep until the next top of the hour
        seconds_to_next_hour = 3600 - (now.minute * 60 + now.second)
        time.sleep(seconds_to_next_hour)
        _run(maybe_send_weekly_report, "weekly_report")


def _score_validator_loop():
    """Run score validation every Monday at 10:00 UTC — after weekly report."""
    from app.jobs.score_validator import validate_past_predictions
    while True:
        now = datetime.now(timezone.utc)
        # Fire on Mondays (weekday 0) at 10:00 UTC
        if now.weekday() == 0 and now.hour == 10 and now.minute < 60:
            _run(validate_past_predictions, "score_validator")
        # Sleep until next top of the hour
        seconds_to_next_hour = 3600 - (now.minute * 60 + now.second)
        time.sleep(seconds_to_next_hour)


async def _fetch_historical_for_top_artists():
    """Fetch Artsy historical data for top artists by lot count."""
    from app.database import BgSessionLocal
    from app.scrapers.artsy_historical_scraper import fetch_artist_auction_results
    from app.scrapers.hammer_price_saver import save_hammer_prices
    from app.config import get_settings
    from sqlalchemy import text
    import asyncio as _aio

    settings = get_settings()
    artsy_token = settings.artsy_api_key  # None is fine — public API works without auth

    async with BgSessionLocal() as db:
        result = await db.execute(
            text("""
            SELECT artist_name_raw, COUNT(*) as cnt
            FROM lots
            WHERE artist_name_raw IS NOT NULL
            GROUP BY artist_name_raw
            ORDER BY cnt DESC
            LIMIT 20
            """)
        )
        top_artists = [row[0] for row in result.fetchall()]

    for artist_name in top_artists:
        try:
            async with BgSessionLocal() as db:
                existing = await db.execute(
                    text("SELECT COUNT(*) FROM hammer_prices WHERE artist_name ILIKE :name"),
                    {"name": f"%{artist_name}%"}
                )
                count = existing.scalar() or 0
                if count > 500:  # Already well-populated, skip
                    continue

            prices = await fetch_artist_auction_results(
                artist_name=artist_name,
                artsy_token=artsy_token,
                max_results=1000,
            )
            if prices:
                async with BgSessionLocal() as db:
                    await save_hammer_prices(prices, db)
                    logger.info(f"[historical] saved {len(prices)} records for {artist_name}")

            await _aio.sleep(2)

        except Exception as e:
            logger.warning("[historical] fetch error", artist=artist_name, error=str(e))
            continue


def _historical_loop():
    """Fetch historical auction data for top artists once per day at 04:00 UTC."""
    while True:
        now = datetime.now(timezone.utc)
        target = now.replace(hour=4, minute=0, second=0, microsecond=0)
        if now >= target:
            import datetime as _dt
            target = target + _dt.timedelta(days=1)
        wait = (target - now).total_seconds()
        logger.info(f"[scheduler] historical_fetch sleeping {wait/3600:.1f}h until 04:00 UTC")
        time.sleep(wait)
        _run(_fetch_historical_for_top_artists, "fetch_historical_top_artists")


def _portfolio_snapshot_loop():
    """Weekly Sunday at 20:00 UTC — snapshot every user's portfolio value + health score."""
    import datetime as _dt
    from app.jobs.portfolio_snapshot import run_portfolio_snapshots
    while True:
        now = _utcnow()
        # Next Sunday (weekday 6) at 20:00 UTC
        days_until_sunday = (6 - now.weekday()) % 7
        target = (now + _dt.timedelta(days=days_until_sunday)).replace(
            hour=20, minute=0, second=0, microsecond=0
        )
        if target <= now:
            target += _dt.timedelta(weeks=1)
        wait = (target - now).total_seconds()
        logger.info(f"[scheduler] portfolio_snapshot sleeping {wait/3600:.1f}h until Sunday 20:00 UTC")
        time.sleep(wait)
        _run(run_portfolio_snapshots, "portfolio_snapshot")


def _auction_closing_loop():
    """Daily at 08:00 UTC — send closing alerts for watchlist lots closing in ~24h."""
    import datetime as _dt
    from app.services.alert_triggers import send_auction_closing_alerts
    while True:
        now = _utcnow()
        target = now.replace(hour=8, minute=0, second=0, microsecond=0)
        if now >= target:
            target = target + _dt.timedelta(days=1)
        wait = (target - now).total_seconds()
        logger.info(f"[scheduler] auction_closing sleeping {wait/3600:.1f}h until 08:00 UTC")
        time.sleep(wait)
        _run(send_auction_closing_alerts, "auction_closing_alerts")


def _post_auction_loop():
    """Daily at 06:00 UTC — fill actual_hammer_price in score_performance."""
    import datetime as _dt
    from app.jobs.post_auction_fill import fill_post_auction_results
    from app.database import BgSessionLocal
    while True:
        now = _utcnow()
        target = now.replace(hour=6, minute=0, second=0, microsecond=0)
        if now >= target:
            target = target + _dt.timedelta(days=1)
        wait = (target - now).total_seconds()
        logger.info(f"[scheduler] post_auction_fill sleeping {wait/3600:.1f}h until 06:00 UTC")
        time.sleep(wait)
        async def _run_fill():
            async with BgSessionLocal() as db:
                return await fill_post_auction_results(db, limit=500)
        _run(_run_fill, "post_auction_fill")


def _daily_email_loop():
    """Daily at 09:00 UTC — lifecycle emails: NPS, re-engagement, trial, winback."""
    import datetime as _dt
    from app.jobs.email_scheduler import (
        _check_nps,
        _check_reengagement,
        _check_trial_ending,
        _check_trial_expired,
        _check_annual_expiring,
        _check_winback,
        _check_post_auction_watchlist,
    )
    while True:
        now = _utcnow()
        target = now.replace(hour=9, minute=0, second=0, microsecond=0)
        if now >= target:
            target = target + _dt.timedelta(days=1)
        wait = (target - now).total_seconds()
        logger.info(f"[scheduler] daily_email sleeping {wait/3600:.1f}h until 09:00 UTC")
        time.sleep(wait)
        for check_fn, name in [
            (_check_nps,                     "email_nps"),
            (_check_reengagement,            "email_reengagement"),
            (_check_trial_ending,            "email_trial_ending"),
            (_check_trial_expired,           "email_trial_expired"),
            (_check_annual_expiring,         "email_annual_expiring"),
            (_check_winback,                 "email_winback"),
            (_check_post_auction_watchlist,  "email_post_auction_watchlist"),
        ]:
            try:
                logger.info(f"[scheduler] running {name}")
                check_fn()
                logger.info(f"[scheduler] {name} complete")
            except Exception as e:
                logger.error(f"[scheduler] {name} failed: {e}", exc_info=True)


def _keep_warm_loop():
    """Ping /health every 5 minutes to prevent Railway cold starts."""
    time.sleep(60)  # Wait 1 min after launch before first ping
    while True:
        try:
            with httpx.Client(timeout=5) as client:
                client.get("http://localhost:8080/health")
        except Exception:
            pass
        time.sleep(5 * 60)  # Every 5 minutes


def start_beat_in_background():
    """Start all scheduler loops as daemon threads."""
    threads = [
        threading.Thread(target=_poll_loop,              daemon=True, name="sched-poll"),
        threading.Thread(target=_rescore_loop,           daemon=True, name="sched-rescore"),
        threading.Thread(target=_cleanup_loop,           daemon=True, name="sched-cleanup"),
        threading.Thread(target=_rationale_loop,         daemon=True, name="sched-rationale"),
        threading.Thread(target=_artist_enrichment_loop, daemon=True, name="sched-artist-enrich"),
        threading.Thread(target=_weekly_report_loop,     daemon=True, name="sched-weekly-report"),
        threading.Thread(target=_score_validator_loop,   daemon=True, name="sched-score-validator"),
        threading.Thread(target=_historical_loop,         daemon=True, name="sched-historical"),
        threading.Thread(target=_auction_closing_loop,    daemon=True, name="sched-auction-closing"),
        threading.Thread(target=_portfolio_snapshot_loop, daemon=True, name="sched-portfolio-snapshot"),
        threading.Thread(target=_post_auction_loop,        daemon=True, name="sched-post-auction"),
        threading.Thread(target=_daily_email_loop,          daemon=True, name="sched-daily-email"),
        threading.Thread(target=_keep_warm_loop,           daemon=True, name="sched-keep-warm"),
    ]
    for t in threads:
        t.start()
    logger.info(f"[scheduler] {len(threads)} scheduler threads started (no Redis required)")
