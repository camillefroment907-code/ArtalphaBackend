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
        "Vous recevez cet email car vous avez un compte ArtAlpha. "
        "<a href='https://artalpha.io/app/portfolio' style='color:#C6A85A'>"
        "Gérer mes préférences</a>"
    )
    footer_en = (
        "You're receiving this because you have an ArtAlpha account. "
        "<a href='https://artalpha.io/app/portfolio' style='color:#C6A85A'>"
        "Manage preferences</a>"
    )
    footer = footer_fr if lang == "fr" else footer_en
    return f"""<!DOCTYPE html>
<html lang="{lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>ArtAlpha</title>
</head>
<body style="margin:0;padding:0;background:#FAFAF8;font-family:'Georgia',serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAF8;padding:40px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid #E8E6E1;">

  <!-- Header -->
  <tr><td style="padding:32px 40px;border-bottom:1px solid #E8E6E1;">
    <span style="font-family:'Georgia',serif;font-size:20px;font-weight:600;color:#1A2A44;letter-spacing:0.05em;">
      ART<span style="color:#C6A85A">ALPHA</span>
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
      &copy; 2026 ArtAlpha &middot; artalpha.io
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


# ══════════════════════════════════════════════════════════════════════════════
# TRANSACTIONAL EMAILS — from: hello@artalpha.io
# ══════════════════════════════════════════════════════════════════════════════

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

    artalpha_url = f"https://artalpha.io/app/opportunities/{lot_id}"

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
