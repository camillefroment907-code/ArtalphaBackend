# BLOCKERS — Nautilus Launch

Last updated: 2026-04-18

## 🔴 BLOQUANTS CRITIQUES

_Aucun bloquant critique identifié à date._

## 🟡 ATTENTION

| # | Blocage | Impact | Action requise | Statut |
|---|---------|--------|----------------|--------|
| 1 | Backend /api/waitlist endpoint inexistant | Waitlist form ne peut pas sauvegarder les inscriptions | Créer endpoint backend | ⏳ |
| 2 | Backend /api/recommendations/collector-dna inexistant | Recommendation Engine bloqué | Créer schema + endpoint backend | ⏳ |
| 3 | Stripe production price IDs non vérifiés | Billing peut échouer en prod | Vérifier env vars Railway | ⏳ |
| 4 | CORS production non configuré | API calls depuis get-nautilus.com vont échouer | Vérifier Railway backend config | ⏳ |
| 5 | SPF/DKIM/DMARC non configurés | Emails outreach vont en spam | Configurer DNS get-nautilus.com | ⏳ |

## 🟢 RÉSOLUS

| # | Blocage | Résolution | Date |
|---|---------|------------|------|
| 1 | Design system — confusion Inter vs Playfair | Confirmé : custom.css a les bons tokens | 2026-04-18 |

## Actions immédiates requises (humain)

1. **Camille** : Vérifier que get-nautilus.com est bien configuré sur Vercel
2. **Camille** : Confirmer les Stripe production price IDs dans Railway env vars
3. **Camille** : Configurer SPF/DKIM/DMARC sur get-nautilus.com avant le 2 mai (outreach email)
