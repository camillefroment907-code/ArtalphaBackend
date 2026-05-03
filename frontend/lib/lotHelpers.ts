import type { Lot } from "@/lib/api";

export function computeFairValue(lot: Lot): number | null {
  if (lot.estimate_low == null || lot.pct_below_low_estimate == null) return null;
  return Math.round(lot.estimate_low * (1 + lot.pct_below_low_estimate / 100));
}

export function formatTimeLeft(hours?: number | null): string {
  if (hours == null || hours < 0) return "—";
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) {
    const h = Math.floor(hours);
    const m = Math.round((hours % 1) * 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  const days = Math.floor(hours / 24);
  const rem = Math.round(hours % 24);
  return rem > 0 ? `${days}d ${rem}h` : `${days}d`;
}

export function getConfidenceLabel(score: number): string {
  if (score >= 80) return "High Confidence";
  if (score >= 60) return "Medium Confidence";
  if (score >= 40) return "Low Confidence";
  return "Very Low";
}

export function getRecommendationLabel(score: number): string {
  if (score >= 90) return "FIRE";
  if (score >= 80) return "STRONG BUY";
  if (score >= 70) return "BUY";
  if (score >= 50) return "WATCH";
  return "HOLD";
}
