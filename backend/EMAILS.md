# Email Setup — Resend

## Variables d'environnement à configurer sur Railway

| Variable | Valeur |
|----------|--------|
| `RESEND_API_KEY` | `re_xxxxxxxxxxxx` (depuis resend.com/api-keys) |
| `TRANSAC_FROM_EMAIL` | `hello@artalpha.io` |
| `ALERT_FROM_EMAIL` | `alerts@artalpha.io` |

## Domaine
Domaine `artalpha.io` à configurer sur Resend (DNS → Settings → Domains).
Vérifier que les deux adresses expéditrices sont autorisées.

## Emails déclenchés

| Événement | Fonction | Expéditeur |
|-----------|----------|------------|
| Register | `send_welcome_email` | hello@artalpha.io |
| `customer.subscription.trial_will_end` (J-3) | `send_trial_ending_email` | hello@artalpha.io |
| `invoice.payment_failed` | `send_payment_failed_email` | hello@artalpha.io |
| `customer.subscription.deleted` | `send_subscription_canceled_email` | hello@artalpha.io |
| Deal alert (score ≥ seuil utilisateur) | `send_deal_alert_email` | alerts@artalpha.io |

## Langue
Déterminée par `UserPreference.language` (`"fr"` ou `"en"`).
Défaut : `"fr"`. Modifiable via `PATCH /api/profile/preferences`.

Les billing webhooks utilisent `"fr"` par défaut (la langue n'est pas chargée
depuis la DB dans les handlers webhook pour éviter une requête supplémentaire).

## Architecture

```
app/services/email_service.py   ← service central (Resend v2)
app/engines/alerts.py           ← deal alerts (appelle email_service)
app/api/auth.py                 ← welcome email au register
app/api/billing.py              ← trial_ending, payment_failed, canceled
```

## Tester localement

```bash
# Sans clé Resend → warnings dans les logs, pas d'envoi
RESEND_API_KEY=re_test_xxx python -c "
import asyncio
from app.services.email_service import send_welcome_email
asyncio.run(send_welcome_email('test@example.com', 'Test User', 'free', 'fr'))
"
```
