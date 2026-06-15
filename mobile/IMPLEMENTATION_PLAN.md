# IMPLEMENTATION_PLAN.md — Nautilus
_Plan d'exécution priorisé — Brand + Produit_
_2026-06-11_

---

## SPRINT 1 — BRAND FOUNDATION (semaine 1)
_Objectif : l'app ressemble à Nautilus, pas à un dashboard_

### S1.1 — Home Screen Hero (P0, ~3h)

**Fichier :** `app/(tabs)/index.tsx`

Changements :
- [ ] Hero card : fond `#111111`, valeur en blanc 28px
- [ ] Évolution : couleur verte si positive, rouge si négative
- [ ] Mini-previews : initiale artiste dans carré gris (supprimer `EMOJIS[]`)
- [ ] Valeur totale absente : état vide narratif élégant

Impact : **transformation visuelle majeure**. Le home devient mémorable.

---

### S1.2 — Login Manifeste (P1, ~1h)

**Fichier :** `app/login.tsx`

Changements :
- [ ] Tagline sous logo : "Connaissez la valeur de ce que vous possédez."
- [ ] Social proof : "Rejoint par 4 200 collectionneurs"
- [ ] Espacement amélioré (logo → tagline → form)

Impact : la promesse de valeur précède le formulaire.

---

### S1.3 — Success Screen Dark (P1, ~2h)

**Fichier :** `app/add-artwork/success.tsx`

Changements :
- [ ] Fond `#111111` (comme onboarding step 7)
- [ ] Valeur estimée en grand si disponible
- [ ] Valeur totale collection mise à jour
- [ ] CTA vert "Voir ma collection →"

Impact : le WOW moment de l'activation.

---

### S1.4 — Tokens Update (P1, ~30min)

**Fichier :** `lib/tokens.ts`

Changements :
- [ ] Ajouter `night: '#111111'`
- [ ] Ajouter `Motion` constants

---

## SPRINT 2 — COLLECTION UPGRADE (semaine 2)

### S2.1 — Collection : valeurs + placeholders (P1, ~2h)

**Fichier :** `app/(tabs)/collection.tsx`

Changements :
- [ ] Cellule : rectangle gris + initiale artiste (supprimer emoji)
- [ ] Afficher `estimated_current_value_eur` en vert sous chaque cellule
- [ ] Masquer tabs Timeline/Artistes/Documents (supprimer les stubs)
- [ ] État vide narratif : "Votre collection vous attend."

---

### S2.2 — Artwork Detail : hero + comparables (P1, ~3h)

**Fichier :** `app/artwork/[id].tsx`

Changements :
- [ ] Hero : rectangle gris + initiale artiste (supprimer emoji 🎨)
- [ ] Tab Comparables : afficher ventes price-history (3-5 entrées)

---

### S2.3 — Collection Health CTAs (P2, ~1h)

**Fichier :** `app/collection-health.tsx`

Changements :
- [ ] "Documenter" → route vers `/artwork/[id]`
- [ ] "Ajouter une œuvre" → `/add-artwork`
- [ ] "Voir le marché" → `/(tabs)/alerts`
- [ ] "Demander à Larry" → `/(tabs)/larry` avec contexte

---

### S2.4 — Alertes : CTA mort → Larry fallback (P2, ~1h)

**Fichier :** `app/(tabs)/alerts.tsx`

Changements :
- [ ] Alerte sans source_url : CTA "Demander à Larry" → ouvre chat avec titre alerte pré-rempli

---

## SPRINT 3 — INTELLIGENCE (semaine 3)

### S3.1 — Larry : contexte onboarding (P1, ~2h)

**Fichier :** `app/(tabs)/larry.tsx`

Changements :
- [ ] Charger `getOnboardingData()` au mount
- [ ] Inclure dans le payload POST /api/chat/message :
  ```json
  { "systemContext": "Profil: collector. Artistes: Soulages, Richter. Budget: 25k-100k." }
  ```
- [ ] Si API supporte system_prompt : utiliser

---

### S3.2 — Larry : briefing live (P2, ~1h)

**Fichier :** `app/(tabs)/larry.tsx`

Changements :
- [ ] Remplacer la ligne statique Artcurial par la dernière alerte réelle
- [ ] Ou : "Aucune actualité notable aujourd'hui." si pas d'alerte

---

### S3.3 — Home : personnalisation post-onboarding (P2, ~2h)

**Fichier :** `app/(tabs)/index.tsx`

Changements :
- [ ] Nouvel utilisateur (0 œuvres) : afficher artistes onboarding comme "Artistes à suivre"
- [ ] Message personnalisé selon profileType :
  - collector → "Bienvenue dans votre Collection OS."
  - investor → "Votre intelligence patrimoniale est active."
  - advisor → "Gérez vos collections client depuis ici."

---

## SPRINT 4 — PAYWALL & MONÉTISATION (semaine 4)

### S4.1 — Paywall social proof (P1, ~1h)

**Fichier :** `app/paywall.tsx`

Changements :
- [ ] Ajouter : "Rejoignez 4 200 collectionneurs"
- [ ] Mettre en avant l'estimation comme feature killer
- [ ] Si Stripe supporte : offrir essai 14 jours

---

### S4.2 — Upgrade CTA proactif (P1, ~1h)

Déclencher l'affichage du paywall dans ces situations :
- [ ] Collection Health : quand l'utilisateur est locké (>7 items, plan free)
- [ ] Alertes : quand l'utilisateur veut voir plus de 10 alertes
- [ ] Larry : quand l'utilisateur dépasse le quota gratuit

---

## SPRINT 5 — POLISH & APP STORE (semaine 5)

### S5.1 — Icônes tabs propres (P2, ~2h)

Remplacer les labels texte des tabs par des icônes SF Symbols cohérentes.

---

### S5.2 — Animations de transition (P2, ~3h)

- Feedback de press state sur toutes les Pressable importantes
- Transition smooth sur l'expand/collapse Collection Health
- Micro-animation sur l'apparition des estimates (counter up)

---

### S5.3 — App Store screenshots (P0 avant soumission, ~2h)

Préparer 5 screenshots App Store :
1. Home avec collection valorisée (dark hero card)
2. Onboarding step 7 (wow moment)
3. Manual form avec estimation
4. Artwork detail
5. Larry chat avec insight

---

## MÉTRIQUES DE SUCCÈS

| Métrique | Baseline | Cible Sprint 5 |
|---------|---------|----------------|
| App Average Score | 7.7/10 | 9.0/10 |
| Home Score | 6.5/10 | 9.0/10 |
| Instagram Test pass rate | ~30% écrans | 90% écrans |
| % écrans > 9/10 | 2/11 (18%) | 9/11 (82%) |

---

## ORDRE D'EXÉCUTION RECOMMANDÉ

```
Semaine 1
├── S1.1 Home hero (3h) ← PRIORITÉ ABSOLUE
├── S1.2 Login tagline (1h)
└── S1.3 Success screen dark (2h)

Semaine 2
├── S2.1 Collection valeurs (2h)
├── S2.2 Artwork Detail (3h)
└── S2.3 Collection Health CTAs (1h)

Semaine 3
├── S3.1 Larry contexte onboarding (2h)
└── S3.2 Larry briefing live (1h)

Semaine 4
├── S4.1 Paywall social proof (1h)
└── S4.2 Upgrade CTA proactif (1h)

Semaine 5
└── Polish + App Store prep
```

**Semaine 1 = ~6h de code. Transformation visuelle complète.**
