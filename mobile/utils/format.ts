// utils/format.ts — Formatters Nautilus (source unique de vérité)

export const formatPrice = (n: number | null | undefined): string => {
  if (n === null || n === undefined) return '—';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n);
};

export const formatPriceShort = (n: number | null | undefined): string => {
  if (n === null || n === undefined) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')} M€`;
  if (n >= 1_000) return `${Math.round(n / 1_000)} k€`;
  return `${Math.round(n)} €`;
};

export const formatPct = (n: number | null | undefined, showSign = true): string => {
  if (n === null || n === undefined) return '—';
  const sign = showSign && n > 0 ? '+' : '';
  return `${sign}${Math.round(n)} %`;
};
