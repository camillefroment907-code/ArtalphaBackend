"""
backend/app/utils/slack_events.py
Notifications Slack pour tous les événements business Nautilus.

Usage (fire-and-forget dans un endpoint async) :
    import asyncio
    from app.utils.slack_events import notify_new_user
    asyncio.create_task(notify_new_user(email="...", plan="investor"))
"""

from datetime import datetime, timezone
from .slack import send_slack


# ─── helpers ────────────────────────────────────────────────────────────────

def _ts() -> str:
    return datetime.now(timezone.utc).strftime("%d/%m/%Y à %H:%M UTC")


def _divider() -> dict:
    return {"type": "divider"}


def _section(text: str) -> dict:
    return {
        "type": "section",
        "text": {"type": "mrkdwn", "text": text},
    }


def _context(text: str) -> dict:
    return {
        "type": "context",
        "elements": [{"type": "mrkdwn", "text": text}],
    }


PLAN_LABELS = {
    "starter": "Starter · 9€/mois",
    "investor": "Investor · 19€/mois",
    "pro": "Pro · 99€/mois",
    "institutional": "Institutional",
    "free": "Free",
}


def _plan_label(plan: str) -> str:
    return PLAN_LABELS.get(plan.lower(), plan.capitalize())


# ─── événements ─────────────────────────────────────────────────────────────

async def notify_new_user(email: str, plan: str) -> None:
    """
    Nouvel inscrit (gratuit ou payant direct).
    Déclencher après création du compte en base.
    """
    await send_slack([
        _section(f"🆕 *Nouvel inscrit*\n`{email}`\nPlan : *{_plan_label(plan)}*"),
        _context(_ts()),
        _divider(),
    ])


async def notify_new_trial(
    email: str,
    plan: str,
    trial_end_date: str,          # format "JJ/MM/AAAA"
) -> None:
    """
    Trial 7 jours activé.
    Déclencher après Stripe checkout.Session.completed avec status=trialing.
    """
    await send_slack([
        _section(
            f"⏱️ *Nouveau trial 7 jours*\n"
            f"`{email}`\n"
            f"Plan : *{_plan_label(plan)}*\n"
            f"Expire le : *{trial_end_date}*"
        ),
        _context(_ts()),
        _divider(),
    ])


async def notify_new_payment(
    email: str,
    plan: str,
    amount_eur: float,
) -> None:
    """
    Premier paiement ou renouvellement réussi.
    Déclencher sur webhook Stripe : invoice.payment_succeeded.
    """
    await send_slack([
        _section(
            f"💰 *Nouveau paiement*\n"
            f"`{email}`\n"
            f"Plan : *{_plan_label(plan)}*\n"
            f"Montant : *{amount_eur:.0f}€/mois*"
        ),
        _context(_ts()),
        _divider(),
    ])


async def notify_upgrade(
    email: str,
    from_plan: str,
    to_plan: str,
) -> None:
    """
    Upgrade de plan (ex: Investor → Pro).
    Déclencher sur webhook Stripe : customer.subscription.updated.
    """
    await send_slack([
        _section(
            f"⬆️ *Upgrade plan*\n"
            f"`{email}`\n"
            f"*{_plan_label(from_plan)}* → *{_plan_label(to_plan)}*"
        ),
        _context(_ts()),
        _divider(),
    ])


async def notify_cancellation(
    email: str,
    plan: str,
    reason: str | None = None,
) -> None:
    """
    Désabonnement confirmé.
    Déclencher sur webhook Stripe : customer.subscription.deleted.
    """
    reason_line = f"\nRaison : _{reason}_" if reason else ""
    await send_slack([
        _section(
            f"❌ *Désabonnement*\n"
            f"`{email}`\n"
            f"Plan annulé : *{_plan_label(plan)}*"
            f"{reason_line}"
        ),
        _context(_ts()),
        _divider(),
    ])


async def notify_trial_expired_no_conversion(email: str) -> None:
    """
    Trial expiré sans conversion en payant.
    Déclencher via n8n (scheduler) ou cron post-expiration.
    """
    await send_slack([
        _section(
            f"⚠️ *Trial expiré sans conversion*\n"
            f"`{email}`\n"
            f"_Action possible : relance manuelle_"
        ),
        _context(_ts()),
        _divider(),
    ])


async def notify_payment_failed(
    email: str,
    plan: str,
    attempt: int = 1,
) -> None:
    """
    Paiement échoué (carte refusée, fonds insuffisants…).
    Déclencher sur webhook Stripe : invoice.payment_failed.
    """
    await send_slack([
        _section(
            f"🚨 *Paiement échoué*\n"
            f"`{email}`\n"
            f"Plan : *{_plan_label(plan)}*\n"
            f"Tentative n°{attempt}"
        ),
        _context(_ts()),
        _divider(),
    ])
