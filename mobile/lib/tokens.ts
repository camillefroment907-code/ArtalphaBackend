// lib/tokens.ts
// Design tokens Nautilus Collection OS

export const Colors = {
  // Backgrounds
  bgPrimary: '#FFFFFF',
  bgSecondary: '#F5F5F5',
  bgTertiary: '#EBEBEB',

  // Text
  textPrimary: '#1A1A1A',
  textSecondary: '#6B6B6B',
  textTertiary: '#A3A3A3',

  // Brand
  green: '#1D9E75',
  greenLight: '#E1F5EE',
  greenDark: '#0F6E56',

  // States
  warning: '#BA7517',
  warningLight: '#FAEEDA',
  error: '#A32D2D',
  blue: '#378ADD',
  blueLight: '#E6F1FB',

  // Dark moments
  night: '#111111',

  // Borders
  borderPrimary: '#1A1A1A',
  borderSecondary: '#D0D0D0',
  borderTertiary: '#E5E5E5',
} as const;

export const Fonts = {
  xs: 10,
  sm: 11,
  base: 12,
  md: 13,
  lg: 14,
  xl: 16,
  '2xl': 18,
  '3xl': 22,
  '4xl': 26,
  '5xl': 30,

  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
} as const;

export const Radius = {
  sm: 6,
  md: 10,
  lg: 12,
  full: 999,
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
} as const;
