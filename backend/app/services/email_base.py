"""
Nautilus Email System — Base Template & Send Utility
All email modules import from here.
"""
import asyncio
import logging
from typing import Optional

import resend as resend_lib

from app.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

TRANSAC_FROM = settings.transac_from_email  # hello@get-nautilus.com
ALERT_FROM = settings.alert_from_email      # insights@get-nautilus.com
ADMIN_EMAIL = "camillefroment907@gmail.com"

_BASE_CSS = """
    body { margin: 0; padding: 0; background-color: #F5F4F0; font-family: Georgia, 'Times New Roman', serif; }
    .wrapper { max-width: 600px; margin: 0 auto; background-color: #F5F4F0; padding: 40px 20px; }
    .header { background-color: #1A2A44; padding: 28px 40px; text-align: left; }
    .header-logo { color: #C6A85A; font-family: Georgia, serif; font-size: 20px; font-weight: normal; letter-spacing: 0.12em; text-transform: uppercase; text-decoration: none; }
    .header-tagline { color: rgba(198,168,90,0.6); font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; margin-top: 4px; }
    .body { background-color: #FFFFFF; padding: 48px 40px; }
    .label { color: #C6A85A; font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; margin-bottom: 16px; }
    h1 { color: #1A2A44; font-family: Georgia, serif; font-size: 28px; font-weight: normal; line-height: 1.3; margin: 0 0 24px 0; }
    h2 { color: #1A2A44; font-family: Georgia, serif; font-size: 20px; font-weight: normal; margin: 32px 0 12px 0; }
    p { color: #444444; font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 15px; line-height: 1.7; margin: 0 0 16px 0; }
    .divider { border: none; border-top: 1px solid #E8E4DC; margin: 32px 0; }
    .cta-button { display: inline-block; background-color: #1A2A44; color: #FFFFFF !important; font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 14px; font-weight: 500; letter-spacing: 0.05em; text-decoration: none; padding: 14px 32px; border-radius: 4px; margin: 24px 0; }
    .cta-gold { background-color: #C6A85A; color: #1A2A44 !important; }
    .score-badge { display: inline-block; background-color: #1A2A44; color: #C6A85A; font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 13px; font-weight: 600; padding: 6px 16px; border-radius: 3px; letter-spacing: 0.05em; }
    .score-exceptional { background-color: #C6A85A; color: #1A2A44; }
    .lot-card { background-color: #F5F4F0; border-left: 3px solid #C6A85A; padding: 20px 24px; margin: 20px 0; }
    .lot-card .artist { color: #1A2A44; font-family: Georgia, serif; font-size: 13px; letter-spacing: 0.1em; text-transform: uppercase; }
    .lot-card .title { color: #1A2A44; font-family: Georgia, serif; font-size: 18px; font-weight: normal; margin: 4px 0 8px 0; }
    .lot-card .details { color: #888888; font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 12px; }
    .lot-card .price { color: #1A2A44; font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 16px; font-weight: 600; margin-top: 12px; }
    .lot-card .upside { color: #2D7A4F; font-size: 12px; font-weight: 500; }
    .stat-row { display: flex; gap: 0; margin: 24px 0; }
    .stat-box { flex: 1; text-align: center; padding: 20px 16px; background: #F5F4F0; }
    .stat-box .number { color: #C6A85A; font-family: Georgia, serif; font-size: 28px; font-weight: normal; }
    .stat-box .label-stat { color: #888888; font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 10px; letter-spacing: 0.15em; text-transform: uppercase; margin-top: 4px; }
    .footer { padding: 32px 40px; text-align: center; }
    .footer p { color: #AAAAAA; font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11px; line-height: 1.6; }
    .footer a { color: #AAAAAA; text-decoration: underline; }
    .disclaimer { color: #CCCCCC; font-size: 10px; font-style: italic; margin-top: 16px; }
    @media (max-width: 480px) { .body { padding: 32px 24px; } h1 { font-size: 22px; } .stat-row { flex-direction: column; } }
"""


def html_email(content: str, subject: str = "Nautilus", unsubscribe_url: str = "https://www.get-nautilus.com/app/portfolio") -> str:
    """Wrap content in the full Nautilus email shell."""
    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{subject}</title>
  <style>{_BASE_CSS}</style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="header-logo">Nautilus</div>
      <div class="header-tagline">Art Market Intelligence</div>
    </div>
    <div class="body">
      {content}
    </div>
    <div class="footer">
      <p>Nautilus &middot; Art Market Intelligence<br>contact@get-nautilus.com</p>
      <p><a href="{unsubscribe_url}">Unsubscribe</a> &middot; <a href="https://www.get-nautilus.com/legal/privacy">Privacy Policy</a></p>
      <p class="disclaimer">Nautilus provides market intelligence for informational purposes only. This is not financial advice. Art investment carries risk of loss.</p>
    </div>
  </div>
</body>
</html>"""


def label(text: str) -> str:
    return f'<p class="label">{text}</p>'


def cta(text: str, url: str, gold: bool = False) -> str:
    cls = "cta-button cta-gold" if gold else "cta-button"
    return f'<a href="{url}" class="{cls}">{text}</a>'


def lot_card(artist: str, title: str, details: str, price: str, upside: str = "", score: int = 0) -> str:
    score_html = ""
    if score:
        badge_cls = "score-badge score-exceptional" if score >= 80 else "score-badge"
        score_html = f'<br><span class="{badge_cls}">{score}/100</span>'
    upside_html = f'<div class="upside">{upside}</div>' if upside else ""
    return f"""<div class="lot-card">
  <div class="artist">{artist}</div>
  <div class="title">{title}</div>
  <div class="details">{details}</div>
  <div class="price">{price}{score_html}</div>
  {upside_html}
</div>"""


def stat_row(*stats: tuple) -> str:
    """stats: list of (number, label) tuples"""
    boxes = "".join(
        f'<div class="stat-box"><div class="number">{n}</div><div class="label-stat">{l}</div></div>'
        for n, l in stats
    )
    return f'<div class="stat-row">{boxes}</div>'


def divider() -> str:
    return '<hr class="divider">'


def hero_artwork(image_url: str, artist: str, title: str, alt: str = "") -> str:
    """Full-width artwork hero image block above the fold."""
    alt_text = alt or f"{artist} — {title}"
    return f"""<div style="margin: -48px -40px 32px; overflow: hidden; max-height: 260px;">
  <img src="{image_url}" alt="{alt_text}" style="width: 100%; height: 260px; object-fit: cover; display: block;" />
  <div style="background: #1A2A44; padding: 10px 24px; display: flex; justify-content: space-between; align-items: center;">
    <span style="color: rgba(198,168,90,0.85); font-family: Georgia, serif; font-size: 12px; letter-spacing: 0.08em;">{artist}</span>
    <span style="color: rgba(255,255,255,0.35); font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase;">{title}</span>
  </div>
</div>"""


def decision_block(verdict: str, score: int, rationale: str) -> str:
    """Conviction verdict block: STRONG BUY / HOLD / AVOID with score and rationale."""
    colors = {
        "STRONG BUY": ("#C6A85A", "#1A2A44"),
        "BUY": ("#2563EB", "#FFFFFF"),
        "HOLD": ("#6B7280", "#FFFFFF"),
        "AVOID": ("#EF4444", "#FFFFFF"),
    }
    bg, fg = colors.get(verdict.upper(), ("#1A2A44", "#FFFFFF"))
    badge_cls = "score-badge score-exceptional" if score >= 80 else "score-badge"
    return f"""<div style="border: 1px solid #E8E4DC; border-radius: 6px; overflow: hidden; margin: 24px 0;">
  <div style="background: {bg}; padding: 14px 20px; display: flex; align-items: center; justify-content: space-between;">
    <span style="color: {fg}; font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 13px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;">◆ {verdict.upper()}</span>
    <span class="{badge_cls}">{score}/100</span>
  </div>
  <div style="padding: 16px 20px; background: #FAFAF8;">
    <p style="margin: 0; font-size: 13px; color: #444444; line-height: 1.7;">{rationale}</p>
  </div>
</div>"""


def urgency_block(closes_in: str, auction_house: str, auction_date: str) -> str:
    """Urgency/countdown block shown when a lot closes soon."""
    return f"""<div style="background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.25); border-radius: 6px; padding: 14px 20px; margin: 20px 0; display: flex; align-items: center; gap: 14px;">
  <div style="font-size: 20px;">⏰</div>
  <div>
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 13px; font-weight: 700; color: #EF4444; letter-spacing: 0.04em;">Closes in {closes_in}</div>
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11px; color: #888888; margin-top: 2px;">{auction_house} · {auction_date}</div>
  </div>
</div>"""


def _configured() -> bool:
    if not settings.resend_api_key:
        logger.warning("RESEND_API_KEY not configured — emails disabled")
        return False
    resend_lib.api_key = settings.resend_api_key
    return True


def _send_sync(to_email: str, subject: str, html: str, from_email: str) -> bool:
    if not _configured():
        return False
    try:
        resend_lib.Emails.send({
            "from": from_email,
            "to": [to_email],
            "subject": subject,
            "html": html,
        })
        logger.info("email_sent to=%s subject=%s", to_email, subject)
        return True
    except Exception as exc:
        logger.error("email_send_failed to=%s error=%s", to_email, exc)
        return False


async def send_email(to_email: str, subject: str, html: str, from_email: Optional[str] = None) -> bool:
    from_addr = from_email or TRANSAC_FROM
    return await asyncio.to_thread(_send_sync, to_email, subject, html, from_addr)


async def send_admin_notification(subject: str, html: str) -> bool:
    return await send_email(ADMIN_EMAIL, subject, html, TRANSAC_FROM)
