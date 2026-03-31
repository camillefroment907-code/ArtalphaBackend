"use client";

import { useLanguageStore } from "@/lib/useLanguage";
import { formatPriceInCurrency } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface ProjectionData {
  year: number;
  conservative_eur: number;
  base_eur: number;
  optimistic_eur: number;
  base_roi_pct: number;
  cagr_pct?: number;
  tier?: string;
}

interface ProjectionChartProps {
  projections: Record<number, ProjectionData>;
  purchasePrice: number;
  artistTier: string;
  recommendedHoldYears: number;
}

const TIER_LABELS: Record<string, string> = {
  blue_chip: "Blue Chip 🔵",
  established: "Établi 🟡",
  emerging: "Émergent 🟢",
  unknown: "Non coté ⚪",
};

export function ProjectionChart({ projections, purchasePrice, artistTier, recommendedHoldYears }: ProjectionChartProps) {
  const { currency, locale } = useLanguageStore();
  const fmt = (v: number) => formatPriceInCurrency(v, currency, locale);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs">
        <span className="text-stone-500">
          Artiste: <span className="font-medium text-stone-700">{TIER_LABELS[artistTier] || "—"}</span>
        </span>
        <span className="text-amber-700 font-medium">
          Vente optimale dans {recommendedHoldYears} ans
        </span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-stone-100">
            {["Horizon", "Pessimiste", "Base", "Optimiste", "ROI"].map(h => (
              <th key={h} className="text-left py-2 text-xs text-stone-400 font-medium last:text-right">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-50">
          {[5, 10, 20, 30, 50].map(year => {
            const p = projections[year];
            if (!p) return null;
            const isRecommended = Math.abs(year - recommendedHoldYears) < 3;
            return (
              <tr key={year} className={cn(isRecommended && "bg-amber-50")}>
                <td className="py-3 font-medium text-stone-900 text-xs">
                  {year} ans{" "}
                  {isRecommended && <span className="text-amber-700 text-xs">★</span>}
                </td>
                <td className="py-3 text-stone-400 text-xs font-mono">{fmt(p.conservative_eur)}</td>
                <td className="py-3 text-emerald-700 font-semibold font-mono">{fmt(p.base_eur)}</td>
                <td className="py-3 text-stone-500 text-xs font-mono">{fmt(p.optimistic_eur)}</td>
                <td className="py-3 text-right">
                  <span className={cn(
                    "text-xs font-mono font-bold",
                    p.base_roi_pct > 0 ? "text-emerald-600" : "text-red-500"
                  )}>
                    {p.base_roi_pct > 0 ? "+" : ""}{p.base_roi_pct.toFixed(0)}%
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-xs text-stone-400 leading-relaxed">
        Projections basées sur données historiques Artprice. Performances passées ne garantissent pas les performances futures.
      </p>
    </div>
  );
}
