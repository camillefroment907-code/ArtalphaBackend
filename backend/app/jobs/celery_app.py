"""
Celery Application + Background Tasks
"""
from celery import Celery
from celery.schedules import crontab
from app.config import get_settings

settings = get_settings()

celery_app = Celery(
    "hono",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=["app.jobs.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_soft_time_limit=300,  # 5 minutes
    task_time_limit=600,       # 10 minutes hard limit
    beat_schedule={
        # Poll all auction sources twice a day (6am and 6pm UTC)
        "poll-and-score-twice-daily": {
            "task": "app.jobs.tasks.poll_and_score_lots",
            "schedule": crontab(minute="0", hour="6,18"),
            "options": {"queue": "default"},
        },
        # Re-score existing lots every hour (prices change) — offset 5min from poll
        "rescore-live-lots-every-hour": {
            "task": "app.jobs.tasks.rescore_live_lots",
            "schedule": crontab(minute="5", hour="*/1"),
            "options": {"queue": "scoring"},
        },
        # Daily cleanup at 3am UTC
        "daily-cleanup": {
            "task": "app.jobs.tasks.daily_cleanup",
            "schedule": crontab(minute="0", hour="3"),
            "options": {"queue": "maintenance"},
        },
        # Weekly dedup every Monday at 2am UTC
        "dedup-cleanup-weekly": {
            "task": "app.jobs.tasks.dedup_cleanup",
            "schedule": crontab(minute="0", hour="2", day_of_week="1"),
            "options": {"queue": "maintenance"},
        },
    },
    task_routes={
        "app.jobs.tasks.poll_and_score_lots": {"queue": "default"},
        "app.jobs.tasks.rescore_live_lots": {"queue": "scoring"},
        "app.jobs.tasks.process_pending_alerts": {"queue": "alerts"},
        "app.jobs.tasks.daily_cleanup": {"queue": "maintenance"},
    },
)
