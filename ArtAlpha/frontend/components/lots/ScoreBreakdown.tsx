"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { ScoreBreakdown } from "@/lib/api";

interface ScoreBreakdownProps {
  breakdown: ScoreBreakdown;
  dealScore: number;
}

const COMPONENTS = [
  { key: "below_estimate_score", label: "Below Estimate", weight: "30%", description: "Price vs. low estimate" },
  { key: "below_market_score", label: "Below Market Avg", weight: "30%", description: "Price vs. historical average" },
  { key: "liquidity_score", label: "Artist Liquidity", weight: "20%", description: "Resale ease" },
  { key: "house_reputation_score", label: "House Reputation", weight: "10%", description: "Auction house trust score" },
  { key: "confidence_score", label: "Data Confidence", weight: "10%", description: "Reliability of scoring data" },
] as const;

function ScoreBar({ value, delay = 0 }: { value: number; delay?: number }) {
  const color =
    value >= 80 ? "#16a34a" : value >= 60 ? "#92670a" : value >= 40 ? "#f97316" : "#dc2626";

  return (
    <div className="relative h-1.5 bg-stone-100 rounded-full overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
        className="absolute h-full rounded-full"
        style={{ backgroundColor: color }}
      />
    </div>
  );
}

function BigScore({ score }: { score: number }) {
  const isHot = score >= 85;
  const isDeal = score >= 75;
  const color = isHot ? "#dc2626" : isDeal ? "#16a34a" : "#92670a";
  const label = isHot ? "HOT DEAL" : isDeal ? "DEAL" : score >= 60 ? "WATCH" : "PASS";

  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-36 h-36">
        <svg className="w-36 h-36 -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="6" />
          <motion.circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className="font-mono text-3xl font-bold tabular-nums"
            style={{ color }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {score.toFixed(0)}
          </motion.span>
          <span className="font-mono text-xs text-stone-400">/100</span>
        </div>
      </div>
      <div
        className="px-3 py-1 rounded-sm text-xs font-bold tracking-widest"
        style={{
          color,
          backgroundColor: `${color}12`,
          border: `1px solid ${color}30`,
        }}
      >
        {label}
      </div>
    </div>
  );
}

export function ScoreBreakdownPanel({ breakdown, dealScore }: ScoreBreakdownProps) {
  return (
    <div className="card-luxury p-6 space-y-6">
      <div className="label-caps">Deal Score Analysis</div>

      <div className="flex justify-center py-2">
        <BigScore score={dealScore} />
      </div>

      {/* Pct indicators */}
      <div className="grid grid-cols-2 gap-3">
        {breakdown.pct_below_low_estimate != null && (
          <div className="p-3 rounded-sm bg-stone-50 border border-stone-100">
            <div className="text-2xs text-stone-400 mb-1">vs. Low Estimate</div>
            <div
              className={cn(
                "font-mono text-lg font-semibold tabular-nums",
                breakdown.pct_below_low_estimate > 0 ? "text-emerald-600" : "text-red-600"
              )}
            >
              {breakdown.pct_below_low_estimate > 0 ? "-" : "+"}
              {Math.abs(breakdown.pct_below_low_estimate).toFixed(0)}%
            </div>
          </div>
        )}
        {breakdown.pct_below_market_avg != null && (
          <div className="p-3 rounded-sm bg-stone-50 border border-stone-100">
            <div className="text-2xs text-stone-400 mb-1">vs. Market Avg</div>
            <div
              className={cn(
                "font-mono text-lg font-semibold tabular-nums",
                breakdown.pct_below_market_avg > 0 ? "text-emerald-600" : "text-red-600"
              )}
            >
              {breakdown.pct_below_market_avg > 0 ? "-" : "+"}
              {Math.abs(breakdown.pct_below_market_avg).toFixed(0)}%
            </div>
          </div>
        )}
      </div>

      {/* Component bars */}
      <div className="space-y-4">
        {COMPONENTS.map(({ key, label, weight, description }, i) => {
          const value = breakdown[key] ?? 0;
          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-xs text-stone-700">{label}</span>
                  <span className="ml-2 text-2xs text-stone-400">{weight}</span>
                </div>
                <span className="font-mono text-xs text-stone-500 tabular-nums">
                  {value.toFixed(0)}
                </span>
              </div>
              <ScoreBar value={value} delay={0.1 + i * 0.1} />
              <div className="text-2xs text-stone-400 mt-1">{description}</div>
            </div>
          );
        })}
      </div>

      {/* Disclaimer */}
      <div className="pt-3 border-t border-stone-100">
        <p className="text-2xs text-stone-400 leading-relaxed">
          Score computed using weighted algorithm: estimate gap (30%), market avg gap (30%),
          artist liquidity (20%), house reputation (10%), data confidence (10%).
        </p>
      </div>
    </div>
  );
}
