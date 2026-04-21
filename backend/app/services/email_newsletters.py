"""
Nautilus Newsletter & Content Emails (31-37)
"""
from app.services.email_base import html_email, label, cta, lot_card, stat_row, divider, send_email, TRANSAC_FROM, ALERT_FROM


async def send_weekly_brief_email(
    to_email: str, week_date: str,
    top_lots: list[dict],       # list of {artist, title, house, date, estimate, score}
    artists_to_watch: list[dict],  # list of {name, pct_change, direction}
    market_insight: str,
    closing_lots: list[dict],   # list of {artist, title, house, date, estimate, score}
) -> bool:
    """Email 31 — weekly intelligence brief, Monday 8am, paid users"""
    top_lots_html = "".join(
        lot_card(
            l.get("artist", "").upper(),
            l.get("title", ""),
            f'{l.get("house", "")} \u00b7 {l.get("date", "")}',
            f'Est. {l.get("estimate", "")}',
            score=l.get("score", 0),
        )
        for l in top_lots[:3]
    )
    artists_html = "".join(
        (
            '<div style="padding:10px 0;border-bottom:1px solid #F0EDE8;">'
            f'<span style="font-family:Georgia,serif;color:#1A2A44;">{a.get("name", "")}</span> '
            '<span style="color:{color};font-weight:600;font-size:13px;">{arrow} {pct}%</span>'
            "</div>"
        ).format(
            color="#2D7A4F" if a.get("direction", "up") == "up" else "#C0392B",
            arrow="\u2191" if a.get("direction", "up") == "up" else "\u2193",
            pct=abs(a.get("pct_change", 0)),
        ).replace('{a.get("name", "")}', a.get("name", ""))
        for a in artists_to_watch[:2]
    )
    # Rebuild artists_html without nested f-string interpolation issues
    artists_html_parts = []
    for a in artists_to_watch[:2]:
        color = "#2D7A4F" if a.get("direction", "up") == "up" else "#C0392B"
        arrow = "\u2191" if a.get("direction", "up") == "up" else "\u2193"
        pct = abs(a.get("pct_change", 0))
        name = a.get("name", "")
        artists_html_parts.append(
            f'<div style="padding:10px 0;border-bottom:1px solid #F0EDE8;">'
            f'<span style="font-family:Georgia,serif;color:#1A2A44;">{name}</span> '
            f'<span style="color:{color};font-weight:600;font-size:13px;">{arrow} {pct}%</span>'
            f"</div>"
        )
    artists_html = "".join(artists_html_parts)

    closing_html = "".join(
        lot_card(
            l.get("artist", "").upper(),
            l.get("title", ""),
            f'{l.get("house", "")} \u00b7 Closes {l.get("date", "")}',
            f'Est. {l.get("estimate", "")}',
            score=l.get("score", 0),
        )
        for l in closing_lots[:2]
    )
    content = f"""
{label("WEEKLY INTELLIGENCE")}
<h1>What matters this week.</h1>
<h2>Top Opportunities</h2>
{top_lots_html}
{divider()}
<h2>Artists to Watch</h2>
<div style="margin:16px 0;">{artists_html}</div>
{divider()}
<h2>One Market Insight</h2>
<p>{market_insight}</p>
{divider()}
<h2>Closing Soon</h2>
{closing_html}
{cta("See all your opportunities", "https://www.get-nautilus.com/app/explore?tab=for-you", gold=True)}
"""
    return await send_email(
        to_email,
        f"Your Nautilus brief \u2014 week of {week_date}",
        html_email(content, f"Nautilus brief \u2014 {week_date}"),
        ALERT_FROM,
    )


async def send_monthly_report_email(
    to_email: str, month: str, year: str,
    exceptional_lots: int, avg_conviction: int, total_lots_scanned: int,
    top_categories: list[dict],   # {name, pct_change}
    notable_sales: list[dict],    # {artist, title, hammer, house, note}
    artists_next_month: list[str],
) -> bool:
    """Email 32 — monthly market report, 1st of month 9am"""
    cats_html_parts = []
    for c in top_categories[:5]:
        pct = c.get("pct_change", 0)
        color = "#2D7A4F" if pct > 0 else "#C0392B"
        sign = "+" if pct > 0 else ""
        name = c.get("name", "")
        cats_html_parts.append(
            f'<div style="padding:8px 0;border-bottom:1px solid #F0EDE8;">'
            f'<span style="color:#1A2A44;">{name}</span> '
            f'<span style="color:{color};font-weight:600;">{sign}{pct}%</span>'
            f"</div>"
        )
    cats_html = "".join(cats_html_parts)

    sales_html = "".join(
        f'<div style="background:#F5F4F0;border-left:3px solid #C6A85A;padding:16px 20px;margin:10px 0;">'
        f'<div style="font-family:Georgia,serif;color:#1A2A44;">{s.get("artist", "")}</div>'
        f'<div style="font-size:13px;color:#555;">{s.get("title", "")}</div>'
        f'<div style="font-weight:600;color:#1A2A44;margin-top:8px;">{s.get("hammer", "")} at {s.get("house", "")}</div>'
        f'<div style="font-size:12px;color:#888;margin-top:4px;">{s.get("note", "")}</div>'
        f"</div>"
        for s in notable_sales[:3]
    )
    next_artists = ", ".join(artists_next_month[:4]) if artists_next_month else "\u2014"
    content = f"""
{label("MONTHLY INTELLIGENCE")}
<h1>The art market in {month}.</h1>
{stat_row((str(exceptional_lots), "Exceptional Lots"), (f"{avg_conviction}/100", "Avg Conviction"), (f"{total_lots_scanned:,}", "Lots Scanned"))}
<h2>Top Performing Categories</h2>
<div style="margin:16px 0;">{cats_html}</div>
{divider()}
<h2>Notable Sales</h2>
{sales_html}
{divider()}
<h2>Artists to Watch Next Month</h2>
<p>{next_artists}</p>
{cta("Full market dashboard", "https://www.get-nautilus.com/app/market")}
"""
    return await send_email(
        to_email,
        f"Nautilus Market Report \u2014 {month} {year}",
        html_email(content, f"Market Report \u2014 {month} {year}"),
        ALERT_FROM,
    )


async def send_sale_analysis_email(
    to_email: str, sale_name: str, total_lots: int, sold_pct: int,
    above_estimate_pct: int, top_result: str,
    top_results: list[dict],  # {artist, title, hammer, estimate}
    analysis_paragraph: str, blog_post_url: str,
) -> bool:
    """Email 33 — post-sale analysis, within 2h of major evening sale"""
    results_html = "".join(
        f'<div style="background:#F5F4F0;border-left:3px solid #C6A85A;padding:16px 20px;margin:10px 0;">'
        f'<div style="font-family:Georgia,serif;color:#1A2A44;">{r.get("artist", "")}</div>'
        f'<div style="font-size:13px;font-style:italic;color:#555;">{r.get("title", "")}</div>'
        f'<div style="font-weight:600;color:#1A2A44;margin-top:8px;">{r.get("hammer", "")} '
        f'<span style="font-size:12px;color:#888;">(est. {r.get("estimate", "")})</span></div>'
        f"</div>"
        for r in top_results[:3]
    )
    content = f"""
{label("SALE ANALYSIS")}
<h1>{sale_name} \u2014 what happened.</h1>
<p>The {sale_name} has concluded. Here\u2019s what Nautilus detected.</p>
{stat_row((str(total_lots), "Total Lots"), (f"{sold_pct}%", "Sold"), (f"{above_estimate_pct}%", "Above Estimate"), (top_result, "Top Result"))}
<h2>Top Results</h2>
{results_html}
{divider()}
<p>{analysis_paragraph}</p>
{cta("See full analysis on the blog", blog_post_url)}
"""
    return await send_email(
        to_email,
        f"Nautilus analysis: {sale_name} results",
        html_email(content, f"Sale analysis: {sale_name}"),
        ALERT_FROM,
    )


async def send_artist_spotlight_email(
    to_email: str, artist_name: str, movement: str, nationality: str,
    period_active: str, price_history: str,
    signals: list[str],       # 2-3 specific market signals
    current_lots: list[dict], # {title, house, estimate, score}
    artist_page_url: str,
) -> bool:
    """Email 34 — artist spotlight, monthly"""
    signals_html = "".join(
        f'<div style="padding:8px 0;border-bottom:1px solid #F0EDE8;font-size:14px;color:#444;">'
        f'<span style="color:#C6A85A;margin-right:8px;">\u2192</span>{s}'
        f"</div>"
        for s in signals[:3]
    )
    lots_html = "".join(
        lot_card(
            artist_name.upper(),
            l.get("title", ""),
            f'{l.get("house", "")} \u00b7 Est. {l.get("estimate", "")}',
            f'Est. {l.get("estimate", "")}',
            score=l.get("score", 0),
        )
        for l in current_lots[:2]
    )
    content = f"""
{label("ARTIST SPOTLIGHT")}
<h1>{artist_name} \u2014 why now.</h1>
<div style="background:#F5F4F0;padding:20px 24px;margin:20px 0;">
<div style="font-size:12px;color:#888;margin-bottom:4px;">{nationality} \u00b7 {movement} \u00b7 {period_active}</div>
</div>
<h2>Price History</h2>
<p>{price_history}</p>
<h2>Why the Market Is Moving</h2>
<div style="margin:16px 0;">{signals_html}</div>
{divider()}
<h2>Current Lots</h2>
{lots_html}
{cta(f"Explore lots by {artist_name}", artist_page_url, gold=True)}
"""
    return await send_email(
        to_email,
        f"Artist Spotlight: {artist_name}",
        html_email(content, f"Artist Spotlight: {artist_name}"),
        ALERT_FROM,
    )


async def send_lot_of_week_email(
    to_email: str, score: int, artist_name: str, lot_title: str,
    auction_house: str, estimate: str, sale_date: str,
    analysis: str, comparable_sales: str, lot_url: str,
) -> bool:
    """Email 35 — lot of the week, Friday 10am"""
    lot_details = f"{auction_house} · {sale_date}"
    lot_estimate = f"Est. {estimate}"
    content = f"""
{label("EDITORIAL PICK")}
<h1>Why this lot is interesting.</h1>
{lot_card(artist_name.upper(), lot_title, lot_details, lot_estimate, score=score)}
<h2>Nautilus Analysis</h2>
<p>{analysis}</p>
<h2>Comparable Sales</h2>
<p style="color:#888;font-size:13px;">{comparable_sales}</p>
{cta("View this lot", lot_url, gold=True)}
"""
    return await send_email(
        to_email,
        f"This week\u2019s most interesting lot \u2014 Score {score}/100",
        html_email(content, "Lot of the week"),
        ALERT_FROM,
    )


async def send_quarterly_outlook_email(
    to_email: str, quarter: str, year: str,
    trends: list[str],                    # 3-4 key trends
    categories_to_watch: list[dict],      # {name, rationale}
    upcoming_sales: list[str],            # upcoming major sales
) -> bool:
    """Email 36 — quarterly market outlook"""
    trends_html = "".join(
        f'<div style="padding:10px 0;border-bottom:1px solid #F0EDE8;font-size:14px;color:#444;">'
        f'<span style="color:#C6A85A;margin-right:8px;">\u00b7</span>{t}'
        f"</div>"
        for t in trends[:4]
    )
    cats_html = "".join(
        f'<div style="background:#F5F4F0;border-left:3px solid #C6A85A;padding:16px 20px;margin:10px 0;">'
        f'<strong style="color:#1A2A44;">{c.get("name", "")}</strong>'
        f'<p style="margin:8px 0 0;font-size:13px;color:#555;">{c.get("rationale", "")}</p>'
        f"</div>"
        for c in categories_to_watch[:3]
    )
    sales_list = " \u00b7 ".join(upcoming_sales[:5]) if upcoming_sales else "\u2014"
    content = f"""
{label("QUARTERLY OUTLOOK")}
<h1>What to watch this quarter.</h1>
<h2>Key Market Trends</h2>
<div style="margin:16px 0;">{trends_html}</div>
{divider()}
<h2>Categories to Watch</h2>
{cats_html}
{divider()}
<h2>Upcoming Major Sales</h2>
<p style="color:#555;font-size:14px;">{sales_list}</p>
{cta("Update your strategy with Larry", "https://www.get-nautilus.com/app/agent")}
"""
    return await send_email(
        to_email,
        f"Art Market Outlook \u2014 {quarter} {year}",
        html_email(content, f"Market Outlook {quarter} {year}"),
        ALERT_FROM,
    )


async def send_annual_review_email(
    to_email: str, name: str, year: str,
    lots_scanned: int, exceptional_opps: int,
    top_artists: list[str], top_categories: list[str],
    top_5_results: list[dict],  # {artist, title, hammer, house}
    user_lots_viewed: int, user_larry_queries: int,
    user_portfolio_change_pct: float, user_exceptional_count: int,
    new_year: str,
) -> bool:
    """Email 37 — annual art market review, January 15"""
    first = (name or "").split()[0] or to_email.split("@")[0]  # noqa: F841
    results_html = "".join(
        f'<div style="padding:10px 0;border-bottom:1px solid #F0EDE8;">'
        f'<span style="font-family:Georgia,serif;color:#1A2A44;">{r.get("artist", "")}</span>'
        f' \u2014 <em style="color:#555;">{r.get("title", "")}</em> '
        f'<span style="font-weight:600;color:#1A2A44;">{r.get("hammer", "")}</span> '
        f'<span style="font-size:12px;color:#888;">at {r.get("house", "")}</span>'
        f"</div>"
        for r in top_5_results[:5]
    )
    portfolio_color = "#2D7A4F" if user_portfolio_change_pct >= 0 else "#C0392B"
    portfolio_display = f'{"+" if user_portfolio_change_pct >= 0 else ""}{user_portfolio_change_pct:.1f}%'
    content = f"""
{label("ANNUAL REVIEW")}
<h1>The year in art investment.</h1>
{stat_row((f"{lots_scanned:,}", "Lots Scanned"), (str(exceptional_opps), "Exceptional Opps"), (", ".join(top_artists[:2]), "Top Artists"))}
<h2>Top 5 Results of {year}</h2>
<div style="margin:16px 0;">{results_html}</div>
{divider()}
<h2>Your Year on Nautilus</h2>
{stat_row(
    (str(user_lots_viewed), "Opportunities Reviewed"),
    (str(user_larry_queries), "Larry Queries"),
    (f'<span style="color:{portfolio_color}">{portfolio_display}</span>', "Portfolio Change"),
    (str(user_exceptional_count), "Exceptional Lots Seen"),
)}
<p>Thank you for being a Nautilus member. Here\u2019s to another year of finding what others miss.</p>
{cta(f"Start {new_year} with your strategy", "https://www.get-nautilus.com/app/dashboard", gold=True)}
"""
    return await send_email(
        to_email,
        f"The art market in {year} \u2014 Nautilus Annual Review",
        html_email(content, f"Annual Review {year}"),
        ALERT_FROM,
    )
