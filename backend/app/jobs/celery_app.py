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
    task_soft_time_limit=600,  # 10 minutes
    task_time_limit=900,       # 15 minutes hard limit
    include=["app.jobs.tasks", "app.jobs.email_scheduler"],
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
        # Artsy + LiveAuctioneers ingest every 3 hours
        "ingest-artsy-liveauctioneers-every-3h": {
            "task": "app.jobs.tasks.ingest_artsy_liveauctioneers",
            "schedule": crontab(minute="30", hour="*/3"),
            "options": {"queue": "default"},
        },
        # ── Email Campaigns ───────────────────────────────────────────────────
        # Monday 8am: weekly brief + weekly momentum signal
        "weekly-brief-monday-8am": {
            "task": "app.jobs.email_scheduler.send_weekly_briefs",
            "schedule": crontab(minute="0", hour="8", day_of_week="1"),
            "options": {"queue": "default"},
        },
        "weekly-momentum-monday-8am": {
            "task": "app.jobs.email_scheduler.send_weekly_momentum_signals",
            "schedule": crontab(minute="10", hour="8", day_of_week="1"),
            "options": {"queue": "default"},
        },
        # 1st of month 9am: monthly reports + portfolio valuations + FO reports
        "monthly-reports-1st-9am": {
            "task": "app.jobs.email_scheduler.send_monthly_reports",
            "schedule": crontab(minute="0", hour="9", day_of_month="1"),
            "options": {"queue": "default"},
        },
        "portfolio-valuations-1st-9am": {
            "task": "app.jobs.email_scheduler.send_portfolio_valuations",
            "schedule": crontab(minute="15", hour="9", day_of_month="1"),
            "options": {"queue": "default"},
        },
        "family-office-reports-1st-9am": {
            "task": "app.jobs.email_scheduler.send_family_office_reports",
            "schedule": crontab(minute="30", hour="9", day_of_month="1"),
            "options": {"queue": "default"},
        },
        # Daily 9am: NPS + re-engagement + anniversaries + trial checks + winback
        "daily-email-checks-9am": {
            "task": "app.jobs.email_scheduler.run_daily_email_checks",
            "schedule": crontab(minute="0", hour="9"),
            "options": {"queue": "default"},
        },
        # December 1: tax reminder
        "tax-reminder-dec-1": {
            "task": "app.jobs.email_scheduler.send_tax_reminders",
            "schedule": crontab(minute="0", hour="10", day_of_month="1", month_of_year="12"),
            "options": {"queue": "default"},
        },
        # Weekly Artsper primary market enrichment — Sunday 1am UTC
        "sync-artsper-artist-data-weekly": {
            "task": "app.jobs.tasks.sync_artsper_artist_data",
            "schedule": crontab(minute="0", hour="1", day_of_week="0"),
            "options": {"queue": "default"},
        },
        # Quarterly outlook: first Monday of Jan/Apr/Jul/Oct
        "quarterly-outlook-q1": {
            "task": "app.jobs.email_scheduler.send_quarterly_outlooks",
            "schedule": crontab(minute="0", hour="9", day_of_week="1", day_of_month="1-7", month_of_year="1,4,7,10"),
            "options": {"queue": "default"},
        },
        # January 15: annual review
        "annual-review-jan-15": {
            "task": "app.jobs.email_scheduler.send_annual_reviews",
            "schedule": crontab(minute="0", hour="9", day_of_month="15", month_of_year="1"),
            "options": {"queue": "default"},
        },
        # Sunday 2am UTC: Nautilus Oracle — predictive signals for all active artists
        "oracle-weekly-sunday-2am": {
            "task": "app.jobs.tasks.compute_oracle_weekly",
            "schedule": crontab(minute="0", hour="2", day_of_week="0"),
            "options": {"queue": "scoring"},
        },
        # 1st of month 3am UTC: Poush Manifesto artist sync
        "poush-sync-monthly": {
            "task": "app.jobs.tasks.sync_poush_artists",
            "schedule": crontab(minute="0", hour="3", day_of_month="1"),
            "options": {"queue": "default"},
        },
        # Every 15 minutes: check for auction subscriptions going live soon
        "check-auction-reminders-every-15min": {
            "task": "check_auction_reminders",
            "schedule": crontab(minute="*/15"),
            "options": {"queue": "default"},
        },
        # Wednesday 10am UTC: generate weekly art market opportunities blog post
        "generate-blog-wednesday-10am": {
            "task": "generate_weekly_blog_post",
            "schedule": crontab(hour=10, minute=0, day_of_week=3),
            "options": {"queue": "default"},
        },
    },
    task_routes={
        "app.jobs.tasks.poll_and_score_lots": {"queue": "default"},
        "app.jobs.tasks.rescore_live_lots": {"queue": "scoring"},
        "app.jobs.tasks.process_pending_alerts": {"queue": "alerts"},
        "app.jobs.tasks.daily_cleanup": {"queue": "maintenance"},
        "app.jobs.tasks.compute_oracle_weekly": {"queue": "scoring"},
        "app.jobs.tasks.sync_poush_artists": {"queue": "default"},
    },
)
