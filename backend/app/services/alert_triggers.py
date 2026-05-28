"""
Nautilus Alert Triggers — wires real pipeline events to email functions.

All public functions are fire-and-forget: exceptions are caught, logged
as warnings, and never propagate to the caller.

Dedup strategy: use Alert.message prefix to distinguish event types
so (user, lot, EXCEPTIONAL) and (user, lot, CLOSING) are tracked separately
without a schema change.
"""
import base64
import logging
import uuid as _uuid
from datetime import datetime, timedelta
from typing import Optional

logger = logging.getLogger(__name__)


async def _resolve_lot_image(image_url: Optional[str], lot_url: Optional[str]) -> Optional[str]:
    """Return a usable image URL: stored image_url if set, else og:image scraped from lot page."""
    if image_url:
        return image_url
    if not lot_url:
        return None
    try:
        import httpx, re
        headers = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"}
        async with httpx.AsyncClient() as client:
            r = await client.get(lot_url, headers=headers, follow_redirects=True, timeout=10)
        if r.status_code == 200:
            # Try both attribute orders for og:image
            m = re.search(r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']', r.text)
            if not m:
                m = re.search(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']', r.text)
            if m:
                return m.group(1)
    except Exception as e:
        logger.debug("og_image_fetch_failed url=%s error=%s", lot_url, e)
    return None


# Signals that represent an improving market outlook
_IMPROVING_SIGNALS = {"BUY_NOW", "WATCH"}


# ── Dedup helpers ─────────────────────────────────────────────────────────────

async def _already_sent(db, user_id, lot_id, prefix: str) -> bool:
    """Return True if an alert of this type was already sent for this user+lot."""
    from sqlalchemy import select
    from app.models.db_models import Alert
    result = await db.execute(
        select(Alert.id).where(
            Alert.user_id == user_id,
            Alert.lot_id == lot_id,
            Alert.message.like(f"{prefix}_%"),
        )
    )
    return result.scalar_one_or_none() is not None


async def _already_sent_artist(db, user_id, artist_id: str, cutoff: datetime) -> bool:
    """Return True if a momentum alert was already sent for this user+artist within the cutoff."""
    from sqlalchemy import select, and_
    from app.models.db_models import Alert
    result = await db.execute(
        select(Alert.id).where(
            and_(
                Alert.user_id == user_id,
                Alert.lot_id.is_(None),
                Alert.message.like(f"MOMENTUM_{artist_id}_%"),
                Alert.sent_at >= cutoff,
            )
        )
    )
    return result.scalar_one_or_none() is not None


async def _record_alert(db, user_id, lot_id, prefix: str, score: float, recipient: str) -> None:
    """Insert an Alert row for dedup tracking."""
    from app.models.db_models import Alert, AlertChannel
    db.add(Alert(
        id=_uuid.uuid4(),
        user_id=user_id,
        lot_id=lot_id,
        channel=AlertChannel.EMAIL,
        recipient=recipient,
        message=f"{prefix}_sent",
        deal_score_at_send=score or None,
        is_delivered=True,
    ))


# ── Daily rate-limit (1 alert email per user per calendar day UTC) ────────────

async def _daily_limit_ok(db, user_id) -> bool:
    """Return True if this user has NOT received an alert email today (UTC)."""
    from sqlalchemy import select
    from app.models.db_models import UserAlertPreferences
    result = await db.execute(
        select(UserAlertPreferences.last_alert_sent_at)
        .where(UserAlertPreferences.user_id == user_id)
    )
    last = result.scalar_one_or_none()
    if last is None:
        return True
    return last.date() < datetime.utcnow().date()


async def _mark_daily_limit(db, user_id) -> None:
    """Upsert last_alert_sent_at = now.
    INSERT if no UserAlertPreferences row exists yet, UPDATE otherwise.
    """
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    from app.models.db_models import UserAlertPreferences
    now = datetime.utcnow()
    await db.execute(
        pg_insert(UserAlertPreferences)
        .values(id=_uuid.uuid4(), user_id=user_id, last_alert_sent_at=now)
        .on_conflict_do_update(
            index_elements=["user_id"],
            set_={"last_alert_sent_at": now},
        )
    )


# ── Trigger 1: Exceptional opportunity (deal_score >= 80) ─────────────────────

async def send_exceptional_opportunity_alerts(lot_ids: list) -> int:
    """
    Called from the ingestion pipeline after each batch commit.
    Sends send_alert_exceptional_email to every user whose
    alert preferences include exceptional_opportunity=True.

    Dedup: one email per (user, lot) marked EXCEPTIONAL.
    """
    if not lot_ids:
        return 0

    from sqlalchemy import select, and_
    from sqlalchemy.orm import selectinload
    from app.models.db_models import (
        Lot, User, UserAlertPreferences, LotStatus,
    )
    from app.services.email_alerts import send_alert_exceptional_email
    from app.database import BgSessionLocal

    sent = 0
    try:
        async with BgSessionLocal() as db:
            lots_result = await db.execute(
                select(Lot)
                .options(selectinload(Lot.artist))
                .where(
                    and_(
                        Lot.id.in_(lot_ids),
                        Lot.deal_score >= 80,
                        Lot.status == LotStatus.upcoming,
                    )
                )
            )
            lots = lots_result.scalars().all()
            if not lots:
                return 0

            # Users who opted into exceptional_opportunity alerts
            users_result = await db.execute(
                select(User, UserAlertPreferences)
                .join(UserAlertPreferences, User.id == UserAlertPreferences.user_id)
                .where(
                    and_(
                        User.is_active == True,
                        UserAlertPreferences.email_notifications == True,
                        UserAlertPreferences.exceptional_opportunity == True,
                    )
                )
            )
            user_rows = users_result.all()
            if not user_rows:
                return 0

            for lot in lots:
                artist_name = (
                    (lot.artist.name if lot.artist else None)
                    or lot.artist_name_raw
                    or "Unknown Artist"
                )
                score = int(lot.deal_score or 0)
                est_low = lot.estimate_low or 0
                est_high = lot.estimate_high or 0
                estimate_range = f"€{est_low:,.0f} – €{est_high:,.0f}"
                upside = int(lot.pct_below_low_estimate or 0)
                sale_date = (
                    lot.auction_date.strftime("%-d %b %Y")
                    if lot.auction_date else "TBD"
                )
                days_left = (
                    max(0, (lot.auction_date - datetime.utcnow()).days)
                    if lot.auction_date else 0
                )
                lot_url = f"https://www.get-nautilus.com/app/opportunities/{lot.id}"

                for user, _prefs in user_rows:
                    try:
                        if await _already_sent(db, user.id, lot.id, "EXCEPTIONAL"):
                            continue
                        if not await _daily_limit_ok(db, user.id):
                            logger.debug("daily_limit_hit user=%s", user.email)
                            continue
                        lot_image_url = await _resolve_lot_image(lot.image_url, lot.url)
                        ok = await send_alert_exceptional_email(
                            to_email=user.email,
                            artist_name=artist_name,
                            score=score,
                            auction_house=lot.auction_house_name or "",
                            lot_title=lot.title or "Untitled",
                            sale_date=sale_date,
                            location="",
                            estimate_range=estimate_range,
                            upside_pct=upside,
                            lot_url=lot_url,
                            days_until_close=days_left,
                            lot_image_url=lot_image_url,
                        )
                        if ok:
                            await _record_alert(db, user.id, lot.id, "EXCEPTIONAL", lot.deal_score, user.email)
                            await _mark_daily_limit(db, user.id)
                            sent += 1
                    except Exception as e:
                        logger.warning("exceptional_alert_failed user=%s lot=%s error=%s", user.email, lot.id, e)

            await db.commit()
    except Exception as e:
        logger.warning("send_exceptional_opportunity_alerts failed error=%s", e)

    logger.info("exceptional_opportunity_alerts_sent count=%d", sent)
    return sent


# ── Trigger 2: Artist momentum change ─────────────────────────────────────────

async def send_artist_momentum_alerts(
    artist_id: str,
    artist_name: str,
    new_signal: str,
    prev_signal: Optional[str],
) -> int:
    """
    Called from oracle_service after a signal is recomputed.
    Sends send_weekly_momentum_email to users who follow this artist
    when the signal transitions into BUY_NOW or WATCH.

    Dedup: one alert per (user, artist) per 7 days, tracked via
    Alert.message = 'MOMENTUM_{artist_id}_sent' with lot_id=NULL.
    """
    # Only fire on a transition INTO an improving signal
    if new_signal not in _IMPROVING_SIGNALS:
        return 0
    if prev_signal in _IMPROVING_SIGNALS:
        return 0  # Signal was already strong — not a new transition

    from sqlalchemy import select, and_
    from app.models.db_models import User, UserPreference, UserAlertPreferences
    from app.services.email_alerts import send_weekly_momentum_email
    from app.database import BgSessionLocal

    sent = 0
    dedup_cutoff = datetime.utcnow() - timedelta(days=7)
    score_pct = 40 if new_signal == "BUY_NOW" else 20

    try:
        async with BgSessionLocal() as db:
            # Fetch all users who have momentum alerts on + we'll filter by artist in Python
            users_result = await db.execute(
                select(User, UserAlertPreferences, UserPreference)
                .join(UserAlertPreferences, User.id == UserAlertPreferences.user_id)
                .join(UserPreference, User.id == UserPreference.user_id)
                .where(
                    and_(
                        User.is_active == True,
                        UserAlertPreferences.email_notifications == True,
                        UserAlertPreferences.artist_momentum_change == True,
                    )
                )
            )
            all_rows = users_result.all()

            # Filter to users who follow this artist (case-insensitive partial match)
            name_lower = artist_name.lower().strip()
            eligible = [
                (user, prefs)
                for user, prefs, user_pref in all_rows
                if user_pref.favorite_artists and any(
                    name_lower in fav.lower() for fav in user_pref.favorite_artists
                )
            ]

            if not eligible:
                return 0

            for user, _prefs in eligible:
                try:
                    if await _already_sent_artist(db, user.id, artist_id, dedup_cutoff):
                        continue
                    if not await _daily_limit_ok(db, user.id):
                        logger.debug("daily_limit_hit user=%s", user.email)
                        continue
                    ok = await send_weekly_momentum_email(
                        to_email=user.email,
                        momentum_artists=[{"name": artist_name, "momentum_pct": score_pct}],
                        top_lots=[],
                    )
                    if ok:
                        await _record_alert(db, user.id, None, f"MOMENTUM_{artist_id}", 0.0, user.email)
                        await _mark_daily_limit(db, user.id)
                        sent += 1
                except Exception as e:
                    logger.warning("momentum_alert_failed user=%s artist=%s error=%s", user.email, artist_name, e)

            await db.commit()
    except Exception as e:
        logger.warning("send_artist_momentum_alerts failed error=%s", e)

    logger.info("artist_momentum_alerts_sent artist=%s new_signal=%s count=%d", artist_name, new_signal, sent)
    return sent


# ── Trigger 3: Auction closing in 24h ─────────────────────────────────────────

async def send_auction_closing_alerts() -> int:
    """
    Scheduled daily at 08:00 UTC.
    Finds UPCOMING lots whose auction_date falls within the next 22–26h window,
    then sends send_watchlist_closing_email to users who saved that lot to their
    watchlist and have auction_closing_24h=True.

    Dedup: one email per (user, lot) marked CLOSING.
    """
    from sqlalchemy import select, and_
    from app.models.db_models import (
        Lot, User, Wishlist, UserAlertPreferences, LotStatus,
    )
    from app.services.email_alerts import send_watchlist_closing_email
    from app.database import BgSessionLocal

    sent = 0
    try:
        async with BgSessionLocal() as db:
            now = datetime.utcnow()
            window_start = now + timedelta(hours=22)
            window_end = now + timedelta(hours=26)

            lots_result = await db.execute(
                select(Lot).where(
                    and_(
                        Lot.status == LotStatus.upcoming,
                        Lot.auction_date >= window_start,
                        Lot.auction_date <= window_end,
                    )
                )
            )
            lots = lots_result.scalars().all()
            if not lots:
                logger.debug("auction_closing_alerts: no lots in 24h window")
                return 0

            lot_ids = [lot.id for lot in lots]
            lot_map = {lot.id: lot for lot in lots}

            # Watchlist entries for these lots from eligible users
            rows_result = await db.execute(
                select(Wishlist, User, UserAlertPreferences)
                .join(User, Wishlist.user_id == User.id)
                .join(UserAlertPreferences, User.id == UserAlertPreferences.user_id)
                .where(
                    and_(
                        Wishlist.lot_id.in_(lot_ids),
                        User.is_active == True,
                        UserAlertPreferences.email_notifications == True,
                        UserAlertPreferences.auction_closing_24h == True,
                    )
                )
            )
            rows = rows_result.all()

            for wishlist, user, _prefs in rows:
                lot = lot_map.get(wishlist.lot_id)
                if not lot:
                    continue
                try:
                    if await _already_sent(db, user.id, lot.id, "CLOSING"):
                        continue
                    if not await _daily_limit_ok(db, user.id):
                        logger.debug("daily_limit_hit user=%s", user.email)
                        continue
                    closing_time = (
                        lot.auction_date.strftime("%-d %b %Y %H:%M UTC")
                        if lot.auction_date else "soon"
                    )
                    ok = await send_watchlist_closing_email(
                        to_email=user.email,
                        lot_title=lot.title or "Untitled",
                        artist_name=lot.artist_name_raw or "",
                        auction_house=lot.auction_house_name or "",
                        estimate=f"€{lot.estimate_low:,.0f}" if lot.estimate_low else "N/A",
                        score=int(lot.deal_score or 0),
                        closing_time=closing_time,
                        lot_url=f"https://www.get-nautilus.com/app/opportunities/{lot.id}",
                    )
                    if ok:
                        await _record_alert(db, user.id, lot.id, "CLOSING", lot.deal_score or 0, user.email)
                        await _mark_daily_limit(db, user.id)
                        sent += 1
                except Exception as e:
                    logger.warning("closing_alert_failed user=%s lot=%s error=%s", user.email, lot.id, e)

            await db.commit()
    except Exception as e:
        logger.warning("send_auction_closing_alerts failed error=%s", e)

    logger.info("auction_closing_alerts_sent count=%d", sent)
    return sent
