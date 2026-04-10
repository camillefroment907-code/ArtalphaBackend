"""
Starts Celery beat in a background thread when the FastAPI app starts.
Used when running on a single Railway service (no separate worker dyno).

Beat stores its schedule state in /tmp/celerybeat-schedule to avoid
permission issues on read-only filesystems.
"""
import threading
import logging

logger = logging.getLogger(__name__)


def start_beat_in_background():
    """Launch celery beat in a daemon thread alongside the FastAPI app."""
    def run_beat():
        try:
            from app.jobs.celery_app import celery_app
            logger.info("Starting embedded Celery beat scheduler...")
            beat = celery_app.Beat(
                loglevel="info",
                schedule="/tmp/celerybeat-schedule",
                pidfile="/tmp/celerybeat.pid",
            )
            beat.run()
        except Exception as e:
            logger.error(f"Celery beat failed: {e}")

    beat_thread = threading.Thread(target=run_beat, daemon=True, name="celery-beat")
    beat_thread.start()
    logger.info("Celery beat thread started")
