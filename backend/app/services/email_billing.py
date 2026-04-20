"""
Nautilus Billing Emails (11-18)
"""
from app.services.email_base import html_email, label, cta, stat_row, divider, send_email, TRANSAC_FROM


def _first_name(name: str, email: str) -> str:
    return (name or "").split()[0] or email.split("@")[0]


async def send_payment_success_email(to_email: str, name: str, plan_name: str, amount: str, next_billing_date: str) -> bool:
    """Email 11 — Stripe checkout.session.completed"""
    first = _first_name(name, to_email)
    receipt = f"""<div style="background:#F5F4F0;padding:24px;margin:20px 0;">
<div style="font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:#888;font-family:Arial,sans-serif;margin-bottom:16px;">Payment Receipt</div>
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-size:13px;color:#888;padding-bottom:8px;">Plan</td><td style="font-size:14px;font-weight:600;color:#1A2A44;text-align:right;">{plan_name}</td></tr>
<tr><td style="font-size:13px;color:#888;padding-bottom:8px;">Amount</td><td style="font-size:14px;font-weight:600;color:#1A2A44;text-align:right;">{amount}/month</td></tr>
<tr><td style="font-size:13px;color:#888;">Next billing</td><td style="font-size:14px;color:#555;text-align:right;">{next_billing_date}</td></tr>
</table>
</div>"""
    content = f"""
{label("CONFIRMED")}
<h1>Access confirmed. The market is yours.</h1>
<p>Your {plan_name} subscription is active. Everything is ready.</p>
{receipt}
{cta("Go to your dashboard", "https://www.get-nautilus.com/app/dashboard", gold=True)}
{divider()}
<p style="font-size:13px;color:#888;">Remember — 30-day money-back guarantee. If Nautilus doesn't deliver value in your first 30 days, email us and we refund in full. No questions.</p>
"""
    return await send_email(to_email, f"You're in. Welcome to Nautilus {plan_name}, {first}.",
                            html_email(content, "Payment confirmed"), TRANSAC_FROM)


async def send_payment_failed_email(to_email: str, name: str, amount: str, plan_name: str, retry_date: str, stripe_billing_portal_url: str) -> bool:
    """Email 12 — invoice.payment_failed"""
    first = _first_name(name, to_email)
    content = f"""
{label("PAYMENT ISSUE")}
<h1>We couldn't process your payment.</h1>
<p>Your payment of <strong>{amount}</strong> for Nautilus {plan_name} failed. Your access continues while we retry, but please update your payment method to avoid interruption.</p>
{cta("Update payment method", stripe_billing_portal_url)}
<p style="color:#888888;font-size:13px;">We'll retry on {retry_date}. If payment fails again, your account will be downgraded to the free plan.</p>
"""
    return await send_email(to_email, "Action required: your payment didn't go through.",
                            html_email(content, "Payment failed"), TRANSAC_FROM)


async def send_payment_retry_email(to_email: str, name: str, plan_name: str, stripe_billing_portal_url: str) -> bool:
    """Email 13 — 3 days after first payment failure"""
    first = _first_name(name, to_email)
    content = f"""
{label("URGENT")}
<h1>Your access is at risk.</h1>
<p>We've been unable to process your payment for 3 days. To keep your {plan_name} access, please update your payment method now.</p>
{cta("Update now — takes 30 seconds", stripe_billing_portal_url, gold=True)}
"""
    return await send_email(to_email, "Last reminder: update your payment method.",
                            html_email(content, "Last reminder"), TRANSAC_FROM)


async def send_subscription_cancelled_email(to_email: str, name: str, plan_name: str, access_until: str) -> bool:
    """Email 14 — customer.subscription.deleted"""
    first = _first_name(name, to_email)
    reason_btns = """<div style="margin:16px 0;">
<a href="https://www.get-nautilus.com/feedback?reason=price" style="display:inline-block;border:1px solid #E8E4DC;padding:8px 16px;margin:4px;font-size:12px;color:#555;text-decoration:none;border-radius:3px;">Too expensive</a>
<a href="https://www.get-nautilus.com/feedback?reason=features" style="display:inline-block;border:1px solid #E8E4DC;padding:8px 16px;margin:4px;font-size:12px;color:#555;text-decoration:none;border-radius:3px;">Missing features I needed</a>
<a href="https://www.get-nautilus.com/feedback?reason=alternative" style="display:inline-block;border:1px solid #E8E4DC;padding:8px 16px;margin:4px;font-size:12px;color:#555;text-decoration:none;border-radius:3px;">Found an alternative</a>
<a href="https://www.get-nautilus.com/feedback?reason=usage" style="display:inline-block;border:1px solid #E8E4DC;padding:8px 16px;margin:4px;font-size:12px;color:#555;text-decoration:none;border-radius:3px;">Not using it enough</a>
</div>"""
    content = f"""
{label("CANCELLATION CONFIRMED")}
<h1>Subscription cancelled.</h1>
<p>Your Nautilus {plan_name} subscription has been cancelled. You'll keep full access until <strong>{access_until}</strong>.</p>
<p>Before you go — we'd love to understand what we could have done better:</p>
{reason_btns}
{divider()}
<p>Changed your mind? You can reactivate anytime.</p>
{cta("Reactivate my account", "https://www.get-nautilus.com/app/pricing")}
"""
    return await send_email(to_email, f"Subscription cancelled — your access continues until {access_until}.",
                            html_email(content, "Subscription cancelled"), TRANSAC_FROM)


async def send_annual_expiring_email(to_email: str, name: str, plan_name: str, renewal_date: str, annual_amount: str, stripe_billing_portal_url: str) -> bool:
    """Email 15 — annual subscription ends in 7 days"""
    first = _first_name(name, to_email)
    content = f"""
{label("RENEWAL REMINDER")}
<h1>Your annual membership renews on {renewal_date}.</h1>
<p>Your Nautilus {plan_name} annual membership will auto-renew on <strong>{renewal_date}</strong> for <strong>{annual_amount}</strong>. No action needed if you'd like to continue.</p>
<p>To cancel or change your plan before renewal:</p>
{cta("Manage my subscription", stripe_billing_portal_url)}
"""
    return await send_email(to_email, f"Your annual Nautilus membership renews in 7 days.",
                            html_email(content, "Annual renewal reminder"), TRANSAC_FROM)


async def send_upgrade_confirmed_email(to_email: str, name: str, old_plan: str, new_plan: str, features: list[str] = None) -> bool:
    """Email 16 — plan upgrade detected"""
    first = _first_name(name, to_email)
    features = features or ["Unlimited opportunity access", "Larry AI Analyst — unlimited queries", "Investment Memo generation", "Real-time price alerts", "Portfolio tracking & valuation"]
    features_html = "".join(
        f'<div style="padding:8px 0;border-bottom:1px solid #F0EDE8;font-size:14px;color:#444;"><span style="color:#C6A85A;margin-right:10px;">&#10003;</span>{f}</div>'
        for f in features
    )
    content = f"""
{label("UPGRADE CONFIRMED")}
<h1>You just unlocked more.</h1>
<p>Your plan has been upgraded from <strong>{old_plan}</strong> to <strong>{new_plan}</strong>. Here's what's now available to you:</p>
<div style="margin:20px 0;">{features_html}</div>
{cta("Explore your new features", "https://www.get-nautilus.com/app/dashboard", gold=True)}
"""
    return await send_email(to_email, f"Upgraded. Welcome to Nautilus {new_plan}, {first}.",
                            html_email(content, "Upgrade confirmed"), TRANSAC_FROM)


async def send_downgrade_confirmed_email(to_email: str, name: str, old_plan: str, new_plan: str, effective_date: str) -> bool:
    """Email 17 — plan downgrade detected"""
    first = _first_name(name, to_email)
    content = f"""
{label("PLAN CHANGE")}
<h1>Plan updated to {new_plan}.</h1>
<p>Your Nautilus plan has been changed to <strong>{new_plan}</strong>. Your new limits take effect on <strong>{effective_date}</strong>.</p>
<p style="color:#888;">Your previous {old_plan} plan features will remain active until {effective_date}.</p>
{cta("View all plans", "https://www.get-nautilus.com/app/pricing")}
"""
    return await send_email(to_email, "Your plan has been updated.",
                            html_email(content, "Plan updated"), TRANSAC_FROM)


async def send_renewal_confirmed_email(to_email: str, name: str, plan_name: str, amount: str, next_renewal_date: str) -> bool:
    """Email 18 — successful annual renewal"""
    first = _first_name(name, to_email)
    receipt = f"""<div style="background:#F5F4F0;padding:24px;margin:20px 0;">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-size:13px;color:#888;padding-bottom:8px;">Amount renewed</td><td style="font-size:14px;font-weight:600;color:#1A2A44;text-align:right;">{amount}</td></tr>
<tr><td style="font-size:13px;color:#888;">Next renewal</td><td style="font-size:14px;color:#555;text-align:right;">{next_renewal_date}</td></tr>
</table>
</div>"""
    content = f"""
{label("RENEWED")}
<h1>Thank you, {first}.</h1>
<p>Your Nautilus {plan_name} membership has been renewed for another year. We're glad you're staying.</p>
{receipt}
{cta("Back to your dashboard", "https://www.get-nautilus.com/app/dashboard")}
"""
    return await send_email(to_email, "Renewed. Another year of Nautilus intelligence.",
                            html_email(content, "Membership renewed"), TRANSAC_FROM)
