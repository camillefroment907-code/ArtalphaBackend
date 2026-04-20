"""
Nautilus Auth Emails (1-4)
- Email verification
- Welcome (post-verification)
- Password reset
- Email changed confirmation
"""
from app.services.email_base import html_email, label, cta, stat_row, divider, send_email, TRANSAC_FROM


def _first_name(name: str, email: str) -> str:
    return (name or "").split()[0] or email.split("@")[0]


async def send_verification_email(to_email: str, verification_link: str) -> bool:
    """Email 1 — triggered after POST /api/auth/register"""
    content = f"""
{label("ACCOUNT SETUP")}
<h1>Verify your email to access Nautilus.</h1>
<p>You're one step away from accessing real-time art market intelligence. Click below to verify your email address.</p>
{cta("Verify my email address", verification_link)}
<p style="color:#888888;font-size:13px;">This link expires in 24 hours. If you didn't create a Nautilus account, you can safely ignore this email.</p>
"""
    return await send_email(to_email, "Please verify your email address",
                            html_email(content, "Please verify your email address"), TRANSAC_FROM)


async def send_welcome_email(to_email: str, name: str, plan: str = "free", lots_tracked: int = 12847, avg_conviction: int = 74) -> bool:
    """Email 2 — triggered after email verification confirmed"""
    first = _first_name(name, to_email)
    plan_label = {"free": "Free", "starter": "Collector", "investor": "Investor", "pro": "Family Office", "elite": "Institutional"}.get(plan, plan.title())
    content = f"""
{label("WELCOME")}
<h1>Your edge starts now.</h1>
<p>Nautilus scans thousands of auction lots across 30+ global sources, scores every opportunity with AI, and surfaces what the market hasn't priced yet. You now have access.</p>
{stat_row((f"{lots_tracked:,}", "Lots Tracked"), (f"{avg_conviction}/100", "Avg Conviction"), (plan_label, "Your Plan"))}
{divider()}
<h2>Three things to do first</h2>
<p><strong>1. Complete your profile</strong> so Nautilus can personalize your opportunities.</p>
<p><strong>2. Ask Larry anything</strong> — he knows every artist, every market trend, every lot in our database.</p>
<p><strong>3. Browse your first opportunities</strong> in the Explorer.</p>
{cta("Go to your dashboard", "https://www.get-nautilus.com/app/dashboard", gold=True)}
<p style="color:#888888;font-size:13px;">Questions? Reply to this email — we read everything.</p>
"""
    return await send_email(to_email, f"Welcome to Nautilus, {first}.",
                            html_email(content, f"Welcome to Nautilus, {first}."), TRANSAC_FROM)


async def send_password_reset_email(to_email: str, reset_link: str) -> bool:
    """Email 3 — triggered by forgot password flow"""
    content = f"""
{label("SECURITY")}
<h1>Password reset requested.</h1>
<p>We received a request to reset the password for your Nautilus account. Click below to choose a new password.</p>
{cta("Reset my password", reset_link)}
<p style="color:#888888;font-size:13px;">This link expires in 1 hour. If you didn't request this, your account is safe — someone may have entered your email by mistake.</p>
"""
    return await send_email(to_email, "Reset your Nautilus password",
                            html_email(content, "Reset your Nautilus password"), TRANSAC_FROM)


async def send_email_changed_email(to_email: str, new_email: str, reset_link: str) -> bool:
    """Email 4 — triggered when user changes email in settings"""
    content = f"""
{label("ACCOUNT")}
<h1>Email address updated.</h1>
<p>Your Nautilus account email has been changed to <strong>{new_email}</strong>. If you made this change, no action is needed.</p>
<p>If you did <strong>NOT</strong> make this change, please contact us immediately at contact@get-nautilus.com or reset your password now.</p>
{cta("Secure my account", reset_link)}
"""
    return await send_email(to_email, "Your email address has been updated",
                            html_email(content, "Your email address has been updated"), TRANSAC_FROM)
