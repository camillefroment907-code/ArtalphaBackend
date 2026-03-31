"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Calendar, Building2, ExternalLink, TrendingDown, Lock, CheckCircle } from "lucide-react";
import { cn, formatPrice, formatDate, getSourceLabel } from "@/lib/utils";
import type { Lot } from "@/lib/api";
import { FomoIndicator } from "@/components/lots/FomoIndicator";
import { WishlistButton } from "@/components/lots/WishlistButton";

interface LotCardProps {
  lot: Lot;
  index?: number;
  variant?: "default" | "compact" | "featured";
  locked?: boolean;
}

function ScoreRing({ score }: { score: number }) {
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const color =
    score >= 85 ? "#dc2626" : score >= 75 ? "#16a34a" : score >= 60 ? "#92670a" : "#d1d5db";
  const trackColor =
    score >= 85
      ? "rgba(220,38,38,0.12)"
      : score >= 75
      ? "rgba(22,163,74,0.12)"
      : "rgba(0,0,0,0.06)";

  return (
    <div className="relative w-14 h-14 flex-shrink-0">
      <svg className="w-14 h-14 -rotate-90" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r={radius} fill="none" stroke={trackColor} strokeWidth="3" />
        <circle
          cx="24"
          cy="24"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-mono text-xs font-semibold" style={{ color }}>
          {score.toFixed(0)}
        </span>
      </div>
    </div>
  );
}

function DealBadge({ score }: { score?: number }) {
  if (!score) return null;
  if (score >= 85) {
    return (
      <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-1 bg-red-500 rounded-sm">
        <span className="w-1 h-1 rounded-full bg-white animate-ping" />
        <span className="text-2xs font-bold text-white tracking-widest">HOT DEAL</span>
      </div>
    );
  }
  if (score >= 75) {
    return (
      <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-1 bg-emerald-500 rounded-sm">
        <span className="text-2xs font-bold text-white tracking-widest">DEAL</span>
      </div>
    );
  }
  return null;
}

export function LotCard({ lot, index = 0, locked = false }: LotCardProps) {
  const isDeal = lot.is_deal;
  const isHot = (lot.deal_score || 0) >= 85;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link href={locked ? "/pricing" : `/lot/${lot.id}`} className="block group">
        <div
          className={cn(
            "relative overflow-hidden rounded-sm border transition-all duration-300",
            isHot
              ? "card-hot border-t-2 border-t-red-400"
              : isDeal
              ? "card-deal border-t-2 border-t-emerald-500"
              : "card-artwork",
            "group-hover:shadow-artwork-hover"
          )}
        >
          {/* Image */}
          <div className="relative h-44 overflow-hidden bg-stone-100">
            {lot.image_url ? (
              <img
                src={lot.image_url}
                alt={lot.title}
                className={cn(
                  "absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105",
                  locked && "blur-sm"
                )}
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            ) : (
              <div className="h-full flex items-center justify-center">
                <span className="font-display text-5xl text-stone-200">◇</span>
              </div>
            )}
            {!locked && (
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
            )}

            {!locked && <DealBadge score={lot.deal_score} />}

            <div className="absolute top-3 right-3 flex items-center gap-1.5">
              {!locked && <WishlistButton lotId={lot.id} />}
              <span className="text-2xs px-1.5 py-0.5 bg-white/90 backdrop-blur-sm border border-stone-200 rounded-sm text-stone-500 tracking-wider">
                {getSourceLabel(lot.source)}
              </span>
            </div>

            {lot.category && (
              <div className="absolute bottom-3 left-3">
                <span className="text-2xs text-white/80 tracking-wide bg-black/30 px-1.5 py-0.5 rounded-sm">
                  {lot.category}
                </span>
              </div>
            )}
          </div>

          {/* Content */}
          <div className={cn("p-4", locked && "blur-sm select-none pointer-events-none")}>
            {lot.artist_name_raw && (
              <div className="label-caps mb-1.5">{lot.artist_name_raw}</div>
            )}

            <h3 className="font-serif text-sm text-stone-900 leading-snug line-clamp-2 mb-3 group-hover:text-amber-800 transition-colors">
              {lot.title}
            </h3>

            <div className="flex items-end justify-between mb-3">
              <div>
                <div className="text-2xs text-stone-400 mb-0.5">Current</div>
                <div className="font-mono text-lg text-stone-900 font-medium tabular-nums">
                  {formatPrice(lot.current_price, lot.currency)}
                </div>
                {lot.estimate_low && (
                  <div className="text-2xs text-stone-400 mt-0.5 font-mono">
                    Est. {formatPrice(lot.estimate_low)} – {formatPrice(lot.estimate_high)}
                  </div>
                )}
              </div>

              {lot.deal_score != null && <ScoreRing score={lot.deal_score} />}
            </div>

            {isDeal && lot.pct_below_low_estimate && lot.pct_below_low_estimate > 0 && (
              <div className="flex items-center gap-1.5 mb-2 px-2.5 py-1.5 rounded-sm bg-emerald-50 border border-emerald-200">
                <TrendingDown className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                <span className="text-xs text-emerald-700 font-medium">
                  {lot.pct_below_low_estimate.toFixed(0)}% sous l&apos;estimation basse
                </span>
              </div>
            )}

            {isDeal && lot.rationale && lot.rationale.length > 0 && (
              <div className="mb-2 space-y-0.5">
                {lot.rationale.slice(0, 2).map((r, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <CheckCircle className="w-2.5 h-2.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                    <span className="text-2xs text-stone-500 leading-relaxed">{r}</span>
                  </div>
                ))}
              </div>
            )}

            {lot.fomo_level && lot.fomo_level !== "low" && (
              <div className="mb-2">
                <FomoIndicator
                  timeLeftHours={lot.time_left_hours}
                  fomoLevel={lot.fomo_level}
                  compact
                />
              </div>
            )}

            <div className="flex items-center justify-between text-2xs text-stone-400 border-t border-stone-100 pt-3">
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>{formatDate(lot.auction_date)}</span>
              </div>
              <div className="flex items-center gap-1 max-w-[55%] truncate">
                <Building2 className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{lot.auction_house_name || "—"}</span>
              </div>
            </div>
          </div>

          {/* Paywall overlay */}
          {locked && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70 backdrop-blur-[2px]">
              <div className="flex flex-col items-center gap-2 text-center px-6">
                <Lock className="w-5 h-5 text-stone-400" />
                <div className="text-xs font-semibold text-stone-700">Premium Deal</div>
                <div className="text-2xs text-stone-500">Upgrade to unlock all deals</div>
                <span className="mt-1 text-2xs font-semibold text-amber-700 underline underline-offset-2">
                  View plans →
                </span>
              </div>
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  );
}

// ── Compact horizontal card for lists ────────────────────────────────────────

export function LotRow({ lot, index = 0 }: { lot: Lot; index?: number }) {
  const isHot = (lot.deal_score || 0) >= 85;
  const isDeal = lot.is_deal;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, delay: index * 0.04, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link href={`/lot/${lot.id}`} className="block group">
        <div
          className={cn(
            "flex items-center gap-4 px-5 py-4 border-b transition-all duration-200",
            isHot
              ? "border-red-100 hover:bg-red-50/50"
              : isDeal
              ? "border-emerald-100 hover:bg-emerald-50/30"
              : "border-stone-100 hover:bg-stone-50"
          )}
        >
          {/* thumbnail */}
          <div className="relative w-12 h-12 rounded-sm overflow-hidden flex-shrink-0 bg-stone-100">
            {lot.image_url ? (
              <img src={lot.image_url} alt="" className="absolute inset-0 w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-stone-300 text-lg font-display">◇</span>
              </div>
            )}
          </div>

          {/* info */}
          <div className="flex-1 min-w-0">
            {lot.artist_name_raw && (
              <div className="text-2xs text-amber-700 tracking-wider mb-0.5">{lot.artist_name_raw}</div>
            )}
            <div className="text-sm text-stone-900 font-medium truncate group-hover:text-amber-800 transition-colors">
              {lot.title}
            </div>
            <div className="flex items-center gap-3 mt-1 text-2xs text-stone-400">
              <span>{getSourceLabel(lot.source)}</span>
              {lot.auction_date && <span>{formatDate(lot.auction_date)}</span>}
              {lot.url && (
                <a
                  href={lot.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-0.5 text-amber-700 hover:text-amber-800 transition-colors"
                >
                  <ExternalLink className="w-2.5 h-2.5" />
                  Voir
                </a>
              )}
            </div>
          </div>

          {/* prices */}
          <div className="text-right flex-shrink-0">
            <div className="font-mono text-sm text-stone-900 tabular-nums">
              {formatPrice(lot.current_price, lot.currency)}
            </div>
            {lot.estimate_low && (
              <div className="text-2xs text-stone-400 font-mono mt-0.5">
                est. {formatPrice(lot.estimate_low)}
              </div>
            )}
          </div>

          {/* score */}
          <div className="flex-shrink-0 w-20 text-right">
            {lot.deal_score != null ? (
              <div>
                <div
                  className={cn(
                    "font-mono text-sm font-semibold tabular-nums",
                    isHot ? "text-red-600" : isDeal ? "text-emerald-600" : "text-stone-400"
                  )}
                >
                  {lot.deal_score.toFixed(0)}
                </div>
                <div className="text-2xs text-stone-400 mt-0.5">
                  {isHot ? "HOT" : isDeal ? "DEAL" : "—"}
                </div>
              </div>
            ) : (
              <span className="text-stone-300 text-sm">—</span>
            )}
          </div>

          <ExternalLink className="w-3.5 h-3.5 text-stone-300 group-hover:text-stone-500 flex-shrink-0 transition-colors" />
        </div>
      </Link>
    </motion.div>
  );
}
