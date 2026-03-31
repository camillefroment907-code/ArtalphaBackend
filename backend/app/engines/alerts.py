"""
HONO Alert Engine
Sends deal alerts via Telegram and Email.
"""
import asyncio
from typing import Optional, List
from datetime import datetime
import structlog
import httpx

from app.config import get_settings
from app.models.db_models import Lot, User, UserPreference, Alert, AlertChannel

logger = structlog.get_logger()
settings = get_settings()


def _format_alert_message(
    lot: Lot,
    artist_avg_price: Optional[float] = None,
) -> str:
    """Format a deal alert message."""
    emoji = "🔥" if (lot.deal_score or 0) >= 90 else "⚡"

    title = lot.title[:60] + ("..." if len(lot.title) > 60 else "")
    artist = lot.artist_name_raw or "Unknown artist"
    source = lot.source.value.capitalize() if lot.source else "Auction"

    lines = [
        f"{emoji} DEAL DETECTED — {source}",
        f"",
        f"📌 {title}",
        f"🎨 {artist}",
    ]

    if lot.estimate_low and lot.estimate_high:
        lines.append(f"📊 Estimate: €{lot.estimate_low:,.0f} – €{lot.estimate_high:,.0f}")
    elif lot.estimate_low:
        lines.append(f"📊 Estimate: €{lot.estimate_low:,.0f}")

    if lot.current_price:
        lines.append(f"💰 Current: €{lot.current_price:,.0f}")

    if artist_avg_price:
        lines.append(f"📈 Market avg: €{artist_avg_price:,.0f}")

    if lot.pct_below_low_estimate:
        pct = abs(lot.pct_below_low_estimate)
        lines.append(f"📉 {pct:.0f}% below low estimate")

    if lot.deal_score:
        lines.append(f"")
        lines.append(f"🏆 Score: {lot.deal_score:.0f}/100")

    if lot.auction_date:
        lines.append(f"📅 Sale date: {lot.auction_date.strftime('%d %b %Y')}")

    if lot.auction_house_name:
        lines.append(f"🏛️ {lot.auction_house_name}")

    if lot.url:
        lines.append(f"")
        lines.append(f"🔗 {lot.url}")

    lines.append(f"")
    lines.append(f"— HONO | AI Auction Intelligence")

    return "\n".join(lines)


async def _send_telegram(
    chat_id: str,
    message: str,
    bot_token: Optional[str] = None,
) -> bool:
    """Send message via Telegram Bot API."""
    token = bot_token or settings.telegram_bot_token
    if not token:
        logger.warning("Telegram not configured — skipping")
        return False

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": message,
        "parse_mode": "HTML",
        "disable_web_page_preview": False,
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code == 200:
                logger.info("Telegram alert sent", chat_id=chat_id)
                return True
            else:
                logger.error(
                    "Telegram send failed",
                    status=resp.status_code,
                    body=resp.text[:200],
                )
                return False
    except Exception as e:
        logger.error("Telegram exception", error=str(e))
        return False


async def _send_email(
    to_email: str,
    subject: str,
    body: str,
) -> bool:
    """Send email via SendGrid."""
    if not settings.sendgrid_api_key:
        logger.warning("SendGrid not configured — skipping email")
        return False

    headers = {
        "Authorization": f"Bearer {settings.sendgrid_api_key}",
        "Content-Type": "application/json",
    }

    # Simple text + HTML email
    html_body = body.replace("\n", "<br>").replace("🔥", "🔥").replace("⚡", "⚡")
    html_body = f"""
    <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; 
                background: #0a0a0a; color: #f5f0e8; padding: 32px; border: 1px solid #c9a84c;">
        <div style="font-size: 11px; letter-spacing: 4px; color: #c9a84c; margin-bottom: 24px;">
            HONO — AI AUCTION INTELLIGENCE
        </div>
        <div style="white-space: pre-line; font-size: 15px; line-height: 1.6;">
            {html_body}
        </div>
        <div style="margin-top: 32px; font-size: 11px; color: #666; border-top: 1px solid #333; padding-top: 16px;">
            You are receiving this alert because you enabled deal notifications. 
            <a href="#" style="color: #c9a84c;">Manage preferences</a>
        </div>
    </div>
    """

    payload = {
        "personalizations": [{"to": [{"email": to_email}]}],
        "from": {"email": settings.alert_from_email, "name": "HONO Alerts"},
        "subject": subject,
        "content": [
            {"type": "text/plain", "value": body},
            {"type": "text/html", "value": html_body},
        ],
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                "https://api.sendgrid.com/v3/mail/send",
                headers=headers,
                json=payload,
            )
            if resp.status_code in (200, 202):
                logger.info("Email alert sent", to=to_email)
                return True
            else:
                logger.error("Email send failed", status=resp.status_code)
                return False
    except Exception as e:
        logger.error("Email exception", error=str(e))
        return False


async def send_deal_alert(
    lot: Lot,
    user: User,
    prefs: UserPreference,
    artist_avg_price: Optional[float] = None,
) -> List[Alert]:
    """
    Send deal alert to user via configured channels.
    Returns list of Alert records to be saved to DB.
    """
    if not prefs.is_alerts_enabled:
        return []

    if (lot.deal_score or 0) < prefs.min_deal_score:
        return []

    message = _format_alert_message(lot, artist_avg_price)
    subject = f"🔥 Deal Score {lot.deal_score:.0f}/100 — {lot.title[:50]}"

    sent_alerts: List[Alert] = []
    channel = prefs.alert_channel

    # ── Telegram ──────────────────────────────────────────────────────────────
    if channel in (AlertChannel.TELEGRAM, AlertChannel.BOTH):
        chat_id = prefs.telegram_chat_id or settings.telegram_chat_id
        if chat_id:
            delivered = await _send_telegram(chat_id, message)
            sent_alerts.append(Alert(
                user_id=user.id,
                lot_id=lot.id,
                channel=AlertChannel.TELEGRAM,
                recipient=chat_id,
                message=message,
                deal_score_at_send=lot.deal_score,
                sent_at=datetime.utcnow(),
                is_delivered=delivered,
            ))

    # ── Email ─────────────────────────────────────────────────────────────────
    if channel in (AlertChannel.EMAIL, AlertChannel.BOTH):
        email = prefs.alert_email or user.email
        delivered = await _send_email(email, subject, message)
        sent_alerts.append(Alert(
            user_id=user.id,
            lot_id=lot.id,
            channel=AlertChannel.EMAIL,
            recipient=email,
            message=message,
            deal_score_at_send=lot.deal_score,
            sent_at=datetime.utcnow(),
            is_delivered=delivered,
        ))

    return sent_alerts


async def broadcast_deal_to_all_eligible_users(
    lot: Lot,
    users_with_prefs: List[tuple],  # [(User, UserPreference), ...]
    artist_avg_price: Optional[float] = None,
) -> int:
    """Send alert to all users who qualify for this lot."""
    alert_count = 0
    tasks = []

    for user, prefs in users_with_prefs:
        tasks.append(send_deal_alert(lot, user, prefs, artist_avg_price))

    results = await asyncio.gather(*tasks, return_exceptions=True)

    for result in results:
        if isinstance(result, list):
            alert_count += len(result)
        elif isinstance(result, Exception):
            logger.error("Alert send error", error=str(result))

    return alert_count
