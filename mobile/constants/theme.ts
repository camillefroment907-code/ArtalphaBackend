// constants/theme.ts — Nautilus Design System V2
// Dark #111111 · Bleu Sèvres #1B4FCC · Cream #F7F4EE

// ─── Palette ─────────────────────────────────────────────────────────────────

export const palette = {
  // Brand
  navy:       '#111111',    // dark bg for auth / onboarding screens
  navyLight:  '#1C1C1C',
  navyDeep:   '#000000',
  gold:       '#1B4FCC',    // Bleu Sèvres — primary accent
  goldLight:  '#3D6AE8',    // lighter Sèvres blue
  goldMuted:  '#1240A8',    // deeper Sèvres blue
  cream:      '#F7F4EE',    // warm beige background
  creamDark:  '#EDE9E1',

  // Neutrals
  white:      '#FFFFFF',
  black:      '#000000',
  ink:        '#1A1A1A',

  gray50:     '#F9F9F9',
  gray100:    '#F0F0F0',
  gray200:    '#E0E0E0',
  gray300:    '#C8C8C8',
  gray400:    '#A3A3A3',
  gray500:    '#6B6B6B',
  gray600:    '#4A4A4A',
  gray700:    '#2E2E2E',

  // Semantic
  green:      '#1D9E75',
  greenLight: '#E1F5EE',
  red:        '#A32D2D',
  redLight:   '#FAE8E8',
  amber:      '#BA7517',
  amberLight: '#FAEEDA',
  blue:       '#1B4FCC',
  blueLight:  '#E6ECF7',
} as const;

// ─── Colors (semantic) ───────────────────────────────────────────────────────

export const Colors = {
  // Backgrounds
  bg:           palette.cream,
  bgSurface:    palette.white,
  bgElevated:   palette.creamDark,
  bgDark:       palette.navy,
  bgDarkSurface: palette.navyLight,

  // Text (light mode)
  textPrimary:   palette.ink,
  textSecondary: palette.gray500,
  textTertiary:  palette.gray400,
  textInverse:   palette.white,
  textGold:      palette.gold,

  // Text (dark / navy backgrounds)
  textOnDark:        palette.white,
  textOnDarkMuted:   'rgba(255,255,255,0.65)',
  textOnDarkSubtle:  'rgba(255,255,255,0.40)',

  // Brand
  gold:      palette.gold,
  goldLight: palette.goldLight,
  navy:      palette.navy,

  // Accents
  green:      palette.green,
  greenLight: palette.greenLight,
  error:      palette.red,
  warning:    palette.amber,
  info:       palette.blue,

  // Borders
  border:        palette.gray200,
  borderMuted:   palette.gray100,
  borderStrong:  palette.gray300,
  borderOnDark:  'rgba(255,255,255,0.12)',

  // Overlays
  overlay:      'rgba(17,17,17,0.55)',
  overlayLight: 'rgba(17,17,17,0.30)',
} as const;

// ─── Typography ──────────────────────────────────────────────────────────────

export const FontFamily = {
  // Playfair Display — headings, price_large, editorial
  serif:       'PlayfairDisplay_400Regular',
  serifMedium: 'PlayfairDisplay_500Medium',
  serifBold:   'PlayfairDisplay_700Bold',

  // Inter — body, captions, UI labels
  sans:          'Inter_400Regular',
  sansMedium:    'Inter_500Medium',
  sansSemibold:  'Inter_600SemiBold',
  sansBold:      'Inter_700Bold',
} as const;

export const FontSize = {
  xs:   10,
  sm:   12,
  base: 14,
  md:   15,
  lg:   16,
  xl:   18,
  '2xl': 20,
  '3xl': 24,
  '4xl': 28,
  '5xl': 34,
  '6xl': 42,
  '7xl': 52,
} as const;

export const LineHeight = {
  tight:   1.15,
  normal:  1.4,
  relaxed: 1.6,
} as const;

// ─── Spacing ─────────────────────────────────────────────────────────────────

export const Spacing = {
  xs:   4,
  sm:   8,
  md:   16,
  lg:   24,
  xl:   32,
  xxl:  48,
  '3xl': 64,
} as const;

// ─── Border radius ───────────────────────────────────────────────────────────

export const Radius = {
  xs:   4,
  sm:   6,
  md:   10,
  lg:   12,
  xl:   16,
  xxl:  24,
  full: 999,
} as const;

// ─── Shadows ─────────────────────────────────────────────────────────────────

export const Shadow = {
  sm: {
    shadowColor: palette.navy,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: palette.navy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: palette.navy,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 8,
  },
  gold: {
    shadowColor: palette.gold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
} as const;

// ─── Component tokens ────────────────────────────────────────────────────────

export const Button = {
  // Primary: dark bg, cream text
  primary: {
    bg:     palette.navy,
    text:   palette.cream,
    border: 'transparent',
    radius: Radius.md,
    py:     14,
    px:     24,
  },
  // Secondary: cream bg, dark text, dark border
  secondary: {
    bg:     palette.cream,
    text:   palette.navy,
    border: palette.navy,
    radius: Radius.md,
    py:     13,
    px:     24,
  },
  // Gold (Bleu Sèvres): CTA, blue bg, white text
  gold: {
    bg:     palette.gold,
    text:   palette.white,
    border: 'transparent',
    radius: Radius.md,
    py:     14,
    px:     24,
  },
  // Ghost: transparent bg, cream text (for dark backgrounds)
  ghost: {
    bg:     'transparent',
    text:   palette.cream,
    border: 'rgba(255,255,255,0.30)',
    radius: Radius.md,
    py:     13,
    px:     24,
  },
} as const;

export const Card = {
  // Standard card
  default: {
    bg:     palette.white,
    border: palette.gray200,
    radius: Radius.lg,
    ...Shadow.sm,
  },
  // Dark card (hero, wow moments)
  dark: {
    bg:     palette.navy,
    border: 'transparent',
    radius: Radius.lg,
    ...Shadow.md,
  },
  // Gold accent card
  featured: {
    bg:     palette.cream,
    border: palette.gold,
    radius: Radius.lg,
    ...Shadow.gold,
  },
} as const;

// ─── Animation durations ─────────────────────────────────────────────────────

export const Duration = {
  fast:   150,
  normal: 250,
  slow:   400,
  slower: 600,
} as const;

// ─── Z-index ─────────────────────────────────────────────────────────────────

export const ZIndex = {
  base:    0,
  raised:  10,
  overlay: 100,
  modal:   1000,
  toast:   2000,
} as const;
