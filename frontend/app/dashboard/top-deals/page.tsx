"use client";

import Image from "next/image";
import Link from "next/link";
import useSWR from "swr";
import { motion } from "framer-motion";
import { Trophy, TrendingDown, Calendar, Building2, ExternalLink } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { lotsApi, type TopDeal } from "@/lib/api";
import { formatPrice, formatDate, getSourceLabel, cn } from "@/lib/utils";

const MEDAL_COLORS = ["#c9a84c", "#9ca3af", "#cd7c3a"];
const RANK_BG = ["bg-gold/10 border-gold/30", "bg-white/[0.04] border-white/10", "bg-orange-900/10 border-orange-500/20"];

function TopDealCard({ deal, rank }: { deal: TopDeal; rank: number }) {
  const lot = deal.lot;
  const isTop3 = rank <= 3;
  const scoreColor =
    (lot.deal_score || 0) >= 85 ? "#ef4444" : (lot.deal_score || 0) >= 75 ? "#22c55e" : "#c9a84c";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: (rank - 1) * 0.07, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link href={`/lot/${lot.id}`} className="block group">
        <div
          className={cn(
            "relative overflow-hidden rounded-sm border transition-all duration-300 shine",
            isTop3
              ? `${RANK_BG[rank - 1]}`
              : "bg-[#111111] border-white/[0.06] hover:border-white/[0.12]",
            "hover:shadow-luxury"
          )}
        >
          <div className="flex gap-0">
            {/* Rank number */}
            <div
              className={cn(
                "flex-shrink-0 w-16 flex flex-col items-center justify-center border-r py-6",
                isTop3 ? "border-white/[0.08]" : "border-white/[0.04]"
              )}
            >
              {rank <= 3 ? (
                <Trophy
                  className="w-5 h-5 mb-1"
                  style={{ color: MEDAL_COLORS[rank - 1] }}
                />
              ) : null}
              <span
                className="font-display text-2xl leading-none"
                style={{ color: rank <= 3 ? MEDAL_COLORS[rank - 1] : "rgba(255,255,255,0.2)" }}
              >
                {rank}
              </span>
            </div>

            {/* Image */}
            <div className="relative w-28 h-28 flex-shrink-0 overflow-hidden bg-obsidian-50">
              {lot.image_url ? (
                <img
                  src={lot.image_url}
                  alt={lot.title}
                  className="absolute inset-0 w-full h-full object-cover opacity-75 group-hover:opacity-90 group-hover:scale-105 transition-all duration-500"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-ivory/10 text-3xl font-display">◇</span>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 p-4">
              {lot.artist_name_raw && (
                <div className="label-caps mb-1">{lot.artist_name_raw}</div>
              )}
              <h3 className="font-serif text-sm text-ivory leading-snug line-clamp-1 mb-2 group-hover:text-gold-200 transition-colors">
                {lot.title}
              </h3>
              <div className="flex items-center gap-4 text-2xs text-ivory/35 mb-3">
                <span className="flex items-center gap-1">
                  <Building2 className="w-3 h-3" />
                  {lot.auction_house_name?.split("—")[0].trim() || getSourceLabel(lot.source)}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {formatDate(lot.auction_date)}
                </span>
              </div>

              {/* Price comparison */}
              <div className="flex items-center gap-4">
                <div>
                  <div className="text-2xs text-ivory/40">Current bid</div>
                  <div className="font-mono text-sm text-ivory font-medium tabular-nums">
                    {formatPrice(lot.current_price, lot.currency)}
                  </div>
                </div>
                <div className="text-ivory/20 text-xs">→</div>
                <div>
                  <div className="text-2xs text-ivory/40">Low estimate</div>
                  <div className="font-mono text-sm text-ivory/60 line-through tabular-nums">
                    {formatPrice(lot.estimate_low, lot.currency)}
                  </div>
                </div>
                {deal.estimated_saving_eur && (
                  <div className="flex items-center gap-1.5 ml-2 px-2 py-1 rounded-sm bg-deal/10 border border-deal/15">
                    <TrendingDown className="w-3 h-3 text-deal" />
                    <span className="text-xs text-deal font-medium font-mono">
                      save {formatPrice(deal.estimated_saving_eur)} ({deal.estimated_saving_pct?.toFixed(0)}%)
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Score */}
            <div className="flex-shrink-0 flex flex-col items-center justify-center px-6 border-l border-white/[0.04]">
              <div
                className="font-mono text-3xl font-bold tabular-nums"
                style={{ color: scoreColor }}
              >
                {lot.deal_score?.toFixed(0)}
              </div>
              <div className="text-2xs text-ivory/30 mt-1">/ 100</div>
              <ExternalLink className="w-3 h-3 text-ivory/20 group-hover:text-ivory/50 mt-3 transition-colors" />
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export default function TopDealsPage() {
  const { data, isLoading } = useSWR(
    "top-deals-full",
    () => lotsApi.topDeals(25).then((r) => r.data),
    { refreshInterval: 120000 }
  );

  const deals: TopDeal[] = data || [];

  return (
    <>
      <TopBar
        title="Top Deals Today"
        subtitle="Best opportunities ranked by deal score — next 30 days"
      />

      <main className="flex-1 px-8 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="flex-1 h-px bg-gradient-to-r from-gold/30 via-gold/10 to-transparent" />
          <div className="label-caps px-4">Ranked by ArtAlpha Score</div>
          <div className="flex-1 h-px bg-gradient-to-l from-gold/30 via-gold/10 to-transparent" />
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-28 card-luxury animate-pulse rounded-sm" />
            ))}
          </div>
        ) : deals.length === 0 ? (
          <div className="text-center py-24">
            <div className="font-display text-6xl text-ivory/10 mb-4">◇</div>
            <div className="text-ivory/40">No deals detected in the next 7 days</div>
          </div>
        ) : (
          <div className="space-y-2">
            {deals.map((deal) => (
              <TopDealCard key={deal.lot.id} deal={deal} rank={deal.rank} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
