"""
ArtAlpha Email Service — Resend v2
Bilingual FR/EN transactional + alert emails.
All public functions are async (use asyncio.to_thread internally for the
synchronous resend.Emails.send call).
"""
import asyncio
import logging
from typing import Optional

import resend as resend_lib

from app.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


# ── SDK init ──────────────────────────────────────────────────────────────────

def _configured() -> bool:
    if not settings.resend_api_key:
        logger.warning("RESEND_API_KEY not configured — emails disabled")
        return False
    resend_lib.api_key = settings.resend_api_key
    return True


# ── Base HTML wrapper ─────────────────────────────────────────────────────────

def _wrap_html(content: str, lang: str = "fr") -> str:
    footer_fr = (
        "Vous recevez cet email car vous avez un compte Nautilus. "
        "<a href='https://app.get-nautilus.com/app/portfolio' style='color:#C6A85A'>"
        "Gérer mes préférences</a>"
    )
    footer_en = (
        "You're receiving this because you have a Nautilus account. "
        "<a href='https://app.get-nautilus.com/app/portfolio' style='color:#C6A85A'>"
        "Manage preferences</a>"
    )
    footer = footer_fr if lang == "fr" else footer_en
    return f"""<!DOCTYPE html>
<html lang="{lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Nautilus</title>
</head>
<body style="margin:0;padding:0;background:#FAFAF8;font-family:'Georgia',serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAF8;padding:40px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid #E8E6E1;">

  <!-- Header -->
  <tr><td style="padding:32px 40px;border-bottom:1px solid #E8E6E1;">
    <span style="font-family:'Georgia',serif;font-size:20px;font-weight:600;color:#0A1628;letter-spacing:0.05em;">
      NAUTI<span style="color:#C6A85A">LUS</span>
    </span>
  </td></tr>

  <!-- Content -->
  <tr><td style="padding:40px 40px 32px;">
    {content}
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:24px 40px;border-top:1px solid #E8E6E1;background:#F4F4F1;">
    <p style="margin:0;font-size:11px;color:#999999;font-family:Arial,sans-serif;line-height:1.6;">
      {footer}
    </p>
    <p style="margin:8px 0 0;font-size:10px;color:#CCCCCC;font-family:Arial,sans-serif;">
      &copy; 2026 Nautilus &middot; get-nautilus.com
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>"""


# ── Low-level send ────────────────────────────────────────────────────────────

def _send_sync(to_email: str, subject: str, html: str, from_email: str) -> bool:
    """Synchronous send — called via asyncio.to_thread."""
    if not _configured():
        return False
    try:
        params: resend_lib.Emails.SendParams = {
            "from": from_email,
            "to": [to_email],
            "subject": subject,
            "html": html,
        }
        resend_lib.Emails.send(params)
        logger.info("email_sent to=%s subject=%s", to_email, subject)
        return True
    except Exception as exc:
        logger.error("email_send_failed to=%s error=%s", to_email, exc)
        return False


async def _send(to_email: str, subject: str, html: str, from_email: str) -> bool:
    return await asyncio.to_thread(_send_sync, to_email, subject, html, from_email)


async def send_admin_notification(subject: str, html: str) -> bool:
    """Send a plain notification email to the admin (camillefroment907@gmail.com)."""
    return await _send(
        to_email="camillefroment907@gmail.com",
        subject=subject,
        html=html,
        from_email=settings.transac_from_email,
    )


# ══════════════════════════════════════════════════════════════════════════════
# TRANSACTIONAL EMAILS — from: hello@artalpha.io
# ══════════════════════════════════════════════════════════════════════════════

async def send_verification_email(to_email: str, verify_url: str) -> bool:
    """Triggered after registration — user must verify email."""
    html = f"""
    <div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
      <h2 style="color: #0A1628; font-size: 24px; margin-bottom: 16px;">Welcome to Nautilus.</h2>
      <p style="color: #4A5568; font-size: 14px; line-height: 1.7; margin-bottom: 24px;">
        One click to verify your email and access your market intelligence platform.
      </p>
      <a href="{verify_url}"
         style="display: inline-block; background: #0A1628; color: white; padding: 14px 32px;
                border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 600;
                letter-spacing: 0.06em;">
        Verify my account &rarr;
      </a>
      <p style="color: #8A95A3; font-size: 11px; margin-top: 32px; font-family: monospace;">
        This link expires in 48 hours. If you didn't create a Nautilus account, ignore this email.
      </p>
      <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 32px 0;" />
      <p style="color: #C8CDD4; font-size: 10px; font-family: monospace;">
        Nautilus &mdash; Market Intelligence for Art Investment
      </p>
    </div>
    """
    return await _send(
        to_email=to_email,
        subject="Verify your Nautilus account",
        html=html,
        from_email=settings.transac_from_email,
    )


async def send_welcome_email(
    to_email: str,
    name: str,
    plan: str = "free",
    lang: str = "fr",
) -> bool:
    """Triggered on register."""
    plan_labels: dict[str, dict[str, str]] = {
        "free":     {"fr": "Gratuit",        "en": "Free"},
        "starter":  {"fr": "Collector",      "en": "Collector"},
        "investor": {"fr": "Investor",        "en": "Investor"},
        "pro":      {"fr": "Family Office",   "en": "Family Office"},
        "elite":    {"fr": "Institutional",   "en": "Institutional"},
    }
    plan_label = plan_labels.get(plan, {}).get(lang, plan)
    first_name = name.split()[0] if name else to_email.split("@")[0]

    if lang == "fr":
        subject = "Bienvenue sur ArtAlpha"
        content = f"""
        <h1 style="font-family:'Georgia',serif;font-size:28px;font-weight:600;color:#1A2A44;margin:0 0 8px;">
          Bienvenue, {first_name}
        </h1>
        <div style="width:40px;height:2px;background:#C6A85A;margin:16px 0 24px;"></div>
        <p style="font-size:15px;color:#555555;line-height:1.7;margin:0 0 20px;">
          Votre compte ArtAlpha est activé. Vous avez maintenant accès aux opportunités
          d'investissement art détectées par notre IA sur les 10 principales maisons de vente mondiales.
        </p>
        <p style="font-size:13px;color:#999999;margin:0 0 28px;">
          Plan actuel&nbsp;: <strong style="color:#1A2A44;">{plan_label}</strong>
        </p>
        <a href="https://artalpha.io/app/opportunities"
           style="display:inline-block;padding:14px 32px;background:#1A2A44;color:#FFFFFF;
                  text-decoration:none;font-family:Arial,sans-serif;font-size:12px;
                  font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">
          VOIR LES OPPORTUNITÉS &rarr;
        </a>
        <p style="font-size:12px;color:#CCCCCC;margin:24px 0 0;">
          Essai gratuit 7 jours &middot; Annulable à tout moment
        </p>
        """
    else:
        subject = "Welcome to ArtAlpha"
        content = f"""
        <h1 style="font-family:'Georgia',serif;font-size:28px;font-weight:600;color:#1A2A44;margin:0 0 8px;">
          Welcome, {first_name}
        </h1>
        <div style="width:40px;height:2px;background:#C6A85A;margin:16px 0 24px;"></div>
        <p style="font-size:15px;color:#555555;line-height:1.7;margin:0 0 20px;">
          Your ArtAlpha account is now active. You have access to AI-detected art investment
          opportunities across 10 major auction houses worldwide.
        </p>
        <p style="font-size:13px;color:#999999;margin:0 0 28px;">
          Current plan: <strong style="color:#1A2A44;">{plan_label}</strong>
        </p>
        <a href="https://artalpha.io/app/opportunities"
           style="display:inline-block;padding:14px 32px;background:#1A2A44;color:#FFFFFF;
                  text-decoration:none;font-family:Arial,sans-serif;font-size:12px;
                  font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">
          VIEW OPPORTUNITIES &rarr;
        </a>
        <p style="font-size:12px;color:#CCCCCC;margin:24px 0 0;">
          7-day free trial &middot; Cancel anytime
        </p>
        """

    return await _send(
        to_email=to_email,
        subject=subject,
        html=_wrap_html(content, lang),
        from_email=settings.transac_from_email,
    )


async def send_trial_ending_email(
    to_email: str,
    name: str,
    plan: str = "free",
    trial_end_date: str = "",
    lang: str = "fr",
) -> bool:
    """Triggered 3 days before trial ends (customer.subscription.trial_will_end)."""
    first_name = name.split()[0] if name else to_email.split("@")[0]

    if lang == "fr":
        subject = "Votre essai ArtAlpha se termine dans 3 jours"
        content = f"""
        <h1 style="font-family:'Georgia',serif;font-size:26px;font-weight:600;color:#1A2A44;margin:0 0 8px;">
          {first_name}, votre essai se termine bientôt
        </h1>
        <div style="width:40px;height:2px;background:#C6A85A;margin:16px 0 24px;"></div>
        <p style="font-size:15px;color:#555555;line-height:1.7;margin:0 0 16px;">
          Votre période d'essai gratuit expire le
          <strong style="color:#1A2A44;">{trial_end_date}</strong>.
        </p>
        <p style="font-size:15px;color:#555555;line-height:1.7;margin:0 0 28px;">
          Pour continuer à recevoir les opportunités d'investissement et les alertes en temps réel,
          votre abonnement sera automatiquement activé. Aucune action requise.
        </p>
        <a href="https://artalpha.io/app/portfolio"
           style="display:inline-block;padding:14px 32px;background:#1A2A44;color:#FFFFFF;
                  text-decoration:none;font-family:Arial,sans-serif;font-size:12px;
                  font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">
          GÉRER MON ABONNEMENT &rarr;
        </a>
        """
    else:
        subject = "Your ArtAlpha trial ends in 3 days"
        content = f"""
        <h1 style="font-family:'Georgia',serif;font-size:26px;font-weight:600;color:#1A2A44;margin:0 0 8px;">
          {first_name}, your trial is ending soon
        </h1>
        <div style="width:40px;height:2px;background:#C6A85A;margin:16px 0 24px;"></div>
        <p style="font-size:15px;color:#555555;line-height:1.7;margin:0 0 16px;">
          Your free trial expires on
          <strong style="color:#1A2A44;">{trial_end_date}</strong>.
        </p>
        <p style="font-size:15px;color:#555555;line-height:1.7;margin:0 0 28px;">
          To keep receiving investment opportunities and real-time alerts, your subscription
          will activate automatically. No action needed.
        </p>
        <a href="https://artalpha.io/app/portfolio"
           style="display:inline-block;padding:14px 32px;background:#1A2A44;color:#FFFFFF;
                  text-decoration:none;font-family:Arial,sans-serif;font-size:12px;
                  font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">
          MANAGE SUBSCRIPTION &rarr;
        </a>
        """

    return await _send(
        to_email=to_email,
        subject=subject,
        html=_wrap_html(content, lang),
        from_email=settings.transac_from_email,
    )


async def send_payment_failed_email(
    to_email: str,
    name: str,
    lang: str = "fr",
) -> bool:
    """Triggered on invoice.payment_failed."""
    first_name = name.split()[0] if name else to_email.split("@")[0]

    if lang == "fr":
        subject = "Problème de paiement — action requise"
        content = f"""
        <h1 style="font-family:'Georgia',serif;font-size:26px;font-weight:600;color:#1A2A44;margin:0 0 8px;">
          {first_name}, votre paiement a échoué
        </h1>
        <div style="width:40px;height:2px;background:#C0392B;margin:16px 0 24px;"></div>
        <p style="font-size:15px;color:#555555;line-height:1.7;margin:0 0 16px;">
          Nous n'avons pas pu débiter votre carte. Votre accès est maintenu temporairement,
          mais une action est requise pour éviter l'interruption du service.
        </p>
        <p style="font-size:15px;color:#555555;line-height:1.7;margin:0 0 28px;">
          Stripe réessaiera automatiquement dans les prochains jours. Vous pouvez également
          mettre à jour votre moyen de paiement dès maintenant.
        </p>
        <a href="https://artalpha.io/app/pricing"
           style="display:inline-block;padding:14px 32px;background:#C0392B;color:#FFFFFF;
                  text-decoration:none;font-family:Arial,sans-serif;font-size:12px;
                  font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">
          METTRE À JOUR MON PAIEMENT &rarr;
        </a>
        """
    else:
        subject = "Payment failed — action required"
        content = f"""
        <h1 style="font-family:'Georgia',serif;font-size:26px;font-weight:600;color:#1A2A44;margin:0 0 8px;">
          {first_name}, your payment failed
        </h1>
        <div style="width:40px;height:2px;background:#C0392B;margin:16px 0 24px;"></div>
        <p style="font-size:15px;color:#555555;line-height:1.7;margin:0 0 16px;">
          We couldn't charge your card. Your access is temporarily maintained, but action
          is required to avoid service interruption.
        </p>
        <p style="font-size:15px;color:#555555;line-height:1.7;margin:0 0 28px;">
          Stripe will automatically retry in the coming days. You can also update your
          payment method now.
        </p>
        <a href="https://artalpha.io/app/pricing"
           style="display:inline-block;padding:14px 32px;background:#C0392B;color:#FFFFFF;
                  text-decoration:none;font-family:Arial,sans-serif;font-size:12px;
                  font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">
          UPDATE PAYMENT METHOD &rarr;
        </a>
        """

    return await _send(
        to_email=to_email,
        subject=subject,
        html=_wrap_html(content, lang),
        from_email=settings.transac_from_email,
    )


async def send_subscription_canceled_email(
    to_email: str,
    name: str,
    end_date: str = "",
    lang: str = "fr",
) -> bool:
    """Triggered on customer.subscription.deleted."""
    first_name = name.split()[0] if name else to_email.split("@")[0]

    if lang == "fr":
        subject = "Votre abonnement ArtAlpha a été annulé"
        content = f"""
        <h1 style="font-family:'Georgia',serif;font-size:26px;font-weight:600;color:#1A2A44;margin:0 0 8px;">
          Abonnement annulé
        </h1>
        <div style="width:40px;height:2px;background:#C6A85A;margin:16px 0 24px;"></div>
        <p style="font-size:15px;color:#555555;line-height:1.7;margin:0 0 16px;">
          {first_name}, votre abonnement ArtAlpha a été annulé. Votre accès reste actif
          jusqu'au <strong style="color:#1A2A44;">{end_date}</strong>.
        </p>
        <p style="font-size:15px;color:#555555;line-height:1.7;margin:0 0 28px;">
          Vous pouvez réactiver votre abonnement à tout moment sans perdre vos données.
        </p>
        <a href="https://artalpha.io/app/pricing"
           style="display:inline-block;padding:14px 32px;background:#1A2A44;color:#FFFFFF;
                  text-decoration:none;font-family:Arial,sans-serif;font-size:12px;
                  font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">
          RÉACTIVER MON ABONNEMENT &rarr;
        </a>
        """
    else:
        subject = "Your ArtAlpha subscription has been canceled"
        content = f"""
        <h1 style="font-family:'Georgia',serif;font-size:26px;font-weight:600;color:#1A2A44;margin:0 0 8px;">
          Subscription canceled
        </h1>
        <div style="width:40px;height:2px;background:#C6A85A;margin:16px 0 24px;"></div>
        <p style="font-size:15px;color:#555555;line-height:1.7;margin:0 0 16px;">
          {first_name}, your ArtAlpha subscription has been canceled. Your access remains
          active until <strong style="color:#1A2A44;">{end_date}</strong>.
        </p>
        <p style="font-size:15px;color:#555555;line-height:1.7;margin:0 0 28px;">
          You can reactivate your subscription at any time without losing your data.
        </p>
        <a href="https://artalpha.io/app/pricing"
           style="display:inline-block;padding:14px 32px;background:#1A2A44;color:#FFFFFF;
                  text-decoration:none;font-family:Arial,sans-serif;font-size:12px;
                  font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">
          REACTIVATE SUBSCRIPTION &rarr;
        </a>
        """

    return await _send(
        to_email=to_email,
        subject=subject,
        html=_wrap_html(content, lang),
        from_email=settings.transac_from_email,
    )


# ══════════════════════════════════════════════════════════════════════════════
# DEAL ALERT EMAIL — from: alerts@artalpha.io
# ══════════════════════════════════════════════════════════════════════════════

async def send_deal_alert_email(
    to_email: str,
    lot_title: str,
    artist_name: str,
    price: float,
    estimate: float,
    deal_score: int,
    upside_pct: float,
    lot_url: str,
    lot_id: str,
    lang: str = "fr",
) -> bool:
    """Triggered by broadcast_deal_to_all_eligible_users."""

    tier = (
        "EXCEPTIONAL" if deal_score >= 80
        else "STRONG" if deal_score >= 65
        else "INTERESTING"
    )
    tier_fr = (
        "EXCEPTIONNEL" if deal_score >= 80
        else "FORT" if deal_score >= 65
        else "INTÉRESSANT"
    )
    tier_color = (
        "#C0392B" if deal_score >= 80
        else "#1A2A44" if deal_score >= 65
        else "#9E8440"
    )

    def fmt_price(v: float) -> str:
        if v >= 1_000_000:
            return f"€{v / 1_000_000:.1f}M"
        elif v >= 1_000:
            return f"€{v / 1_000:.0f}K"
        return f"€{v:,.0f}"

    artalpha_url = f"https://app.get-nautilus.com/app/opportunities/{lot_id}"

    stats_block = f"""
    <table cellpadding="0" cellspacing="0" width="100%"
           style="margin-bottom:28px;background:#F4F4F1;border-left:3px solid #1A2A44;">
      <tr>
        <td style="padding:20px;">
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding-right:32px;">
                <div style="font-size:10px;color:#999999;letter-spacing:0.12em;text-transform:uppercase;
                            font-family:Arial,sans-serif;margin-bottom:4px;">
                  {"Prix actuel" if lang == "fr" else "Current Price"}
                </div>
                <div style="font-family:'Courier New',monospace;font-size:22px;font-weight:700;color:#111111;">
                  {fmt_price(price)}
                </div>
              </td>
              <td style="padding-right:32px;">
                <div style="font-size:10px;color:#999999;letter-spacing:0.12em;text-transform:uppercase;
                            font-family:Arial,sans-serif;margin-bottom:4px;">
                  Estimation
                </div>
                <div style="font-family:'Courier New',monospace;font-size:22px;font-weight:700;color:#111111;">
                  {fmt_price(estimate)}
                </div>
              </td>
              <td style="padding-right:32px;">
                <div style="font-size:10px;color:#999999;letter-spacing:0.12em;text-transform:uppercase;
                            font-family:Arial,sans-serif;margin-bottom:4px;">
                  Upside
                </div>
                <div style="font-family:'Courier New',monospace;font-size:22px;font-weight:700;color:#C6A85A;">
                  +{upside_pct:.0f}%
                </div>
              </td>
              <td>
                <div style="font-size:10px;color:#999999;letter-spacing:0.12em;text-transform:uppercase;
                            font-family:Arial,sans-serif;margin-bottom:4px;">
                  Score
                </div>
                <div style="font-family:'Courier New',monospace;font-size:22px;font-weight:700;color:#1A2A44;">
                  {deal_score}/100
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    """

    if lang == "fr":
        subject = f"🎨 Nouvelle opportunité {tier_fr} — {artist_name}"
        cta_label = "VOIR L'ANALYSE COMPLÈTE &rarr;"
        source_label = "Voir sur la source originale"
        disclaimer = "&#9888; Cette alerte est fournie à titre informatif uniquement. Pas un conseil en investissement."
        tier_display = tier_fr
    else:
        subject = f"🎨 New {tier} opportunity — {artist_name}"
        cta_label = "VIEW FULL ANALYSIS &rarr;"
        source_label = "View original listing"
        disclaimer = "&#9888; This alert is for informational purposes only. Not investment advice."
        tier_display = tier

    content = f"""
    <div style="margin-bottom:20px;">
      <span style="display:inline-block;padding:4px 12px;
                   background:{tier_color}18;border:1px solid {tier_color}40;
                   font-family:Arial,sans-serif;font-size:10px;font-weight:700;
                   color:{tier_color};letter-spacing:0.12em;text-transform:uppercase;">
        {tier_display}
      </span>
    </div>
    <h1 style="font-family:'Georgia',serif;font-size:24px;font-weight:600;
               color:#1A2A44;margin:0 0 4px;">
      {artist_name}
    </h1>
    <p style="font-family:'Georgia',serif;font-size:16px;color:#555555;
              font-style:italic;margin:0 0 24px;">{lot_title}</p>

    {stats_block}

    <a href="{artalpha_url}"
       style="display:inline-block;padding:14px 32px;background:#1A2A44;color:#FFFFFF;
              text-decoration:none;font-family:Arial,sans-serif;font-size:12px;
              font-weight:700;letter-spacing:0.1em;text-transform:uppercase;
              margin-bottom:12px;">
      {cta_label}
    </a>
    <br>
    <a href="{lot_url}" style="font-size:11px;color:#999999;font-family:Arial,sans-serif;">
      {source_label}
    </a>
    <p style="font-size:11px;color:#CCCCCC;margin:20px 0 0;font-family:Arial,sans-serif;
              font-style:italic;">
      {disclaimer}
    </p>
    """

    return await _send(
        to_email=to_email,
        subject=subject,
        html=_wrap_html(content, lang),
        from_email=settings.alert_from_email,
    )


# ══════════════════════════════════════════════════════════════════════════════
# MISSING TRANSACTIONAL EMAILS — added Phase 3
# ══════════════════════════════════════════════════════════════════════════════

async def send_trial_started_email(to_email: str, name: str, trial_end_date: str, plan: str = "investor") -> bool:
    """Sent immediately when a trial subscription is created."""
    first = name.split()[0] if name else to_email.split("@")[0]
    plan_label = {"starter": "Collector", "investor": "Investor", "pro": "Family Office"}.get(plan, plan.title())
    content = f"""
    <h1 style="font-family:'Georgia',serif;font-size:26px;color:#0A1628;margin:0 0 8px;">
      Your {plan_label} trial has started, {first}.
    </h1>
    <div style="width:40px;height:2px;background:#C6A85A;margin:16px 0 24px;"></div>
    <p style="font-size:14px;color:#555555;line-height:1.7;margin:0 0 20px;">
      You have full access to Nautilus {plan_label} features for the next 7 days.
      Your trial ends on <strong>{trial_end_date}</strong>.
    </p>
    <p style="font-size:14px;color:#555555;line-height:1.7;margin:0 0 28px;">
      During your trial, explore AI-scored deals, set up your alerts, and track the artists you care about.
      No card will be charged until your trial ends.
    </p>
    <a href="https://app.get-nautilus.com/app/explore"
       style="display:inline-block;background:#0A1628;color:#FFFFFF;padding:14px 32px;
              border-radius:8px;text-decoration:none;font-size:12px;font-weight:700;
              letter-spacing:0.1em;text-transform:uppercase;">
      EXPLORE THE PLATFORM &rarr;
    </a>
    """
    return await _send(
        to_email=to_email,
        subject=f"Your Nautilus {plan_label} trial has started",
        html=_wrap_html(content, "en"),
        from_email=settings.transac_from_email,
    )


async def send_trial_expired_email(to_email: str, name: str, plan: str = "investor") -> bool:
    """Sent when trial period ends without conversion."""
    first = name.split()[0] if name else to_email.split("@")[0]
    plan_label = {"starter": "Collector", "investor": "Investor", "pro": "Family Office"}.get(plan, plan.title())
    content = f"""
    <h1 style="font-family:'Georgia',serif;font-size:26px;color:#0A1628;margin:0 0 8px;">
      Your trial has ended, {first}.
    </h1>
    <div style="width:40px;height:2px;background:#C6A85A;margin:16px 0 24px;"></div>
    <p style="font-size:14px;color:#555555;line-height:1.7;margin:0 0 16px;">
      Your 7-day Nautilus {plan_label} trial has ended. Your account has been moved to the free plan.
    </p>
    <p style="font-size:14px;color:#555555;line-height:1.7;margin:0 0 28px;">
      Upgrade now to keep your alerts, watchlists, and full deal scoring — starting at €9/month.
    </p>
    <a href="https://app.get-nautilus.com/app/pricing"
       style="display:inline-block;background:#0A1628;color:#FFFFFF;padding:14px 32px;
              border-radius:8px;text-decoration:none;font-size:12px;font-weight:700;
              letter-spacing:0.1em;text-transform:uppercase;">
      UPGRADE NOW &rarr;
    </a>
    <p style="font-size:11px;color:#AAAAAA;margin-top:24px;font-family:Arial,sans-serif;">
      Questions? Reply to this email — we read every message.
    </p>
    """
    return await _send(
        to_email=to_email,
        subject="Your Nautilus trial has ended — upgrade to keep your edge",
        html=_wrap_html(content, "en"),
        from_email=settings.transac_from_email,
    )


async def send_payment_success_email(to_email: str, name: str, plan: str, amount: str, period_end: str) -> bool:
    """Sent on every successful recurring payment."""
    first = name.split()[0] if name else to_email.split("@")[0]
    plan_label = {"starter": "Collector", "investor": "Investor", "pro": "Family Office", "elite": "Institutional"}.get(plan, plan.title())
    content = f"""
    <h1 style="font-family:'Georgia',serif;font-size:26px;color:#0A1628;margin:0 0 8px;">
      Payment confirmed, {first}.
    </h1>
    <div style="width:40px;height:2px;background:#C6A85A;margin:16px 0 24px;"></div>
    <table cellpadding="0" cellspacing="0" style="background:#F5F4F0;border-radius:6px;width:100%;margin-bottom:24px;">
      <tr><td style="padding:20px 24px;">
        <div style="font-size:11px;color:#999;letter-spacing:0.1em;text-transform:uppercase;font-family:Arial,sans-serif;margin-bottom:4px;">Plan</div>
        <div style="font-size:16px;font-weight:700;color:#0A1628;">{plan_label}</div>
        <div style="font-size:11px;color:#999;letter-spacing:0.1em;text-transform:uppercase;font-family:Arial,sans-serif;margin:12px 0 4px;">Amount charged</div>
        <div style="font-size:16px;font-weight:700;color:#0A1628;">{amount}</div>
        <div style="font-size:11px;color:#999;letter-spacing:0.1em;text-transform:uppercase;font-family:Arial,sans-serif;margin:12px 0 4px;">Next billing date</div>
        <div style="font-size:14px;color:#555;">{period_end}</div>
      </td></tr>
    </table>
    <a href="https://app.get-nautilus.com/app/portfolio?tab=subscription"
       style="display:inline-block;background:#0A1628;color:#FFFFFF;padding:12px 28px;
              border-radius:8px;text-decoration:none;font-size:12px;font-weight:700;
              letter-spacing:0.1em;text-transform:uppercase;">
      VIEW SUBSCRIPTION &rarr;
    </a>
    """
    return await _send(
        to_email=to_email,
        subject=f"Payment confirmed — Nautilus {plan_label}",
        html=_wrap_html(content, "en"),
        from_email=settings.transac_from_email,
    )


async def send_password_reset_email(to_email: str, reset_url: str) -> bool:
    """Sent on password reset request."""
    content = f"""
    <h1 style="font-family:'Georgia',serif;font-size:26px;color:#0A1628;margin:0 0 8px;">
      Reset your password
    </h1>
    <div style="width:40px;height:2px;background:#C6A85A;margin:16px 0 24px;"></div>
    <p style="font-size:14px;color:#555555;line-height:1.7;margin:0 0 28px;">
      We received a request to reset your Nautilus password. Click the button below.
      This link expires in 1 hour.
    </p>
    <a href="{reset_url}"
       style="display:inline-block;background:#0A1628;color:#FFFFFF;padding:14px 32px;
              border-radius:8px;text-decoration:none;font-size:12px;font-weight:700;
              letter-spacing:0.1em;text-transform:uppercase;">
      RESET PASSWORD &rarr;
    </a>
    <p style="font-size:11px;color:#AAAAAA;margin-top:24px;font-family:Arial,sans-serif;">
      If you didn't request a password reset, you can safely ignore this email.
    </p>
    """
    return await _send(
        to_email=to_email,
        subject="Reset your Nautilus password",
        html=_wrap_html(content, "en"),
        from_email=settings.transac_from_email,
    )


async def send_nps_survey_email(to_email: str, name: str) -> bool:
    """Sent 14 days after signup to measure NPS."""
    first = name.split()[0] if name else to_email.split("@")[0]
    base_url = "https://app.get-nautilus.com/feedback?score="
    content = f"""
    <h1 style="font-family:'Georgia',serif;font-size:26px;color:#0A1628;margin:0 0 8px;">
      How are we doing, {first}?
    </h1>
    <div style="width:40px;height:2px;background:#C6A85A;margin:16px 0 24px;"></div>
    <p style="font-size:14px;color:#555555;line-height:1.7;margin:0 0 24px;">
      On a scale of 0–10, how likely are you to recommend Nautilus to a fellow collector?
    </p>
    <table cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
      <tr>
        {"".join(f'<td style="padding:0 3px;"><a href="{base_url}{i}" style="display:inline-block;width:36px;height:36px;background:{"#0A1628" if i >= 9 else "#C6A85A" if i >= 7 else "#E8E6E1"};color:{"white" if i >= 7 else "#555"};text-align:center;line-height:36px;font-family:Arial,sans-serif;font-size:13px;font-weight:700;text-decoration:none;border-radius:4px;">{i}</a></td>' for i in range(11))}
      </tr>
    </table>
    <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:24px;">
      <tr>
        <td style="font-size:10px;color:#AAAAAA;font-family:Arial,sans-serif;">Not likely</td>
        <td style="text-align:right;font-size:10px;color:#AAAAAA;font-family:Arial,sans-serif;">Extremely likely</td>
      </tr>
    </table>
    <p style="font-size:11px;color:#AAAAAA;font-family:Arial,sans-serif;">
      Takes 10 seconds. Your feedback directly shapes what we build next.
    </p>
    """
    return await _send(
        to_email=to_email,
        subject="Quick question from the Nautilus team",
        html=_wrap_html(content, "en"),
        from_email=settings.transac_from_email,
    )


async def send_monthly_report_email(
    to_email: str,
    name: str,
    month: str,
    lots_scored: int,
    top_deal_title: str,
    top_deal_score: int,
    top_deal_url: str,
    alerts_fired: int,
) -> bool:
    """Monthly market intelligence summary sent to all paid subscribers."""
    first = name.split()[0] if name else to_email.split("@")[0]
    content = f"""
    <h1 style="font-family:'Georgia',serif;font-size:26px;color:#0A1628;margin:0 0 8px;">
      {month} — Your Nautilus Summary
    </h1>
    <div style="width:40px;height:2px;background:#C6A85A;margin:16px 0 24px;"></div>
    <p style="font-size:14px;color:#555555;line-height:1.7;margin:0 0 24px;">
      Here's what the Nautilus engine found for you in {month}, {first}:
    </p>
    <table cellpadding="0" cellspacing="0" width="100%" style="background:#F5F4F0;margin-bottom:28px;">
      <tr>
        <td style="padding:20px 24px;border-right:1px solid #E8E6E1;width:33%;">
          <div style="font-size:10px;color:#999;text-transform:uppercase;letter-spacing:0.1em;font-family:Arial,sans-serif;">Lots scored</div>
          <div style="font-size:28px;font-family:'Courier New',monospace;font-weight:700;color:#0A1628;">{lots_scored:,}</div>
        </td>
        <td style="padding:20px 24px;border-right:1px solid #E8E6E1;width:33%;">
          <div style="font-size:10px;color:#999;text-transform:uppercase;letter-spacing:0.1em;font-family:Arial,sans-serif;">Alerts fired</div>
          <div style="font-size:28px;font-family:'Courier New',monospace;font-weight:700;color:#C6A85A;">{alerts_fired}</div>
        </td>
        <td style="padding:20px 24px;width:33%;">
          <div style="font-size:10px;color:#999;text-transform:uppercase;letter-spacing:0.1em;font-family:Arial,sans-serif;">Top score</div>
          <div style="font-size:28px;font-family:'Courier New',monospace;font-weight:700;color:#0A1628;">{top_deal_score}/100</div>
        </td>
      </tr>
    </table>
    <p style="font-size:13px;color:#555;font-style:italic;margin:0 0 8px;">Top deal this month:</p>
    <p style="font-size:15px;font-weight:700;color:#0A1628;margin:0 0 24px;">{top_deal_title}</p>
    <a href="{top_deal_url}"
       style="display:inline-block;background:#0A1628;color:#FFFFFF;padding:12px 28px;
              border-radius:8px;text-decoration:none;font-size:12px;font-weight:700;
              letter-spacing:0.1em;text-transform:uppercase;">
      VIEW DEAL &rarr;
    </a>
    """
    return await _send(
        to_email=to_email,
        subject=f"Your Nautilus summary — {month}",
        html=_wrap_html(content, "en"),
        from_email=settings.transac_from_email,
    )
