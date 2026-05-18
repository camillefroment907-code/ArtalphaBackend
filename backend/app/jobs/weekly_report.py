"""
Nautilus Weekly Report — sent every Monday 8:00 UTC.
Top 5 lots by deal score, market stats, personalised to each active user.
"""
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import BgSessionLocal
from app.models.db_models import User, Lot, LotStatus, UserPreference, Subscription, SubscriptionStatus, UserAlertPreferences

logger = logging.getLogger(__name__)

FRONTEND_URL = "https://www.get-nautilus.com"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _fmt(v: Optional[float]) -> str:
    if not v:
        return "N/A"
    if v >= 1_000_000:
        return f"€{v / 1_000_000:.1f}M"
    if v >= 1_000:
        return f"€{v / 1_000:.0f}K"
    return f"€{v:,.0f}"


def _lot_row_html(lot: Lot, lang: str = "fr") -> str:
    score = lot.deal_score or 0
    upside = lot.pct_below_low_estimate or 0
    score_color = (
        "#1A7A4A" if score >= 80
        else "#C6A85A" if score >= 65
        else "#8A95A3"
    )
    lot_url = f"{FRONTEND_URL}/app/opportunities/{lot.id}"
    label_score = "Score"
    label_upside = "Upside" if lang == "en" else "Décote"
    label_est = "Estimate" if lang == "en" else "Estimation"
    label_view = "View &rarr;" if lang == "en" else "Voir &rarr;"

    return f"""
    <tr style="border-bottom:1px solid #E8E6E1;">
      <td style="padding:14px 0;">
        <div style="font-family:'Georgia',serif;font-size:14px;font-weight:600;color:#1A2A44;margin-bottom:2px;">
          {lot.artist_name_raw or 'Unknown'}
        </div>
        <div style="font-size:12px;color:#8A95A3;font-style:italic;">
          {(lot.title or '')[:60]}{'…' if lot.title and len(lot.title) > 60 else ''}
        </div>
        <div style="font-size:11px;color:#AAAAAA;margin-top:2px;">{lot.auction_house_name or ''}</div>
      </td>
      <td style="padding:14px 8px;text-align:right;white-space:nowrap;">
        <div style="font-size:10px;color:#AAAAAA;letter-spacing:0.1em;text-transform:uppercase;font-family:Arial,sans-serif;">{label_est}</div>
        <div style="font-family:'Courier New',monospace;font-size:13px;font-weight:700;color:#1A2A44;">
          {_fmt(lot.estimate_low)}
        </div>
      </td>
      <td style="padding:14px 8px;text-align:right;white-space:nowrap;">
        <div style="font-size:10px;color:#AAAAAA;letter-spacing:0.1em;text-transform:uppercase;font-family:Arial,sans-serif;">{label_upside}</div>
        <div style="font-family:'Courier New',monospace;font-size:13px;font-weight:700;color:#C6A85A;">
          +{upside:.0f}%
        </div>
      </td>
      <td style="padding:14px 8px;text-align:right;white-space:nowrap;">
        <div style="font-size:10px;color:#AAAAAA;letter-spacing:0.1em;text-transform:uppercase;font-family:Arial,sans-serif;">{label_score}</div>
        <div style="font-family:'Courier New',monospace;font-size:13px;font-weight:700;color:{score_color};">
          {score:.0f}
        </div>
      </td>
      <td style="padding:14px 0 14px 16px;text-align:right;">
        <a href="{lot_url}"
           style="display:inline-block;padding:6px 14px;background:#1A2A44;color:white;
                  text-decoration:none;font-size:10px;font-weight:700;
                  font-family:Arial,sans-serif;letter-spacing:0.08em;border-radius:3px;">
          {label_view}
        </a>
      </td>
    </tr>"""


def _build_email_html(
    user_name: str,
    top_lots: List[Lot],
    total_live: int,
    avg_score: float,
    week_str: str,
    lang: str = "fr",
) -> str:
    first_name = user_name.split()[0] if user_name else "there"

    rows_html = "".join(_lot_row_html(lot, lang) for lot in top_lots)

    if lang == "fr":
        subject_line = f"Semaine du {week_str} — Vos 5 meilleures opportunités"
        greeting = f"Bonjour {first_name},"
        intro = (
            f"Voici vos <strong>{min(5, len(top_lots))} meilleures opportunités</strong> "
            f"de la semaine parmi <strong>{total_live} lots analysés</strong> "
            f"(score moyen : <strong>{avg_score:.0f}/100</strong>)."
        )
        table_header = ["Lot", "Estimation", "Décote", "Score", ""]
        cta_label = "VOIR TOUTES LES OPPORTUNITÉS &rarr;"
        disclaimer = (
            "Ce rapport est fourni à titre informatif uniquement et ne constitue pas "
            "un conseil en investissement. Les performances passées ne garantissent pas "
            "les résultats futurs."
        )
        unsubscribe_text = "Gérer mes alertes"
    else:
        subject_line = f"Week of {week_str} — Your top 5 opportunities"
        greeting = f"Hi {first_name},"
        intro = (
            f"Here are your <strong>top {min(5, len(top_lots))} opportunities</strong> "
            f"this week from <strong>{total_live} lots analysed</strong> "
            f"(average score: <strong>{avg_score:.0f}/100</strong>)."
        )
        table_header = ["Lot", "Estimate", "Upside", "Score", ""]
        cta_label = "VIEW ALL OPPORTUNITIES &rarr;"
        disclaimer = (
            "This report is for informational purposes only and does not constitute "
            "investment advice. Past performance does not guarantee future results."
        )
        unsubscribe_text = "Manage alerts"

    header_cells = "".join(
        f'<th style="padding:0 8px 10px {0 if i == 0 else 8}px;text-align:{"left" if i < 2 else "right"};'
        f'font-size:9px;color:#AAAAAA;letter-spacing:0.12em;text-transform:uppercase;'
        f'font-family:Arial,sans-serif;font-weight:700;">{h}</th>'
        for i, h in enumerate(table_header)
    )

    content = f"""
    <h2 style="font-family:'Georgia',serif;font-size:22px;font-weight:600;color:#1A2A44;margin:0 0 6px;">
      {greeting}
    </h2>
    <div style="width:32px;height:2px;background:#C6A85A;margin:12px 0 20px;"></div>
    <p style="font-size:14px;color:#555555;line-height:1.7;margin:0 0 24px;">
      {intro}
    </p>

    <table cellpadding="0" cellspacing="0" width="100%" style="border-top:2px solid #1A2A44;margin-bottom:24px;">
      <thead>
        <tr>{header_cells}</tr>
      </thead>
      <tbody>
        {rows_html}
      </tbody>
    </table>

    <a href="{FRONTEND_URL}/app/opportunities"
       style="display:inline-block;padding:14px 32px;background:#1A2A44;color:#FFFFFF;
              text-decoration:none;font-family:Arial,sans-serif;font-size:11px;
              font-weight:700;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:8px;">
      {cta_label}
    </a>

    <p style="font-size:10px;color:#CCCCCC;margin:24px 0 0;font-family:Arial,sans-serif;
              font-style:italic;line-height:1.6;">
      {disclaimer}
    </p>
    """

    # Minimal wrapper (reuse the style from email_service without importing to avoid circular)
    footer = (
        f"Vous recevez cet email car vous avez un compte Nautilus. "
        f"<a href='{FRONTEND_URL}/app/portfolio' style='color:#C6A85A'>{unsubscribe_text}</a>"
        if lang == "fr" else
        f"You're receiving this because you have a Nautilus account. "
        f"<a href='{FRONTEND_URL}/app/portfolio' style='color:#C6A85A'>{unsubscribe_text}</a>"
    )

    return f"""<!DOCTYPE html>
<html lang="{lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Nautilus Weekly</title>
</head>
<body style="margin:0;padding:0;background:#FAFAF8;font-family:'Georgia',serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAF8;padding:40px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid #E8E6E1;">
  <tr><td style="background-color:#FFFFFF;padding:28px 40px 24px 40px;border-top:3px solid #C6A85A;">
    <img src="https://www.get-nautilus.com/logo.png" alt="Nautilus" style="height:40px;display:block;">
    <span style="font-size:10px;color:#AAAAAA;font-family:Arial,sans-serif;
                 letter-spacing:0.12em;text-transform:uppercase;margin-left:16px;">
      Weekly Report &middot; {week_str}
    </span>
  </td></tr>
  <tr><td style="padding:40px 40px 32px;">
    {content}
  </td></tr>
  <tr><td style="padding:24px 40px;border-top:1px solid #E8E6E1;background:#F4F4F1;">
    <p style="margin:0;font-size:11px;color:#999999;font-family:Arial,sans-serif;line-height:1.6;">
      {footer}
    </p>
    <p style="margin:8px 0 0;font-size:10px;color:#CCCCCC;font-family:Arial,sans-serif;">
      &copy; 2026 Nautilus &middot; artalpha.io
    </p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>"""


# ── Core send logic ───────────────────────────────────────────────────────────

async def send_weekly_report() -> dict:
    """
    Fetch top 5 live lots by deal_score, then email every active user.
    Returns a summary dict.
    """
    import resend as resend_lib
    from app.config import get_settings
    settings = get_settings()

    if not settings.resend_api_key:
        logger.warning("[weekly_report] RESEND_API_KEY not set — skipping")
        return {"skipped": True, "reason": "no_resend_key"}

    resend_lib.api_key = settings.resend_api_key

    now = datetime.now(timezone.utc)
    week_str = now.strftime("%d %b %Y")

    async with BgSessionLocal() as db:
        # Top 5 live lots by deal score
        lots_result = await db.execute(
            select(Lot)
            .where(
                Lot.status == LotStatus.LIVE,
                Lot.deal_score.isnot(None),
            )
            .order_by(desc(Lot.deal_score))
            .limit(5)
        )
        top_lots: List[Lot] = lots_result.scalars().all()

        if not top_lots:
            logger.warning("[weekly_report] no live lots found — aborting")
            return {"skipped": True, "reason": "no_lots"}

        # Stats
        stats_result = await db.execute(
            select(func.count(Lot.id), func.avg(Lot.deal_score))
            .where(Lot.status == LotStatus.LIVE)
        )
        total_live, avg_score = stats_result.one()
        avg_score = float(avg_score or 0)

        # All active users
        users_result = await db.execute(
            select(User)
            .where(User.is_active == True)
        )
        users: List[User] = users_result.scalars().all()

        # Bulk-fetch alert preferences for dedup at send time
        prefs_result = await db.execute(
            select(UserAlertPreferences)
            .where(UserAlertPreferences.user_id.in_([u.id for u in users]))
        )
        alert_prefs_map = {
            str(p.user_id): p for p in prefs_result.scalars().all()
        }

    sent = 0
    errors = 0
    for user in users:
        pref = alert_prefs_map.get(str(user.id))
        # Users without a prefs row keep default (all True) — don't skip them
        if pref and (not pref.email_notifications or not pref.weekly_brief):
            continue
        try:
            lang = "fr"  # default; could fetch from UserPreference
            html = _build_email_html(
                user_name=user.full_name or user.email,
                top_lots=top_lots,
                total_live=total_live or 0,
                avg_score=avg_score,
                week_str=week_str,
                lang=lang,
            )
            subject = (
                f"Semaine du {week_str} — Vos 5 meilleures opportunités"
                if lang == "fr"
                else f"Week of {week_str} — Your top 5 opportunities"
            )
            import asyncio as _asyncio
            await _asyncio.to_thread(
                lambda: resend_lib.Emails.send({
                    "from": settings.transac_from_email,
                    "to": [user.email],
                    "subject": subject,
                    "html": html,
                })
            )
            sent += 1
        except Exception as e:
            logger.error("[weekly_report] failed for %s: %s", user.email, e)
            errors += 1

    logger.info("[weekly_report] sent=%d errors=%d", sent, errors)
    return {"sent": sent, "errors": errors, "lots": len(top_lots)}


async def maybe_send_weekly_report() -> None:
    """
    Called from the scheduler every hour.
    Only fires on Monday between 08:00–08:59 UTC.
    """
    now = datetime.now(timezone.utc)
    if now.weekday() != 0:   # 0 = Monday
        return
    if now.hour != 8:
        return
    logger.info("[weekly_report] Monday 8am — triggering weekly report")
    await send_weekly_report()
