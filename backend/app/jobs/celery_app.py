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
        # Poll all auction sources every 15 minutes
        "poll-all-auctions": {
            "task": "app.jobs.tasks.poll_and_score_lots",
            "schedule": crontab(minute=f"*/{settings.poll_interval_minutes}"),
            "options": {"queue": "default"},
        },
        # Re-score existing lots every hour (prices change)
        "rescore-live-lots": {
            "task": "app.jobs.tasks.rescore_live_lots",
            "schedule": crontab(minute=0),  # every hour
            "options": {"queue": "scoring"},
        },
        # Send pending alerts every 5 minutes
        "process-alerts": {
            "task": "app.jobs.tasks.process_pending_alerts",
            "schedule": crontab(minute="*/5"),
            "options": {"queue": "alerts"},
        },
        # Daily cleanup
        "daily-cleanup": {
            "task": "app.jobs.tasks.daily_cleanup",
            "schedule": crontab(hour=2, minute=0),
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
