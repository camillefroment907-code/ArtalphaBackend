"""
ArtAlpha Billing API — Complete Stripe Integration
Plans: Free | Starter €9 | Investor €29 | Pro €99 | Institutional (Contact Sales)
"""
import asyncio
import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from typing import Optional
from datetime import datetime, timedelta
import structlog
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.services.email_service import (
    send_trial_ending_email,
    send_trial_started_email,
    send_payment_failed_email,
    send_payment_success_email,
    send_subscription_canceled_email,
    send_upgrade_confirmed_email,
    send_downgrade_confirmed_email,
    send_renewal_confirmed_email,
    send_admin_notification,
)

from app.database import get_db
from app.models.db_models import User, Subscription, SubscriptionPlan, SubscriptionStatus
from app.api.auth_utils import get_current_user
from app.config import get_settings

settings = get_settings()
logger = structlog.get_logger().bind(module="billing")
router = APIRouter(prefix="/billing", tags=["billing"])
limiter = Limiter(key_func=get_remote_address)

# ── Plan definitions ──────────────────────────────────────────────────────────

PLANS = [
    {
        "id": "free",
        "name": "Free",
        "tagline": "Discover the market",
        "monthly": 0,
        "yearly": 0,
        "badge": None,
        "highlighted": False,
        "features": [
            {"label": "3 deals / day", "ok": True},
            {"label": "Deal scores visible", "ok": True},
            {"label": "1 alert / day", "ok": True},
            {"label": "24h history", "ok": True},
            {"label": "Real-time feed", "ok": False},
            {"label": "Favorite artists", "ok": False},
            {"label": "Portfolio tracker", "ok": False},
            {"label": "API access", "ok": False},
        ],
        "limits": {
            "deals_per_day": 3,
            "alerts_per_day": 1,
            "max_artists": 0,
            "history_days": 1,
            "realtime": False,
            "portfolio": False,
            "api": False,
        },
        "cta": "Start free",
        "price_keys": None,
    },
    {
        "id": "starter",
        "name": "Starter",
        "tagline": "Entry-level intelligence",
        "monthly": 9,
        "yearly": 90,
        "yearly_saving": 18,
        "badge": None,
        "highlighted": False,
        "features": [
            {"label": "15 deals / day", "ok": True},
            {"label": "Full deal scores", "ok": True},
            {"label": "5 alerts / day", "ok": True},
            {"label": "Basic filters", "ok": True},
            {"label": "5 favorite artists", "ok": True},
            {"label": "7-day history", "ok": True},
            {"label": "Real-time feed", "ok": False},
            {"label": "Portfolio tracker", "ok": False},
            {"label": "API access", "ok": False},
        ],
        "limits": {
            "deals_per_day": 15,
            "alerts_per_day": 5,
            "max_artists": 5,
            "history_days": 7,
            "realtime": False,
            "portfolio": False,
            "api": False,
        },
        "cta": "Start Starter",
        "price_keys": {"monthly": "collector_monthly", "annual": "collector_annual"},
    },
    {
        "id": "investor",
        "name": "Investor",
        "tagline": "For active collectors",
        "monthly": 29,
        "yearly": 290,
        "yearly_saving": 58,
        "badge": "Most Popular",
        "highlighted": True,
        "features": [
            {"label": "50 deals / day", "ok": True},
            {"label": "Real-time alerts", "ok": True},
            {"label": "Advanced filters", "ok": True},
            {"label": "Unlimited favorites", "ok": True},
            {"label": "Full history", "ok": True},
            {"label": "Early deal access", "ok": True},
            {"label": "Portfolio tracker", "ok": False},
            {"label": "ROI projections", "ok": False},
            {"label": "API access", "ok": False},
        ],
        "limits": {
            "deals_per_day": 50,
            "alerts_per_day": 50,
            "max_artists": -1,
            "history_days": -1,
            "realtime": True,
            "portfolio": False,
            "api": False,
        },
        "cta": "Start Investing",
        "price_keys": {"monthly": "investor_monthly", "annual": "investor_annual"},
    },
    {
        "id": "pro",
        "name": "Pro",
        "tagline": "For serious investors",
        "monthly": 99,
        "yearly": 990,
        "yearly_saving": 198,
        "badge": "Best Value",
        "highlighted": False,
        "features": [
            {"label": "Unlimited deals", "ok": True},
            {"label": "Priority alerts", "ok": True},
            {"label": "Portfolio tracker", "ok": True},
            {"label": "ROI projections", "ok": True},
            {"label": "Rarity & liquidity data", "ok": True},
            {"label": "Lite API access", "ok": True},
            {"label": "CSV export", "ok": True},
            {"label": "Dedicated support", "ok": False},
        ],
        "limits": {
            "deals_per_day": -1,
            "alerts_per_day": -1,
            "max_artists": -1,
            "history_days": -1,
            "realtime": True,
            "portfolio": True,
            "api": True,
        },
        "cta": "Go Pro",
        "price_keys": {"monthly": "pro_monthly", "annual": "pro_annual"},
    },
    {
        "id": "institutional",
        "name": "Institutional",
        "tagline": "For galleries & family offices",
        "monthly": None,
        "yearly": None,
        "badge": None,
        "highlighted": False,
        "features": [
            {"label": "Everything in Pro", "ok": True},
            {"label": "White-glove onboarding", "ok": True},
            {"label": "Dedicated analyst", "ok": True},
            {"label": "Custom integrations", "ok": True},
            {"label": "Full API access", "ok": True},
            {"label": "SLA guarantee", "ok": True},
            {"label": "Volume licensing", "ok": True},
            {"label": "On-site training", "ok": True},
        ],
        "limits": {
            "deals_per_day": -1,
            "alerts_per_day": -1,
            "max_artists": -1,
            "history_days": -1,
            "realtime": True,
            "portfolio": True,
            "api": True,
        },
        "cta": "Contact Sales",
        "price_keys": None,
    },
]

PLAN_LIMITS = {
    "free": {
        "lots_per_day": 3,
        "primary_lots": 3,
        "convictions": False,
        "larry_messages": 3,
        "agent_alerts": 0,
        "investment_memo": False,
        "investment_dossier": False,
        "portfolio_items": 3,
        "artist_profiles": True,
        "deal_score": True,
    },
    "starter": {  # Collector
        "lots_per_day": 10,
        "primary_lots": 10,
        "convictions": True,
        "larry_messages": 10,
        "agent_alerts": 1,
        "investment_memo": False,
        "investment_dossier": False,
        "portfolio_items": 10,
        "artist_profiles": True,
        "deal_score": True,
    },
    "investor": {
        "lots_per_day": 99999,
        "primary_lots": 99999,
        "convictions": True,
        "larry_messages": 30,
        "agent_alerts": 3,
        "investment_memo": True,
        "investment_dossier": False,
        "portfolio_items": 99999,
        "artist_profiles": True,
        "deal_score": True,
    },
    "pro": {  # Family Office
        "lots_per_day": 99999,
        "primary_lots": 99999,
        "convictions": True,
        "larry_messages": 99999,
        "agent_alerts": 99999,
        "investment_memo": True,
        "investment_dossier": True,
        "portfolio_items": 99999,
        "artist_profiles": True,
        "deal_score": True,
    },
    "institutional": {
        "lots_per_day": 99999,
        "primary_lots": 99999,
        "convictions": True,
        "larry_messages": 99999,
        "agent_alerts": 99999,
        "investment_memo": True,
        "investment_dossier": True,
        "portfolio_items": 99999,
        "artist_profiles": True,
        "deal_score": True,
    },
}

ADMIN_EMAILS = frozenset({
    "camillefroment907@gmail.com",
    "demo@get-nautilus.com",
    "demo@hono.art",
    "demo@balthus.art",
})

# Map DB enum values (uppercase) to lowercase plan IDs
_PLAN_VALUE_TO_ID = {
    "FREE": "free",
    "STARTER": "starter",
    "INVESTOR": "investor",
    "PRO": "pro",
    "INSTITUTIONAL": "institutional",
    "ELITE": "institutional",    # legacy → maps to institutional
    "EXPERT": "institutional",   # legacy → maps to institutional
}

PLAN_HIERARCHY = {
    "free": 0,
    "starter": 1,      # Collector
    "investor": 2,
    "pro": 3,          # Family Office
    "institutional": 4,
}


def _get_stripe():
    if not settings.stripe_secret_key:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "stripe_not_configured",
                "message": "Add STRIPE_SECRET_KEY to .env then restart the backend.",
                "setup": "https://dashboard.stripe.com/apikeys",
            },
        )
    stripe.api_key = settings.stripe_secret_key
    return stripe


PRICE_MAP = {
    "collector_monthly": settings.stripe_price_collector_monthly,
    "collector_annual":  settings.stripe_price_collector_annual,
    "investor_monthly":  settings.stripe_price_investor_monthly,
    "investor_annual":   settings.stripe_price_investor_annual,
    "pro_monthly":       settings.stripe_price_pro_monthly,
    "pro_annual":        settings.stripe_price_pro_annual,
    # Legacy aliases
    "starter_monthly":   settings.stripe_price_collector_monthly,
    "starter_annual":    settings.stripe_price_collector_annual,
    "starter_yearly":    settings.stripe_price_collector_annual,
    "investor_yearly":   settings.stripe_price_investor_annual,
    "pro_yearly":        settings.stripe_price_pro_annual,
}


def _price_id(price_key: str) -> str:
    price = PRICE_MAP.get(price_key)
    if not price:
        raise HTTPException(
            400,
            f"Price not configured for '{price_key}'. Please contact support."
        )
    return price


def _plan_from_price_id(price_id: str) -> SubscriptionPlan:
    mapping: dict[str, SubscriptionPlan] = {}
    for fld in (settings.stripe_price_collector_monthly, settings.stripe_price_collector_annual):
        if fld: mapping[fld] = SubscriptionPlan.STARTER
    for fld in (settings.stripe_price_investor_monthly, settings.stripe_price_investor_annual):
        if fld: mapping[fld] = SubscriptionPlan.INVESTOR
    for fld in (settings.stripe_price_pro_monthly, settings.stripe_price_pro_annual):
        if fld: mapping[fld] = SubscriptionPlan.PRO
    # institutional has no Stripe price (contact sales)
    return mapping.get(price_id, SubscriptionPlan.FREE)


def _plan_id(sub: Subscription) -> str:
    """Return lowercase plan ID from a Subscription record."""
    if sub is None:
        return "free"
    return _PLAN_VALUE_TO_ID.get(sub.plan.value, "free")


async def _get_user_plan(user: User, db: AsyncSession) -> str:
    """Return the lowercase plan ID for a user, checking admin override first."""
    if user.email in ADMIN_EMAILS:
        return "institutional"
    result = await db.execute(
        select(Subscription).where(Subscription.user_id == user.id)
    )
    sub = result.scalar_one_or_none()
    if sub and sub.status.value.lower() in ("active", "trialing"):
        return _PLAN_VALUE_TO_ID.get(sub.plan.value, "free")
    return "free"


async def _can_change_plan(current_plan: str, new_plan: str, is_annual: bool) -> tuple[bool, str]:
    """
    Upgrade always allowed.
    Downgrade blocked if on annual plan.
    """
    current_level = PLAN_HIERARCHY.get(current_plan, 0)
    new_level = PLAN_HIERARCHY.get(new_plan, 0)

    if new_level > current_level:
        return True, "ok"  # Upgrade always allowed

    if new_level < current_level and is_annual:
        return False, "You cannot downgrade during an annual subscription. Your current plan will remain active until the end of your billing period."

    return True, "ok"


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/plans")
async def get_plans():
    return {"plans": PLANS}


@router.get("/subscription")
async def get_subscription(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.email in ADMIN_EMAILS:
        return {
            "plan": "institutional",
            "status": "active",
            "billing_interval": "yearly",
            "current_period_end": "2125-01-01T00:00:00",
            "cancel_at_period_end": False,
            "limits": PLAN_LIMITS["institutional"],
            "is_admin": True,
        }

    result = await db.execute(
        select(Subscription).where(Subscription.user_id == current_user.id)
    )
    sub = result.scalar_one_or_none()

    if not sub:
        return {
            "plan": "free",
            "status": "active",
            "cancel_at_period_end": False,
            "limits": PLAN_LIMITS["free"],
        }

    plan_id = _plan_id(sub)
    return {
        "plan": plan_id,
        "status": sub.status.value.lower(),
        "billing_interval": sub.billing_interval or "monthly",
        "current_period_end": sub.current_period_end.isoformat() if sub.current_period_end else None,
        "cancel_at_period_end": sub.cancel_at_period_end or False,
        "limits": PLAN_LIMITS.get(plan_id, PLAN_LIMITS["free"]),
    }


@router.get("/limits")
async def get_plan_limits(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return plan limits for the current user."""
    plan = await _get_user_plan(current_user, db)
    limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])
    return {"plan": plan, "limits": limits}


@router.post("/create-checkout-session")
@limiter.limit("10/minute")
async def create_checkout_session(
    request: Request,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    s = _get_stripe()

    price_key = body.get("price_key")
    if not price_key:
        raise HTTPException(400, detail="price_key required")

    price_id = _price_id(price_key)

    result = await db.execute(
        select(Subscription).where(Subscription.user_id == current_user.id)
    )
    sub = result.scalar_one_or_none()

    # ── SERVER-SIDE PLAN ENFORCEMENT ──────────────────────────────
    if sub and sub.plan.value.lower() != "free" and sub.status.value.lower() in ("active", "trialing"):
        current_plan_id = _plan_id(sub)
        target_plan = _plan_from_price_id(price_id)
        target_plan_id = _PLAN_VALUE_TO_ID.get(target_plan.value, "free")
        is_annual = sub.billing_interval == "yearly"

        can_change, reason = await _can_change_plan(current_plan_id, target_plan_id, is_annual)
        if not can_change:
            raise HTTPException(403, detail={
                "error": "yearly_commitment",
                "message": reason,
                "renewal_date": sub.current_period_end.isoformat() if sub.current_period_end else None,
            })

        current_interval = "yearly" if sub.billing_interval == "yearly" else "monthly"
        target_interval = "yearly" if "year" in price_key else "monthly"
        if PLAN_HIERARCHY.get(target_plan_id, 0) == PLAN_HIERARCHY.get(current_plan_id, 0) and target_interval == current_interval:
            raise HTTPException(400, detail={
                "error": "same_plan",
                "message": "You are already on this plan.",
            })

    # Existing paid subscription → upgrade via Stripe proration
    if (
        sub
        and sub.plan.value != "FREE"
        and sub.status.value in ("ACTIVE", "TRIALING")
        and sub.stripe_subscription_id
    ):
        try:
            stripe_sub = s.Subscription.retrieve(sub.stripe_subscription_id)
            current_item_id = stripe_sub["items"]["data"][0]["id"]
            s.Subscription.modify(
                sub.stripe_subscription_id,
                items=[{"id": current_item_id, "price": price_id}],
                proration_behavior="always_invoice",
                billing_cycle_anchor="unchanged",
            )
            new_plan = _plan_from_price_id(price_id)
            sub.plan = new_plan
            sub.stripe_price_id = price_id
            sub.updated_at = datetime.utcnow()
            await db.commit()
            logger.info("Subscription upgraded", user=current_user.email, plan=new_plan.value)
            return {"upgraded": True, "plan": new_plan.value, "message": "Plan upgraded successfully with proration"}
        except stripe.error.StripeError as e:
            raise HTTPException(400, detail={"error": "stripe_error", "message": str(e)})

    # New subscription → create Stripe checkout session
    customer_id = sub.stripe_customer_id if sub else None
    if not customer_id:
        customer = s.Customer.create(
            email=current_user.email,
            name=getattr(current_user, "full_name", None) or current_user.email,
            metadata={"user_id": str(current_user.id), "platform": "artalpha"},
        )
        customer_id = customer.id

    is_new = not sub or sub.plan == SubscriptionPlan.FREE

    try:
        session = s.checkout.Session.create(
            customer=customer_id,
            payment_method_types=["card"],
            line_items=[{"price": price_id, "quantity": 1}],
            mode="subscription",
            subscription_data={
                **({"trial_period_days": 7} if is_new else {}),
                "metadata": {"user_id": str(current_user.id)},
            },
            success_url=f"{settings.frontend_url}/billing/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{settings.frontend_url}/app/pricing?canceled=true",
            metadata={"user_id": str(current_user.id), "price_key": price_key},
            allow_promotion_codes=True,
            billing_address_collection="auto",
            locale="auto",
        )
    except stripe.error.StripeError as e:
        raise HTTPException(400, detail={
            "error": "stripe_error",
            "message": e.user_message or str(e),
        })
    except Exception as e:
        raise HTTPException(500, detail={
            "error": "server_error",
            "message": str(e),
        })

    logger.info("Checkout session created", user=current_user.email, price_key=price_key)
    return {"checkout_url": session.url, "session_id": session.id}


@router.post("/cancel-subscription")
@limiter.limit("5/minute")
async def cancel_subscription(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Cancel at end of current period. Access continues until period_end."""
    s = _get_stripe()

    result = await db.execute(
        select(Subscription).where(Subscription.user_id == current_user.id)
    )
    sub = result.scalar_one_or_none()

    if not sub or not sub.stripe_subscription_id:
        raise HTTPException(400, "No active subscription")
    if sub.plan.value == "FREE":
        raise HTTPException(400, "No paid subscription to cancel")

    try:
        stripe_sub = s.Subscription.modify(
            sub.stripe_subscription_id,
            cancel_at_period_end=True,
        )
        sub.cancel_at_period_end = True
        sub.updated_at = datetime.utcnow()
        await db.commit()

        period_end = datetime.fromtimestamp(stripe_sub["current_period_end"])
        interval = sub.billing_interval or "monthly"
        return {
            "cancelled": True,
            "access_until": period_end.isoformat(),
            "billing_interval": interval,
            "message": f"Subscription cancelled. Access continues until {period_end.strftime('%B %d, %Y')}.",
        }
    except stripe.error.StripeError as e:
        raise HTTPException(400, detail={"error": "stripe_error", "message": str(e)})


@router.post("/reactivate-subscription")
async def reactivate_subscription(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Undo cancellation if still within billing period."""
    s = _get_stripe()

    result = await db.execute(
        select(Subscription).where(Subscription.user_id == current_user.id)
    )
    sub = result.scalar_one_or_none()

    if not sub or not sub.stripe_subscription_id:
        raise HTTPException(400, "No subscription found")

    try:
        s.Subscription.modify(
            sub.stripe_subscription_id,
            cancel_at_period_end=False,
        )
        sub.cancel_at_period_end = False
        sub.updated_at = datetime.utcnow()
        await db.commit()
        return {"reactivated": True}
    except stripe.error.StripeError as e:
        raise HTTPException(400, detail={"error": "stripe_error", "message": str(e)})


@router.post("/sync-subscription")
async def sync_subscription(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Called by frontend after successful checkout.
    Fetches latest subscription from Stripe and updates DB.
    No webhook needed.
    """
    s = _get_stripe()

    customers = s.Customer.list(email=current_user.email, limit=5)
    if not customers.data:
        return {"plan": "free", "status": "no_customer"}

    for customer in customers.data:
        subs = s.Subscription.list(
            customer=customer.id,
            status="all",
            limit=10,
            expand=["data.items.data.price"],
        )
        for stripe_sub in subs.data:
            if stripe_sub.status not in ("active", "trialing"):
                continue

            price_id = stripe_sub["items"]["data"][0]["price"]["id"]
            interval = stripe_sub["items"]["data"][0]["price"]["recurring"]["interval"]
            plan = _plan_from_price_id(price_id)
            period_end = datetime.fromtimestamp(stripe_sub["current_period_end"])
            status = SubscriptionStatus.TRIALING if stripe_sub.status == "trialing" else SubscriptionStatus.ACTIVE

            result = await db.execute(
                select(Subscription).where(Subscription.user_id == current_user.id)
            )
            existing = result.scalar_one_or_none()

            if existing:
                existing.plan = plan
                existing.status = status
                existing.stripe_customer_id = customer.id
                existing.stripe_subscription_id = stripe_sub.id
                existing.stripe_price_id = price_id
                existing.billing_interval = interval
                existing.current_period_end = period_end
                existing.cancel_at_period_end = stripe_sub.get("cancel_at_period_end", False)
                existing.updated_at = datetime.utcnow()
            else:
                db.add(Subscription(
                    user_id=current_user.id,
                    plan=plan,
                    status=status,
                    stripe_customer_id=customer.id,
                    stripe_subscription_id=stripe_sub.id,
                    stripe_price_id=price_id,
                    billing_interval=interval,
                    current_period_end=period_end,
                ))

            await db.commit()
            logger.info("Subscription synced", user=current_user.email, plan=plan.value)
            return {
                "plan": plan.value,
                "status": status.value,
                "period_end": period_end.isoformat(),
            }

    return {"plan": "free", "status": "no_active_subscription"}


@router.get("/invoices")
async def get_invoices(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return Stripe invoices for the current user."""
    try:
        s = _get_stripe()
        result = await db.execute(
            select(Subscription).where(Subscription.user_id == current_user.id)
        )
        sub = result.scalar_one_or_none()
        if not sub or not sub.stripe_customer_id:
            return {"invoices": []}
        invoices = s.Invoice.list(customer=sub.stripe_customer_id, limit=12)
        return {
            "invoices": [
                {
                    "id": inv.id,
                    "created": inv.created,
                    "amount_paid": inv.amount_paid,
                    "currency": inv.currency,
                    "status": inv.status,
                    "description": inv.lines.data[0].description if inv.lines.data else None,
                    "invoice_pdf": inv.invoice_pdf,
                }
                for inv in invoices.data
            ]
        }
    except Exception as e:
        logger.warning("invoice_fetch_failed", error=str(e))
        return {"invoices": []}


@router.post("/create-portal-session")
async def create_portal_session(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    s = _get_stripe()
    result = await db.execute(
        select(Subscription).where(Subscription.user_id == current_user.id)
    )
    sub = result.scalar_one_or_none()
    if not sub or not sub.stripe_customer_id:
        raise HTTPException(400, "No active subscription found")

    session = s.billing_portal.Session.create(
        customer=sub.stripe_customer_id,
        return_url=f"{settings.frontend_url}/settings",
    )
    return {"portal_url": session.url}


@router.post("/portal")
async def create_portal_session(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        import stripe as stripe_lib
        stripe_lib.api_key = settings.stripe_secret_key

        result = await db.execute(
            select(Subscription).where(Subscription.user_id == current_user.id)
        )
        sub = result.scalar_one_or_none()

        # No subscription or no stripe customer — redirect to pricing
        if not sub or not sub.stripe_customer_id:
            return {"url": f"{settings.frontend_url}/app/pricing"}

        try:
            session = stripe_lib.billing_portal.Session.create(
                customer=sub.stripe_customer_id,
                return_url=f"{settings.frontend_url}/app/portfolio?tab=subscription",
            )
            return {"url": session.url}
        except stripe_lib.error.InvalidRequestError:
            return {"url": f"{settings.frontend_url}/app/pricing"}

    except Exception as e:
        logger.warning("portal_failed", error=str(e))
        return {"url": f"{settings.frontend_url}/app/pricing"}


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    stripe_signature: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    if not settings.stripe_webhook_secret:
        raise HTTPException(400, "Webhook secret not configured")

    payload = await request.body()

    try:
        stripe.api_key = settings.stripe_secret_key
        event = stripe.Webhook.construct_event(
            payload, stripe_signature, settings.stripe_webhook_secret
        )
    except Exception as e:
        raise HTTPException(400, f"Webhook signature invalid: {e}")

    event_id = event["id"]
    event_type = event["type"]

    # ── IDEMPOTENCY CHECK ─────────────────────────────────────────
    try:
        existing = (await db.execute(
            text("SELECT id FROM processed_stripe_events WHERE event_id = :eid"),
            {"eid": event_id}
        )).fetchone()
        if existing:
            return {"received": True, "skipped": "already_processed"}
    except Exception:
        pass  # Table may not exist yet

    data = event["data"]["object"]

    if event_type in ("customer.subscription.created", "customer.subscription.updated"):
        await _handle_subscription_update(db, data)
    elif event_type == "customer.subscription.deleted":
        await _handle_subscription_canceled(db, data)
    elif event_type == "invoice.payment_failed":
        await _handle_payment_failed(db, data)
    elif event_type == "invoice.payment_succeeded":
        await _handle_payment_succeeded(db, data)
    elif event_type == "customer.subscription.trial_will_end":
        await _handle_trial_ending(db, data)

    # ── MARK AS PROCESSED ─────────────────────────────────────────
    try:
        await db.execute(
            text("INSERT INTO processed_stripe_events (event_id, event_type, processed_at) VALUES (:eid, :etype, NOW())"),
            {"eid": event_id, "etype": event_type}
        )
    except Exception:
        pass

    await db.commit()
    logger.info("Webhook processed", type=event_type)
    return {"received": True}


async def _handle_subscription_update(db: AsyncSession, stripe_sub: dict):
    customer_id = stripe_sub["customer"]
    items = stripe_sub.get("items", {}).get("data", [])
    price_id = items[0]["price"]["id"] if items else None
    plan = _plan_from_price_id(price_id) if price_id else SubscriptionPlan.FREE

    # Fetch customer email upfront for notification
    customer_email = None
    try:
        stripe.api_key = settings.stripe_secret_key
        cust = stripe.Customer.retrieve(customer_id)
        customer_email = cust.get("email")
    except Exception:
        pass

    interval = "monthly"
    if items:
        recurring = items[0].get("price", {}).get("recurring", {})
        if recurring.get("interval") == "year":
            interval = "yearly"

    status_map = {
        "active":   SubscriptionStatus.ACTIVE,
        "trialing": SubscriptionStatus.TRIALING,
        "canceled": SubscriptionStatus.CANCELED,
        "past_due": SubscriptionStatus.PAST_DUE,
    }
    status = status_map.get(stripe_sub.get("status", "active"), SubscriptionStatus.ACTIVE)

    period_start = datetime.fromtimestamp(stripe_sub["current_period_start"]) if stripe_sub.get("current_period_start") else None
    period_end = datetime.fromtimestamp(stripe_sub["current_period_end"]) if stripe_sub.get("current_period_end") else None

    result = await db.execute(
        select(Subscription).where(Subscription.stripe_customer_id == customer_id)
    )
    sub = result.scalar_one_or_none()

    _UPGRADE_ORDER = ["free", "starter", "investor", "pro", "institutional"]

    if sub:
        old_plan_str = _PLAN_VALUE_TO_ID.get(sub.plan.value, "free")
        sub.plan = plan
        sub.status = status
        sub.stripe_subscription_id = stripe_sub["id"]
        sub.stripe_price_id = price_id
        sub.billing_interval = interval
        sub.current_period_start = period_start
        sub.current_period_end = period_end
        sub.cancel_at_period_end = stripe_sub.get("cancel_at_period_end", False)
        sub.updated_at = datetime.utcnow()

        new_plan_str = _PLAN_VALUE_TO_ID.get(plan.value, "free")
        old_idx = _UPGRADE_ORDER.index(old_plan_str) if old_plan_str in _UPGRADE_ORDER else 0
        new_idx = _UPGRADE_ORDER.index(new_plan_str) if new_plan_str in _UPGRADE_ORDER else 0
        if new_idx > old_idx:
            try:
                user_result = await db.execute(select(User).where(User.id == sub.user_id))
                upgraded_user = user_result.scalar_one_or_none()
                if upgraded_user:
                    asyncio.create_task(send_upgrade_confirmed_email(
                        to_email=upgraded_user.email,
                        name=upgraded_user.full_name or upgraded_user.email,
                        old_plan=old_plan_str,
                        new_plan=new_plan_str,
                        lang=getattr(upgraded_user, "language", "fr"),
                    ))
            except Exception:
                pass
        elif new_idx < old_idx:
            try:
                user_result = await db.execute(select(User).where(User.id == sub.user_id))
                downgraded_user = user_result.scalar_one_or_none()
                if downgraded_user:
                    asyncio.create_task(send_downgrade_confirmed_email(
                        to_email=downgraded_user.email,
                        name=downgraded_user.full_name or downgraded_user.email,
                        old_plan=old_plan_str,
                        new_plan=new_plan_str,
                        effective_date=datetime.utcnow().strftime("%d/%m/%Y"),
                        lang=getattr(downgraded_user, "language", "fr"),
                    ))
            except Exception:
                pass
    else:
        stripe.api_key = settings.stripe_secret_key
        try:
            customer = stripe.Customer.retrieve(customer_id)
            user_id = customer.get("metadata", {}).get("user_id")
        except Exception:
            user_id = None

        if user_id:
            # Check if user already has a subscription row (e.g. manually seeded, no stripe_customer_id)
            existing = await db.execute(
                select(Subscription).where(Subscription.user_id == user_id)
            )
            existing_sub = existing.scalar_one_or_none()

            if existing_sub:
                # Update existing row with Stripe data
                existing_sub.plan = plan
                existing_sub.status = status
                existing_sub.billing_interval = interval
                existing_sub.stripe_customer_id = customer_id
                existing_sub.stripe_subscription_id = stripe_sub["id"]
                existing_sub.stripe_price_id = price_id
                existing_sub.current_period_start = period_start
                existing_sub.current_period_end = period_end
                existing_sub.cancel_at_period_end = stripe_sub.get("cancel_at_period_end", False)
                existing_sub.updated_at = datetime.utcnow()
                logger.info("Updated existing subscription via webhook", user_id=user_id, plan=plan.value)
            else:
                new_sub = Subscription(
                    user_id=user_id,
                    plan=plan,
                    status=status,
                    billing_interval=interval,
                    stripe_customer_id=customer_id,
                    stripe_subscription_id=stripe_sub["id"],
                    stripe_price_id=price_id,
                    current_period_start=period_start,
                    current_period_end=period_end,
                    cancel_at_period_end=stripe_sub.get("cancel_at_period_end", False),
                )
                db.add(new_sub)
                logger.info("New subscription created via webhook", user_id=user_id, plan=plan.value)

    # Send trial started email on first trialing event
    try:
        status_val = stripe_sub.get("status", "")
        if status_val == "trialing" and customer_email:
            trial_end_ts = stripe_sub.get("trial_end")
            trial_end_str = datetime.fromtimestamp(trial_end_ts).strftime("%d %B %Y") if trial_end_ts else "7 days"
            # Find user name
            user_name = customer_email
            try:
                cust_meta = stripe_sub.get("customer_details") or {}
                user_name = cust_meta.get("name") or customer_email
            except Exception:
                pass
            asyncio.create_task(send_trial_started_email(
                to_email=customer_email,
                name=user_name,
                trial_end_date=trial_end_str,
                plan=plan.value if hasattr(plan, "value") else str(plan),
            ))
    except Exception:
        pass

    # Notify admin of new/updated subscription
    try:
        status_val = stripe_sub.get("status", "")
        if status_val in ("active", "trialing"):
            asyncio.create_task(send_admin_notification(
                subject=f"🎉 New Nautilus subscriber — {plan.value} plan",
                html=f"""
                <div style="font-family: Georgia, serif; padding: 32px; max-width: 480px;">
                  <h2 style="color: #0A1628;">New subscriber on Nautilus</h2>
                  <p><strong>Plan:</strong> {plan.value}</p>
                  <p><strong>Status:</strong> {status_val}</p>
                  <p><strong>Email:</strong> {customer_email or 'unknown'}</p>
                  <p><strong>Date:</strong> {datetime.utcnow().strftime('%d/%m/%Y %H:%M')} UTC</p>
                  <hr/>
                  <p style="color: #8A95A3; font-size: 12px;">Nautilus Market Intelligence</p>
                </div>
                """,
            ))
    except Exception:
        pass


async def _handle_subscription_canceled(db: AsyncSession, stripe_sub: dict):
    customer_id = stripe_sub["customer"]
    result = await db.execute(
        select(Subscription).where(Subscription.stripe_customer_id == customer_id)
    )
    sub = result.scalar_one_or_none()
    if sub:
        previous_plan_name = sub.plan.value if sub else "Nautilus"
        sub.plan = SubscriptionPlan.FREE
        sub.status = SubscriptionStatus.CANCELED
        sub.updated_at = datetime.utcnow()

        user_result = await db.execute(select(User).where(User.id == sub.user_id))
        canceled_user = user_result.scalar_one_or_none()
        if canceled_user:
            period_end_ts = stripe_sub.get("current_period_end")
            end_date_str = (
                datetime.fromtimestamp(period_end_ts).strftime("%d %B %Y")
                if period_end_ts else ""
            )
            await send_subscription_canceled_email(
                to_email=canceled_user.email,
                name=canceled_user.full_name or canceled_user.email,
                plan_name=previous_plan_name,
                access_until=end_date_str,
                lang=getattr(canceled_user, 'language', 'fr'),
            )
            # Notify admin of cancellation
            asyncio.create_task(send_admin_notification(
                subject=f"❌ Nautilus cancellation — {sub.plan.value} plan",
                html=f"""
                <div style="font-family: Georgia, serif; padding: 32px; max-width: 480px;">
                  <h2 style="color: #0A1628;">Subscription cancelled</h2>
                  <p><strong>Plan:</strong> {sub.plan.value}</p>
                  <p><strong>Email:</strong> {canceled_user.email}</p>
                  <p><strong>Access until:</strong> {end_date_str or 'N/A'}</p>
                  <p><strong>Date:</strong> {datetime.utcnow().strftime('%d/%m/%Y %H:%M')} UTC</p>
                  <hr/>
                  <p style="color: #8A95A3; font-size: 12px;">Nautilus Market Intelligence</p>
                </div>
                """,
            ))


async def _handle_payment_failed(db: AsyncSession, invoice: dict):
    """
    On failure: set past_due but keep access (7-day grace period).
    Stripe retries automatically. Access only removed on subscription.deleted.
    """
    customer_id = invoice.get("customer")
    if not customer_id:
        return

    attempt_count = invoice.get("attempt_count", 1)

    result = await db.execute(
        select(Subscription).where(Subscription.stripe_customer_id == customer_id)
    )
    sub = result.scalar_one_or_none()
    if not sub:
        return

    # Grace period: mark past_due but do NOT remove plan access
    sub.status = SubscriptionStatus.PAST_DUE
    sub.updated_at = datetime.utcnow()

    logger.warning(
        "payment_failed",
        customer_id=customer_id,
        attempt=attempt_count,
        plan=sub.plan.value,
    )

    user_result = await db.execute(select(User).where(User.id == sub.user_id))
    failed_user = user_result.scalar_one_or_none()
    if failed_user:
        failed_user.payment_failed_at = datetime.utcnow()
        amount_eur = f"€{invoice.get('amount_due', 0) / 100:.2f}"
        plan_name = sub.plan.value if sub else "Nautilus"
        next_attempt_ts = invoice.get("next_payment_attempt")
        retry_date = datetime.fromtimestamp(next_attempt_ts).strftime("%d/%m/%Y") if next_attempt_ts else ""
        portal_url = "https://get-nautilus.com/app/pricing"
        asyncio.create_task(send_payment_failed_email(
            to_email=failed_user.email,
            name=failed_user.full_name or failed_user.email,
            amount=amount_eur,
            plan_name=plan_name,
            retry_date=retry_date,
            stripe_billing_portal_url=portal_url,
            lang=getattr(failed_user, 'language', 'fr'),
        ))


async def _handle_payment_succeeded(db: AsyncSession, invoice: dict):
    customer_id = invoice.get("customer")
    if not customer_id:
        return
    result = await db.execute(
        select(Subscription).where(Subscription.stripe_customer_id == customer_id)
    )
    sub = result.scalar_one_or_none()
    if not sub:
        return

    was_past_due = sub.status == SubscriptionStatus.PAST_DUE
    if was_past_due:
        sub.status = SubscriptionStatus.ACTIVE
        sub.updated_at = datetime.utcnow()

    # Send payment confirmation email (skip zero-amount invoices like free trials)
    amount_paid = invoice.get("amount_paid", 0)
    if amount_paid > 0:
        user_result = await db.execute(select(User).where(User.id == sub.user_id))
        paid_user = user_result.scalar_one_or_none()
        if paid_user:
            currency = invoice.get("currency", "eur").upper()
            amount_str = f"€{amount_paid / 100:.2f}" if currency == "EUR" else f"{amount_paid / 100:.2f} {currency}"
            period_end_ts = invoice.get("period_end")
            period_end_str = datetime.fromtimestamp(period_end_ts).strftime("%d %B %Y") if period_end_ts else ""
            asyncio.create_task(send_payment_success_email(
                to_email=paid_user.email,
                name=paid_user.full_name or paid_user.email,
                plan_name=sub.plan.value,
                amount=amount_str,
                next_billing_date=period_end_str,
                lang=getattr(paid_user, 'language', 'fr'),
            ))
            # Renewal confirmation — only for returning subscribers (account > 35 days old)
            if paid_user.created_at and paid_user.created_at < datetime.utcnow() - timedelta(days=35):
                asyncio.create_task(send_renewal_confirmed_email(
                    to_email=paid_user.email,
                    name=paid_user.full_name or paid_user.email,
                    plan_name=sub.plan.value,
                    amount=amount_str,
                    next_renewal_date=period_end_str,
                    lang=getattr(paid_user, 'language', 'fr'),
                ))


async def _handle_trial_ending(db: AsyncSession, stripe_sub: dict):
    """Called 3 days before trial ends. Log for email trigger."""
    customer_id = stripe_sub.get("customer")
    if not customer_id:
        return

    result = await db.execute(
        select(Subscription).where(Subscription.stripe_customer_id == customer_id)
    )
    sub = result.scalar_one_or_none()
    if not sub:
        return

    user_result = await db.execute(
        select(User).where(User.id == sub.user_id)
    )
    user = user_result.scalar_one_or_none()
    if not user:
        return

    trial_end = datetime.fromtimestamp(stripe_sub["trial_end"]) if stripe_sub.get("trial_end") else None

    logger.info(
        "trial_ending_soon",
        email=user.email,
        plan=sub.plan.value,
        trial_end=trial_end.isoformat() if trial_end else None,
    )
    trial_end_str = trial_end.strftime("%d %B %Y") if trial_end else ""
    asyncio.create_task(send_trial_ending_email(
        to_email=user.email,
        name=user.full_name or user.email,
        plan=sub.plan.value.lower(),
        trial_end_date=trial_end_str,
        lang="fr",
    ))
