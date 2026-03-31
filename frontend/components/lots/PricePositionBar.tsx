"use client";

import { motion } from "framer-motion";
import { formatPrice } from "@/lib/utils";

interface PricePositionBarProps {
  current?: number;
  estimateLow?: number;
  estimateHigh?: number;
  marketAvg?: number;
  currency?: string;
}

export function PricePositionBar({
  current,
  estimateLow,
  estimateHigh,
  marketAvg,
  currency = "EUR",
}: PricePositionBarProps) {
  if (!current || (!estimateLow && !estimateHigh && !marketAvg)) return null;

  const values = [current, estimateLow, estimateHigh, marketAvg].filter(
    (v): v is number => v != null && v > 0
  );
  if (values.length < 2) return null;

  const min = Math.min(...values) * 0.85;
  const max = Math.max(...values) * 1.15;
  const range = max - min;

  const pct = (v: number) => Math.max(0, Math.min(100, ((v - min) / range) * 100));

  const markers = [
    estimateLow && { val: estimateLow, label: "Est. basse", color: "#d97706" },
    estimateHigh && { val: estimateHigh, label: "Est. haute", color: "#92400e" },
    marketAvg && { val: marketAvg, label: "Moy. marché", color: "#3b82f6" },
  ].filter(Boolean) as { val: number; label: string; color: string }[];

  return (
    <div className="space-y-2">
      <div className="text-2xs text-stone-400 tracking-wider uppercase font-semibold">
        Position Prix
      </div>
      <div className="relative h-2 bg-stone-100 rounded-full">
        {/* Current price bar fill */}
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct(current)}%` }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="absolute left-0 top-0 h-full rounded-full"
          style={{
            background: pct(current) < 50 ? "#22c55e" : "#f59e0b",
          }}
        />
        {/* Marker lines */}
        {markers.map(({ val, label, color }) => (
          <div
            key={label}
            className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4"
            style={{ left: `${pct(val)}%`, backgroundColor: color }}
            title={`${label}: ${formatPrice(val, currency)}`}
          />
        ))}
      </div>
      {/* Legend */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-2xs text-stone-500">
            Actuel {formatPrice(current, currency)}
          </span>
        </div>
        {markers.map(({ label, color, val }) => (
          <div key={label} className="flex items-center gap-1">
            <div className="w-0.5 h-3" style={{ backgroundColor: color }} />
            <span className="text-2xs text-stone-400">
              {label} {formatPrice(val, currency)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
