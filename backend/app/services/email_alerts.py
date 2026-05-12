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
            EmailSentLog.user_id == user_id,
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
    log = EmailSentLog(user_id=user_id, email_type=email_type, sent_at=_dt.utcnow())
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
    lang: str = "fr",
) -> bool:
    """Email 20 — lot price significantly below historical median"""
    if not await _pref_ok(user_id, "lot_below_market", db): return False
    if user_id and not await _under_weekly_limit(user_id, "price_gap_alert", db): return False
    is_fr = lang == "fr"
    _label = "ÉCART DE PRIX DÉTECTÉ" if is_fr else "PRICE ALERT"
    _h1 = f"{artist_name} apparaît significativement sous-estimé." if is_fr else f"{artist_name} is significantly below market."
    _body = (
        f"Nautilus a détecté un écart de <strong>{gap_pct}%</strong> entre l'estimation de ce lot et la médiane historique des ventes de <strong>{artist_name}</strong>. Score de conviction Nautilus : <strong>{score}/100</strong>."
        if is_fr else
        f"A {artist_name} has appeared at auction priced <strong>{gap_pct}%</strong> below the historical average for comparable works. Nautilus conviction score: <strong>{score}/100</strong>."
    )
    _col1 = "Estimation actuelle" if is_fr else "Current estimate"
    _col2 = "Médiane historique des comparables" if is_fr else "Historical average for comparable works"
    _col3 = "Écart détecté" if is_fr else "Gap"
    _gap_val = f"{gap_pct}% sous le marché" if is_fr else f"{gap_pct}% below market"
    _cta = "Voir le lot" if is_fr else "View the lot"
    _disclaimer = (
        f"Vente clôturée le {sale_date}. Nautilus fournit de l'intelligence marché, pas des conseils en investissement."
        if is_fr else
        f"Sale closes {sale_date}. Past performance does not guarantee future results."
    )
    _subject = f"{artist_name} — lot estimé {gap_pct}% sous le marché." if is_fr else f"{artist_name} priced {gap_pct}% below market average"
    comparison = f"""<div style="background:#F5F4F0;border-left:3px solid #C6A85A;padding:20px 24px;margin:20px 0;">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-size:12px;color:#888;padding-bottom:8px;">{_col1}</td><td style="font-size:16px;font-weight:600;color:#1A2A44;text-align:right;">{estimate}</td></tr>
<tr><td style="font-size:12px;color:#888;padding-bottom:8px;">{_col2}</td><td style="font-size:16px;font-weight:600;color:#1A2A44;text-align:right;">{historical_avg}</td></tr>
<tr><td style="font-size:12px;color:#2D7A4F;font-weight:600;">{_col3}</td><td style="font-size:16px;font-weight:600;color:#2D7A4F;text-align:right;">{_gap_val}</td></tr>
</table>
</div>"""
    content = f"""
{label(_label)}
<h1>{_h1}</h1>
<p>{_body}</p>
{comparison}
{cta(_cta, lot_url)}
<p style="color:#888888;font-size:13px;">{_disclaimer}</p>
"""
    sent = await send_email(to_email, _subject, html_email(content, f"Price alert: {artist_name}"), ALERT_FROM)
    if sent and user_id:
        await _log_email(user_id, "price_gap_alert", db)
    return sent


async def send_watchlist_closing_email(
    to_email: str, lot_title: str, artist_name: str, auction_house: str,
    estimate: str, score: int, closing_time: str, lot_url: str,
    user_id: Optional[str] = None, db=None,
    lang: str = "fr",
) -> bool:
    """Email 21 — watchlist lot closing in 48h"""
    if not await _pref_ok(user_id, "auction_closing_24h", db): return False
    is_fr = lang == "fr"
    _label = "CLÔTURE IMMINENTE" if is_fr else "CLOSING SOON"
    _h1 = "Dernière chance — lot dans votre liste de suivi." if is_fr else "Last chance — lot on your watchlist."
    _body = "Un lot que vous avez sauvegardé se clôture dans moins de 48 heures." if is_fr else "A lot you saved to your watchlist closes in less than 48 hours."
    _closes = "Clôture le" if is_fr else "Closes"
    _cta = "Voir avant clôture" if is_fr else "View before it closes"
    _subject = f"Un lot de votre liste se clôture demain — {lot_title}" if is_fr else f"A lot on your watchlist closes tomorrow — {lot_title}"
    content = f"""
{label(_label)}
<h1>{_h1}</h1>
<p>{_body}</p>
{lot_card(artist_name.upper(), lot_title, f"{auction_house} · {_closes} {closing_time}", f"Est. {estimate}", score=score)}
{cta(_cta, lot_url, gold=True)}
"""
    return await send_email(to_email, _subject, html_email(content, "Watchlist lot closing soon"), ALERT_FROM)


async def send_artist_record_email(
    to_email: str, artist_name: str, hammer_price: str, auction_house: str,
    pct_above_previous: int, previous_record: str, artist_page_url: str,
    user_id: Optional[str] = None, db=None,
    lang: str = "fr",
) -> bool:
    """Email 22 — artist in favorites sets new auction record"""
    if not await _pref_ok(user_id, "artist_momentum_change", db): return False
    is_fr = lang == "fr"
    _label = "NOUVEAU RECORD" if is_fr else "NEW RECORD"
    _h1 = f"{artist_name} atteint un nouveau sommet." if is_fr else f"{artist_name} reached a new high."
    _body1 = (
        f"{artist_name} vient de se vendre <strong>{hammer_price}</strong> chez {auction_house} — un nouveau record aux enchères, en hausse de <strong>{pct_above_previous}%</strong> par rapport au précédent record de {previous_record}."
        if is_fr else
        f"{artist_name} just sold for <strong>{hammer_price}</strong> at {auction_house} — a new auction record, up <strong>{pct_above_previous}%</strong> from the previous record of {previous_record}."
    )
    _body2 = (
        f"Ce que cela signifie pour vous : les œuvres de {artist_name} dans votre liste de suivi ou votre portfolio peuvent désormais valoir plus qu'estimé précédemment."
        if is_fr else
        f"What this means for you: works by {artist_name} in your watchlist or portfolio may now be worth more than previously estimated."
    )
    _stat1 = ("Nouveau Record", "New Record")[not is_fr]
    _stat2 = ("Précédent Record", "Previous Record")[not is_fr]
    _stat3 = ("Hausse", "Increase")[not is_fr]
    _cta = f"Voir les lots actuels de {artist_name}" if is_fr else f"See current lots by {artist_name}"
    _subject = f"{artist_name} vient d'établir un nouveau record aux enchères" if is_fr else f"{artist_name} just set a new record at auction"
    content = f"""
{label(_label)}
<h1>{_h1}</h1>
<p>{_body1}</p>
<p>{_body2}</p>
{stat_row((hammer_price, _stat1), (previous_record, _stat2), (f"+{pct_above_previous}%", _stat3))}
{cta(_cta, artist_page_url)}
"""
    return await send_email(to_email, _subject, html_email(content, f"New record: {artist_name}"), ALERT_FROM)


async def send_weekly_momentum_email(
    to_email: str, momentum_artists: list[dict], top_lots: list[dict],
    user_id: Optional[str] = None, db=None,
    lang: str = "fr",
) -> bool:
    """Email 23 — weekly momentum signal, Monday 8am"""
    if not await _pref_ok(user_id, "weekly_brief", db): return False
    is_fr = lang == "fr"
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
    _est = "Est." if not is_fr else "Estim."
    lots_html = "".join(
        lot_card(
            l.get("artist", "").upper(),
            l.get("title", ""),
            f'{l.get("house", "")} · {l.get("date", "")}',
            f'{_est} {l.get("estimate", "")}',
            score=l.get("score", 0)
        )
        for l in top_lots[:2]
    )
    _label = "SIGNAL HEBDOMADAIRE" if is_fr else "WEEKLY INTELLIGENCE"
    _h1 = "Les signaux marché de cette semaine." if is_fr else "This week's market signals."
    _body = "Cinq artistes avec un momentum de prix significatif détecté par Nautilus cette semaine." if is_fr else "Five artists with significant price momentum detected by Nautilus this week."
    _h2 = "Meilleures opportunités pour vous" if is_fr else "Top opportunities for you"
    _cta = "Voir toutes les opportunités" if is_fr else "See all opportunities"
    _footer = "Personnalisé pour votre profil. Mettez à jour vos préférences dans les paramètres." if is_fr else "Personalized for your profile. Update your preferences in settings."
    _subject = "Artistes en momentum cette semaine — Signal Nautilus" if is_fr else "Artists with momentum this week — Nautilus Signal"
    content = f"""
{label(_label)}
<h1>{_h1}</h1>
<p>{_body}</p>
<div style="margin:20px 0;">{artists_html}</div>
{divider()}
<h2>{_h2}</h2>
{lots_html}
{cta(_cta, "https://www.get-nautilus.com/app/explore", gold=True)}
<p style="color:#888888;font-size:13px;">{_footer}</p>
"""
    return await send_email(to_email, _subject, html_email(content, "Weekly momentum signal"), ALERT_FROM)


async def send_wishlist_match_email(
    to_email: str, name: str, wishlist_description: str, artist_name: str,
    lot_title: str, auction_house: str, estimate: str, score: int, lot_url: str,
    user_id: Optional[str] = None, db=None,
    lang: str = "fr",
) -> bool:
    """Email 24 — wishlist match found"""
    if not await _pref_ok(user_id, "new_lot_followed_artist", db): return False
    is_fr = lang == "fr"
    first = (name or "").split()[0] or to_email.split("@")[0]
    _label = "CORRESPONDANCE TROUVÉE" if is_fr else "WISHLIST MATCH"
    _h1 = "Nous avons trouvé ce que vous cherchiez." if is_fr else "We found what you were looking for."
    _body = (
        f"Vous avez indiqué à Larry que vous recherchiez <em>{wishlist_description}</em>. Nous venons de trouver une correspondance."
        if is_fr else
        f"You told Larry you were looking for <em>{wishlist_description}</em>. We just found a match."
    )
    _est = f"Estim. {estimate}" if is_fr else f"Est. {estimate}"
    _cta = "Voir la correspondance" if is_fr else "View your match"
    _footer = (
        "Pas d'autres correspondances ? Mettez à jour votre liste en indiquant à Larry ce que vous recherchez."
        if is_fr else
        "Don't see other matches? Update your wishlist by telling Larry what you're looking for."
    )
    _subject = f"Correspondance trouvée — vous recherchiez ceci, {first}" if is_fr else f"Wishlist match — you were looking for this, {first}"
    content = f"""
{label(_label)}
<h1>{_h1}</h1>
<p>{_body}</p>
{lot_card(artist_name.upper(), lot_title, auction_house, _est, score=score)}
{cta(_cta, lot_url, gold=True)}
<p style="color:#888888;font-size:13px;">{_footer}</p>
"""
    return await send_email(to_email, _subject, html_email(content, "Wishlist match found"), ALERT_FROM)


async def send_record_proximity_email(
    to_email: str, artist_name: str, estimate_high: str, pct_from_record: int,
    record_amount: str, auction_house: str, lot_url: str,
    user_id: Optional[str] = None, db=None,
    lang: str = "fr",
) -> bool:
    """Email 25 — lot estimate within 20% of artist record"""
    if not await _pref_ok(user_id, "artist_momentum_change", db): return False
    is_fr = lang == "fr"
    _label = "TENTATIVE DE RECORD" if is_fr else "RECORD WATCH"
    _h1 = "Une tentative de record pourrait être en cours." if is_fr else "A record attempt may be coming."
    _body1 = (
        f"Une œuvre de {artist_name} est estimée à {estimate_high}, soit à <strong>{pct_from_record}%</strong> du record aux enchères de l'artiste ({record_amount})."
        if is_fr else
        f"A {artist_name} is estimated at {estimate_high}, which is within <strong>{pct_from_record}%</strong> of the artist's all-time auction record of {record_amount}."
    )
    _body2 = (
        "Les ventes record soutiennent généralement les prix des œuvres similaires sur le marché. Cela pourrait affecter la valeur des œuvres liées dans votre portfolio ou votre liste de suivi."
        if is_fr else
        "Record sales often lift prices for similar works across the market. This may affect the value of related works in your portfolio or watchlist."
    )
    _col1 = "Estimation haute actuelle" if is_fr else "Current estimate (high)"
    _col2 = "Record historique aux enchères" if is_fr else "All-time auction record"
    _proximity = f"À seulement {pct_from_record}% du record" if is_fr else f"Only {pct_from_record}% from the record"
    _cta = "Voir le lot" if is_fr else "View the lot"
    _subject = f"Tentative de record possible pour {artist_name} chez {auction_house}" if is_fr else f"{artist_name} record attempt possible at {auction_house}"
    comparison = f"""<div style="background:#F5F4F0;border-left:3px solid #C6A85A;padding:20px 24px;margin:20px 0;">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-size:12px;color:#888;padding-bottom:8px;">{_col1}</td><td style="font-size:16px;font-weight:600;color:#1A2A44;text-align:right;">{estimate_high}</td></tr>
<tr><td style="font-size:12px;color:#888;">{_col2}</td><td style="font-size:16px;font-weight:600;color:#C6A85A;text-align:right;">{record_amount}</td></tr>
</table>
<div style="margin-top:12px;font-size:12px;color:#888;">{_proximity}</div>
</div>"""
    content = f"""
{label(_label)}
<h1>{_h1}</h1>
<p>{_body1}</p>
{comparison}
<p>{_body2}</p>
{cta(_cta, lot_url)}
"""
    return await send_email(to_email, _subject, html_email(content, f"Record watch: {artist_name}"), ALERT_FROM)


async def send_buy_dip_email(
    to_email: str, artist_name: str, dip_pct: int, peak_period: str,
    current_lots_count: int, artist_page_url: str,
    user_id: Optional[str] = None, db=None,
    lang: str = "fr",
) -> bool:
    """Email 26 — artist price down 15%+ in 6 months, fundamentals stable"""
    if not await _pref_ok(user_id, "optimal_sell_window", db): return False
    is_fr = lang == "fr"
    _label = "SIGNAL MARCHÉ" if is_fr else "MARKET SIGNAL"
    _h1 = f"Les prix de {artist_name} ont baissé de {dip_pct}%." if is_fr else f"{artist_name} prices are down {dip_pct}%."
    _body1 = (
        f"Les prix aux enchères de {artist_name} ont reculé de <strong>{dip_pct}%</strong> depuis leur pic en {peak_period}. La représentation en galerie reste stable et la demande institutionnelle n'a pas changé."
        if is_fr else
        f"{artist_name}'s auction prices have declined <strong>{dip_pct}%</strong> from their peak in {peak_period}. However, gallery representation remains stable and institutional demand has not changed."
    )
    _body2 = (
        f"Tendance historique : les artistes avec ce profil se sont généralement redressés en 6 à 18 mois. <strong>{current_lots_count} lots</strong> actuellement disponibles."
        if is_fr else
        f"Historical pattern: artists with this profile have typically recovered within 6–18 months. <strong>{current_lots_count} lots</strong> currently available."
    )
    _cta = "Voir les lots disponibles" if is_fr else "View available lots"
    _disclaimer = "Pas un conseil en investissement. Les tendances passées ne garantissent pas les performances futures." if is_fr else "Not financial advice. Past patterns do not guarantee future performance."
    _subject = f"{artist_name} est en correction. Les fondamentaux restent solides." if is_fr else f"{artist_name} is in a correction. Fundamentals remain strong."
    content = f"""
{label(_label)}
<h1>{_h1}</h1>
<p>{_body1}</p>
<p>{_body2}</p>
{cta(_cta, artist_page_url, gold=True)}
<p style="color:#888888;font-size:13px;">{_disclaimer}</p>
"""
    return await send_email(to_email, _subject, html_email(content, f"Buy the dip: {artist_name}"), ALERT_FROM)


async def send_geo_opportunity_email(
    to_email: str, regional_house: str, price_difference: int,
    major_artist: str, major_estimate: str, regional_artist: str,
    regional_estimate: str, savings: str, lot_url: str,
    user_id: Optional[str] = None, db=None,
    lang: str = "fr",
) -> bool:
    """Email 27 — geographic price opportunity"""
    if not await _pref_ok(user_id, "lot_below_market", db): return False
    is_fr = lang == "fr"
    _label = "OPPORTUNITÉ GÉOGRAPHIQUE" if is_fr else "PRICE INTELLIGENCE"
    _h1 = "La même œuvre. Un meilleur prix." if is_fr else "The same work. A better price."
    _body = (
        f"Nautilus a détecté une œuvre comparable à un lot que vous suivez — même artiste, même période, qualité similaire — disponible chez {regional_house} pour <strong>{price_difference}% moins cher</strong> que les ventes comparables dans les grandes maisons."
        if is_fr else
        f"Nautilus detected a comparable work to a lot you've been watching — same artist, same period, similar quality — available at {regional_house} for <strong>{price_difference}% less</strong> than comparable sales at major houses."
    )
    _col_major = "Grande Maison" if is_fr else "Major House"
    _col_regional = "Opportunité Régionale" if is_fr else "Regional Opportunity"
    _save = "ÉCONOMISEZ" if is_fr else "SAVE"
    _cta = "Voir l'opportunité" if is_fr else "View the opportunity"
    _subject = f"Même qualité — {price_difference}% moins cher. Autre maison de vente." if is_fr else "Same quality — 30% less. Different auction house."
    comparison = f"""<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
<tr>
<td width="48%" style="background:#F5F4F0;padding:20px;vertical-align:top;">
<div style="font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:#888;margin-bottom:8px;">{_col_major}</div>
<div style="font-family:Georgia,serif;color:#1A2A44;margin-bottom:4px;">{major_artist}</div>
<div style="font-size:16px;font-weight:600;color:#1A2A44;">{major_estimate}</div>
</td>
<td width="4%"></td>
<td width="48%" style="background:#1A2A44;padding:20px;vertical-align:top;">
<div style="font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:#C6A85A;margin-bottom:8px;">{_col_regional}</div>
<div style="font-family:Georgia,serif;color:#FFFFFF;margin-bottom:4px;">{regional_artist}</div>
<div style="font-size:16px;font-weight:600;color:#C6A85A;">{regional_estimate}</div>
<div style="font-size:11px;color:#C6A85A;margin-top:8px;">{_save} {savings}</div>
</td>
</tr>
</table>"""
    content = f"""
{label(_label)}
<h1>{_h1}</h1>
<p>{_body}</p>
{comparison}
{cta(_cta, lot_url)}
"""
    return await send_email(to_email, _subject, html_email(content, "Geographic price opportunity"), ALERT_FROM)


async def send_artist_gallery_upgrade_email(
    to_email: str, artist_name: str, gallery_name: str, avg_appreciation: int, artist_page_url: str,
    user_id: Optional[str] = None, db=None,
    lang: str = "fr",
) -> bool:
    """Email 28 — artist signed to Tier 1 gallery"""
    if not await _pref_ok(user_id, "artist_momentum_change", db): return False
    is_fr = lang == "fr"
    _label = "SIGNAL INSTITUTIONNEL" if is_fr else "MARKET SIGNAL"
    _h1 = f"{artist_name} vient d'obtenir un soutien institutionnel." if is_fr else f"{artist_name} just gained institutional backing."
    _body1 = (
        f"{artist_name}, un artiste que vous suivez, vient d'intégrer le catalogue de <strong>{gallery_name}</strong> — une galerie de Tier 1 avec une influence institutionnelle sur le marché primaire."
        if is_fr else
        f"{artist_name}, an artist you follow, has been added to the roster of <strong>{gallery_name}</strong> — a Tier 1 gallery with institutional influence in the primary art market."
    )
    _body2 = (
        f"La représentation en galerie à ce niveau est historiquement l'un des indicateurs avancés les plus fiables de l'appréciation des prix sur le marché secondaire. Les artistes avec ce profil ont enregistré en moyenne <strong>+{avg_appreciation}%</strong> de hausse aux enchères dans les 24 mois suivant une représentation Tier 1."
        if is_fr else
        f"Gallery representation at this level is historically one of the strongest leading indicators of secondary market price appreciation. Artists with this profile have seen an average of <strong>+{avg_appreciation}%</strong> in auction prices within 24 months of Tier 1 representation."
    )
    _cta = f"Voir les lots actuels de {artist_name}" if is_fr else f"See current lots by {artist_name}"
    _subject = f"{artist_name} est désormais représenté par {gallery_name}" if is_fr else f"{artist_name} is now represented by {gallery_name}"
    content = f"""
{label(_label)}
<h1>{_h1}</h1>
<p>{_body1}</p>
<p>{_body2}</p>
{cta(_cta, artist_page_url, gold=True)}
"""
    return await send_email(to_email, _subject, html_email(content, f"Gallery signal: {artist_name}"), ALERT_FROM)


async def send_portfolio_artist_sale_email(
    to_email: str, artist_name: str, auction_house: str,
    lot_artist: str, lot_title: str, lot_details: str, lot_estimate: str, lot_score: int,
    lot_url: str,
    user_id: Optional[str] = None, db=None,
    lang: str = "fr",
) -> bool:
    """Email 29 — artist in user portfolio has new lot in upcoming auction"""
    if not await _pref_ok(user_id, "portfolio_value_change", db): return False
    if user_id and not await _under_weekly_limit(user_id, "portfolio_artist_sale", db): return False
    is_fr = lang == "fr"
    _label = "ALERTE PORTFOLIO" if is_fr else "PORTFOLIO ALERT"
    _h1 = f"{artist_name} passe en vente aux enchères." if is_fr else f"{artist_name} is going to auction."
    _body1 = (
        f"Vous possédez une œuvre de <strong>{artist_name}</strong> (suivie dans votre portfolio Nautilus). Un comparable vient d'apparaître chez {auction_house} — cette vente pourrait affecter la valeur estimée de votre pièce."
        if is_fr else
        f"You own a work by <strong>{artist_name}</strong> (tracked in your Nautilus portfolio). A comparable work has appeared at {auction_house} — this sale may affect the estimated value of your piece."
    )
    _est = f"Estim. {lot_estimate}" if is_fr else f"Est. {lot_estimate}"
    _body2 = (
        "Si ce lot se vend au-dessus de l'estimation, la valeur estimée de votre pièce sera révisée à la hausse. Si en dessous, Nautilus signalera une réévaluation."
        if is_fr else
        "If this lot sells above estimate, your portfolio piece's estimated value will be revised upward. If below, Nautilus will flag a reassessment."
    )
    _cta = "Voir la vente" if is_fr else "View the sale"
    _subject = f"{artist_name} — nouveau lot en vente. Votre portfolio pourrait être affecté." if is_fr else f"{artist_name} — new lot at auction. Your portfolio may be affected."
    content = f"""
{label(_label)}
<h1>{_h1}</h1>
<p>{_body1}</p>
{lot_card(lot_artist.upper(), lot_title, lot_details, _est, score=lot_score)}
<p>{_body2}</p>
{cta(_cta, lot_url)}
"""
    sent = await send_email(to_email, _subject, html_email(content, f"Portfolio alert: {artist_name}"), ALERT_FROM)
    if sent and user_id:
        await _log_email(user_id, "portfolio_artist_sale", db)
    return sent


async def send_collection_completion_email(
    to_email: str, collection_theme: str, artist_name: str, lot_title: str,
    lot_details: str, lot_estimate: str, lot_score: int, lot_url: str,
    user_id: Optional[str] = None, db=None,
    lang: str = "fr",
) -> bool:
    """Email 30 — collection completion recommendation"""
    if not await _pref_ok(user_id, "new_lot_followed_artist", db): return False
    is_fr = lang == "fr"
    _label = "POUR VOTRE COLLECTION" if is_fr else "FOR YOUR COLLECTION"
    _h1 = "Cette pièce appartient à votre collection." if is_fr else "This belongs in your collection."
    _body1 = (
        f"En analysant les œuvres de votre portfolio Nautilus, nous avons identifié une pièce qui compléterait parfaitement votre collection <strong>{collection_theme}</strong>."
        if is_fr else
        f"Based on the works in your Nautilus portfolio, we identified a piece that would complement your <strong>{collection_theme}</strong> collection."
    )
    _est = f"Estim. {lot_estimate}" if is_fr else f"Est. {lot_estimate}"
    _body2 = (
        "Nautilus a identifié cette pièce comme une correspondance thématique forte — même période, même mouvement, sujet complémentaire."
        if is_fr else
        "Nautilus identified this as a strong thematic match — same period, same movement, complementary subject matter."
    )
    _cta = "Voir cette pièce" if is_fr else "View this piece"
    _subject = f"Une nouvelle pièce pour votre collection {collection_theme}" if is_fr else f"A new piece for your {collection_theme} collection"
    content = f"""
{label(_label)}
<h1>{_h1}</h1>
<p>{_body1}</p>
{lot_card(artist_name.upper(), lot_title, lot_details, _est, score=lot_score)}
<p>{_body2}</p>
{cta(_cta, lot_url, gold=True)}
"""
    return await send_email(to_email, _subject, html_email(content, "Collection completion"), ALERT_FROM)
