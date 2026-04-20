"""
Nautilus Institutional & B2B Emails (48-49)
"""
from app.services.email_base import (
    html_email, label, cta, lot_card, stat_row, divider,
    send_email, send_admin_notification, TRANSAC_FROM, ALERT_FROM,
)


def _first_name(name: str, email: str) -> str:
    return (name or "").split()[0] or email.split("@")[0]


async def send_institutional_contact_email(
    to_email: str,
    name: str,
    company: str = "",
    message: str = "",
    phone: str = "",
) -> bool:
    """Email 48 — institutional contact form response + admin notification"""
    first = _first_name(name, to_email)

    # Send confirmation to the prospect
    content = f"""
{label("INSTITUTIONAL INQUIRY")}
<h1>We'll be in touch within 24 hours.</h1>
<p>Thank you for reaching out about Nautilus Institutional. We've received your inquiry and a member of our team will contact you within one business day to discuss your specific needs.</p>
<p>In the meantime, you have full access to the Nautilus platform. Larry can already answer many questions about the art market and how Nautilus works.</p>
{cta("Explore the platform", "https://www.get-nautilus.com/app/dashboard")}
"""
    sent = await send_email(
        to_email,
        "Thank you for your interest in Nautilus Institutional",
        html_email(content, "Institutional inquiry received"),
        TRANSAC_FROM,
    )

    # Send notification to admin
    admin_html = html_email(
        f"""
{label("NEW INSTITUTIONAL INQUIRY")}
<h1>New institutional contact form submission.</h1>
<div style="background:#F5F4F0;padding:24px;margin:20px 0;">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-size:12px;color:#888;padding-bottom:8px;">Name</td><td style="font-size:14px;color:#1A2A44;">{name}</td></tr>
<tr><td style="font-size:12px;color:#888;padding-bottom:8px;">Email</td><td style="font-size:14px;color:#1A2A44;">{to_email}</td></tr>
<tr><td style="font-size:12px;color:#888;padding-bottom:8px;">Company</td><td style="font-size:14px;color:#1A2A44;">{company or "—"}</td></tr>
<tr><td style="font-size:12px;color:#888;padding-bottom:8px;">Phone</td><td style="font-size:14px;color:#1A2A44;">{phone or "—"}</td></tr>
<tr><td style="font-size:12px;color:#888;vertical-align:top;padding-top:8px;">Message</td><td style="font-size:14px;color:#1A2A44;">{message or "—"}</td></tr>
</table>
</div>
""",
        "New Institutional Inquiry",
    )
    await send_admin_notification(
        f"New Institutional Inquiry — {name} ({company or to_email})",
        admin_html,
    )
    return sent


async def send_family_office_report_email(
    to_email: str,
    name: str,
    month: str,
    year: str,
    macro_context: str,
    categories: list,           # list of dicts: {name, pct_change, volume}
    notable_transactions: list, # list of dicts: {artist, title, hammer, house, note}
    institutional_artists: list, # list of dicts: {name, signal}
    top_lots: list,              # list of dicts: {artist, title, house, date, estimate, score, upside}
    portfolio_summary: str,
    upcoming_sales: list,        # list of str
) -> bool:
    """Email 49 — monthly family office report, 1st of month"""
    first = _first_name(name, to_email)

    cats_html = "".join(
        f'<div style="padding:10px 0;border-bottom:1px solid #F0EDE8;">'
        f'<div style="display:flex;justify-content:space-between;align-items:center;">'
        f'<span style="font-family:Georgia,serif;color:#1A2A44;">{c.get("name", "")}</span>'
        f'<span style="font-weight:600;color:{"#2D7A4F" if c.get("pct_change", 0) >= 0 else "#C0392B"};">'
        f'{"+" if c.get("pct_change", 0) >= 0 else ""}{c.get("pct_change", 0):.1f}%</span></div>'
        f'<div style="font-size:11px;color:#888;margin-top:2px;">Volume: {c.get("volume", "—")}</div></div>'
        for c in categories[:6]
    )

    transactions_html = "".join(
        f'<div style="background:#F5F4F0;border-left:3px solid #C6A85A;padding:16px 20px;margin:10px 0;">'
        f'<div style="font-family:Georgia,serif;color:#1A2A44;">{t.get("artist", "")}</div>'
        f'<div style="font-size:13px;font-style:italic;color:#555;">{t.get("title", "")}</div>'
        f'<div style="font-weight:600;color:#1A2A44;margin-top:8px;">{t.get("hammer", "")} at {t.get("house", "")}</div>'
        f'<div style="font-size:12px;color:#888;margin-top:4px;">{t.get("note", "")}</div></div>'
        for t in notable_transactions[:4]
    )

    inst_html = "".join(
        f'<div style="padding:10px 0;border-bottom:1px solid #F0EDE8;">'
        f'<strong style="color:#1A2A44;">{a.get("name", "")}</strong>'
        f'<div style="font-size:12px;color:#888;margin-top:2px;">{a.get("signal", "")}</div></div>'
        for a in institutional_artists[:4]
    )

    lots_html = "".join(
        lot_card(
            l.get("artist", "").upper(),
            l.get("title", ""),
            f'{l.get("house", "")} · {l.get("date", "")}',
            f'Est. {l.get("estimate", "")}',
            upside=f'+{l.get("upside", 0)}% potential upside' if l.get("upside") else "",
            score=l.get("score", 0),
        )
        for l in top_lots[:5]
    )

    upcoming = " · ".join(upcoming_sales[:6]) if upcoming_sales else "—"

    content = f"""
{label("FAMILY OFFICE INTELLIGENCE")}
<h1>Your monthly art market briefing.</h1>
<h2>Macro Market Context</h2>
<p>{macro_context}</p>
{divider()}
<h2>Category Performance</h2>
<div style="margin:16px 0;">{cats_html}</div>
{divider()}
<h2>Notable Transactions This Month</h2>
{transactions_html}
{divider()}
<h2>Institutional Artist Movements</h2>
<div style="margin:16px 0;">{inst_html}</div>
{divider()}
<h2>Opportunities Matching Your Profile</h2>
{lots_html}
{divider()}
<h2>Portfolio Performance</h2>
<p>{portfolio_summary}</p>
{divider()}
<h2>Upcoming Major Sales</h2>
<p style="color:#555;font-size:14px;">{upcoming}</p>
{cta("Full analysis in your dashboard", "https://www.get-nautilus.com/app/dashboard")}
"""
    return await send_email(
        to_email,
        f"Nautilus Monthly Intelligence — {month} {year}",
        html_email(content, f"Family Office Intelligence — {month} {year}"),
        ALERT_FROM,
    )
