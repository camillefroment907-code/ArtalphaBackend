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
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# ── schedule config ───────────────────────────────────────────
POLL_INTERVAL_S   = 15 * 60   # 15 min
RESCORE_INTERVAL_S = 60 * 60  # 60 min
RESCORE_OFFSET_S   =  5 * 60  # start rescore 5 min after first poll


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _run(coro_factory, name: str):
    """Run an async coroutine in a dedicated event loop, isolated from uvicorn's loop."""
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
    """Poll every 15 min indefinitely."""
    from app.jobs.tasks import _poll_and_score_async
    while True:
        _run(_poll_and_score_async, "poll_and_score_lots")
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


def start_beat_in_background():
    """Start all scheduler loops as daemon threads."""
    threads = [
        threading.Thread(target=_poll_loop,    daemon=True, name="sched-poll"),
        threading.Thread(target=_rescore_loop, daemon=True, name="sched-rescore"),
        threading.Thread(target=_cleanup_loop, daemon=True, name="sched-cleanup"),
    ]
    for t in threads:
        t.start()
    logger.info(f"[scheduler] {len(threads)} scheduler threads started (no Redis required)")
