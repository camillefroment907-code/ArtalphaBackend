"use client";

import { useState } from "react";
import useSWR from "swr";
import { motion } from "framer-motion";
import { Search, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { artistsApi, type Artist } from "@/lib/api";
import { formatPrice, cn } from "@/lib/utils";

function ArtistCard({ artist, index }: { artist: Artist; index: number }) {
  const trendIcon =
    artist.trend === "up" ? (
      <TrendingUp className="w-3.5 h-3.5 text-deal" />
    ) : artist.trend === "down" ? (
      <TrendingDown className="w-3.5 h-3.5 text-red-400" />
    ) : (
      <Minus className="w-3.5 h-3.5 text-ivory/40" />
    );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.04 }}
      className="card-luxury p-5 hover:border-white/[0.10] transition-all duration-200"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-serif text-base text-ivory mb-0.5">{artist.name}</h3>
          <div className="text-2xs text-ivory/40">
            {[artist.nationality, artist.movement].filter(Boolean).join(" · ")}
          </div>
        </div>
        <div className="flex items-center gap-1.5">{trendIcon}</div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2.5">
        {[
          { label: "Avg Price", value: formatPrice(artist.avg_auction_price) },
          { label: "Liquidity", value: `${artist.liquidity_score.toFixed(0)}/100` },
          { label: "Lots Sold", value: artist.total_lots_sold.toLocaleString() },
          { label: "Sell Rate", value: `${(artist.sell_through_rate * 100).toFixed(0)}%` },
        ].map(({ label, value }) => (
          <div key={label} className="p-2.5 rounded-sm bg-white/[0.03] border border-white/[0.04]">
            <div className="text-2xs text-ivory/35 mb-0.5">{label}</div>
            <div className="text-xs font-mono text-ivory/80">{value}</div>
          </div>
        ))}
      </div>

      {/* Popularity bar */}
      <div className="mt-4">
        <div className="flex justify-between text-2xs text-ivory/35 mb-1">
          <span>Popularity</span>
          <span>{artist.popularity_score.toFixed(0)}/100</span>
        </div>
        <div className="h-1 bg-white/[0.05] rounded-full overflow-hidden">
          <div
            className="h-full bg-gold/50 rounded-full"
            style={{ width: `${artist.popularity_score}%` }}
          />
        </div>
      </div>
    </motion.div>
  );
}

export default function ArtistsPage() {
  const [query, setQuery] = useState("");
  const [trend, setTrend] = useState<string>("");
  const [minLiquidity, setMinLiquidity] = useState<number | undefined>();

  const params: Record<string, unknown> = { limit: 50 };
  if (query) params.q = query;
  if (trend) params.trend = trend;
  if (minLiquidity) params.min_liquidity = minLiquidity;

  const { data, isLoading } = useSWR(
    ["artists", query, trend, minLiquidity],
    () => artistsApi.list(params).then((r) => r.data),
    { keepPreviousData: true }
  );

  const artists: Artist[] = data || [];

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 ml-[52px]">
        <TopBar title="Artist Market Intelligence" subtitle="Liquidity, trend, and pricing data" />

        {/* Filters */}
        <div className="flex items-center gap-3 px-8 py-3 border-b border-white/[0.06]">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ivory/30" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search artist…"
              className="input-luxury pl-8 text-xs py-2"
            />
          </div>

          {["up", "stable", "down"].map((t) => (
            <button
              key={t}
              onClick={() => setTrend(trend === t ? "" : t)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs border transition-all",
                trend === t
                  ? t === "up" ? "bg-deal/10 border-deal/30 text-deal"
                    : t === "down" ? "bg-red-500/10 border-red-500/30 text-red-400"
                    : "bg-gold/10 border-gold/30 text-gold"
                  : "border-white/10 text-ivory/40 hover:border-white/20"
              )}
            >
              {t === "up" ? <TrendingUp className="w-3 h-3" /> : t === "down" ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <main className="px-8 py-6">
          {isLoading ? (
            <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="card-luxury h-48 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
              {artists.map((artist, i) => (
                <ArtistCard key={artist.id} artist={artist} index={i} />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
