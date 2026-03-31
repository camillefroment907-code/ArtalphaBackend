import { create } from "zustand";
import { persist } from "zustand/middleware";
import { LANGUAGES, type LangCode } from "./i18n";

interface LanguageStore {
  lang: LangCode;
  currency: string;
  locale: string;
  symbol: string;
  rtl: boolean;
  setLanguage: (code: string) => void;
}

export function formatPriceInCurrency(price: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(price);
}

export const useLanguageStore = create<LanguageStore>()(
  persist(
    (set) => ({
      lang: "fr",
      currency: "EUR",
      locale: "fr-FR",
      symbol: "€",
      rtl: false,
      setLanguage: (code: string) => {
        const lang = LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
        set({
          lang: lang.code,
          currency: lang.currency,
          locale: lang.locale,
          symbol: lang.symbol,
          rtl: lang.rtl,
        });
        if (typeof document !== "undefined") {
          document.documentElement.dir = lang.rtl ? "rtl" : "ltr";
          document.documentElement.lang = lang.code;
        }
      },
    }),
    { name: "hono-language" },
  ),
);
