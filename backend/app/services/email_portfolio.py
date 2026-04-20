"""
Nautilus Portfolio & Performance Emails (38-42)
"""
from app.services.email_base import html_email, label, cta, lot_card, stat_row, divider, send_email, TRANSAC_FROM


def _first_name(name: str, email: str) -> str:
    return (name or "").split()[0] or email.split("@")[0]


async def send_portfolio_valuation_email(
    to_email: str, name: str, month: str,
    total_value: str, monthly_change_pct: float, total_return_pct: float,
    artists: list[dict],  # {name, value, change_pct, direction}
) -> bool:
    """Email 38 — monthly portfolio valuation, 1st of month"""
    first = _first_name(name, to_email)  # noqa: F841
    change_color = "#2D7A4F" if monthly_change_pct >= 0 else "#C0392B"
    return_color = "#2D7A4F" if total_return_pct >= 0 else "#C0392B"
    change_display = f'{"+" if monthly_change_pct >= 0 else ""}{monthly_change_pct:.1f}%'
    return_display = f'{"+" if total_return_pct >= 0 else ""}{total_return_pct:.1f}%'

    artists_html_parts = []
    for a in (artists or [])[:6]:
        pct = a.get("change_pct", 0)
        color = "#2D7A4F" if pct >= 0 else "#C0392B"
        sign = "+" if pct >= 0 else ""
        a_name = a.get("name", "")
        a_value = a.get("value", "")
        artists_html_parts.append(
            f'<div style="padding:10px 0;border-bottom:1px solid #F0EDE8;display:flex;justify-content:space-between;align-items:center;">'
            f'<div>'
            f'<span style="font-family:Georgia,serif;color:#1A2A44;">{a_name}</span>'
            f'<div style="font-size:12px;color:#888;margin-top:2px;">{a_value}</div>'
            f"</div>"
            f'<div style="font-weight:600;color:{color};">{sign}{pct:.1f}%</div>'
            f"</div>"
        )
    artists_html = "".join(artists_html_parts)

    content = f"""
{label("PORTFOLIO UPDATE")}
<h1>Your collection this month.</h1>
{stat_row(
    (total_value, "Estimated Value"),
    (f'<span style="color:{change_color}">{change_display}</span>', "Monthly Change"),
    (f'<span style="color:{return_color}">{return_display}</span>', "Total Return"),
)}
{('<div style="margin:20px 0;">' + artists_html + "</div>") if artists_html else ""}
<p style="color:#888;font-size:12px;font-style:italic;">Estimated values based on comparable recent auction sales. Not a guarantee of future sale price.</p>
{cta("View full portfolio", "https://www.get-nautilus.com/app/portfolio")}
"""
    return await send_email(
        to_email,
        f"Your Nautilus portfolio \u2014 {month} update",
        html_email(content, f"Portfolio update \u2014 {month}"),
        TRANSAC_FROM,
    )


async def send_performance_vs_market_email(
    to_email: str, name: str, user_return_pct: float, index_return_pct: float,
    period: str,
) -> bool:
    """Email 39 — performance vs market, quarterly"""
    first = _first_name(name, to_email)  # noqa: F841
    user_color = "#C6A85A" if user_return_pct >= 0 else "#FF6B6B"
    index_color = "#2D7A4F" if index_return_pct >= 0 else "#C0392B"
    user_sign = "+" if user_return_pct >= 0 else ""
    index_sign = "+" if index_return_pct >= 0 else ""
    comparison = (
        '<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">'
        "<tr>"
        '<td width="48%" style="background:#1A2A44;padding:24px;text-align:center;">'
        '<div style="font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:#C6A85A;margin-bottom:8px;">Your Tracked Acquisitions</div>'
        f'<div style="font-size:36px;font-family:Georgia,serif;color:{user_color};">'
        f"{user_sign}{user_return_pct:.1f}%</div>"
        "</td>"
        '<td width="4%"></td>'
        '<td width="48%" style="background:#F5F4F0;padding:24px;text-align:center;">'
        '<div style="font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:#888;margin-bottom:8px;">Nautilus Art Index</div>'
        f'<div style="font-size:36px;font-family:Georgia,serif;color:{index_color};">'
        f"{index_sign}{index_return_pct:.1f}%</div>"
        "</td>"
        "</tr>"
        "</table>"
    )
    content = f"""
{label("PERFORMANCE ANALYSIS")}
<h1>You vs the market.</h1>
{comparison}
<p style="color:#888;font-size:13px;">Based on the works you\u2019ve tracked in Nautilus over the past {period}.</p>
{cta("See your full analysis", "https://www.get-nautilus.com/app/portfolio")}
"""
    return await send_email(
        to_email,
        "Your picks vs the market \u2014 how did you do?",
        html_email(content, "Performance vs market"),
        TRANSAC_FROM,
    )


async def send_artwork_anniversary_email(
    to_email: str, artwork_title: str, artist_name: str,
    original_estimate: str, current_estimate: str, pct_change: float,
    comparable_sales_count: int,
) -> bool:
    """Email 40 — artwork anniversary, 1 year after portfolio item added"""
    change_color = "#2D7A4F" if pct_change >= 0 else "#C0392B"
    change_display = f'{"+" if pct_change >= 0 else ""}{pct_change:.1f}%'
    content = f"""
{label("ONE YEAR AGO")}
<h1>{artwork_title} \u2014 one year on.</h1>
<p>A year ago, you added <em>{artwork_title}</em> by <strong>{artist_name}</strong> to your Nautilus portfolio at an estimated value of {original_estimate}.</p>
<p>Based on comparable sales over the past year, Nautilus now estimates this work at <strong>{current_estimate}</strong> \u2014 a change of <span style="color:{change_color};font-weight:600;">{change_display}</span>.</p>
{stat_row(
    (original_estimate, "Original Estimate"),
    (current_estimate, "Current Estimate"),
    (f'<span style="color:{change_color}">{change_display}</span>', "Change"),
    (str(comparable_sales_count), "Comparable Sales"),
)}
{cta("View updated analysis", "https://www.get-nautilus.com/app/portfolio")}
"""
    return await send_email(
        to_email,
        f"One year ago, you saved {artwork_title}. It may be worth more now.",
        html_email(content, f"Artwork anniversary: {artwork_title}"),
        TRANSAC_FROM,
    )


async def send_tax_reminder_email(to_email: str, name: str) -> bool:
    """Email 41 — tax report reminder, December 1"""
    first = _first_name(name, to_email)  # noqa: F841
    content = f"""
{label("YEAR-END REMINDER")}
<h1>Your 2026 art activity \u2014 export now.</h1>
<p>For your records and tax purposes, you can download a complete history of your Nautilus activity \u2014 lots tracked, artworks in portfolio, estimated values, and valuation changes \u2014 in CSV or PDF format.</p>
{cta("Export my history", "https://www.get-nautilus.com/app/portfolio/export")}
<p style="color:#888888;font-size:13px;">Nautilus does not provide tax advice. Consult a tax professional for guidance on art investment taxation in your jurisdiction.</p>
"""
    return await send_email(
        to_email,
        "Year-end: download your Nautilus transaction history",
        html_email(content, "Year-end export reminder"),
        TRANSAC_FROM,
    )


async def send_portfolio_diversification_email(
    to_email: str, name: str, concentrated_category: str, pct_concentrated: int,
    diversification_lots: list[dict],  # {artist, title, details, estimate, score}
) -> bool:
    """Email 42 — portfolio concentration alert"""
    first = _first_name(name, to_email)  # noqa: F841
    lots_html = "".join(
        lot_card(
            l.get("artist", "").upper(),
            l.get("title", ""),
            l.get("details", ""),
            f'Est. {l.get("estimate", "")}',
            score=l.get("score", 0),
        )
        for l in diversification_lots[:3]
    )
    content = f"""
{label("PORTFOLIO INTELLIGENCE")}
<h1>Your collection is concentrated.</h1>
<p>Nautilus analysis shows <strong>{pct_concentrated}%</strong> of your tracked portfolio value is in <strong>{concentrated_category}</strong>. Concentration increases risk \u2014 market downturns in this segment could significantly affect your overall art portfolio.</p>
<p>Opportunities that would balance your exposure, within your taste profile:</p>
{lots_html}
{cta("Explore diversification options", "https://www.get-nautilus.com/app/explore")}
"""
    return await send_email(
        to_email,
        f"Your portfolio may be over-concentrated in {concentrated_category}",
        html_email(content, "Portfolio diversification alert"),
        TRANSAC_FROM,
    )
