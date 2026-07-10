"""
Nautilus Email Scheduler
Celery tasks for all scheduled email campaigns.
Each task fetches the relevant users from the DB and sends the appropriate email.
"""
import asyncio
import logging
from datetime import datetime, timedelta, timezone

from app.jobs.celery_app import celery_app
from app.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()


def _get_sync_db():
    """Get a synchronous SQLAlchemy session for use inside Celery tasks."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    sync_url = settings.database_url.replace("postgresql+asyncpg://", "postgresql://")
    engine = create_engine(sync_url, pool_size=5, max_overflow=10)
    Session = sessionmaker(bind=engine)
    return Session()


def _run(coro):
    """Run an async coroutine from a synchronous Celery task."""
    return asyncio.run(coro)


# ── WEEKLY EMAILS ─────────────────────────────────────────────────────────────

@celery_app.task(name="app.jobs.email_scheduler.send_weekly_briefs")
def send_weekly_briefs():
    """Monday 8am UTC — send Weekly Intelligence Brief to all paid users."""
    from app.services.email_newsletters import send_weekly_brief_email
    from app.models.db_models import User, Subscription, AgentRecommendation, AgentAlert, Lot
    from sqlalchemy import select

    db = _get_sync_db()
    try:
        paid_statuses = ["active", "trialing"]
        stmt = (
            select(User)
            .join(User.subscription)
            .where(Subscription.status.in_(paid_statuses))
            .where(User.is_active == True)
        )
        users = db.execute(stmt).scalars().all()

        week_date = datetime.now(timezone.utc).strftime("%B %d, %Y")
        sent = 0
        for user in users:
            try:
                # Fetch top lots from active agent recommendations for this user
                recs_stmt = (
                    select(AgentRecommendation, Lot)
                    .join(Lot, AgentRecommendation.lot_id == Lot.id)
                    .join(AgentAlert, AgentRecommendation.alert_id == AgentAlert.id)
                    .where(AgentRecommendation.user_id == user.id)
                    .where(AgentAlert.is_active == True)
                    .where(AgentRecommendation.verdict.in_(["STRONG_BUY", "BUY"]))
                    .where(Lot.deal_score >= 70)
                    .order_by(Lot.deal_score.desc())
                    .limit(5)
                )
                rows = db.execute(recs_stmt).all()

                top_lots = []
                for rec, lot in rows:
                    estimate = ""
                    if lot.estimate_low and lot.estimate_high:
                        estimate = f"€{int(lot.estimate_low):,} – €{int(lot.estimate_high):,}"
                    elif lot.estimate_low:
                        estimate = f"€{int(lot.estimate_low):,}+"
                    date_str = lot.auction_date.strftime("%b %d") if lot.auction_date else ""
                    top_lots.append({
                        "artist":   lot.artist_name_raw or "",
                        "title":    lot.title or "",
                        "house":    lot.auction_house_name or "",
                        "date":     date_str,
                        "estimate": estimate,
                        "score":    int(lot.deal_score or 0),
                    })

                _run(send_weekly_brief_email(
                    to_email=user.email,
                    week_date=week_date,
                    top_lots=top_lots,
                    artists_to_watch=[],
                    market_insight="",
                    closing_lots=[],
                ))
                sent += 1
            except Exception as e:
                logger.error("weekly_brief_failed user=%s error=%s", user.email, e)
        logger.info("weekly_briefs_sent count=%d", sent)
    finally:
        db.close()


@celery_app.task(name="app.jobs.email_scheduler.send_weekly_momentum_signals")
def send_weekly_momentum_signals():
    """Monday 8am UTC — send weekly momentum signal to all active users."""
    from app.services.email_alerts import send_weekly_momentum_email
    from app.models.db_models import User
    from sqlalchemy import select

    db = _get_sync_db()
    try:
        stmt = select(User).where(User.is_active == True)
        users = db.execute(stmt).scalars().all()
    finally:
        db.close()

    sent = 0
    for user in users:
        try:
            _run(send_weekly_momentum_email(
                to_email=user.email,
                momentum_artists=[],  # TODO: fetch top momentum artists
                top_lots=[],
            ))
            sent += 1
        except Exception as e:
            logger.error("weekly_momentum_failed user=%s error=%s", user.email, e)
    logger.info("weekly_momentum_sent count=%d", sent)


# ── MONTHLY EMAILS ────────────────────────────────────────────────────────────

@celery_app.task(name="app.jobs.email_scheduler.send_monthly_reports")
def send_monthly_reports():
    """1st of month 9am UTC — monthly market report to all active users."""
    from app.services.email_newsletters import send_monthly_report_email
    from app.models.db_models import User, Subscription
    from sqlalchemy import select

    db = _get_sync_db()
    try:
        stmt = (
            select(User)
            .join(User.subscription)
            .where(Subscription.status.in_(["active", "trialing"]))
            .where(User.is_active == True)
        )
        users = db.execute(stmt).scalars().all()
    finally:
        db.close()

    now = datetime.now(timezone.utc)
    month = now.strftime("%B")
    year = str(now.year)
    sent = 0
    for user in users:
        try:
            _run(send_monthly_report_email(
                to_email=user.email,
                month=month,
                year=year,
                exceptional_lots=0,   # TODO: fetch from DB
                avg_conviction=0,
                total_lots_scanned=0,
                top_categories=[],
                notable_sales=[],
                artists_next_month=[],
            ))
            sent += 1
        except Exception as e:
            logger.error("monthly_report_failed user=%s error=%s", user.email, e)
    logger.info("monthly_reports_sent count=%d", sent)


@celery_app.task(name="app.jobs.email_scheduler.send_portfolio_valuations")
def send_portfolio_valuations():
    """1st of month 9am UTC — portfolio valuation to users with portfolio items."""
    from app.services.email_portfolio import send_portfolio_valuation_email
    from app.models.db_models import User, PortfolioItem
    from sqlalchemy import select

    db = _get_sync_db()
    try:
        stmt = (
            select(User)
            .join(PortfolioItem, PortfolioItem.user_id == User.id)
            .where(User.is_active == True)
            .distinct()
        )
        users = db.execute(stmt).scalars().all()
    finally:
        db.close()

    now = datetime.now(timezone.utc)
    month = now.strftime("%B")
    sent = 0
    for user in users:
        try:
            name = user.full_name or user.email
            _run(send_portfolio_valuation_email(
                to_email=user.email,
                name=name,
                month=month,
                total_value="—",   # TODO: compute from DB
                monthly_change_pct=0.0,
                total_return_pct=0.0,
                artists=[],
            ))
            sent += 1
        except Exception as e:
            logger.error("portfolio_valuation_failed user=%s error=%s", user.email, e)
    logger.info("portfolio_valuations_sent count=%d", sent)


@celery_app.task(name="app.jobs.email_scheduler.send_family_office_reports")
def send_family_office_reports():
    """1st of month 9am UTC — detailed report to Family Office+ plan users."""
    from app.services.email_institutional import send_family_office_report_email
    from app.models.db_models import User, Subscription
    from sqlalchemy import select

    db = _get_sync_db()
    try:
        stmt = (
            select(User)
            .join(User.subscription)
            .where(Subscription.plan.in_(["pro", "elite"]))
            .where(Subscription.status.in_(["active", "trialing"]))
            .where(User.is_active == True)
        )
        users = db.execute(stmt).scalars().all()
    finally:
        db.close()

    now = datetime.now(timezone.utc)
    month = now.strftime("%B")
    year = str(now.year)
    sent = 0
    for user in users:
        try:
            name = user.full_name or user.email
            _run(send_family_office_report_email(
                to_email=user.email,
                name=name,
                month=month,
                year=year,
                macro_context="",   # TODO: generate from AI
                categories=[],
                notable_transactions=[],
                institutional_artists=[],
                top_lots=[],
                portfolio_summary="",
                upcoming_sales=[],
            ))
            sent += 1
        except Exception as e:
            logger.error("family_office_report_failed user=%s error=%s", user.email, e)
    logger.info("family_office_reports_sent count=%d", sent)


# ── DAILY CHECK TASKS ─────────────────────────────────────────────────────────

@celery_app.task(name="app.jobs.email_scheduler.run_daily_email_checks")
def run_daily_email_checks():
    """
    Daily 9am UTC — run all time-based email checks:
    - NPS survey (J+7 after signup)
    - Re-engagement (J+14, J+30 inactive)
    - 1-year anniversary
    - Artwork anniversary
    - Trial checks (ending 48h, expired)
    - Annual subscription expiring (7 days)
    - Winback (7 days post-cancellation)
    """
    _check_j1()
    _check_nps()
    _check_reengagement()
    _check_anniversaries()
    _check_artwork_anniversaries()
    _check_trial_ending()
    _check_trial_expired()
    _check_annual_expiring()
    _check_winback()
    _check_payment_retry()
    _check_payment_dunning()


def _check_j1():
    """J+1 after signup: first analysis reminder."""
    db = _get_sync_db()
    now = datetime.utcnow()
    cutoff_min = now - timedelta(hours=25)
    cutoff_max = now - timedelta(hours=23)
    try:
        from sqlalchemy import text as _text
        users = db.execute(
            _text("SELECT id, email, full_name FROM users WHERE is_active = true AND created_at BETWEEN :cmin AND :cmax"),
            {"cmin": cutoff_min, "cmax": cutoff_max}
        ).fetchall()
        for u in users:
            try:
                from app.services.email_retention import send_j1_email
                _run(send_j1_email(u.email, u.full_name or u.email.split("@")[0]))
                logger.info("j1_email_sent user=%s", u.email)
            except Exception as e:
                logger.error("j1_email_failed user=%s error=%s", u.email, e)
    finally:
        db.close()


def _check_nps():
    from app.services.email_retention import send_nps_email
    from app.models.db_models import User
    from sqlalchemy import select

    now = datetime.now(timezone.utc)
    cutoff_min = now - timedelta(days=7, hours=1)
    cutoff_max = now - timedelta(days=7)

    db = _get_sync_db()
    try:
        stmt = select(User).where(
            User.created_at.between(cutoff_min, cutoff_max),
            User.is_active == True,
        )
        users = db.execute(stmt).scalars().all()
    finally:
        db.close()

    for user in users:
        try:
            _run(send_nps_email(user.email, user.full_name or "", str(user.id)))
        except Exception as e:
            logger.error("nps_email_failed user=%s error=%s", user.email, e)


def _check_reengagement():
    from app.services.email_retention import send_reengagement_14_email, send_reengagement_30_email
    from app.models.db_models import User
    from sqlalchemy import select

    now = datetime.now(timezone.utc)

    db = _get_sync_db()
    try:
        cutoff_14_min = now - timedelta(days=14, hours=1)
        cutoff_14_max = now - timedelta(days=14)
        stmt14 = select(User).where(
            User.updated_at.between(cutoff_14_min, cutoff_14_max),
            User.is_active == True,
        )
        users_14 = db.execute(stmt14).scalars().all()

        cutoff_30_min = now - timedelta(days=30, hours=1)
        cutoff_30_max = now - timedelta(days=30)
        stmt30 = select(User).where(
            User.updated_at.between(cutoff_30_min, cutoff_30_max),
            User.is_active == True,
        )
        users_30 = db.execute(stmt30).scalars().all()
    finally:
        db.close()

    for user in users_14:
        try:
            _run(send_reengagement_14_email(
                user.email, user.full_name or "",
                exceptional_count=0,
                artist_movement="",
                market_shift="",
                current_lots=[],
            ))
        except Exception as e:
            logger.error("reengagement_14_failed user=%s error=%s", user.email, e)

    for user in users_30:
        try:
            _run(send_reengagement_30_email(user.email, user.full_name or ""))
        except Exception as e:
            logger.error("reengagement_30_failed user=%s error=%s", user.email, e)


def _check_anniversaries():
    from app.services.email_retention import send_anniversary_email
    from app.models.db_models import User
    from sqlalchemy import select, extract

    now = datetime.now(timezone.utc)

    db = _get_sync_db()
    try:
        stmt = select(User).where(
            extract("month", User.created_at) == now.month,
            extract("day", User.created_at) == now.day,
            extract("year", User.created_at) == now.year - 1,
            User.is_active == True,
        )
        users = db.execute(stmt).scalars().all()
    finally:
        db.close()

    for user in users:
        try:
            _run(send_anniversary_email(
                user.email, user.full_name or "",
                lots_viewed=0,
                larry_queries=0,
                portfolio_change_pct=0.0,
                exceptional_count=0,
            ))
        except Exception as e:
            logger.error("anniversary_email_failed user=%s error=%s", user.email, e)


def _check_artwork_anniversaries():
    from app.services.email_portfolio import send_artwork_anniversary_email
    from app.models.db_models import PortfolioItem, User
    from sqlalchemy import select, extract

    now = datetime.now(timezone.utc)

    db = _get_sync_db()
    try:
        stmt = (
            select(PortfolioItem, User)
            .join(User, User.id == PortfolioItem.user_id)
            .where(
                extract("month", PortfolioItem.created_at) == now.month,
                extract("day", PortfolioItem.created_at) == now.day,
                extract("year", PortfolioItem.created_at) == now.year - 1,
                User.is_active == True,
            )
        )
        results = db.execute(stmt).all()
    finally:
        db.close()

    for item, user in results:
        try:
            title = getattr(item, "title", None) or "Untitled"
            artist = getattr(item, "artist_name", "") or ""
            _run(send_artwork_anniversary_email(
                user.email,
                title,
                artist,
                original_estimate="—",
                current_estimate="—",
                pct_change=0.0,
                comparable_sales_count=0,
            ))
        except Exception as e:
            logger.error("artwork_anniversary_failed user=%s error=%s", user.email, e)


def _check_trial_ending():
    from app.services.email_trial import send_trial_ending_email
    from app.models.db_models import User, Subscription, Alert, AlertChannel
    from sqlalchemy import select, cast, Date

    now = datetime.now(timezone.utc)
    in_2_days = (now + timedelta(days=2)).date()
    dedup_cutoff = now - timedelta(hours=36)

    db = _get_sync_db()
    try:
        # Users whose trial ends in ~48h — use User.trial_end (non-Stripe trials
        # don't have current_period_end set on Subscription)
        stmt = (
            select(User, Subscription)
            .join(User.subscription)
            .where(
                Subscription.status == "trialing",
                cast(User.trial_end, Date) == in_2_days,
            )
        )
        results = db.execute(stmt).all()

        # Dedup: skip users already sent this email in the last 36h
        dedup_stmt = select(Alert.user_id).where(
            Alert.message.like("TRIAL_ENDING_%"),
            Alert.sent_at >= dedup_cutoff,
        )
        already_sent = {str(uid) for uid in db.execute(dedup_stmt).scalars().all()}
    finally:
        db.close()

    for user, sub in results:
        if str(user.id) in already_sent:
            continue
        try:
            end_str = user.trial_end.strftime("%B %d, %Y") if user.trial_end else ""
            _run(send_trial_ending_email(user.email, user.full_name or "", end_str, sub.plan or "investor"))
            db2 = _get_sync_db()
            try:
                db2.add(Alert(
                    user_id=user.id,
                    lot_id=None,
                    channel=AlertChannel.EMAIL,
                    recipient=user.email,
                    message=f"TRIAL_ENDING_{user.id}",
                    deal_score_at_send=None,
                    sent_at=now,
                    is_delivered=True,
                ))
                db2.commit()
            finally:
                db2.close()
        except Exception as e:
            logger.error("trial_ending_failed user=%s error=%s", user.email, e)


def _check_trial_expired():
    """Daily — downgrade TRIALING→FREE/CANCELED in DB and send the expired email
    for users whose trial_end has passed and who never converted to a paid plan."""
    from app.services.email_trial import send_trial_expired_email
    from app.models.db_models import (
        User, Subscription, SubscriptionPlan, SubscriptionStatus, Alert, AlertChannel,
    )
    from sqlalchemy import select

    now = datetime.now(timezone.utc)
    dedup_cutoff = now - timedelta(hours=36)

    db = _get_sync_db()
    try:
        stmt = (
            select(User, Subscription)
            .join(User.subscription)
            .where(
                Subscription.status == "trialing",
                User.trial_end != None,
                User.trial_end <= now,
            )
        )
        results = db.execute(stmt).all()

        dedup_stmt = select(Alert.user_id).where(
            Alert.message.like("TRIAL_EXPIRED_%"),
            Alert.sent_at >= dedup_cutoff,
        )
        already_sent = {str(uid) for uid in db.execute(dedup_stmt).scalars().all()}
    finally:
        db.close()

    for user, sub in results:
        db2 = _get_sync_db()
        try:
            # Downgrade subscription in DB
            sub_row = db2.get(Subscription, sub.id)
            if sub_row:
                sub_row.plan = SubscriptionPlan.FREE
                sub_row.status = SubscriptionStatus.CANCELED
                db2.commit()
                logger.info("trial_expired_downgraded user=%s", user.email)

            # Send expired email once (deduped per 36h)
            if str(user.id) not in already_sent:
                _run(send_trial_expired_email(
                    user.email, user.full_name or "",
                    lang=getattr(user, "language", "fr") or "fr",
                ))
                db2.add(Alert(
                    user_id=user.id,
                    lot_id=None,
                    channel=AlertChannel.EMAIL,
                    recipient=user.email,
                    message=f"TRIAL_EXPIRED_{user.id}",
                    deal_score_at_send=None,
                    sent_at=now,
                    is_delivered=True,
                ))
                db2.commit()
        except Exception as e:
            logger.error("trial_expired_failed user=%s error=%s", user.email, e)
        finally:
            db2.close()


def _check_annual_expiring():
    from app.services.email_billing import send_annual_expiring_email
    from app.models.db_models import User, Subscription
    from sqlalchemy import select

    now = datetime.now(timezone.utc)
    cutoff_min = now + timedelta(days=6, hours=23)
    cutoff_max = now + timedelta(days=7, hours=1)

    db = _get_sync_db()
    try:
        stmt = (
            select(User, Subscription)
            .join(User.subscription)
            .where(
                Subscription.billing_interval == "year",
                Subscription.status == "active",
                Subscription.current_period_end.between(cutoff_min, cutoff_max),
            )
        )
        results = db.execute(stmt).all()
    finally:
        db.close()

    for user, sub in results:
        try:
            renewal_str = sub.current_period_end.strftime("%B %d, %Y") if sub.current_period_end else ""
            plan_label = {
                "starter": "Collector",
                "investor": "Investor",
                "pro": "Family Office",
            }.get(str(sub.plan or "").lower(), "")
            portal_url = getattr(settings, "stripe_billing_portal_url", "https://billing.stripe.com/p/login")
            _run(send_annual_expiring_email(
                user.email, user.full_name or "",
                plan_label, renewal_str, "—", portal_url,
                lang=getattr(user, 'language', 'fr'),
            ))
        except Exception as e:
            logger.error("annual_expiring_failed user=%s error=%s", user.email, e)


def _check_winback():
    from app.services.email_retention import send_winback_email
    from app.models.db_models import User, Subscription
    from sqlalchemy import select

    now = datetime.now(timezone.utc)
    cutoff_min = now - timedelta(days=7, hours=1)
    cutoff_max = now - timedelta(days=7)

    db = _get_sync_db()
    try:
        stmt = (
            select(User, Subscription)
            .join(User.subscription)
            .where(
                Subscription.status == "canceled",
                Subscription.updated_at.between(cutoff_min, cutoff_max),
            )
        )
        results = db.execute(stmt).all()
    finally:
        db.close()

    for user, sub in results:
        try:
            _run(send_winback_email(user.email, user.full_name or ""))
        except Exception as e:
            logger.error("winback_email_failed user=%s error=%s", user.email, e)


def _check_payment_retry():
    """Email 13 — send retry reminder to past_due users whose payment failed 2–4 days ago."""
    from app.services.email_billing import send_payment_retry_email
    from app.models.db_models import User, Subscription
    from sqlalchemy import select

    now = datetime.now(timezone.utc)
    cutoff_min = now - timedelta(days=4)
    cutoff_max = now - timedelta(days=2)

    db = _get_sync_db()
    try:
        stmt = (
            select(User, Subscription)
            .join(User.subscription)
            .where(
                Subscription.status == "past_due",
                User.payment_failed_at.between(cutoff_min, cutoff_max),
                User.is_active == True,
            )
        )
        results = db.execute(stmt).all()
    finally:
        db.close()

    portal_url = getattr(settings, "stripe_billing_portal_url", "https://billing.stripe.com/p/login")
    sent = 0
    for user, sub in results:
        try:
            _run(send_payment_retry_email(
                to_email=user.email,
                name=user.full_name or user.email,
                plan_name=sub.plan.value.lower() if sub.plan else "",
                stripe_billing_portal_url=portal_url,
                lang=getattr(user, "language", "fr"),
            ))
            sent += 1
        except Exception as e:
            logger.error("payment_retry_failed user=%s error=%s", user.email, e)
    logger.info("payment_retry_sent count=%d", sent)


def _check_payment_dunning():
    """Daily — downgrade to free any user whose payment has been failing for 3+ days."""
    from app.services.email_billing import send_payment_retry_email
    from app.models.db_models import User, Subscription, SubscriptionPlan, SubscriptionStatus
    from sqlalchemy import select

    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=3)

    db = _get_sync_db()
    try:
        stmt = (
            select(User, Subscription)
            .join(User.subscription)
            .where(
                User.payment_failed_at != None,
                User.payment_failed_at <= cutoff,
                Subscription.status == "past_due",
                User.is_active == True,
            )
        )
        results = db.execute(stmt).all()
    finally:
        db.close()

    portal_url = getattr(settings, "stripe_billing_portal_url", "https://billing.stripe.com/p/login")
    downgraded = 0
    for user, sub in results:
        db2 = _get_sync_db()
        try:
            # Final warning email before downgrade
            try:
                _run(send_payment_retry_email(
                    to_email=user.email,
                    name=user.full_name or user.email,
                    plan_name=sub.plan.value.lower() if sub.plan else "",
                    stripe_billing_portal_url=portal_url,
                    lang=getattr(user, "language", "fr"),
                ))
            except Exception as e:
                logger.error("payment_dunning_email_failed user=%s error=%s", user.email, e)

            # Downgrade to free
            db_sub = db2.get(Subscription, sub.id)
            if db_sub:
                db_sub.plan = SubscriptionPlan.FREE
                db_sub.status = SubscriptionStatus.CANCELED
            db_user = db2.get(User, user.id)
            if db_user:
                db_user.payment_failed_at = None
            db2.commit()
            downgraded += 1
            logger.info("payment_dunning_downgraded user=%s", user.email)
        except Exception as e:
            logger.error("payment_dunning_failed user=%s error=%s", user.email, e)
        finally:
            db2.close()
    logger.info("payment_dunning_completed count=%d", downgraded)


# ── SEASONAL/SPECIAL TASKS ────────────────────────────────────────────────────

@celery_app.task(name="app.jobs.email_scheduler.send_tax_reminders")
def send_tax_reminders():
    """December 1 — tax report reminder to all users with portfolio items."""
    from app.services.email_portfolio import send_tax_reminder_email
    from app.models.db_models import User, PortfolioItem
    from sqlalchemy import select

    db = _get_sync_db()
    try:
        stmt = (
            select(User)
            .join(PortfolioItem, PortfolioItem.user_id == User.id)
            .where(User.is_active == True)
            .distinct()
        )
        users = db.execute(stmt).scalars().all()
    finally:
        db.close()

    sent = 0
    for user in users:
        try:
            _run(send_tax_reminder_email(user.email, user.full_name or ""))
            sent += 1
        except Exception as e:
            logger.error("tax_reminder_failed user=%s error=%s", user.email, e)
    logger.info("tax_reminders_sent count=%d", sent)


@celery_app.task(name="app.jobs.email_scheduler.send_quarterly_outlooks")
def send_quarterly_outlooks():
    """First week of Jan/Apr/Jul/Oct — quarterly market outlook."""
    from app.services.email_newsletters import send_quarterly_outlook_email
    from app.models.db_models import User, Subscription
    from sqlalchemy import select

    db = _get_sync_db()
    try:
        stmt = (
            select(User)
            .join(User.subscription)
            .where(Subscription.status.in_(["active", "trialing"]))
            .where(User.is_active == True)
        )
        users = db.execute(stmt).scalars().all()
    finally:
        db.close()

    now = datetime.now(timezone.utc)
    month = now.month
    quarter = f"Q{(month - 1) // 3 + 1}"
    year = str(now.year)
    sent = 0
    for user in users:
        try:
            _run(send_quarterly_outlook_email(
                user.email,
                quarter,
                year,
                trends=[],
                categories_to_watch=[],
                upcoming_sales=[],
            ))
            sent += 1
        except Exception as e:
            logger.error("quarterly_outlook_failed user=%s error=%s", user.email, e)
    logger.info("quarterly_outlooks_sent count=%d", sent)


@celery_app.task(name="app.jobs.email_scheduler.send_annual_reviews")
def send_annual_reviews():
    """January 15 — annual art market review."""
    from app.services.email_newsletters import send_annual_review_email
    from app.models.db_models import User, Subscription
    from sqlalchemy import select

    db = _get_sync_db()
    try:
        stmt = (
            select(User)
            .join(User.subscription)
            .where(Subscription.status.in_(["active", "trialing"]))
            .where(User.is_active == True)
        )
        users = db.execute(stmt).scalars().all()
    finally:
        db.close()

    now = datetime.now(timezone.utc)
    year = str(now.year - 1)
    new_year = str(now.year)
    sent = 0
    for user in users:
        try:
            _run(send_annual_review_email(
                user.email,
                user.full_name or "",
                year=year,
                lots_scanned=0,
                exceptional_opps=0,
                top_artists=[],
                top_categories=[],
                top_5_results=[],
                user_lots_viewed=0,
                user_larry_queries=0,
                user_portfolio_change_pct=0.0,
                user_exceptional_count=0,
                new_year=new_year,
            ))
            sent += 1
        except Exception as e:
            logger.error("annual_review_failed user=%s error=%s", user.email, e)
    logger.info("annual_reviews_sent count=%d", sent)


# ── POST-AUCTION WATCHLIST ─────────────────────────────────────────────────────

def _check_post_auction_watchlist():
    """Daily 09:00 UTC — 'Did you buy this?' email for watchlist lots that ended 12–48h ago.

    Skipped if:
    - alert already sent for this (user, lot) pair
    - user already declared a purchase (DecisionArchive entry exists)
    """
    from app.services.email_alerts import send_post_auction_watchlist_email
    from app.models.db_models import (
        User, Lot, Wishlist, Alert, AlertChannel, DecisionArchive,
    )
    from sqlalchemy import select

    now = datetime.now(timezone.utc)
    window_start = now - timedelta(hours=48)
    window_end   = now - timedelta(hours=12)

    db = _get_sync_db()
    try:
        rows = db.execute(
            select(User, Lot)
            .join(Wishlist, Wishlist.lot_id == Lot.id)
            .join(User, User.id == Wishlist.user_id)
            .where(
                Lot.auction_date.between(window_start, window_end),
                User.is_active == True,
            )
        ).all()

        already_sent = {
            (str(uid), str(lid))
            for uid, lid in db.execute(
                select(Alert.user_id, Alert.lot_id).where(Alert.message.like("POST_AUCTION_%"))
            ).all()
        }

        already_purchased = {
            (str(uid), str(lid))
            for uid, lid in db.execute(
                select(DecisionArchive.user_id, DecisionArchive.lot_id)
                .where(DecisionArchive.lot_id.isnot(None))
            ).all()
        }
    finally:
        db.close()

    sent = 0
    for user, lot in rows:
        key = (str(user.id), str(lot.id))
        if key in already_sent or key in already_purchased:
            continue
        try:
            estimate = ""
            if lot.estimate_low and lot.estimate_high:
                estimate = f"€{int(lot.estimate_low):,}–€{int(lot.estimate_high):,}"
            elif lot.estimate_low:
                estimate = f"€{int(lot.estimate_low):,}+"

            lot_url = f"{settings.frontend_url}/app/lot/{lot.id}"
            lang = getattr(user, "language", "fr") or "fr"

            _run(send_post_auction_watchlist_email(
                to_email=user.email,
                lot_title=lot.title or "Lot",
                artist_name=lot.artist_name_raw or "",
                auction_house=lot.auction_house_name or "",
                estimate=estimate,
                score=int(lot.deal_score or 0),
                lot_url=lot_url,
                lang=lang,
            ))

            db2 = _get_sync_db()
            try:
                db2.add(Alert(
                    user_id=user.id,
                    lot_id=lot.id,
                    channel=AlertChannel.EMAIL,
                    recipient=user.email,
                    message=f"POST_AUCTION_{user.id}_{lot.id}",
                    deal_score_at_send=lot.deal_score,
                    sent_at=now,
                    is_delivered=True,
                ))
                db2.commit()
            finally:
                db2.close()

            sent += 1
        except Exception as e:
            logger.error("post_auction_watchlist_failed user=%s lot=%s error=%s", user.email, lot.id, e)

    logger.info("post_auction_watchlist_sent count=%d", sent)
