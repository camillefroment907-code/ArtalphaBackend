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


async def send_verification_email(to_email: str, verification_link: str, lang: str = "fr") -> bool:
    """Email 1 — triggered after POST /api/auth/register"""
    is_fr = lang == "fr"
    _subject = "Vérifiez votre adresse email" if is_fr else "Please verify your email address"
    _label = "CRÉATION DE COMPTE" if is_fr else "ACCOUNT SETUP"
    _h1 = "Vérifiez votre email pour accéder à Nautilus." if is_fr else "Verify your email to access Nautilus."
    _body = (
        "Vous êtes à une étape d'accéder à l'intelligence du marché de l'art en temps réel. Cliquez ci-dessous pour confirmer votre adresse email."
        if is_fr else
        "You're one step away from accessing real-time art market intelligence. Click below to verify your email address."
    )
    _cta = "Vérifier mon adresse email" if is_fr else "Verify my email address"
    _disclaimer = (
        "Ce lien expire dans 24h. Si vous n'avez pas créé de compte Nautilus, ignorez simplement cet email."
        if is_fr else
        "This link expires in 24 hours. If you didn't create a Nautilus account, you can safely ignore this email."
    )
    content = f"""
{label(_label)}
<h1>{_h1}</h1>
<p>{_body}</p>
{cta(_cta, verification_link)}
<p style="color:#888888;font-size:13px;">{_disclaimer}</p>
"""
    return await send_email(to_email, _subject, html_email(content, _subject), TRANSAC_FROM)


async def send_welcome_email(to_email: str, name: str, plan: str = "free", lots_tracked: int = 12847, avg_conviction: int = 74, artists_tracked: int = 1200, lang: str = "fr") -> bool:
    """Email 2 — triggered after email verification confirmed"""
    is_fr = lang == "fr"
    first = _first_name(name, to_email)
    plan_label = {"free": "Free", "starter": "Collector", "investor": "Investor", "pro": "Family Office", "elite": "Institutional"}.get(plan, plan.title())
    unsubscribe_url = "https://www.get-nautilus.com/app/portfolio"

    _subject = f"Bienvenue sur Nautilus, {first}." if is_fr else f"Welcome to Nautilus, {first}."
    _label_hero = "BIENVENUE · ACCÈS CONFIRMÉ" if is_fr else "WELCOME · ACCESS CONFIRMED"
    _h1 = f"Votre avantage commence maintenant, {first}." if is_fr else f"Your edge starts now, {first}."
    _body = (
        "Votre compte est actif. Chaque lot aux enchères dans notre base est scoré, classé et prêt pour vous — avec les données exactes pour agir avant le marché."
        if is_fr else
        "Your account is live. Every auction lot in our database is now scored, ranked, and waiting for you — with the exact data you need to act before the market does."
    )
    _section_title = "Trois choses à faire en premier" if is_fr else "Three things to do first"
    _step1_title = "1. Parcourez l'Explorer" if is_fr else "1. Browse the Explorer"
    _step1_body = (
        "Chaque lot classé par score de conviction. Filtrez par catégorie, budget, niveau de signal. Voyez exactement pourquoi chaque lot est estimé à ce prix."
        if is_fr else
        "Every lot ranked by conviction score. Filter by category, budget, signal tier. See exactly why each lot is priced where it is."
    )
    _step2_title = "2. Interrogez Larry — votre analyste IA" if is_fr else "2. Ask Larry — your AI analyst"
    _step2_body = (
        "Quel artiste gagne en momentum ? Ce lot est-il mal estimé ? Quel est le bon point d'entrée sur une lithographie de Chagall ? Il répond en quelques secondes."
        if is_fr else
        "Which artist is gaining momentum? Is this lot mispriced? What's the right entry on a Chagall print? He answers in seconds."
    )
    _step3_title = "3. Générez un Investment Memo" if is_fr else "3. Generate an Investment Memo"
    _step3_body = (
        "Rapport analyste complet sur n'importe quel lot en 30 secondes — objectifs de prix, ventes comparables, facteurs de risque, verdict achat/conservation/pass."
        if is_fr else
        "Full analyst report on any lot in 30 seconds — price targets, comparable sales, risk factors, buy/hold/pass verdict."
    )
    _trial_badge = "ESSAI GRATUIT · 7 JOURS" if is_fr else "FREE TRIAL · 7 DAYS"
    _trial_title = "7 jours d'accès Investor offerts" if is_fr else "7 days of Investor access, on us"
    _trial_body = (
        "Votre compte inclut 7 jours d'accès complet au plan Investor — mémos d'investissement IA, alertes temps réel, analyse artiste complète. Aucune carte bancaire requise pour commencer."
        if is_fr else
        "Your account includes 7 days of full Investor access — AI investment memos, real-time alerts, complete artist analysis. No credit card required to get started."
    )
    _cta = "Ouvrir l'Explorer →" if is_fr else "Open the Explorer →"
    _footer_note = "Une question ? Répondez à cet email — nous lisons tout." if is_fr else "Questions? Reply to this email — we read everything."
    _footer_disclaimer = "Pas un conseil en investissement. L'art comporte un risque de perte." if is_fr else "Not financial advice. Art investment carries risk of loss."

    html = f"""<!DOCTYPE html>
<html lang="{lang}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1.0" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <title>{_subject}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=Inter:wght@400;500;600&display=swap');
    </style>
  </head>
  <body style="margin:0;padding:0;background-color:#F5F4F0;font-family:'Inter',Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F5F4F0;">
      <tr>
        <td align="center" style="padding:40px 8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
            <!-- HEADER -->
            <tr>
              <td style="background-color:#FFFFFF;padding:20px 24px 20px 24px;border-top:3px solid #C6A85A;">
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
              <td style="background-color:#FFFFFF;padding:0 24px;">
                <hr style="border:none;border-top:1px solid #E8E4DC;margin:0;" />
              </td>
            </tr>
            <!-- HERO -->
            <tr>
              <td style="background-color:#FFFFFF;padding:36px 24px 28px 24px;">
                <p style="color:#C6A85A;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;margin:0 0 16px 0;font-family:'Inter',Arial,Helvetica,sans-serif;font-weight:500;">{_label_hero}</p>
                <h1 style="color:#1A2A44;font-family:Georgia,serif;font-size:28px;font-weight:normal;line-height:1.3;margin:0 0 24px 0;">{_h1}</h1>
                <p style="color:#555555;font-size:14px;line-height:1.75;margin:0;font-family:'Inter',Arial,Helvetica,sans-serif;">{_body}</p>
              </td>
            </tr>
            <!-- STATS BAR -->
            <tr>
              <td style="background-color:#FFFFFF;padding:0 24px 32px 24px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td width="31%" align="center" style="background-color:#F5F4F0;padding:20px 10px;">
                      <div style="color:#4B6DF5;font-family:'Playfair Display',Georgia,serif;font-size:26px;font-weight:700;line-height:1;">{lots_tracked:,}</div>
                      <div style="color:#888888;font-family:'Inter',Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:0.14em;text-transform:uppercase;margin-top:6px;">{"Lots suivis" if is_fr else "Lots Tracked"}</div>
                    </td>
                    <td width="2%" style="background-color:#FFFFFF;"></td>
                    <td width="31%" align="center" style="background-color:#F5F4F0;padding:20px 10px;">
                      <div style="color:#4B6DF5;font-family:'Playfair Display',Georgia,serif;font-size:26px;font-weight:700;line-height:1;">{avg_conviction}/100</div>
                      <div style="color:#888888;font-family:'Inter',Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:0.14em;text-transform:uppercase;margin-top:6px;">{"Conviction moy." if is_fr else "Avg Conviction"}</div>
                    </td>
                    <td width="2%" style="background-color:#FFFFFF;"></td>
                    <td width="34%" align="center" style="background-color:#0C1622;padding:20px 10px;">
                      <div style="color:#4B6DF5;font-family:'Playfair Display',Georgia,serif;font-size:22px;font-weight:700;line-height:1;">{artists_tracked:,}</div>
                      <div style="color:rgba(255,255,255,0.4);font-family:'Inter',Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:0.14em;text-transform:uppercase;margin-top:6px;">{"Artistes suivis" if is_fr else "Artists Tracked"}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <!-- TRIAL BANNER -->
            <tr>
              <td style="background-color:#0C1622;padding:28px 24px;">
                <p style="color:#C6A85A;font-size:9px;letter-spacing:0.18em;text-transform:uppercase;margin:0 0 10px 0;font-family:'Inter',Arial,Helvetica,sans-serif;font-weight:600;">{_trial_badge}</p>
                <p style="color:#FFFFFF;font-family:'Playfair Display',Georgia,serif;font-size:20px;font-weight:700;margin:0 0 12px 0;line-height:1.3;">{_trial_title}</p>
                <p style="color:rgba(255,255,255,0.65);font-family:'Inter',Arial,Helvetica,sans-serif;font-size:13px;line-height:1.7;margin:0;">{_trial_body}</p>
              </td>
            </tr>
            <!-- DIVIDER -->
            <tr>
              <td style="background-color:#FFFFFF;padding:0 24px;">
                <hr style="border:none;border-top:1px solid #E8E4DC;margin:0 0 28px 0;" />
              </td>
            </tr>
            <!-- 3 STEPS -->
            <tr>
              <td style="background-color:#FFFFFF;padding:0 24px 28px 24px;">
                <p style="color:#0C1622;font-family:'Playfair Display',Georgia,serif;font-size:20px;font-weight:700;margin:0 0 18px 0;">{_section_title}</p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px;">
                  <tr>
                    <td style="background-color:#F5F4F0;border-left:3px solid #C6A85A;padding:14px 18px;">
                      <p style="color:#0C1622;font-family:'Inter',Arial,Helvetica,sans-serif;font-size:13px;font-weight:600;margin:0 0 4px 0;">{_step1_title}</p>
                      <p style="color:#666666;font-family:'Inter',Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;margin:0;">{_step1_body}</p>
                    </td>
                  </tr>
                </table>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px;">
                  <tr>
                    <td style="background-color:#F5F4F0;border-left:3px solid #C6A85A;padding:14px 18px;">
                      <p style="color:#0C1622;font-family:'Inter',Arial,Helvetica,sans-serif;font-size:13px;font-weight:600;margin:0 0 4px 0;">{_step2_title}</p>
                      <p style="color:#666666;font-family:'Inter',Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;margin:0;">{_step2_body}</p>
                    </td>
                  </tr>
                </table>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="background-color:#F5F4F0;border-left:3px solid #C6A85A;padding:14px 18px;">
                      <p style="color:#0C1622;font-family:'Inter',Arial,Helvetica,sans-serif;font-size:13px;font-weight:600;margin:0 0 4px 0;">{_step3_title}</p>
                      <p style="color:#666666;font-family:'Inter',Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;margin:0;">{_step3_body}</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <!-- CTA -->
            <tr>
              <td style="background-color:#FFFFFF;padding:0 24px 40px 24px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td align="center">
                      <a href="https://get-nautilus.com/app/explore" style="display:block;background-color:#4B6DF5;color:#FFFFFF;font-family:'Inter',Arial,Helvetica,sans-serif;font-size:15px;font-weight:600;letter-spacing:0.01em;text-decoration:none;padding:15px 32px;border-radius:8px;text-align:center;">{_cta}</a>
                    </td>
                  </tr>
                </table>
                <p style="color:#888888;font-family:'Inter',Arial,Helvetica,sans-serif;font-size:12px;text-align:center;margin:16px 0 0 0;">{_footer_note}</p>
              </td>
            </tr>
            <!-- FOOTER -->
            <tr>
              <td style="padding:24px 24px;text-align:center;border-top:1px solid #E8E4DC;">
                <p style="color:#AAAAAA;font-family:'Inter',Arial,Helvetica,sans-serif;font-size:11px;line-height:1.7;margin:0 0 6px 0;">Nautilus &#183; Art Market Intelligence &#183; <a href="https://get-nautilus.com" style="color:#AAAAAA;text-decoration:underline;">get-nautilus.com</a><br /><a href="{unsubscribe_url}" style="color:#AAAAAA;text-decoration:underline;">{"Se désabonner" if is_fr else "Unsubscribe"}</a> &nbsp;&#183;&nbsp; <a href="https://get-nautilus.com/legal/privacy" style="color:#AAAAAA;text-decoration:underline;">{"Politique de confidentialité" if is_fr else "Privacy Policy"}</a></p>
                <p style="color:#CCCCCC;font-family:'Inter',Arial,Helvetica,sans-serif;font-size:10px;font-style:italic;margin:0;">{_footer_disclaimer}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>"""
    return await send_email(to_email, _subject, html, TRANSAC_FROM)


async def send_password_reset_email(to_email: str, reset_link: str, lang: str = "fr") -> bool:
    """Email 3 — triggered by forgot password flow"""
    is_fr = lang == "fr"
    _subject = "Réinitialisez votre mot de passe Nautilus" if is_fr else "Reset your Nautilus password"
    _label = "SÉCURITÉ" if is_fr else "SECURITY"
    _h1 = "Réinitialisation de mot de passe demandée." if is_fr else "Password reset requested."
    _body = (
        "Nous avons reçu une demande de réinitialisation du mot de passe de votre compte Nautilus. Cliquez ci-dessous pour choisir un nouveau mot de passe."
        if is_fr else
        "We received a request to reset the password for your Nautilus account. Click below to choose a new password."
    )
    _cta = "Réinitialiser mon mot de passe" if is_fr else "Reset my password"
    _disclaimer = (
        "Ce lien expire dans 1 heure. Si vous n'avez pas fait cette demande, votre compte est en sécurité."
        if is_fr else
        "This link expires in 1 hour. If you didn't request this, your account is safe — someone may have entered your email by mistake."
    )
    content = f"""
{label(_label)}
<h1>{_h1}</h1>
<p>{_body}</p>
{cta(_cta, reset_link)}
<p style="color:#888888;font-size:13px;">{_disclaimer}</p>
"""
    return await send_email(to_email, _subject, html_email(content, _subject), TRANSAC_FROM)


async def send_email_changed_email(to_email: str, new_email: str, reset_link: str, lang: str = "fr") -> bool:
    """Email 4 — triggered when user changes email in settings"""
    is_fr = lang == "fr"
    _subject = "Votre adresse email a été mise à jour" if is_fr else "Your email address has been updated"
    _label = "COMPTE" if is_fr else "ACCOUNT"
    _h1 = "Adresse email modifiée." if is_fr else "Email address updated."
    _body1 = (
        f"L'email de votre compte Nautilus a été changé pour <strong>{new_email}</strong>. Si vous avez effectué ce changement, aucune action n'est requise."
        if is_fr else
        f"Your Nautilus account email has been changed to <strong>{new_email}</strong>. If you made this change, no action is needed."
    )
    _body2 = (
        "Si vous n'êtes <strong>PAS</strong> à l'origine de ce changement, contactez-nous immédiatement à contact@get-nautilus.com ou réinitialisez votre mot de passe."
        if is_fr else
        "If you did <strong>NOT</strong> make this change, please contact us immediately at contact@get-nautilus.com or reset your password now."
    )
    _cta = "Sécuriser mon compte" if is_fr else "Secure my account"
    content = f"""
{label(_label)}
<h1>{_h1}</h1>
<p>{_body1}</p>
<p>{_body2}</p>
{cta(_cta, reset_link)}
"""
    return await send_email(to_email, _subject, html_email(content, _subject), TRANSAC_FROM)
