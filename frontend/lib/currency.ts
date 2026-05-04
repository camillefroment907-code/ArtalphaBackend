import { LANGUAGES, convertPrice } from "./i18n";

/**
 * Format an EUR amount in the user's selected currency.
 * - compact: €1.2M, €34K, €999 (no thousands separators)
 * - default: Intl.NumberFormat full format
 */
export function formatCurrency(
  amountEur: number | null | undefined,
  lang: string,
  options?: { compact?: boolean }
): string {
  if (amountEur == null || isNaN(amountEur)) return "—";
  const langDef = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];
  const converted = convertPrice(amountEur, langDef.currency);
  const sym = langDef.symbol;

  if (options?.compact) {
    const abs = Math.abs(converted);
    const sign = converted < 0 ? "-" : "";
    if (abs >= 1_000_000)
      return `${sign}${sym}${(abs / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
    if (abs >= 1_000)
      return `${sign}${sym}${Math.round(abs / 1_000)}K`;
    return `${sign}${sym}${Math.round(abs)}`;
  }

  try {
    return new Intl.NumberFormat(langDef.locale, {
      style: "currency",
      currency: langDef.currency,
      maximumFractionDigits: 0,
    }).format(converted);
  } catch {
    return `${sym}${Math.round(converted)}`;
  }
}
