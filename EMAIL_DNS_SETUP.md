# EMAIL DNS SETUP — Nautilus / get-nautilus.com

Email provider: **Resend** (confirmed from `app/services/email_service.py`)
From domains: `hello@get-nautilus.com`, `alerts@get-nautilus.com`

> Must be configured before May 2 to warm up the domain before launch outreach.

---

## Step 1 — Add domain in Resend Dashboard

1. Go to https://resend.com/domains
2. Click **Add Domain**
3. Enter `get-nautilus.com`
4. Resend will generate the DNS records below

---

## Step 2 — DNS Records to add (in your domain registrar / Cloudflare)

Resend requires these record types. The exact values will be shown in your Resend dashboard after Step 1.
The records below are the **structure** — copy the actual values from Resend.

### SPF record
```
Type:   TXT
Host:   @  (or get-nautilus.com)
Value:  v=spf1 include:_spf.resend.com ~all
TTL:    3600
```

### DKIM records (Resend generates 3 CNAME records)
```
Type:   CNAME
Host:   resend._domainkey   (exact subdomain shown in Resend dashboard)
Value:  [value from Resend dashboard]
TTL:    3600
```
Repeat for all CNAME records shown in Resend (typically 1–3).

### DMARC record
```
Type:   TXT
Host:   _dmarc
Value:  v=DMARC1; p=quarantine; rua=mailto:dmarc@get-nautilus.com; pct=100
TTL:    3600
```
Start with `p=quarantine` for the first 2 weeks, then upgrade to `p=reject` after confirming delivery.

---

## Step 3 — Update backend config

In Railway environment variables, update:
```
TRANSAC_FROM_EMAIL=hello@get-nautilus.com
ALERT_FROM_EMAIL=alerts@get-nautilus.com
```

These replace the old artalpha.io addresses in `app/config.py`.

---

## Step 4 — Verify in Resend

After adding DNS records (allow 15–60 min for propagation):
1. In Resend dashboard → Domains → click **Verify**
2. All records should show ✓
3. Send a test email to confirm delivery

---

## Warm-up schedule (before May 13 launch)

| Date | Volume | Purpose |
|------|--------|---------|
| May 2 | 10–50 emails | Initial warm-up (team + beta) |
| May 5–9 | 100–500/day | Waitlist confirmation sends |
| May 13 | Unlimited | Launch day — waitlist + onboarding |

---

## Email addresses to configure in Railway

```env
RESEND_API_KEY=re_...  (from https://resend.com/api-keys)
TRANSAC_FROM_EMAIL=hello@get-nautilus.com
ALERT_FROM_EMAIL=alerts@get-nautilus.com
```
