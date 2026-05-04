export const LANGUAGES = [
  { code: "fr", label: "Français", flag: "🇫🇷", currency: "EUR", symbol: "€", locale: "fr-FR", rtl: false },
  { code: "en", label: "English",  flag: "🇺🇸", currency: "USD", symbol: "$", locale: "en-US", rtl: false },
  { code: "es", label: "Español",  flag: "🇪🇸", currency: "EUR", symbol: "€", locale: "es-ES", rtl: false },
  { code: "zh", label: "中文",      flag: "🇨🇳", currency: "CNY", symbol: "¥", locale: "zh-CN", rtl: false },
  { code: "ar", label: "العربية",  flag: "🇸🇦", currency: "AED", symbol: "د.إ", locale: "ar-SA", rtl: true },
] as const;

export type LangCode = typeof LANGUAGES[number]["code"];

// Exchange rates relative to EUR (update via API in production)
export const EXCHANGE_RATES: Record<string, number> = {
  EUR: 1.0,
  GBP: 0.86,
  CNY: 7.85,
  AED: 3.97,
  USD: 1.10,
};

export function convertPrice(priceEur: number, targetCurrency: string): number {
  const rate = EXCHANGE_RATES[targetCurrency] ?? 1;
  return priceEur * rate;
}

export function formatPriceInCurrency(
  priceEur: number | undefined | null,
  currency: string,
  locale: string,
): string {
  if (priceEur == null) return "—";
  const converted = convertPrice(priceEur, currency);
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(converted);
  } catch {
    return `${converted.toFixed(0)} ${currency}`;
  }
}
