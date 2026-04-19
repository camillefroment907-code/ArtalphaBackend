# n8n Credential Setup — One time only

Before importing the workflows, create **1 credential** and **1 environment variable** in n8n.

---

## Credential — Resend SMTP

All 8 email workflows use `n8n-nodes-base.emailSend` with SMTP transport via Resend.

1. Go to n8n → **Settings → Credentials → Add credential**
2. Search for **"SMTP"**
3. Name it **exactly**: `Resend SMTP`
4. Fill in:
   - **Host**: `smtp.resend.com`
   - **Port**: `465`
   - **SSL/TLS**: enabled (SSL)
   - **User**: `resend`
   - **Password**: your `RESEND_API_KEY` from Railway
5. Save

> n8n will auto-link any imported workflow that references `"name": "Resend SMTP"`.

---

## Environment Variable — NAUTILUS_ADMIN_KEY

Workflows 04 (Weekly Digest) and 09 (Weekly Blog) call the backend admin API.
They read the admin key from n8n's environment.

1. Go to n8n → **Settings → Environment Variables** (or set in Railway n8n service)
2. Add: `NAUTILUS_ADMIN_KEY` = your admin key (same value as `NAUTILUS_ADMIN_KEY` in Railway backend)

---

## Then import workflows

After creating the credential and env var:

1. Go to n8n → **Workflows → Import from file**
2. Import each `.json` file in this folder
3. n8n will auto-link `"Resend SMTP"` to the credential you just created
4. Toggle each workflow **Active** once you've confirmed it works in a test execution

---

## Workflow overview

| File | Trigger | Purpose |
|------|---------|---------|
| `01-welcome-email.json` | Webhook POST `/nautilus-welcome` | Sends welcome email on signup |
| `02-waitlist-confirmation.json` | Webhook POST `/nautilus-waitlist-confirm` | Waitlist confirmation + referral link |
| `03-deal-alert.json` | Webhook POST `/nautilus-deal-alert` | Real-time deal alert email |
| `04-weekly-digest.json` | Cron — Monday 8:00 AM | Weekly admin stats digest |
| `05-launch-day-blast.json` | Cron — May 13 8:00 AM UTC | Launch day notification (one-time) |
| `06-upgrade-prompt.json` | Webhook POST `/nautilus-upgrade-prompt` | Upgrade prompt when free limit hit |
| `07-subscription-confirmed.json` | Webhook POST `/nautilus-subscription-confirmed` | Stripe subscription confirmation |
| `08-churn-recovery.json` | Webhook POST `/nautilus-churn-recovery` | Cancellation recovery email |
| `09-weekly-blog.json` | Cron — Monday 6:00 AM | Auto-generates weekly blog post |

---

## Backend webhook trigger

Your backend calls these n8n webhooks. The webhook URLs in n8n follow this pattern:

```
https://primary-production-acb7.up.railway.app/webhook/[path]
```

For example:
- Welcome email: `POST https://primary-production-acb7.up.railway.app/webhook/nautilus-welcome`
- Deal alert: `POST https://primary-production-acb7.up.railway.app/webhook/nautilus-deal-alert`

Copy the exact webhook URL from each workflow's Webhook node after import.
Update `N8N_WEBHOOK_BASE` in your Railway backend env if not already set.
