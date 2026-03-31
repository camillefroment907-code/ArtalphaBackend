"use client";

import { useLanguageStore } from "@/lib/useLanguage";
import { formatPriceInCurrency } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface PriceDisplayProps {
  priceEur?: number | null;
  originalCurrency?: string;
  className?: string;
  size?: "xs" | "sm" | "base" | "lg" | "xl" | "2xl";
}

export function PriceDisplay({
  priceEur,
  originalCurrency = "EUR",
  className,
  size = "base",
}: PriceDisplayProps) {
  const { currency, locale } = useLanguageStore();

  if (priceEur == null) {
    return <span className={cn("text-stone-400", className)}>—</span>;
  }

  // If original currency differs from EUR, convert to EUR first (simplified: assume stored in EUR)
  const formatted = formatPriceInCurrency(priceEur, currency, locale);

  return (
    <span
      className={cn(
        "font-mono tabular-nums",
        size === "xs" && "text-xs",
        size === "sm" && "text-sm",
        size === "base" && "text-base",
        size === "lg" && "text-lg",
        size === "xl" && "text-xl",
        size === "2xl" && "text-2xl",
        className,
      )}
    >
      {formatted}
    </span>
  );
}
