# SCREEN_AUDIT.md — Nautilus
_Audit écran par écran — Brand + UX + Product_
_2026-06-11_

---

## Grille de notation

| Dimension | Description |
|-----------|-------------|
| **Clarté** | La proposition de valeur est-elle immédiate ? |
| **Désirabilité** | Donne-t-on envie d'utiliser cet écran ? |
| **Premium** | L'écran serait-il à sa place dans une app à 4.8★ ? |
| **Branding** | Reconnaît-on Nautilus sans le logo ? |
| **Mémorisation** | Y a-t-il un moment ou détail mémorable ? |
| **Confiance** | Cet écran inspire-t-il confiance dans les données ? |
| **Conversion** | Cet écran fait-il avancer vers l'action voulue ? |
| **Score** | /10 |

---

## 1. LOGIN

**Score actuel : 7.5/10**

| Dimension | Score | Commentaire |
|-----------|-------|-------------|
| Clarté | 9/10 | Form claire, erreurs visibles |
| Désirabilité | 6/10 | Aucune promesse de valeur visible |
| Premium | 7/10 | Propre mais générique |
| Branding | 5/10 | "Nautilus / Collection OS" mais sans émotion |
| Mémorisation | 4/10 | Rien de distinctif |
| Confiance | 8/10 | Formulaire rassurant |
| Conversion | 8/10 | Flow direct |

**Problèmes identifiés :**
- Le login ouvre sur un formulaire blanc vide. Zéro désirabilité.
- Aucune image, aucune couleur, aucune émotion pour vendre la vision AVANT la connexion.
- Le tagline "Collection OS" n'explique rien à un nouveau visiteur.

**Redesign requis :**
- Ajouter une phrase manifeste sous le logo : "Connaissez la valeur de ce que vous possédez."
- Fond légèrement texturé ou un seul élément visuel évocateur (art abstrait minimaliste).
- Social proof discret : "Rejoint par 4 200 collectionneurs".
- Le bouton "Se connecter" devient noir plein (déjà OK).
- Ouvrir sur logo + phrase avant de scroll vers le form (ou fond blanc avec phrase en bas).

**Score cible : 9/10**

---

## 2. ONBOARDING (steps 1–7)

**Score actuel : 9.2/10**

| Dimension | Score | Commentaire |
|-----------|-------|-------------|
| Clarté | 9/10 | Chaque step a un objectif unique |
| Désirabilité | 9/10 | Progression bien rythmée |
| Premium | 9/10 | Dots, cards, layout élégant |
| Branding | 8/10 | Cohérent mais peu distinctif avant step 7 |
| Mémorisation | 10/10 | Step 7 dark + vert est mémorable |
| Confiance | 9/10 | Skippable = non intrusif |
| Conversion | 9/10 | Activation bien pensée |

**Problèmes identifiés :**
- Steps 1–6 : fond blanc standard, pas encore "Nautilus"
- Les données collectées (artistes, budget) ne sont PAS utilisées ensuite → promesse non tenue

**Améliorations :**
- Step 1 : ajouter une phrase de bienvenue plus personnelle avant les choix
- Step 4 (artistes) : après sélection, preview "Votre première alerte vous attendra"
- Utiliser les données onboarding dans Larry briefing (P0 technique)

**Score cible : 9.5/10**

---

## 3. HOME / DASHBOARD

**Score actuel : 6.5/10 — CRITIQUE**

| Dimension | Score | Commentaire |
|-----------|-------|-------------|
| Clarté | 6/10 | Trop de cartes, hiérarchie peu claire |
| Désirabilité | 5/10 | Ressemble à un dashboard SaaS |
| Premium | 6/10 | Cards correctes mais layout plat |
| Branding | 4/10 | Pourrait être n'importe quelle app |
| Mémorisation | 3/10 | Rien de marquant |
| Confiance | 7/10 | Data réelles = bien |
| Conversion | 7/10 | CTAs présents |

**Problèmes critiques :**

1. **La valeur de la collection n'est pas le héros.** Elle est cachée dans une petite card grise. C'est LE chiffre le plus important de l'app.

2. **Pas de hiérarchie émotionnelle.** Tout a le même poids visuel. L'œil ne sait pas où aller.

3. **"Bonjour X" + cartes = dashboard générique.** Aucune personnalité Nautilus.

4. **Les alertes sont minuscules.** Elles devraient avoir une présence plus forte.

5. **Emojis dans les previews d'œuvres.** Casse le premium feeling.

**Redesign complet :**

```
[SAFE AREA TOP]

[TOPBAR] Bonjour Camille    [🔔][+]

─── HERO CARD (fond sombre #111) ───────────────
VOTRE COLLECTION
[montant principal en display 28px blanc]
184 000 €
[sous-texte] +12.4% · 23 œuvres · 8 artistes
[mini-previews alignés à droite]
────────────────────────────────────────────────

[COLLECTION HEALTH — card blanche avec dot vert]
Collection solide →  [4 dims en ligne]

[ACTION RECOMMANDÉE — card avec dot coloré]
→ ACTION RECOMMANDÉE
Documenter "Sans titre" de Richter
Collection Health · Documentation

[ALERTES — section avec badge]
ALERTES                        Tout voir →
[2 alertes avec dot + titre + age]

[LARRY — card fond gris]
INTELLIGENCE NAUTILUS
[2 chips questions]
```

**Le changement principal : la valeur de collection doit être en héro sur fond sombre.**

**Score cible : 9/10**

---

## 4. COLLECTION

**Score actuel : 7.2/10**

| Dimension | Score | Commentaire |
|-----------|-------|-------------|
| Clarté | 8/10 | Grille claire |
| Désirabilité | 6/10 | Cellules génériques (emojis) |
| Premium | 7/10 | Layout correct |
| Branding | 5/10 | Aucun élément distinctif |
| Mémorisation | 4/10 | Grille standard |
| Confiance | 8/10 | Data réelles |
| Conversion | 7/10 | Tap → artwork detail OK |

**Problèmes :**
- Emojis comme placeholder = cassent totalement le premium
- Tabs "Timeline / Artistes / Documents" stubs = frustration
- Aucune personnalité dans l'état vide

**Redesign :**
- Placeholder œuvre = rectangle gris doux avec initiale artiste (comme la librairie Apple Music)
- Ajouter un indicateur de valeur sous chaque œuvre : "est. 12 000 €" en vert subtil
- État vide narratif : "Votre collection vous attend. Commencez par une œuvre."
- Supprimer ou cacher les tabs non fonctionnels

**Score cible : 8.5/10**

---

## 5. ALERTES

**Score actuel : 6.9/10**

| Dimension | Score | Commentaire |
|-----------|-------|-------------|
| Clarté | 8/10 | Cards bien structurées |
| Désirabilité | 6/10 | Pas d'urgence ressentie |
| Premium | 7/10 | Correct |
| Branding | 5/10 | Générique |
| Mémorisation | 4/10 | Rien de distinctif |
| Confiance | 8/10 | Types d'alertes clairs |
| Conversion | 6/10 | CTA sans URL = mort |

**Problèmes :**
- Les alertes ne racontent pas d'histoire. Un titre + body + CTA mais pas d'émotion.
- Sans source_url, le CTA est mort. Mauvaise UX.
- Le topbar "Alertes" est purement fonctionnel, aucune personnalité.

**Améliorations :**
- Topbar : ajouter un insight du jour (ex: "3 nouvelles ventes concernent votre collection")
- Alertes sans URL : rediriger vers Larry avec le contexte pré-rempli
- Ajouter une carte "Insights marché de la semaine" en haut (non-personnelle mais utile)

**Score cible : 8/10**

---

## 6. LARRY (IA Chat)

**Score actuel : 8.2/10**

| Dimension | Score | Commentaire |
|-----------|-------|-------------|
| Clarté | 9/10 | Chips + chat = bien |
| Désirabilité | 8/10 | L'IA est engageante |
| Premium | 8/10 | Briefing card = bien |
| Branding | 8/10 | "Larry" est un choix distinctif |
| Mémorisation | 8/10 | La personnalité IA est mémorable |
| Confiance | 7/10 | Briefing statique = peu fiable |
| Conversion | 8/10 | Pré-rempli depuis autres écrans = parfait |

**Problèmes :**
- Le briefing du matin est **statique** (toujours "Artcurial a vendu..."). Casse la confiance.
- Larry ne sait pas qui tu es (onboarding data non utilisées).

**Améliorations :**
- Utiliser les données onboarding dans le contexte envoyé à l'API chat
- Briefing : remplacer la ligne statique par "Aucune actualité disponible" ou données réelles
- Chips contextuels basés sur la collection réelle de l'utilisateur

**Score cible : 9/10**

---

## 7. PROFIL

**Score actuel : 7.2/10**

| Dimension | Score | Commentaire |
|-----------|-------|-------------|
| Clarté | 8/10 | Structure claire |
| Désirabilité | 6/10 | Trop utilitaire |
| Premium | 7/10 | Sections bien séparées |
| Branding | 5/10 | Trop proche d'un settings screen |
| Mémorisation | 6/10 | "Pièce maîtresse" = bien |
| Confiance | 8/10 | Data réelles |
| Conversion | 5/10 | Pas de conversion vers upgrade |

**Problèmes :**
- La section "Mon abonnement" avec "Voir les offres →" est le seul chemin vers le paywall. Trop discret.
- "Ma direction" avec GOALS statiques est déconnecté de la réalité.
- Le Profil devrait raconter l'histoire du collectionneur, pas juste ses settings.

**Améliorations :**
- Ajouter en haut : "Collectionneur depuis [date 1ère œuvre]" — ancre temporelle
- Section upgrade plus visible si plan free/trial
- Utiliser les GOALS de l'onboarding (pas une liste statique)

**Score cible : 8.5/10**

---

## 8. ARTWORK DETAIL

**Score actuel : 8.1/10**

| Dimension | Score | Commentaire |
|-----------|-------|-------------|
| Clarté | 9/10 | Tabs bien organisés |
| Désirabilité | 7/10 | Emoji placeholder = casse tout |
| Premium | 8/10 | BoldText, narrative = bien |
| Branding | 7/10 | La narration est distinctive |
| Mémorisation | 8/10 | "Vendre ↗" → Larry = parcours fluide |
| Confiance | 8/10 | Estimation visible |
| Conversion | 7/10 | Tab Comparables = stub |

**Problèmes :**
- Zone hero : emoji 🎨 à la place de l'image = insupportable en prod
- Tab "Comparables" : stub → frustration

**Solutions :**
- Hero : rectangle gris avec initiale artiste + médium (pour V1 sans image upload)
- Comparables : utiliser price-history data pour montrer 3-5 ventes récentes similaires

**Score cible : 9/10**

---

## 9. COLLECTION HEALTH

**Score actuel : 7.7/10**

| Dimension | Score | Commentaire |
|-----------|-------|-------------|
| Clarté | 8/10 | 5 dimensions bien expliquées |
| Désirabilité | 7/10 | Instructif mais froid |
| Premium | 8/10 | Layout épuré |
| Branding | 6/10 | Aucun élément distinctif |
| Mémorisation | 7/10 | Score global mémorable |
| Confiance | 8/10 | Logique des thresholds claire |
| Conversion | 5/10 | Action CTAs inopérants |

**Problème principal :** Action CTAs ne naviguent pas.

**Score cible : 8.5/10**

---

## 10. ADD ARTWORK FLOW (Search → Manual → Price → Success)

**Score actuel : 8.3/10 (moyenne)**

| Écran | Score | Problème principal |
|-------|-------|-------------------|
| Mode Select | 8/10 | Photo mode déceptif (fixé) |
| Search | 8/10 | Bon |
| Manual Form | 8.5/10 | Estimation = différenciant fort |
| Price | 8/10 | Market card = bien |
| Success | 8.5/10 | Wow moment présent |

**Amélioration principale :**
- Success screen : ajouter la valeur estimée en grand : "Votre collection vaut maintenant X €"
- Rendre le moment de l'ajout plus solennel

**Score cible : 9/10**

---

## 11. PAYWALL

**Score actuel : 7/10 (nouveau, première version)**

| Dimension | Score | Commentaire |
|-----------|-------|-------------|
| Clarté | 8/10 | 3 plans clairs |
| Désirabilité | 7/10 | Features list générique |
| Premium | 7/10 | Correct |
| Branding | 6/10 | Pourrait être n'importe quel paywall |
| Mémorisation | 5/10 | Rien d'émotionnel |
| Confiance | 8/10 | Stripe + annulable |
| Conversion | 6/10 | Pas de trial offert |

**Améliorations :**
- Ajouter social proof : "Rejoignez 4 200 collectionneurs qui connaissent la valeur de leur collection"
- Mettre en avant l'estimation comme feature killer : "Recevez une estimation marché en moins de 30 secondes"
- Offrir un essai 14 jours (si Stripe le permet)

**Score cible : 8.5/10**

---

## RÉCAPITULATIF ET PRIORITÉS

| Écran | Score Actuel | Score Cible | Priorité Redesign |
|-------|-------------|-------------|------------------|
| Login | 7.5 | 9.0 | P1 |
| Onboarding | 9.2 | 9.5 | P2 |
| **Home** | **6.5** | **9.0** | **P0 — CRITIQUE** |
| Collection | 7.2 | 8.5 | P1 |
| Alertes | 6.9 | 8.0 | P1 |
| Larry | 8.2 | 9.0 | P2 |
| Profil | 7.2 | 8.5 | P2 |
| Artwork Detail | 8.1 | 9.0 | P1 |
| Collection Health | 7.7 | 8.5 | P2 |
| Add Artwork Flow | 8.3 | 9.0 | P2 |
| Paywall | 7.0 | 8.5 | P1 |

**Le Home est l'écran le plus critique.**

C'est le premier écran après l'onboarding. C'est l'écran de rétention quotidienne. Il doit être redesigné en priorité absolue.

**Objectif global : moyenne 8.9/10**
