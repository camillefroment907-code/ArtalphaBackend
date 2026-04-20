"""
Nautilus Engagement & Retention Emails (43-47)
"""
from app.services.email_base import html_email, label, cta, lot_card, stat_row, divider, send_email, TRANSAC_FROM


def _first_name(name: str, email: str) -> str:
    return (name or "").split()[0] or email.split("@")[0]


async def send_nps_email(to_email: str, name: str, user_id: str) -> bool:
    """Email 43 — NPS survey, 7 days after signup"""
    first = _first_name(name, to_email)
    base_url = f"https://www.get-nautilus.com/api/feedback/nps?user_id={user_id}&score="

    score_buttons = ""
    for i in range(11):
        if i >= 9:
            bg, color = "#1A2A44", "#FFFFFF"
        elif i >= 7:
            bg, color = "#C6A85A", "#1A2A44"
        else:
            bg, color = "#F5F4F0", "#555555"
        score_buttons += (
            f'<td style="padding:2px;">'
            f'<a href="{base_url}{i}" style="display:inline-block;width:40px;height:40px;'
            f'background:{bg};color:{color};text-align:center;line-height:40px;'
            f'font-family:Arial,sans-serif;font-size:13px;font-weight:700;'
            f'text-decoration:none;border-radius:4px;">{i}</a></td>'
        )

    content = f"""
{label("ONE QUESTION")}
<h1>How is Nautilus working for you?</h1>
<p>You've been using Nautilus for a week. One quick question:</p>
<p><strong>On a scale of 0–10, how likely are you to recommend Nautilus to a fellow collector?</strong></p>
<table cellpadding="0" cellspacing="0" style="margin:24px 0;">
  <tr>{score_buttons}</tr>
</table>
<table cellpadding="0" cellspacing="0" style="width:440px;margin-bottom:24px;">
  <tr>
    <td style="font-size:11px;color:#AAAAAA;font-family:Arial,sans-serif;">Not at all</td>
    <td style="text-align:right;font-size:11px;color:#AAAAAA;font-family:Arial,sans-serif;">Absolutely</td>
  </tr>
</table>
<p style="color:#888;font-size:13px;">Takes 5 seconds. Your feedback directly shapes the platform.</p>
"""
    return await send_email(
        to_email,
        f"Quick question, {first}.",
        html_email(content, "Quick question"),
        TRANSAC_FROM,
    )


async def send_reengagement_14_email(
    to_email: str,
    name: str,
    exceptional_count: int,
    artist_movement: str,
    market_shift: str,
    current_lots: list,  # list of dicts: {artist, title, house, date, estimate, score}
) -> bool:
    """Email 44 — re-engagement after 14 days inactive"""
    first = _first_name(name, to_email)
    items_html = f"""<div style="margin:20px 0;">
<div style="padding:12px 0;border-bottom:1px solid #F0EDE8;"><span style="color:#C6A85A;margin-right:8px;">·</span><strong>{exceptional_count} exceptional lots</strong> identified — including works in categories you follow</div>
<div style="padding:12px 0;border-bottom:1px solid #F0EDE8;"><span style="color:#C6A85A;margin-right:8px;">·</span>{artist_movement}</div>
<div style="padding:12px 0;"><span style="color:#C6A85A;margin-right:8px;">·</span>{market_shift}</div>
</div>"""
    lots_html = "".join(
        lot_card(
            l.get("artist", "").upper(),
            l.get("title", ""),
            f'{l.get("house", "")} · {l.get("date", "")}',
            f'Est. {l.get("estimate", "")}',
            score=l.get("score", 0),
        )
        for l in current_lots[:2]
    )
    content = f"""
{label("WHAT YOU MISSED")}
<h1>The market didn't wait.</h1>
<p>You haven't logged in for 14 days. Here's what Nautilus detected while you were away:</p>
{items_html}
{lots_html}
{cta("See what's waiting", "https://www.get-nautilus.com/app/explore", gold=True)}
"""
    return await send_email(
        to_email,
        f"Three things changed on Nautilus while you were away, {first}",
        html_email(content, "What you missed"),
        TRANSAC_FROM,
    )


async def send_reengagement_30_email(to_email: str, name: str) -> bool:
    """Email 45 — re-engagement after 30 days inactive"""
    first = _first_name(name, to_email)
    content = f"""
{label("A PERSONAL NOTE")}
<h1>Are you still collecting?</h1>
<p>It's been a month since you last visited Nautilus. We'd like you back.</p>
<p>Use code <strong style="color:#C6A85A;font-size:18px;">RETURN30</strong> for 30% off your first paid month when you upgrade.</p>
{cta("Return to Nautilus", "https://www.get-nautilus.com/app/pricing?coupon=RETURN30", gold=True)}
<p style="color:#888888;font-size:13px;">Offer valid 7 days from today.</p>
"""
    return await send_email(
        to_email,
        f"We miss you, {first}. Here's an offer.",
        html_email(content, "We miss you"),
        TRANSAC_FROM,
    )


async def send_winback_email(to_email: str, name: str) -> bool:
    """Email 46 — winback 7 days post-cancellation"""
    first = _first_name(name, to_email)
    content = f"""
{label("WE NOTICED")}
<h1>You cancelled. We get it.</h1>
<p>Whatever the reason, we respect your decision. But if you're still active in the art market — collecting, investing, or simply watching — Nautilus may still be useful.</p>
<p>Come back for 3 months at half price. Code: <strong style="color:#C6A85A;font-size:18px;">COMEBACK50</strong></p>
{cta("Try again at -50%", "https://www.get-nautilus.com/app/pricing?coupon=COMEBACK50")}
<p style="color:#888888;font-size:13px;">No pressure. Offer valid for 14 days.</p>
"""
    return await send_email(
        to_email,
        f"The market is still moving, {first}.",
        html_email(content, "Come back"),
        TRANSAC_FROM,
    )


async def send_anniversary_email(
    to_email: str,
    name: str,
    lots_viewed: int,
    larry_queries: int,
    portfolio_change_pct: float,
    exceptional_count: int,
) -> bool:
    """Email 47 — 1-year anniversary"""
    first = _first_name(name, to_email)
    pct_color = "#2D7A4F" if portfolio_change_pct >= 0 else "#C0392B"
    pct_display = f'{"+" if portfolio_change_pct >= 0 else ""}{portfolio_change_pct:.1f}%'
    content = f"""
{label("ONE YEAR")}
<h1>A year of intelligence.</h1>
<p>A year ago, you joined Nautilus. Here's what happened since.</p>
{stat_row(
    (str(lots_viewed), "Opportunities Reviewed"),
    (str(larry_queries), "Larry Queries"),
    (f'<span style="color:{pct_color}">{pct_display}</span>', "Portfolio Change"),
    (str(exceptional_count), "Exceptional Lots Seen"),
)}
<p>Thank you for being a Nautilus member. Here's to another year of finding what others miss.</p>
{cta("See what's next", "https://www.get-nautilus.com/app/explore", gold=True)}
"""
    return await send_email(
        to_email,
        f"One year on Nautilus, {first}. Here's your recap.",
        html_email(content, "One year on Nautilus"),
        TRANSAC_FROM,
    )
