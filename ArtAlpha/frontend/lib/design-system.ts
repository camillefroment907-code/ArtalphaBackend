export const DS = {
  colors: {
    bg: {
      primary: "#0a0a0b",
      secondary: "#111113",
      tertiary: "#18181b",
      hover: "#1c1c1f",
      border: "#27272a",
    },
    text: {
      primary: "#fafafa",
      secondary: "#a1a1aa",
      muted: "#52525b",
      inverse: "#09090b",
    },
    gold: {
      DEFAULT: "#d4a843",
      bright: "#f0c060",
      dim: "#a07830",
      subtle: "#1a1408",
    },
    deal: {
      fire: "#ef4444",
      hot: "#f97316",
      good: "#22c55e",
      watch: "#eab308",
    },
    up: "#22c55e",
    down: "#ef4444",
    neutral: "#a1a1aa",
  },
  fonts: {
    display: "'Playfair Display', Georgia, serif",
    sans: "'Inter', system-ui, sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', monospace",
    data: "'DM Mono', monospace",
  },
  space: {
    xs: "4px",
    sm: "8px",
    md: "16px",
    lg: "24px",
    xl: "32px",
    "2xl": "48px",
    "3xl": "64px",
  },
} as const;
