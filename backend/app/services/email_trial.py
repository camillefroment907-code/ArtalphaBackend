"""
Nautilus Trial & Onboarding Emails (5-10)
"""
from app.services.email_base import html_email, label, cta, divider, send_email, TRANSAC_FROM


def _first_name(name: str, email: str) -> str:
    return (name or "").split()[0] or email.split("@")[0]


async def send_trial_started_email(to_email: str, name: str, trial_end_date: str, plan: str = "investor") -> bool:
    """Email 5 — trial started J0"""
    first = _first_name(name, to_email)
    plan_label = {"starter": "Collector", "investor": "Investor", "pro": "Family Office"}.get(plan, plan.title())
    feature_block = lambda title, desc: f'<div style="background:#F5F4F0;border-left:3px solid #C6A85A;padding:16px 20px;margin:12px 0;"><strong style="color:#1A2A44;font-family:Georgia,serif;">{title}</strong><p style="margin:8px 0 0;font-size:14px;color:#555;">{desc}</p></div>'
    content = f"""
{label("YOUR TRIAL")}
<h1>7 days of full access. Use them well.</h1>
<p>Your trial gives you access to everything Nautilus offers — real-time opportunity scoring, Larry your AI analyst, Investment Memos, and the full Explorer. Here's how to get the most from it.</p>
{feature_block("The Explorer", "Browse 500+ scored opportunities. Filter by conviction score, category, price. Everything is ranked by AI.")}
{feature_block("Larry", "Ask him anything. Which artists are gaining momentum? Is this lot undervalued? What should I buy with €15,000?")}
{feature_block("Investment Memos", "Generate a full analyst report on any lot in seconds.")}
{divider()}
{cta("Start exploring now", "https://www.get-nautilus.com/app/explore", gold=True)}
<p style="color:#888888;font-size:13px;">Trial ends {trial_end_date}. No charge until then.</p>
"""
    return await send_email(to_email, f"Your 7-day Nautilus trial has started, {first}.",
                            html_email(content, "Your trial has started"), TRANSAC_FROM)


async def send_trial_ending_email(to_email: str, name: str, trial_end_date: str, plan: str = "investor") -> bool:
    """Email 9 — trial ending 48h"""
    first = _first_name(name, to_email)
    comparison = """<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
<tr>
<td width="48%" style="background:#F5F4F0;padding:20px;vertical-align:top;">
<div style="font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:#888;margin-bottom:12px;">Free Plan</div>
<div style="font-size:13px;color:#666;line-height:2;">3 lots/day<br>No Larry<br>No memos<br>No alerts</div>
</td>
<td width="4%"></td>
<td width="48%" style="background:#1A2A44;padding:20px;vertical-align:top;">
<div style="font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:#C6A85A;margin-bottom:12px;">Your Current Plan</div>
<div style="font-size:13px;color:#FFFFFF;line-height:2;">Unlimited lots<br>Larry AI Analyst<br>Investment Memos<br>Real-time alerts</div>
</td>
</tr>
</table>"""
    content = f"""
{label("TRIAL ENDING")}
<h1>Don't lose your edge.</h1>
<p>Your 7-day trial ends on <strong>{trial_end_date}</strong>. After that, your access will be limited to the free plan — 3 lots per day, no Larry, no Investment Memos.</p>
{comparison}
{divider()}
<p>Keep everything from €19/month. Your first acquisition pays for years of subscription.</p>
{cta("Keep my access", "https://www.get-nautilus.com/app/pricing", gold=True)}
<p style="color:#888888;font-size:13px;">30-day money-back guarantee. Cancel anytime.</p>
"""
    return await send_email(to_email, f"Your trial ends in 48 hours, {first}.",
                            html_email(content, "Trial ending soon"), TRANSAC_FROM)


async def send_trial_expired_email(to_email: str, name: str, days_since_trial_end: int = 1, new_exceptional_count: int = 3, plan: str = "investor") -> bool:
    """Email 10 — trial expired, not converted"""
    first = _first_name(name, to_email)
    content = f"""
{label("A FINAL NOTE")}
<h1>The market kept moving.</h1>
<p>Your trial ended {days_since_trial_end} day(s) ago. Since then, Nautilus has identified <strong>{new_exceptional_count} exceptional opportunities</strong> — including lots by artists you explored during your trial.</p>
<p>Reactivate today and get your first month at 20% off. Code: <strong style="color:#C6A85A;font-size:18px;">COMEBACK20</strong></p>
{cta("Reactivate at -20%", "https://www.get-nautilus.com/app/pricing?coupon=COMEBACK20", gold=True)}
<p style="color:#888888;font-size:13px;">Offer valid for 7 days. After that, standard pricing applies.</p>
"""
    return await send_email(to_email, "Your trial is over — but your edge doesn't have to be.",
                            html_email(content, "Your trial is over"), TRANSAC_FROM)
