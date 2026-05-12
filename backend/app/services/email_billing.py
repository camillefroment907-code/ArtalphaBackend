"""
Nautilus Billing Emails (11-18)
"""
from app.services.email_base import html_email, label, cta, stat_row, divider, send_email, TRANSAC_FROM


def _first_name(name: str, email: str) -> str:
    return (name or "").split()[0] or email.split("@")[0]


async def send_payment_success_email(to_email: str, name: str, plan_name: str, amount: str, next_billing_date: str, lang: str = "fr") -> bool:
    """Email 11 — Stripe checkout.session.completed"""
    is_fr = lang == "fr"
    first = _first_name(name, to_email)
    _receipt_header = "Reçu de paiement" if is_fr else "Payment Receipt"
    _plan_label = "Plan"
    _amount_label = "Montant" if is_fr else "Amount"
    _amount_suffix = "/mois" if is_fr else "/month"
    _next_label = "Prochaine facturation" if is_fr else "Next billing"
    receipt = f"""<div style="background:#F5F4F0;padding:24px;margin:20px 0;">
<div style="font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:#888;font-family:Arial,sans-serif;margin-bottom:16px;">{_receipt_header}</div>
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-size:13px;color:#888;padding-bottom:8px;">{_plan_label}</td><td style="font-size:14px;font-weight:600;color:#1A2A44;text-align:right;">{plan_name}</td></tr>
<tr><td style="font-size:13px;color:#888;padding-bottom:8px;">{_amount_label}</td><td style="font-size:14px;font-weight:600;color:#1A2A44;text-align:right;">{amount}{_amount_suffix}</td></tr>
<tr><td style="font-size:13px;color:#888;">{_next_label}</td><td style="font-size:14px;color:#555;text-align:right;">{next_billing_date}</td></tr>
</table>
</div>"""
    _label_str = "CONFIRMÉ" if is_fr else "CONFIRMED"
    _h1 = "Accès confirmé. Le marché est à vous." if is_fr else "Access confirmed. The market is yours."
    _body = f"Votre abonnement {plan_name} est actif. Tout est prêt." if is_fr else f"Your {plan_name} subscription is active. Everything is ready."
    _cta = "Accéder à votre tableau de bord" if is_fr else "Go to your dashboard"
    _guarantee = (
        "Rappel — garantie satisfait ou remboursé 30 jours. Si Nautilus ne vous apporte pas de valeur dans les 30 premiers jours, écrivez-nous et nous remboursons intégralement. Sans questions."
        if is_fr else
        "Remember — 30-day money-back guarantee. If Nautilus doesn't deliver value in your first 30 days, email us and we refund in full. No questions."
    )
    _subject = f"Vous êtes dans la place. Bienvenue sur Nautilus {plan_name}, {first}." if is_fr else f"You're in. Welcome to Nautilus {plan_name}, {first}."
    content = f"""
{label(_label_str)}
<h1>{_h1}</h1>
<p>{_body}</p>
{receipt}
{cta(_cta, "https://www.get-nautilus.com/app/dashboard", gold=True)}
{divider()}
<p style="font-size:13px;color:#888;">{_guarantee}</p>
"""
    return await send_email(to_email, _subject, html_email(content, "Payment confirmed"), TRANSAC_FROM)


async def send_payment_failed_email(to_email: str, name: str, amount: str, plan_name: str, retry_date: str, stripe_billing_portal_url: str, lang: str = "fr") -> bool:
    """Email 12 — invoice.payment_failed"""
    is_fr = lang == "fr"
    first = _first_name(name, to_email)
    _subject = "Action requise : votre paiement n'a pas abouti." if is_fr else "Action required: your payment didn't go through."
    _label_str = "PROBLÈME DE PAIEMENT" if is_fr else "PAYMENT ISSUE"
    _h1 = "Nous n'avons pas pu traiter votre paiement." if is_fr else "We couldn't process your payment."
    _body = (
        f"Votre paiement de <strong>{amount}</strong> pour Nautilus {plan_name} a échoué. Votre accès est maintenu pendant que nous réessayons, mais veuillez mettre à jour votre moyen de paiement pour éviter toute interruption."
        if is_fr else
        f"Your payment of <strong>{amount}</strong> for Nautilus {plan_name} failed. Your access continues while we retry, but please update your payment method to avoid interruption."
    )
    _cta = "Mettre à jour mon moyen de paiement" if is_fr else "Update payment method"
    _disclaimer = (
        f"Nous réessaierons le {retry_date}. En cas de nouvel échec, votre compte sera rétrogradé au plan gratuit."
        if is_fr else
        f"We'll retry on {retry_date}. If payment fails again, your account will be downgraded to the free plan."
    )
    content = f"""
{label(_label_str)}
<h1>{_h1}</h1>
<p>{_body}</p>
{cta(_cta, stripe_billing_portal_url)}
<p style="color:#888888;font-size:13px;">{_disclaimer}</p>
"""
    return await send_email(to_email, _subject, html_email(content, "Payment failed"), TRANSAC_FROM)


async def send_payment_retry_email(to_email: str, name: str, plan_name: str, stripe_billing_portal_url: str, lang: str = "fr") -> bool:
    """Email 13 — 3 days after first payment failure"""
    is_fr = lang == "fr"
    first = _first_name(name, to_email)
    _subject = "Dernier rappel : mettez à jour votre moyen de paiement." if is_fr else "Last reminder: update your payment method."
    _label_str = "ACCÈS EN DANGER" if is_fr else "ACCESS AT RISK"
    _h1 = "Votre accès Nautilus expire dans 24h." if is_fr else "Your Nautilus access expires in 24h."
    _body = (
        "Nous n'avons toujours pas pu débiter votre carte. Sans mise à jour, votre compte passe en version gratuite demain."
        if is_fr else
        "We still couldn't charge your card. Without an update, your account moves to the free plan tomorrow."
    )
    _cta = "Mettre à jour ma carte maintenant" if is_fr else "Update my card now"
    content = f"""
{label(_label_str)}
<h1>{_h1}</h1>
<p>{_body}</p>
{cta(_cta, stripe_billing_portal_url, gold=True)}
"""
    return await send_email(to_email, _subject, html_email(content, "Last reminder"), TRANSAC_FROM)


async def send_subscription_cancelled_email(to_email: str, name: str, plan_name: str, access_until: str, lang: str = "fr") -> bool:
    """Email 14 — customer.subscription.deleted"""
    is_fr = lang == "fr"
    first = _first_name(name, to_email)
    _subject = (
        f"Abonnement annulé — votre accès continue jusqu'au {access_until}."
        if is_fr else
        f"Subscription cancelled — your access continues until {access_until}."
    )
    _label_str = "ANNULATION CONFIRMÉE" if is_fr else "CANCELLATION CONFIRMED"
    _h1 = "Abonnement annulé." if is_fr else "Subscription cancelled."
    _body1 = (
        f"Votre abonnement Nautilus {plan_name} a été annulé. Vous conservez un accès complet jusqu'au <strong>{access_until}</strong>."
        if is_fr else
        f"Your Nautilus {plan_name} subscription has been cancelled. You'll keep full access until <strong>{access_until}</strong>."
    )
    _body2 = (
        "Avant de partir — dites-nous ce qu'on aurait pu faire mieux :"
        if is_fr else
        "Before you go — we'd love to understand what we could have done better:"
    )
    if is_fr:
        reason_btns = """<div style="margin:16px 0;">
<a href="https://www.get-nautilus.com/feedback?reason=price" style="display:inline-block;border:1px solid #E8E4DC;padding:8px 16px;margin:4px;font-size:12px;color:#555;text-decoration:none;border-radius:3px;">Trop cher</a>
<a href="https://www.get-nautilus.com/feedback?reason=features" style="display:inline-block;border:1px solid #E8E4DC;padding:8px 16px;margin:4px;font-size:12px;color:#555;text-decoration:none;border-radius:3px;">Fonctionnalités manquantes</a>
<a href="https://www.get-nautilus.com/feedback?reason=alternative" style="display:inline-block;border:1px solid #E8E4DC;padding:8px 16px;margin:4px;font-size:12px;color:#555;text-decoration:none;border-radius:3px;">J'ai trouvé une alternative</a>
<a href="https://www.get-nautilus.com/feedback?reason=usage" style="display:inline-block;border:1px solid #E8E4DC;padding:8px 16px;margin:4px;font-size:12px;color:#555;text-decoration:none;border-radius:3px;">Je ne l'utilisais pas assez</a>
</div>"""
    else:
        reason_btns = """<div style="margin:16px 0;">
<a href="https://www.get-nautilus.com/feedback?reason=price" style="display:inline-block;border:1px solid #E8E4DC;padding:8px 16px;margin:4px;font-size:12px;color:#555;text-decoration:none;border-radius:3px;">Too expensive</a>
<a href="https://www.get-nautilus.com/feedback?reason=features" style="display:inline-block;border:1px solid #E8E4DC;padding:8px 16px;margin:4px;font-size:12px;color:#555;text-decoration:none;border-radius:3px;">Missing features I needed</a>
<a href="https://www.get-nautilus.com/feedback?reason=alternative" style="display:inline-block;border:1px solid #E8E4DC;padding:8px 16px;margin:4px;font-size:12px;color:#555;text-decoration:none;border-radius:3px;">Found an alternative</a>
<a href="https://www.get-nautilus.com/feedback?reason=usage" style="display:inline-block;border:1px solid #E8E4DC;padding:8px 16px;margin:4px;font-size:12px;color:#555;text-decoration:none;border-radius:3px;">Not using it enough</a>
</div>"""
    _reactivate = "Vous avez changé d'avis ? Vous pouvez réactiver à tout moment." if is_fr else "Changed your mind? You can reactivate anytime."
    _cta = "Réactiver mon compte" if is_fr else "Reactivate my account"
    content = f"""
{label(_label_str)}
<h1>{_h1}</h1>
<p>{_body1}</p>
<p>{_body2}</p>
{reason_btns}
{divider()}
<p>{_reactivate}</p>
{cta(_cta, "https://www.get-nautilus.com/app/pricing")}
"""
    return await send_email(to_email, _subject, html_email(content, "Subscription cancelled"), TRANSAC_FROM)


async def send_annual_expiring_email(to_email: str, name: str, plan_name: str, renewal_date: str, annual_amount: str, stripe_billing_portal_url: str, lang: str = "fr") -> bool:
    """Email 15 — annual subscription ends in 7 days"""
    is_fr = lang == "fr"
    first = _first_name(name, to_email)
    _subject = "Votre abonnement annuel Nautilus se renouvelle dans 7 jours." if is_fr else "Your annual Nautilus membership renews in 7 days."
    _label_str = "RAPPEL DE RENOUVELLEMENT" if is_fr else "RENEWAL REMINDER"
    _h1 = (
        f"Votre abonnement annuel se renouvelle le {renewal_date}."
        if is_fr else
        f"Your annual membership renews on {renewal_date}."
    )
    _body1 = (
        f"Votre abonnement annuel Nautilus {plan_name} sera automatiquement renouvelé le <strong>{renewal_date}</strong> pour <strong>{annual_amount}</strong>. Aucune action requise si vous souhaitez continuer."
        if is_fr else
        f"Your Nautilus {plan_name} annual membership will auto-renew on <strong>{renewal_date}</strong> for <strong>{annual_amount}</strong>. No action needed if you'd like to continue."
    )
    _body2 = "Pour annuler ou changer de plan avant le renouvellement :" if is_fr else "To cancel or change your plan before renewal:"
    _cta = "Gérer mon abonnement" if is_fr else "Manage my subscription"
    content = f"""
{label(_label_str)}
<h1>{_h1}</h1>
<p>{_body1}</p>
<p>{_body2}</p>
{cta(_cta, stripe_billing_portal_url)}
"""
    return await send_email(to_email, _subject, html_email(content, "Annual renewal reminder"), TRANSAC_FROM)


async def send_upgrade_confirmed_email(to_email: str, name: str, old_plan: str, new_plan: str, features: list[str] = None, lang: str = "fr") -> bool:
    """Email 16 — plan upgrade detected"""
    is_fr = lang == "fr"
    first = _first_name(name, to_email)
    if features is None:
        features = (
            ["Accès illimité aux opportunités", "Larry — analyste IA, requêtes illimitées", "Génération d'Investment Memo", "Alertes prix en temps réel", "Suivi et valorisation de portfolio"]
            if is_fr else
            ["Unlimited opportunity access", "Larry AI Analyst — unlimited queries", "Investment Memo generation", "Real-time price alerts", "Portfolio tracking & valuation"]
        )
    features_html = "".join(
        f'<div style="padding:8px 0;border-bottom:1px solid #F0EDE8;font-size:14px;color:#444;"><span style="color:#C6A85A;margin-right:10px;">&#10003;</span>{f}</div>'
        for f in features
    )
    _subject = f"Upgrade confirmé. Bienvenue sur Nautilus {new_plan}, {first}." if is_fr else f"Upgraded. Welcome to Nautilus {new_plan}, {first}."
    _label_str = "UPGRADE CONFIRMÉ" if is_fr else "UPGRADE CONFIRMED"
    _h1 = "Vous venez de débloquer plus." if is_fr else "You just unlocked more."
    _body = (
        f"Votre plan a été mis à niveau de <strong>{old_plan}</strong> vers <strong>{new_plan}</strong>. Voici ce qui est maintenant disponible :"
        if is_fr else
        f"Your plan has been upgraded from <strong>{old_plan}</strong> to <strong>{new_plan}</strong>. Here's what's now available to you:"
    )
    _cta = "Explorer vos nouvelles fonctionnalités" if is_fr else "Explore your new features"
    content = f"""
{label(_label_str)}
<h1>{_h1}</h1>
<p>{_body}</p>
<div style="margin:20px 0;">{features_html}</div>
{cta(_cta, "https://www.get-nautilus.com/app/dashboard", gold=True)}
"""
    return await send_email(to_email, _subject, html_email(content, "Upgrade confirmed"), TRANSAC_FROM)


async def send_downgrade_confirmed_email(to_email: str, name: str, old_plan: str, new_plan: str, effective_date: str, lang: str = "fr") -> bool:
    """Email 17 — plan downgrade detected"""
    is_fr = lang == "fr"
    first = _first_name(name, to_email)
    _subject = "Votre plan a été mis à jour." if is_fr else "Your plan has been updated."
    _label_str = "CHANGEMENT DE PLAN" if is_fr else "PLAN CHANGE"
    _h1 = f"Votre plan a été mis à jour vers {new_plan}." if is_fr else f"Your plan has been updated to {new_plan}."
    _body1 = (
        f"Votre abonnement Nautilus est passé de <strong>{old_plan}</strong> à <strong>{new_plan}</strong>. Les nouvelles limites prennent effet le <strong>{effective_date}</strong>."
        if is_fr else
        f"Your Nautilus subscription moved from <strong>{old_plan}</strong> to <strong>{new_plan}</strong>. New limits apply from <strong>{effective_date}</strong>."
    )
    _body2 = (
        "Vous perdez l'accès à : les opportunités illimitées, Larry IA, la génération d'Investment Memo et les alertes en temps réel."
        if is_fr else
        "You're losing access to: unlimited opportunities, Larry AI, Investment Memo generation and real-time alerts."
    )
    _cta = "Revenir à mon ancien plan" if is_fr else "Restore my previous plan"
    _small = "Réactivation immédiate. Aucun engagement." if is_fr else "Instant reactivation. No commitment."
    content = f"""
{label(_label_str)}
<h1>{_h1}</h1>
<p>{_body1}</p>
<p>{_body2}</p>
{cta(_cta, "https://www.get-nautilus.com/app/pricing", gold=True)}
<p style="color:#aaa;font-size:12px;text-align:center;">{_small}</p>
"""
    return await send_email(to_email, _subject, html_email(content, "Plan updated"), TRANSAC_FROM)


async def send_renewal_confirmed_email(to_email: str, name: str, plan_name: str, amount: str, next_renewal_date: str, lang: str = "fr") -> bool:
    """Email 18 — successful annual renewal"""
    is_fr = lang == "fr"
    first = _first_name(name, to_email)
    _subject = "Renouvelé. Une nouvelle année d'intelligence Nautilus." if is_fr else "Renewed. Another year of Nautilus intelligence."
    _label_str = "RENOUVELÉ" if is_fr else "RENEWED"
    _h1 = f"Merci, {first}." if is_fr else f"Thank you, {first}."
    _body = (
        f"Votre abonnement annuel Nautilus {plan_name} a été renouvelé pour une année supplémentaire. Nous sommes ravis de vous garder."
        if is_fr else
        f"Your Nautilus {plan_name} membership has been renewed for another year. We're glad you're staying."
    )
    _amount_label = "Montant renouvelé" if is_fr else "Amount renewed"
    _next_label = "Prochain renouvellement" if is_fr else "Next renewal"
    _cta = "Retour à votre tableau de bord" if is_fr else "Back to your dashboard"
    receipt = f"""<div style="background:#F5F4F0;padding:24px;margin:20px 0;">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-size:13px;color:#888;padding-bottom:8px;">{_amount_label}</td><td style="font-size:14px;font-weight:600;color:#1A2A44;text-align:right;">{amount}</td></tr>
<tr><td style="font-size:13px;color:#888;">{_next_label}</td><td style="font-size:14px;color:#555;text-align:right;">{next_renewal_date}</td></tr>
</table>
</div>"""
    content = f"""
{label(_label_str)}
<h1>{_h1}</h1>
<p>{_body}</p>
{receipt}
{cta(_cta, "https://www.get-nautilus.com/app/dashboard")}
"""
    return await send_email(to_email, _subject, html_email(content, "Membership renewed"), TRANSAC_FROM)
