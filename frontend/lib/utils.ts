import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price?: number, currency = "EUR"): string {
  if (price == null) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(price);
}

export function formatScore(score?: number): string {
  if (score == null) return "—";
  return `${score.toFixed(0)}/100`;
}

export function formatPct(pct?: number): string {
  if (pct == null) return "—";
  const sign = pct > 0 ? "-" : "+";
  return `${sign}${Math.abs(pct).toFixed(0)}%`;
}

export function formatDate(date?: string): string {
  if (!date) return "—";
  return format(new Date(date), "d MMM yyyy", { locale: fr });
}

export function formatDateRelative(date?: string): string {
  if (!date) return "—";
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: fr });
}

export function getScoreColor(score?: number): string {
  if (!score) return "text-stone-300";
  if (score >= 85) return "text-red-600";
  if (score >= 75) return "text-emerald-600";
  if (score >= 60) return "text-amber-700";
  return "text-stone-400";
}

export function getScoreLabel(score?: number): string {
  if (!score) return "Unscored";
  if (score >= 85) return "HOT";
  if (score >= 75) return "DEAL";
  if (score >= 60) return "WATCH";
  return "PASS";
}

export function getScoreBadgeClass(score?: number): string {
  if (!score) return "score-badge-neutral";
  if (score >= 85) return "score-badge-hot";
  if (score >= 75) return "score-badge-deal";
  return "score-badge-neutral";
}

export function getSourceLabel(source: string): string {
  const map: Record<string, string> = {
    drouot: "Drouot",
    interencheres: "Interenchères",
    invaluable: "Invaluable",
    christies: "Christie's",
    sothebys: "Sotheby's",
    bonhams: "Bonhams",
    other: "Other",
  };
  return map[source] || source;
}

export function getTrendIcon(trend?: string): string {
  if (trend === "up") return "↑";
  if (trend === "down") return "↓";
  return "→";
}

export function getTrendColor(trend?: string): string {
  if (trend === "up") return "text-emerald-600";
  if (trend === "down") return "text-red-600";
  return "text-stone-400";
}
