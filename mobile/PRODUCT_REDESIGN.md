# PRODUCT_REDESIGN.md — Nautilus
_Transformation complète de l'application mobile_
_2026-06-11_

---

## PRINCIPE DIRECTEUR DU REDESIGN

**Une seule règle : la collection est le héros.**

Chaque décision de design répond à cette question :

"Est-ce que ça met la collection de l'utilisateur en valeur ?"

Si non → supprimer ou simplifier.

---

## TRANSFORMATION 1 — HOME SCREEN (P0)

### Problème actuel

L'accueil ressemble à un dashboard SaaS.
La valeur de collection est enterrée.
Aucune émotion. Aucune identité.

### Nouvelle architecture

```
[TOPBAR]
"Bonjour [Prénom]"           [🔔][＋]

─── HERO CARD (fond #111111, noir) ──────────
[label] MA COLLECTION
[valeur principale] 184 000 €         (Display, blanc)
[sous-valeur] +12.4 % · 12 mois      (Caption vert)
[méta] 23 œuvres · 8 artistes        (Caption gris)
[previews] ▪▪▪▪ +19
─────────────────────────────────────────────

[Collection Health — card blanche bordée]
Collection solide →   [4 indicateurs en ligne]

[Action recommandée]
● ACTION RECOMMANDÉE
Documenter "Sans titre" de Richter
→ (CTA discret)

[ALERTES]                              Tout voir →
■ [dot] Soulages : record de vente · 2h
■ [dot] Document manquant · hier

[LARRY]
NAUTILUS INTELLIGENCE
[chip] 📈 Valeur de ma collection
[chip] 💰 Vendre maintenant ?
```

### Changements code (index.tsx)

1. Hero card : backgroundColor `#111111`, valeur en blanc 28px weight 700
2. Valeur évolution : couleur verte si positive
3. Mini-previews : rectangles gris avec initiale artiste (pas emojis)
4. Alert rows : `<Pressable>` → déjà fait ✅
5. Supprimer les emojis EMOJIS[] → initiales artistes

---

## TRANSFORMATION 2 — COLLECTION SCREEN (P1)

### Problème actuel

Grille de cellules avec emojis.
Aucune valeur affichée sur les cellules.
Tabs stubs = frustration.

### Nouvelle architecture cellule

```
[rectangle gris, initiale artiste en grand]
Titre œuvre (Body, 13px)
Artiste (Caption, 11px, textTertiary)
est. 12 000 € (11px, vert si valorisé)
● (dot statut)
```

### Changements code

1. Supprimer emoji → initiale/médium placeholder
2. Afficher `estimated_current_value_eur` en vert sous chaque cellule
3. Masquer les tabs Timeline/Artistes/Documents (supprimer ou `display: none`) plutôt que "coming soon"
4. État vide narratif : "Votre collection vous attend."

---

## TRANSFORMATION 3 — ARTWORK DETAIL (P1)

### Problème actuel

Emoji 🎨 en hero → détruit l'effet premium.
Tab Comparables = stub.

### Nouveau hero

```
[rectangle 120x120 fond #F5F5F5, coins arrondis]
[initiale artiste au centre, 48px, gris foncé]
[médium en bas, 10px, textTertiary]
```

### Comparables (V1 minimal)

Utiliser les données `price-history` déjà disponibles pour afficher :
- 3–5 ventes récentes de l'artiste
- Titre (si disponible), date, prix

```
VENTES COMPARABLES
[date]  Vente Paris  [montant]
[date]  Vente NY     [montant]
```

---

## TRANSFORMATION 4 — LOGIN SCREEN (P1)

### Problème actuel

Formulaire blanc vide.
Aucune promesse de valeur.
Aucune émotion.

### Nouvelle structure

```
[SAFE AREA]

[logo grand] Nautilus
[tagline] "Connaissez la valeur de ce que vous possédez."

[social proof discret]
Rejoint par 4 200 collectionneurs

[spacer]

[form]
[email input]
[password input]
[mot de passe oublié ?] → déjà fait ✅

[Bouton Se connecter]

[Pas de compte ?] → get-nautilus.com
```

Le tagline transforme une page de connexion en déclaration de valeur.

---

## TRANSFORMATION 5 — SUCCESS SCREEN APRÈS AJOUT (P1)

### Problème actuel

"Votre œuvre a été ajoutée." — sans impact émotionnel.

### Nouveau moment

```
[FOND SOMBRE #111111]

[N cerclé vert]

"[Titre ou Artiste] rejoint votre collection."

[Si estimation disponible :]
Estimée entre
[montant min] — [montant max]

[Valeur totale mise à jour :]
VOTRE COLLECTION
184 000 €
(+[montant] depuis l'ajout de cette œuvre)

[CTA vert] Voir ma collection →
[CTA discret] Ajouter une autre œuvre
```

C'est le WOW moment. L'utilisateur doit ressentir que quelque chose a changé.

---

## TRANSFORMATION 6 — COLLECTION HEALTH ACTIONS (P2)

### Problème actuel

CTAs des actions ne naviguent nulle part.

### Fix

Chaque action doit router :
- "Documenter" → `/artwork/[id]` de l'œuvre concernée
- "Ajouter une œuvre" → `/add-artwork`
- "Diversifier" → Larry avec prompt pré-rempli
- "Explorer le marché" → `/(tabs)/alerts`

---

## TRANSFORMATION 7 — LARRY BRIEFING LIVE (P2)

### Problème actuel

Briefing statique "Artcurial a vendu..."

### Fix minimal

Remplacer la ligne statique par :
- Si l'utilisateur a des alertes récentes → afficher la plus récente
- Sinon → ne rien afficher (pas de fausse information)

```tsx
// Dans Larry, à la place du briefing statique :
const latestAlert = alerts[0];
const briefingLine = latestAlert
  ? latestAlert.title
  : "Aucune actualité notable aujourd'hui.";
```

---

## TRANSFORMATION 8 — DONNÉES ONBOARDING → CONTEXTE LARRY (P1)

### Problème actuel

Les données collectées en onboarding (artistes préférés, profil, objectifs) ne sont jamais utilisées.

### Fix

Dans Larry, inclure le contexte onboarding dans le prompt système envoyé à l'API :

```tsx
const onboardingData = await getOnboardingData();

const systemContext = [
  onboardingData.profileType && `Profil collectionneur: ${onboardingData.profileType}`,
  onboardingData.artists?.length && `Artistes suivis: ${onboardingData.artists.join(', ')}`,
  onboardingData.budget && `Budget acquisition: ${onboardingData.budget}`,
  items.length > 0 && `Collection: ${items.length} œuvres`,
].filter(Boolean).join('. ');
```

Ce changement transforme Larry d'un chatbot générique en assistant personnalisé.

---

## TOKENS À METTRE À JOUR

Ajouter dans `lib/tokens.ts` :

```typescript
export const Colors = {
  // ... existants ...

  // Nouveaux tokens
  night: '#111111',         // Hero card fond, dark moments
  canvas: '#FFFFFF',        // Alias bgPrimary pour sémantique
} as const;

// Nouveaux tokens animation
export const Motion = {
  fast: 200,
  standard: 300,
  slow: 450,
} as const;
```

---

## ÉTAT DES TRANSFORMATIONS

| Transformation | Complexité | Impact Brand | Statut |
|---------------|-----------|-------------|--------|
| Home hero dark card | Moyen | ★★★★★ | À faire |
| Collection : valeurs + initiales | Faible | ★★★★☆ | À faire |
| Artwork hero placeholder | Faible | ★★★☆☆ | À faire |
| Login tagline + social proof | Faible | ★★★★☆ | À faire |
| Success screen dark | Moyen | ★★★★★ | À faire |
| Collection Health CTAs | Faible | ★★★☆☆ | À faire |
| Larry briefing live | Moyen | ★★★☆☆ | À faire |
| Onboarding → Larry context | Moyen | ★★★★☆ | À faire |
