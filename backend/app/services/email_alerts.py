"""
Nautilus Recommendation & Alert Emails (19-30)
"""
from typing import Optional
from datetime import datetime
from app.services.email_base import html_email, label, cta, lot_card, stat_row, divider, send_email, TRANSAC_FROM, ALERT_FROM


async def _under_weekly_limit(user_id: str, email_type: str, db, limit: int = 1) -> bool:
    """Returns True if the user has received fewer than `limit` emails of this type in the last 7 days."""
    if not user_id or not db:
        return True
    from sqlalchemy import select, func
    from datetime import timedelta
    from app.models.db_models import EmailSentLog
    cutoff = datetime.utcnow() - timedelta(days=7)
    result = await db.execute(
        select(func.count()).select_from(EmailSentLog).where(
            EmailSentLog.user_id == str(user_id),
            EmailSentLog.email_type == email_type,
            EmailSentLog.sent_at >= cutoff,
        )
    )
    count = result.scalar() or 0
    return count < limit


async def _log_email(user_id: str, email_type: str, db) -> None:
    """Records that an email of this type was sent to the user."""
    if not user_id or not db:
        return
    from app.models.db_models import EmailSentLog
    from datetime import datetime as _dt
    log = EmailSentLog(user_id=str(user_id), email_type=email_type, sent_at=_dt.utcnow())
    db.add(log)
    await db.commit()


async def _pref_ok(user_id: Optional[str], pref_field: str, db) -> bool:
    """Returns False if the user has disabled this alert type (or email entirely)."""
    if not user_id or not db:
        return True
    from sqlalchemy import select
    from app.models.db_models import UserAlertPreferences
    result = await db.execute(
        select(UserAlertPreferences).where(UserAlertPreferences.user_id == user_id)
    )
    prefs = result.scalar_one_or_none()
    if not prefs:
        return True
    if not prefs.email_notifications:
        return False
    return bool(getattr(prefs, pref_field, True))


async def send_alert_exceptional_email(
    to_email: str, artist_name: str, score: int, auction_house: str,
    lot_title: str, sale_date: str, location: str, estimate_range: str,
    upside_pct: int, lot_url: str, days_until_close: int,
    user_id: Optional[str] = None, db=None,
    lot_image_url: Optional[str] = None,
    lang: str = "fr",
    estimate_low_eur: float = 0,
) -> bool:
    """Email 19 — exceptional lot for followed artist (score >= 80)"""
    if not await _pref_ok(user_id, "exceptional_opportunity", db): return False
    is_fr = lang == "fr"
    _house_display = auction_house.split(":")[0].strip()
    _house_display = _house_display[:35] + "..." if len(_house_display) > 35 else _house_display

    image_block = (
        f'<div style="padding:0 0 20px 0;">'
        f'<a href="{lot_url}" style="display:block;">'
        f'<img src="{lot_image_url}" alt="{lot_title}" '
        f'style="width:100%;max-height:260px;object-fit:cover;border-radius:6px;display:block;">'
        f'</a></div>'
    ) if lot_image_url else ""

    potential_gain = int(estimate_low_eur * upside_pct / 100) if estimate_low_eur and upside_pct else 0
    comparable_value = int(estimate_low_eur + potential_gain) if potential_gain else 0

    _label = "SIGNAL À FORTE CONVICTION" if is_fr else "HIGH CONVICTION SIGNAL"
    _h1 = f"{artist_name} est en vente aux enchères." if is_fr else f"{artist_name} is going up for auction."
    _body = (
        f"Nautilus a détecté un signal à <strong>{score}/100</strong> sur cette œuvre de <strong>{artist_name}</strong> chez {_house_display}. "
        f"Le lot apparaît positionné significativement sous les transactions comparables récentes."
        if is_fr else
        f"Nautilus has identified a <strong>{score}/100</strong> conviction signal on this work by <strong>{artist_name}</strong> at {_house_display}. "
        f"The lot appears significantly below recent comparable transactions."
    )
    _estimation_label = "Estimation maison de vente" if is_fr else "Auction house estimate"
    _decote_label = "Décote estimée vs comparables" if is_fr else "Estimated discount vs comparables"
    _gain_line = (
        f"Valeur comparable estimée : ~€{comparable_value:,} · Gain potentiel : +€{potential_gain:,}"
        if is_fr else
        f"Estimated comparable value: ~€{comparable_value:,} · Potential gain: +€{potential_gain:,}"
    ) if potential_gain else ""
    _conviction_label = "Conviction basée sur :" if is_fr else "Signal based on:"
    _conviction_bullets = (
        "<li>Estimation conservatrice vs comparables récents</li>"
        "<li>Offre secondaire limitée sur ce segment</li>"
        "<li>Momentum de marché positif détecté</li>"
        if is_fr else
        "<li>Conservative estimate vs recent comparables</li>"
        "<li>Limited secondary supply in this segment</li>"
        "<li>Positive market momentum detected</li>"
    )
    _proof = "Analyse Nautilus · données marché secondaire · 1,5M+ transactions" if is_fr else "Nautilus analysis · secondary market data · 1.5M+ transactions"
    _cta = "Voir l'analyse complète" if is_fr else "View full analysis"
    _closing = (
        f"Ce lot se clôture dans {days_until_close} jour(s). Les signaux au-dessus de 80 représentent nos convictions les plus fortes."
        if is_fr else
        f"This lot closes in {days_until_close} day(s). Signals above 80 represent our highest conviction."
    )
    _subject = f"{artist_name} · Score {score}/100 · {_house_display}"
    _footer = "Nautilus fournit de l'intelligence marché, pas des conseils en investissement." if is_fr else "Nautilus provides market intelligence, not investment advice."

    gain_block = (
        f'<div style="font-size:12px;color:#555;margin-bottom:4px;">↑ {"Valeur comparable estimée" if is_fr else "Estimated comparable value"} : ~€{comparable_value:,}</div>'
        f'<div style="font-size:13px;color:#16A34A;font-weight:600;margin-bottom:14px;">{"Gain potentiel" if is_fr else "Potential gain"} : +€{potential_gain:,}</div>'
    ) if potential_gain else ""

    content = f"""
{label(_label)}
<h1>{_h1}</h1>
<p>{_body}</p>
{image_block}
<table cellpadding="0" cellspacing="0" width="100%" style="margin:20px 0;">
<tr><td style="background:#F5F4F0;border-left:3px solid #C6A85A;padding:20px 24px;border-radius:0 8px 8px 0;">
  <div style="font-size:10px;color:#888;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:6px;">{artist_name.upper()}</div>
  <div style="font-size:18px;font-family:Georgia,serif;color:#0C1622;margin-bottom:4px;">{lot_title}</div>
  <div style="font-size:12px;color:#888;margin-bottom:16px;">{_house_display} · {sale_date}</div>
  <hr style="border:none;border-top:1px solid #E8E4DC;margin:0 0 16px 0;">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;margin-bottom:12px;">
    <div>
      <div style="font-size:10px;color:#888;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px;">{_estimation_label}</div>
      <div style="font-size:20px;font-weight:700;color:#0C1622;">{estimate_range}</div>
    </div>
    <div>
      <div style="font-size:10px;color:#888;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px;">Score</div>
      <div style="background:#C6A85A;color:#1A2A44;font-size:14px;font-weight:700;padding:4px 12px;border-radius:4px;display:inline-block;">{score}/100</div>
    </div>
  </div>
  <div style="font-size:13px;color:#888;margin-bottom:8px;">&#8595; {_decote_label} : -{upside_pct}%</div>
  {gain_block}
  <hr style="border:none;border-top:1px solid #E8E4DC;margin:0 0 14px 0;">
  <div style="font-size:11px;color:#555;font-weight:600;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.08em;">{_conviction_label}</div>
  <ul style="font-size:12px;color:#555;margin:0;padding-left:16px;line-height:1.9;">{_conviction_bullets}</ul>
  <div style="font-size:10px;color:#aaa;margin-top:12px;font-style:italic;">{_proof}</div>
</td></tr>
</table>
<div style="text-align:center;margin:24px 0;">{cta(_cta, lot_url, gold=True)}</div>
<p style="color:#888;font-size:12px;text-align:center;">{_closing}</p>
<p style="color:#aaa;font-size:11px;text-align:center;">{_footer}</p>
"""
    return await send_email(to_email, _subject, html_email(content, f"Signal: {artist_name}"), ALERT_FROM)


async def send_price_gap_alert_email(
    to_email: str, artist_name: str, gap_pct: int, score: int,
    estimate: str, historical_avg: str, lot_url: str, sale_date: str,
    user_id: Optional[str] = None, db=None,
) -> bool:
    """Email 20 — lot price significantly below historical median"""
    if not await _pref_ok(user_id, "lot_below_market", db): return False
    if user_id and not await _under_weekly_limit(user_id, "price_gap_alert", db): return False
    comparison = f"""<div style="background:#F5F4F0;border-left:3px solid #C6A85A;padding:20px 24px;margin:20px 0;">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-size:12px;color:#888;padding-bottom:8px;">Current estimate</td><td style="font-size:16px;font-weight:600;color:#1A2A44;text-align:right;">{estimate}</td></tr>
<tr><td style="font-size:12px;color:#888;padding-bottom:8px;">Historical average for comparable works</td><td style="font-size:16px;font-weight:600;color:#1A2A44;text-align:right;">{historical_avg}</td></tr>
<tr><td style="font-size:12px;color:#2D7A4F;font-weight:600;">Gap</td><td style="font-size:16px;font-weight:600;color:#2D7A4F;text-align:right;">{gap_pct}% below market</td></tr>
</table>
</div>"""
    content = f"""
{label("PRICE ALERT")}
<h1>{artist_name} is significantly below market.</h1>
<p>A {artist_name} has appeared at auction priced <strong>{gap_pct}%</strong> below the historical average for comparable works. Nautilus conviction score: <strong>{score}/100</strong>.</p>
{comparison}
{cta("View the lot", lot_url)}
<p style="color:#888888;font-size:13px;">Sale closes {sale_date}. Past performance does not guarantee future results.</p>
"""
    sent = await send_email(to_email, f"{artist_name} priced {gap_pct}% below market average",
                            html_email(content, f"Price alert: {artist_name}"), ALERT_FROM)
    if sent and user_id:
        await _log_email(user_id, "price_gap_alert", db)
    return sent


async def send_watchlist_closing_email(
    to_email: str, lot_title: str, artist_name: str, auction_house: str,
    estimate: str, score: int, closing_time: str, lot_url: str,
    user_id: Optional[str] = None, db=None,
) -> bool:
    """Email 21 — watchlist lot closing in 48h"""
    if not await _pref_ok(user_id, "auction_closing_24h", db): return False
    content = f"""
{label("CLOSING SOON")}
<h1>Last chance — lot on your watchlist.</h1>
<p>A lot you saved to your watchlist closes in less than 48 hours.</p>
{lot_card(artist_name.upper(), lot_title, f"{auction_house} · Closes {closing_time}", f"Est. {estimate}", score=score)}
{cta("View before it closes", lot_url, gold=True)}
"""
    return await send_email(to_email, f"A lot on your watchlist closes tomorrow — {lot_title}",
                            html_email(content, "Watchlist lot closing soon"), ALERT_FROM)


async def send_artist_record_email(
    to_email: str, artist_name: str, hammer_price: str, auction_house: str,
    pct_above_previous: int, previous_record: str, artist_page_url: str,
    user_id: Optional[str] = None, db=None,
) -> bool:
    """Email 22 — artist in favorites sets new auction record"""
    if not await _pref_ok(user_id, "artist_momentum_change", db): return False
    content = f"""
{label("NEW RECORD")}
<h1>{artist_name} reached a new high.</h1>
<p>{artist_name} just sold for <strong>{hammer_price}</strong> at {auction_house} — a new auction record, up <strong>{pct_above_previous}%</strong> from the previous record of {previous_record}.</p>
<p>What this means for you: works by {artist_name} in your watchlist or portfolio may now be worth more than previously estimated.</p>
{stat_row((hammer_price, "New Record"), (previous_record, "Previous Record"), (f"+{pct_above_previous}%", "Increase"))}
{cta(f"See current lots by {artist_name}", artist_page_url)}
"""
    return await send_email(to_email, f"{artist_name} just set a new record at auction",
                            html_email(content, f"New record: {artist_name}"), ALERT_FROM)


async def send_weekly_momentum_email(
    to_email: str, momentum_artists: list[dict], top_lots: list[dict],
    user_id: Optional[str] = None, db=None,
) -> bool:
    """Email 23 — weekly momentum signal, Monday 8am"""
    if not await _pref_ok(user_id, "weekly_brief", db): return False
    artists_html = ""
    for a in momentum_artists[:5]:
        trend = "&#8593;" if a.get("momentum_pct", 0) > 0 else "&#8595;"
        color = "#2D7A4F" if a.get("momentum_pct", 0) > 0 else "#C0392B"
        artists_html += (
            f'<div style="padding:12px 0;border-bottom:1px solid #F0EDE8;display:flex;justify-content:space-between;">'
            f'<span style="font-family:Georgia,serif;color:#1A2A44;">{a.get("name", "")}</span>'
            f'<span style="color:{color};font-weight:600;">{trend} {abs(a.get("momentum_pct", 0))}%</span>'
            f'</div>'
        )

    lots_html = "".join(
        lot_card(
            l.get("artist", "").upper(),
            l.get("title", ""),
            f'{l.get("house", "")} · {l.get("date", "")}',
            f'Est. {l.get("estimate", "")}',
            score=l.get("score", 0)
        )
        for l in top_lots[:2]
    )
    content = f"""
{label("WEEKLY INTELLIGENCE")}
<h1>This week's market signals.</h1>
<p>Five artists with significant price momentum detected by Nautilus this week.</p>
<div style="margin:20px 0;">{artists_html}</div>
{divider()}
<h2>Top opportunities for you</h2>
{lots_html}
{cta("See all opportunities", "https://www.get-nautilus.com/app/explore", gold=True)}
<p style="color:#888888;font-size:13px;">Personalized for your profile. Update your preferences in settings.</p>
"""
    return await send_email(to_email, "Artists with momentum this week — Nautilus Signal",
                            html_email(content, "Weekly momentum signal"), ALERT_FROM)


async def send_wishlist_match_email(
    to_email: str, name: str, wishlist_description: str, artist_name: str,
    lot_title: str, auction_house: str, estimate: str, score: int, lot_url: str,
    user_id: Optional[str] = None, db=None,
) -> bool:
    """Email 24 — wishlist match found"""
    if not await _pref_ok(user_id, "new_lot_followed_artist", db): return False
    first = (name or "").split()[0] or to_email.split("@")[0]
    content = f"""
{label("WISHLIST MATCH")}
<h1>We found what you were looking for.</h1>
<p>You told Larry you were looking for <em>{wishlist_description}</em>. We just found a match.</p>
{lot_card(artist_name.upper(), lot_title, auction_house, f"Est. {estimate}", score=score)}
{cta("View your match", lot_url, gold=True)}
<p style="color:#888888;font-size:13px;">Don't see other matches? Update your wishlist by telling Larry what you're looking for.</p>
"""
    return await send_email(to_email, f"Wishlist match — you were looking for this, {first}",
                            html_email(content, "Wishlist match found"), ALERT_FROM)


async def send_record_proximity_email(
    to_email: str, artist_name: str, estimate_high: str, pct_from_record: int,
    record_amount: str, auction_house: str, lot_url: str,
    user_id: Optional[str] = None, db=None,
) -> bool:
    """Email 25 — lot estimate within 20% of artist record"""
    if not await _pref_ok(user_id, "artist_momentum_change", db): return False
    comparison = f"""<div style="background:#F5F4F0;border-left:3px solid #C6A85A;padding:20px 24px;margin:20px 0;">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-size:12px;color:#888;padding-bottom:8px;">Current estimate (high)</td><td style="font-size:16px;font-weight:600;color:#1A2A44;text-align:right;">{estimate_high}</td></tr>
<tr><td style="font-size:12px;color:#888;">All-time auction record</td><td style="font-size:16px;font-weight:600;color:#C6A85A;text-align:right;">{record_amount}</td></tr>
</table>
<div style="margin-top:12px;font-size:12px;color:#888;">Only {pct_from_record}% from the record</div>
</div>"""
    content = f"""
{label("RECORD WATCH")}
<h1>A record attempt may be coming.</h1>
<p>A {artist_name} is estimated at {estimate_high}, which is within <strong>{pct_from_record}%</strong> of the artist's all-time auction record of {record_amount}.</p>
{comparison}
<p>Record sales often lift prices for similar works across the market. This may affect the value of related works in your portfolio or watchlist.</p>
{cta("View the lot", lot_url)}
"""
    return await send_email(to_email, f"{artist_name} record attempt possible at {auction_house}",
                            html_email(content, f"Record watch: {artist_name}"), ALERT_FROM)


async def send_buy_dip_email(
    to_email: str, artist_name: str, dip_pct: int, peak_period: str,
    current_lots_count: int, artist_page_url: str,
    user_id: Optional[str] = None, db=None,
) -> bool:
    """Email 26 — artist price down 15%+ in 6 months, fundamentals stable"""
    if not await _pref_ok(user_id, "optimal_sell_window", db): return False
    content = f"""
{label("MARKET SIGNAL")}
<h1>{artist_name} prices are down {dip_pct}%.</h1>
<p>{artist_name}'s auction prices have declined <strong>{dip_pct}%</strong> from their peak in {peak_period}. However, gallery representation remains stable and institutional demand has not changed.</p>
<p>Historical pattern: artists with this profile have typically recovered within 6–18 months. <strong>{current_lots_count} lots</strong> currently available.</p>
{cta("View available lots", artist_page_url, gold=True)}
<p style="color:#888888;font-size:13px;">Not financial advice. Past patterns do not guarantee future performance.</p>
"""
    return await send_email(to_email, f"{artist_name} is in a correction. Fundamentals remain strong.",
                            html_email(content, f"Buy the dip: {artist_name}"), ALERT_FROM)


async def send_geo_opportunity_email(
    to_email: str, regional_house: str, price_difference: int,
    major_artist: str, major_estimate: str, regional_artist: str,
    regional_estimate: str, savings: str, lot_url: str,
    user_id: Optional[str] = None, db=None,
) -> bool:
    """Email 27 — geographic price opportunity"""
    if not await _pref_ok(user_id, "lot_below_market", db): return False
    comparison = f"""<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
<tr>
<td width="48%" style="background:#F5F4F0;padding:20px;vertical-align:top;">
<div style="font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:#888;margin-bottom:8px;">Major House</div>
<div style="font-family:Georgia,serif;color:#1A2A44;margin-bottom:4px;">{major_artist}</div>
<div style="font-size:16px;font-weight:600;color:#1A2A44;">{major_estimate}</div>
</td>
<td width="4%"></td>
<td width="48%" style="background:#1A2A44;padding:20px;vertical-align:top;">
<div style="font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:#C6A85A;margin-bottom:8px;">Regional Opportunity</div>
<div style="font-family:Georgia,serif;color:#FFFFFF;margin-bottom:4px;">{regional_artist}</div>
<div style="font-size:16px;font-weight:600;color:#C6A85A;">{regional_estimate}</div>
<div style="font-size:11px;color:#C6A85A;margin-top:8px;">SAVE {savings}</div>
</td>
</tr>
</table>"""
    content = f"""
{label("PRICE INTELLIGENCE")}
<h1>The same work. A better price.</h1>
<p>Nautilus detected a comparable work to a lot you've been watching — same artist, same period, similar quality — available at {regional_house} for <strong>{price_difference}% less</strong> than comparable sales at major houses.</p>
{comparison}
{cta("View the opportunity", lot_url)}
"""
    return await send_email(to_email, "Same quality — 30% less. Different auction house.",
                            html_email(content, "Geographic price opportunity"), ALERT_FROM)


async def send_artist_gallery_upgrade_email(
    to_email: str, artist_name: str, gallery_name: str, avg_appreciation: int, artist_page_url: str,
    user_id: Optional[str] = None, db=None,
) -> bool:
    """Email 28 — artist signed to Tier 1 gallery"""
    if not await _pref_ok(user_id, "artist_momentum_change", db): return False
    content = f"""
{label("MARKET SIGNAL")}
<h1>{artist_name} just gained institutional backing.</h1>
<p>{artist_name}, an artist you follow, has been added to the roster of <strong>{gallery_name}</strong> — a Tier 1 gallery with institutional influence in the primary art market.</p>
<p>Gallery representation at this level is historically one of the strongest leading indicators of secondary market price appreciation. Artists with this profile have seen an average of <strong>+{avg_appreciation}%</strong> in auction prices within 24 months of Tier 1 representation.</p>
{cta(f"See current lots by {artist_name}", artist_page_url, gold=True)}
"""
    return await send_email(to_email, f"{artist_name} is now represented by {gallery_name}",
                            html_email(content, f"Gallery signal: {artist_name}"), ALERT_FROM)


async def send_portfolio_artist_sale_email(
    to_email: str, artist_name: str, auction_house: str,
    lot_artist: str, lot_title: str, lot_details: str, lot_estimate: str, lot_score: int,
    lot_url: str,
    user_id: Optional[str] = None, db=None,
) -> bool:
    """Email 29 — artist in user portfolio has new lot in upcoming auction"""
    if not await _pref_ok(user_id, "portfolio_value_change", db): return False
    if user_id and not await _under_weekly_limit(user_id, "portfolio_artist_sale", db): return False
    content = f"""
{label("PORTFOLIO ALERT")}
<h1>{artist_name} is going to auction.</h1>
<p>You own a work by <strong>{artist_name}</strong> (tracked in your Nautilus portfolio). A comparable work has appeared at {auction_house} — this sale may affect the estimated value of your piece.</p>
{lot_card(lot_artist.upper(), lot_title, lot_details, f"Est. {lot_estimate}", score=lot_score)}
<p>If this lot sells above estimate, your portfolio piece's estimated value will be revised upward. If below, Nautilus will flag a reassessment.</p>
{cta("View the sale", lot_url)}
"""
    sent = await send_email(to_email, f"{artist_name} — new lot at auction. Your portfolio may be affected.",
                            html_email(content, f"Portfolio alert: {artist_name}"), ALERT_FROM)
    if sent and user_id:
        await _log_email(user_id, "portfolio_artist_sale", db)
    return sent


async def send_collection_completion_email(
    to_email: str, collection_theme: str, artist_name: str, lot_title: str,
    lot_details: str, lot_estimate: str, lot_score: int, lot_url: str,
    user_id: Optional[str] = None, db=None,
) -> bool:
    """Email 30 — collection completion recommendation"""
    if not await _pref_ok(user_id, "new_lot_followed_artist", db): return False
    content = f"""
{label("FOR YOUR COLLECTION")}
<h1>This belongs in your collection.</h1>
<p>Based on the works in your Nautilus portfolio, we identified a piece that would complement your <strong>{collection_theme}</strong> collection.</p>
{lot_card(artist_name.upper(), lot_title, lot_details, f"Est. {lot_estimate}", score=lot_score)}
<p>Nautilus identified this as a strong thematic match — same period, same movement, complementary subject matter.</p>
{cta("View this piece", lot_url, gold=True)}
"""
    return await send_email(to_email, f"A new piece for your {collection_theme} collection",
                            html_email(content, "Collection completion"), ALERT_FROM)
