/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        gold: { DEFAULT: "#d4a843", bright: "#f0c060", dim: "#a07830", subtle: "#1a1408" },
        bg: { primary: "#0a0a0b", secondary: "#111113", tertiary: "#18181b", border: "#27272a" },
        deal: { fire: "#ef4444", hot: "#f97316", good: "#22c55e", watch: "#eab308" },
      },
      fontFamily: {
        display: ["'Playfair Display'", "Georgia", "serif"],
        serif:   ["'Playfair Display'", "Georgia", "serif"],
        sans:    ["'Inter'", "system-ui", "sans-serif"],
        mono:    ["'JetBrains Mono'", "monospace"],
      },
      fontSize: {
        "2xs": ["10px", { lineHeight: "14px" }],
        "3xs": ["9px",  { lineHeight: "12px" }],
      },
      borderRadius: {
        sm: "2px",
      },
      animation: {
        ticker: "ticker 40s linear infinite",
      },
      keyframes: {
        ticker: { "0%": { transform: "translateX(0)" }, "100%": { transform: "translateX(-50%)" } },
      },
    },
  },
  plugins: [],
};
