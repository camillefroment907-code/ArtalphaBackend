# BRAND_SYSTEM.md — Nautilus Design System
_Version 1.0 — 2026-06-11_

---

## I. COULEURS

### Palette principale

| Token | Hex | Usage |
|-------|-----|-------|
| `canvas` | `#FFFFFF` | Fond principal. Galerie blanche. |
| `ink` | `#1A1A1A` | Texte primaire, CTAs noirs, autorité |
| `ink.2` | `#6B6B6B` | Texte secondaire, métadonnées |
| `ink.3` | `#A3A3A3` | Texte tertiaire, placeholders |
| `nautilus` | `#1D9E75` | Vert signature. Rare. Précieux. |
| `nautilus.light` | `#E1F5EE` | Fond vert doux. Succès, confirmation. |
| `nautilus.dark` | `#0F6E56` | Vert profond. Texte sur fond vert clair. |
| `night` | `#111111` | Fond dark mode. Moments culminants. |

### Palette sémantique

| Token | Hex | Usage |
|-------|-----|-------|
| `surface` | `#F5F5F5` | Fond cartes secondaires |
| `surface.2` | `#EBEBEB` | Fond tertiaire, skeleton loaders |
| `border` | `#E5E5E5` | Séparateurs, bordures légères |
| `border.2` | `#D0D0D0` | Bordures inputs, cartes |
| `amber` | `#BA7517` | Attention, à compléter |
| `amber.light` | `#FAEEDA` | Fond alerte ambre |
| `marine` | `#378ADD` | Institutionnel, liens |
| `marine.light` | `#E6F1FB` | Fond info bleue |
| `error` | `#A32D2D` | Erreur critique |

### Règle d'utilisation

**Le vert `nautilus` est la couleur la plus importante et la plus rare.**

Règle absolue : maximum 3 occurrences par écran.

Il signifie : valeur, croissance, confirmation, intelligence Nautilus.

Il ne doit jamais être utilisé pour la décoration.

---

## II. TYPOGRAPHIE

### Hiérarchie

```
Display     26–30px  weight 700   letterSpacing -0.8   Montants, valeurs, titres landing
Headline    22px     weight 700   letterSpacing -0.6   Titres écrans, wow moments
Title       18–20px  weight 600   letterSpacing -0.3   Noms d'artistes, titres cartes
Subtitle    16px     weight 500   letterSpacing 0      Sous-titres, labels importants
Body        14px     weight 400   letterSpacing 0      Corps de texte principal
Body+       13px     weight 500   letterSpacing 0      Corps emphase légère
Caption     12px     weight 400   letterSpacing 0      Métadonnées, dates
Label       11px     weight 400   letterSpacing 0.3    Labels, timestamps
Micro       10px     weight 400   letterSpacing 0.5    Catégories ALL CAPS
```

### Règles typographiques

1. **Valeurs monétaires** → toujours Display ou Headline, jamais Body
2. **Noms d'artistes** → toujours Title ou Subtitle, fontWeight 500+
3. **Labels de catégorie** → Micro, ALL CAPS, letterSpacing 0.5+
4. **Phrases narratives** → Body, lineHeight 1.5
5. **Chiffres clés** → fontVariant: ['tabular-nums'] pour alignement

### Police

Système natif iOS (San Francisco) en priorité.

Pas de police custom en V1 — la typographie native iOS est reconnaissable et rassurante.

---

## III. ESPACEMENTS

```
4px   — micro     Gaps entre icône et label
8px   — small     Padding interne compact
12px  — medium    Padding standard interne
16px  — base      Padding horizontal écran
20px  — large     Gap entre sections
24px  — xl        Padding vertical sections majeures
32px  — 2xl       Séparation entre blocs majeurs
48px  — 3xl       Espacement top navigation
```

**Grille horizontale :** padding 15–16px gauche/droite, jamais moins.

---

## IV. RAYONS

```
6px   — sm    Boutons compact, badges
10px  — md    Inputs, boutons standard, petites cartes
12px  — lg    Cartes principales
16px  — xl    Cartes hero, modales
999px — full  Pills, chips, avatars
```

---

## V. ÉLÉVATION ET OMBRES

Nautilus n'utilise **pas d'ombres portées**.

Séparation par : bordures légères (0.5px), fonds légèrement différents, espace blanc.

Exceptions acceptées :
- Modales → ombre très douce (0 2px 20px rgba(0,0,0,0.06))
- Toasts → ombre légère pour flottement

L'absence d'ombre renforce le sentiment de clarté et de précision.

---

## VI. COMPOSANTS CLÉS

### Card Standard
```
borderWidth: 0.5
borderColor: #E5E5E5
borderRadius: 12
padding: 14
backgroundColor: #FFFFFF
```

### Card Surface (fond gris)
```
backgroundColor: #F5F5F5
borderRadius: 12
padding: 14
borderWidth: 0  (pas de bordure)
```

### Card Hero (fond sombre)
```
backgroundColor: #111111
borderRadius: 16
padding: 20
```

### Input
```
borderWidth: 0.5
borderColor: #D0D0D0
borderRadius: 10
padding: 12
fontSize: 14 (Body)
color: #1A1A1A
placeholderTextColor: #A3A3A3
```

### Bouton Primaire (noir)
```
backgroundColor: #1A1A1A
borderRadius: 10
paddingVertical: 14
paddingHorizontal: 20
Text: color #FFFFFF, fontSize 16, fontWeight 500
```

### Bouton Nautilus (vert)
```
backgroundColor: #1D9E75
borderRadius: 10
paddingVertical: 14
Text: color #FFFFFF, fontSize 16, fontWeight 700, letterSpacing 0.2
```
_Utilisé uniquement pour les actions de haute importance : première activation, wow moment, upgrade_

### Bouton Secondaire (outline)
```
borderWidth: 1
borderColor: #1A1A1A
borderRadius: 10
paddingVertical: 13
Text: color #1A1A1A, fontSize 14, fontWeight 500
```

### Chip / Tag
```
paddingVertical: 6, paddingHorizontal: 12
borderRadius: 999
borderWidth: 0.5
borderColor: #D0D0D0
Text: fontSize 12, color #6B6B6B
```

### Chip Actif
```
backgroundColor: #1A1A1A
borderColor: #1A1A1A
Text: color #FFFFFF, fontWeight 500
```

### Chip Nautilus (vert)
```
backgroundColor: #E1F5EE
borderWidth: 0
Text: color #0F6E56, fontWeight 500, fontSize 11
```

### Dot de statut
```
width: 7, height: 7
borderRadius: 3.5
backgroundColor: [nautilus / amber / marine / ink.3]
```
Vert = valorisé, actif
Ambre = à compléter
Marine = information

### Topbar Standard
```
paddingHorizontal: 16
paddingTop: 52  (safe area iOS)
paddingBottom: 12
borderBottomWidth: 0.5
borderBottomColor: #E5E5E5
```

### Barre de progression
```
height: 3  (pas 2)
backgroundColor: #F5F5F5
activeColor: #1D9E75
borderRadius: 999
```

---

## VII. ICONOGRAPHIE

### Principe

Icônes SF Symbols style (lignes fines).

Stroke width 1.5px maximum.

Taille standard : 18–22px.

Jamais d'icônes colorées dans les tabs (état actif = couleur ink, inactif = ink.3).

### Navigation tabs

Icônes à définir en V1 (utilisation de SF Symbols via expo/vector-icons) :
- Home → `house` ou `chart.bar`
- Collection → `square.grid.2x2`
- Alertes → `bell`
- Larry → `brain` ou `sparkles`
- Profil → `person.circle`

### Règle : pas d'emojis dans les écrans principaux

Exception : états vides illustrés, onboarding, messages narratifs.

---

## VIII. MOTION & ANIMATIONS

### Principes

**Rapide. Fonctionnel. Jamais décoratif.**

Les animations existent pour :
1. Guider l'attention
2. Donner du feedback
3. Créer de la continuité

Jamais pour impressionner.

### Durées standards

```
Micro     100ms  Feedback tactile (press state)
Fast      200ms  Apparition d'éléments, toggles
Standard  300ms  Transitions de cartes, expand
Slow      450ms  Transitions d'écrans, modales
```

### Courbes d'easing

- `easeOut` → apparitions, entrées
- `easeIn` → sorties, fermetures
- `spring` (tension 180, friction 20) → drag, confirmations

### Transitions écrans

`slide_from_right` pour navigation forward.

`slide_from_bottom` pour modales.

Pas de `fade` sur les transitions principales — trop imprécis.

---

## IX. ÉTATS VIDES

Les états vides sont des opportunités de marque.

Ils ne doivent jamais être neutres.

### Formule : Icône + Message principal + Message secondaire + CTA

**Collection vide :**
```
Icône : une cadre vide (SF Symbols "photo.artframe")
Titre : "Votre collection vous attend."
Sub   : "Ajoutez votre première œuvre pour commencer."
CTA   : "Ajouter une œuvre" (bouton noir)
```

**Alertes vides :**
```
Icône : cloche (bell)
Titre : "Aucune alerte pour l'instant."
Sub   : "Nautilus surveille le marché pour vous."
[Pas de CTA — l'inaction est acceptable ici]
```

**Résultats de recherche vides :**
```
Titre : "Aucun résultat pour « {query} »"
Sub   : "Essayez avec le nom complet, ou ajoutez manuellement."
CTA   : "Ajouter manuellement →"
```

---

## X. GRILLE ÉCRAN (iPhone)

```
Largeur standard       375px (iPhone 15)
Padding horizontal     15–16px
Contenu utile          343–345px
Padding top safe area  52px (topbar)
Padding bottom tab bar 84px (tabs)
```

Cartes pleine largeur : margin 15px gauche/droite.
Cartes côte à côte : gap 8px, chacune (343–8)/2 ≈ 167px.

---

## XI. NAVIGATION

### Structure recommandée

```
(tabs)
├── / (Home)         — icône maison ou chart
├── /collection      — icône grille
├── /alerts          — icône cloche  
├── /larry           — icône intelligence
└── /profile         — icône personne
```

### Règle tab bar

Label visible sous chaque icône.

Couleur active : `#1A1A1A`.
Couleur inactive : `#A3A3A3`.

Pas de badge rouge agressif — compteur discret si nécessaire.

---

## XII. INSTAGRAM TEST — CHECKLIST

Avant de finir un écran :

- [ ] Le fond blanc domine-t-il ?
- [ ] La hiérarchie typographique est-elle lisible en 2 secondes ?
- [ ] Le vert Nautilus apparaît-il au bon endroit (≤3 fois) ?
- [ ] Y a-t-il un élément mémorable (valeur, alerte, insight) ?
- [ ] En screenshot, reconnaît-on que c'est une app d'art ?
- [ ] En screenshot, reconnaît-on que c'est premium ?
- [ ] Peut-on deviner le nom de l'app sans le voir ?
