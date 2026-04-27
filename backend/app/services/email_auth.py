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


async def send_welcome_email(to_email: str, name: str, plan: str = "free", lots_tracked: int = 12847, avg_conviction: int = 74, artists_tracked: int = 1200) -> bool:
    """Email 2 — triggered after email verification confirmed"""
    first = _first_name(name, to_email)
    plan_label = {"free": "Free", "starter": "Collector", "investor": "Investor", "pro": "Family Office", "elite": "Institutional"}.get(plan, plan.title())
    unsubscribe_url = "https://www.get-nautilus.com/app/portfolio"
    html = f"""<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1.0" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <title>Welcome to Nautilus</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=Inter:wght@400;500;600&display=swap');
    </style>
  </head>
  <body style="margin:0;padding:0;background-color:#F5F4F0;font-family:'Inter',Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F5F4F0;">
      <tr>
        <td align="center" style="padding:40px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
            <!-- HEADER -->
            <tr>
              <td style="background-color:#FFFFFF;padding:28px 40px 24px 40px;border-top:3px solid #C6A85A;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td valign="middle">
                      <img src="https://www.get-nautilus.com/logo.png" alt="Nautilus" width="36" height="36" style="display:inline-block;vertical-align:middle;margin-right:10px;" />
                      <span style="display:inline-block;vertical-align:middle;">
                        <span style="display:block;color:#0C1622;font-family:'Inter',Arial,Helvetica,sans-serif;font-size:17px;font-weight:600;letter-spacing:-0.01em;line-height:1.2;">Nautilus</span>
                        <span style="display:block;color:#AAAAAA;font-family:'Inter',Arial,Helvetica,sans-serif;font-size:10px;font-weight:400;letter-spacing:0.04em;line-height:1.4;">Art Market Intelligence</span>
                      </span>
                    </td>
                    <td align="right" valign="middle">
                      <span style="background-color:#C6A85A;color:#1A2A44;font-size:9px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;padding:5px 12px;border-radius:3px;font-family:'Inter',Arial,Helvetica,sans-serif;">{plan_label}</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <!-- HEADER DIVIDER -->
            <tr>
              <td style="background-color:#FFFFFF;padding:0 40px;">
                <hr style="border:none;border-top:1px solid #E8E4DC;margin:0;" />
              </td>
            </tr>
            <!-- HERO -->
            <tr>
              <td style="background-color:#FFFFFF;padding:36px 40px 28px 40px;">
                <p style="color:#C6A85A;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;margin:0 0 16px 0;font-family:'Inter',Arial,Helvetica,sans-serif;font-weight:500;">WELCOME · ACCESS CONFIRMED</p>
                <h1 style="color:#1A2A44;font-family:Georgia,serif;font-size:28px;font-weight:normal;line-height:1.3;margin:0 0 24px 0;">Your edge starts now, {first}.</h1>
                <p style="color:#555555;font-size:14px;line-height:1.75;margin:0;font-family:'Inter',Arial,Helvetica,sans-serif;">Your account is live. Every auction lot in our database is now scored, ranked, and waiting for you — with the exact data you need to act before the market does.</p>
              </td>
            </tr>
            <!-- STATS BAR -->
            <tr>
              <td style="background-color:#FFFFFF;padding:0 40px 32px 40px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td width="31%" align="center" style="background-color:#F5F4F0;padding:20px 10px;">
                      <div style="color:#4B6DF5;font-family:'Playfair Display',Georgia,serif;font-size:26px;font-weight:700;line-height:1;">{lots_tracked:,}</div>
                      <div style="color:#888888;font-family:'Inter',Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:0.14em;text-transform:uppercase;margin-top:6px;">Lots Tracked</div>
                    </td>
                    <td width="2%" style="background-color:#FFFFFF;"></td>
                    <td width="31%" align="center" style="background-color:#F5F4F0;padding:20px 10px;">
                      <div style="color:#4B6DF5;font-family:'Playfair Display',Georgia,serif;font-size:26px;font-weight:700;line-height:1;">{avg_conviction}/100</div>
                      <div style="color:#888888;font-family:'Inter',Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:0.14em;text-transform:uppercase;margin-top:6px;">Avg Conviction</div>
                    </td>
                    <td width="2%" style="background-color:#FFFFFF;"></td>
                    <td width="34%" align="center" style="background-color:#0C1622;padding:20px 10px;">
                      <div style="color:#4B6DF5;font-family:'Playfair Display',Georgia,serif;font-size:22px;font-weight:700;line-height:1;">{artists_tracked:,}</div>
                      <div style="color:rgba(255,255,255,0.4);font-family:'Inter',Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:0.14em;text-transform:uppercase;margin-top:6px;">Artists Tracked</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <!-- DIVIDER -->
            <tr>
              <td style="background-color:#FFFFFF;padding:0 40px;">
                <hr style="border:none;border-top:1px solid #E8E4DC;margin:0 0 28px 0;" />
              </td>
            </tr>
            <!-- 3 STEPS -->
            <tr>
              <td style="background-color:#FFFFFF;padding:0 40px 28px 40px;">
                <p style="color:#0C1622;font-family:'Playfair Display',Georgia,serif;font-size:20px;font-weight:700;margin:0 0 18px 0;">Three things to do first</p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px;">
                  <tr>
                    <td style="background-color:#F5F4F0;border-left:3px solid #C6A85A;padding:14px 18px;">
                      <p style="color:#0C1622;font-family:'Inter',Arial,Helvetica,sans-serif;font-size:13px;font-weight:600;margin:0 0 4px 0;">1. Browse the Explorer</p>
                      <p style="color:#666666;font-family:'Inter',Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;margin:0;">Every lot ranked by conviction score. Filter by category, budget, signal tier. See exactly why each lot is priced where it is.</p>
                    </td>
                  </tr>
                </table>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px;">
                  <tr>
                    <td style="background-color:#F5F4F0;border-left:3px solid #C6A85A;padding:14px 18px;">
                      <p style="color:#0C1622;font-family:'Inter',Arial,Helvetica,sans-serif;font-size:13px;font-weight:600;margin:0 0 4px 0;">2. Ask Larry — your AI analyst</p>
                      <p style="color:#666666;font-family:'Inter',Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;margin:0;">Which artist is gaining momentum? Is this lot mispriced? What's the right entry on a Chagall print? He answers in seconds.</p>
                    </td>
                  </tr>
                </table>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="background-color:#F5F4F0;border-left:3px solid #C6A85A;padding:14px 18px;">
                      <p style="color:#0C1622;font-family:'Inter',Arial,Helvetica,sans-serif;font-size:13px;font-weight:600;margin:0 0 4px 0;">3. Generate an Investment Memo</p>
                      <p style="color:#666666;font-family:'Inter',Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;margin:0;">Full analyst report on any lot in 30 seconds — price targets, comparable sales, risk factors, buy/hold/pass verdict.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <!-- CTA -->
            <tr>
              <td style="background-color:#FFFFFF;padding:0 40px 40px 40px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td align="center">
                      <a href="https://get-nautilus.com/app/explore" style="display:block;background-color:#4B6DF5;color:#FFFFFF;font-family:'Inter',Arial,Helvetica,sans-serif;font-size:15px;font-weight:600;letter-spacing:0.01em;text-decoration:none;padding:15px 32px;border-radius:8px;text-align:center;">Open the Explorer &#8594;</a>
                    </td>
                  </tr>
                </table>
                <p style="color:#888888;font-family:'Inter',Arial,Helvetica,sans-serif;font-size:12px;text-align:center;margin:16px 0 0 0;">Questions? Reply to this email &#8212; we read everything.</p>
              </td>
            </tr>
            <!-- FOOTER -->
            <tr>
              <td style="padding:24px 40px;text-align:center;border-top:1px solid #E8E4DC;">
                <p style="color:#AAAAAA;font-family:'Inter',Arial,Helvetica,sans-serif;font-size:11px;line-height:1.7;margin:0 0 6px 0;">Nautilus &#183; Art Market Intelligence &#183; <a href="https://get-nautilus.com" style="color:#AAAAAA;text-decoration:underline;">get-nautilus.com</a><br /><a href="{unsubscribe_url}" style="color:#AAAAAA;text-decoration:underline;">Unsubscribe</a> &nbsp;&#183;&nbsp; <a href="https://get-nautilus.com/legal/privacy" style="color:#AAAAAA;text-decoration:underline;">Privacy Policy</a></p>
                <p style="color:#CCCCCC;font-family:'Inter',Arial,Helvetica,sans-serif;font-size:10px;font-style:italic;margin:0;">Not financial advice. Art investment carries risk of loss.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>"""
    return await send_email(to_email, f"Welcome to Nautilus, {first}.",
                            html, TRANSAC_FROM)


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
