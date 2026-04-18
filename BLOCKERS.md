# BLOCKERS — Nautilus Launch

Last updated: 2026-04-18

## 🔴 BLOQUANTS CRITIQUES

_Aucun bloquant critique identifié à date._

## 🟡 ATTENTION — Requires Camille action

| # | Blocage | Impact | Action requise | Statut |
|---|---------|--------|----------------|--------|
| 3 | Stripe production price IDs non confirmés | Billing peut échouer en prod | Vérifier/créer dans Stripe Dashboard, puis setter dans Railway env: `STRIPE_PRICE_COLLECTOR_MONTHLY`, `STRIPE_PRICE_COLLECTOR_ANNUAL`, `STRIPE_PRICE_INVESTOR_MONTHLY`, `STRIPE_PRICE_INVESTOR_ANNUAL`, `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_ANNUAL` | ⏳ Camille |
| 5 | SPF/DKIM/DMARC non configurés | Emails outreach vont en spam | Voir EMAIL_DNS_SETUP.md | ⏳ Camille |

## 🟢 RÉSOLUS

| # | Blocage | Résolution | Date |
|---|---------|------------|------|
| 1 | Design system — confusion Inter vs Playfair | Confirmé : custom.css a les bons tokens | 2026-04-18 |
| 1P2 | Backend /api/waitlist inexistant | Créé: `app/api/waitlist.py` + `WaitlistEntry` model — auto-creates table on deploy | 2026-04-18 |
| 2P2 | CollectorDNA schema inexistant | Créé: `CollectorDNA` + `RecommendationEvent` models in db_models.py | 2026-04-18 |
| 4 | CORS get-nautilus.com non configuré | Ajouté https://get-nautilus.com et https://www.get-nautilus.com dans main.py CORS allow_origins | 2026-04-18 |

## Actions immédiates requises (humain)

1. **Camille** : Vérifier que get-nautilus.com est bien configuré sur Vercel
2. **Camille** : Confirmer les Stripe production price IDs dans Railway env vars (voir tableau ci-dessus)
3. **Camille** : Configurer SPF/DKIM/DMARC sur get-nautilus.com avant le 2 mai — voir EMAIL_DNS_SETUP.md
