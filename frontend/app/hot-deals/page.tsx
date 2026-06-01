"use client";

import useSWR from "swr";
import { Flame, Zap, ThumbsUp, ExternalLink, TrendingDown, Calendar, Building2 } from "lucide-react";
import { lotsApi, type HotDeal } from "@/lib/api";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { formatDate } from "@/lib/utils";

const DEAL_CONFIG = {
  FIRE: {
    icon: Flame,
    label: "FIRE",
    bgClass: "bg-red-50 border-red-200",
    textClass: "text-red-700",
    badgeClass: "bg-red-100 text-red-700 border-red-200",
    scoreColor: "#dc2626",
  },
  HOT: {
    icon: Zap,
    label: "HOT",
    bgClass: "bg-amber-50 border-amber-200",
    textClass: "text-amber-700",
    badgeClass: "bg-amber-100 text-amber-700 border-amber-200",
    scoreColor: "#d97706",
  },
  GOOD: {
    icon: ThumbsUp,
    label: "GOOD",
    bgClass: "bg-emerald-50 border-emerald-200",
    textClass: "text-emerald-700",
    badgeClass: "bg-emerald-100 text-emerald-700 border-emerald-200",
    scoreColor: "#059669",
  },
} as const;

function formatPrice(price?: number, currency = "EUR"): string {
  if (price == null) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(price);
}

function SourceLabel({ source }: { source?: string }) {
  if (!source) return null;
  const labels: Record<string, string> = {
    DROUOT: "Drouot",
    INVALUABLE: "Invaluable",
    INTERENCHERES: "Interenchères",
  };
  return <span>{labels[source] || source}</span>;
}

function HotDealCard({ deal }: { deal: HotDeal }) {
  const config = DEAL_CONFIG[deal.deal_class] ?? DEAL_CONFIG.GOOD;
  const Icon = config.icon;
  const savingPct = deal.pct_below_estimate
    ? Math.abs(deal.pct_below_estimate).toFixed(0)
    : null;

  return (
    <div className={`border rounded-sm overflow-hidden bg-white transition-shadow hover:shadow-md ${deal.deal_class === "FIRE" ? "border-red-200" : deal.deal_class === "HOT" ? "border-amber-200" : "border-stone-200"}`}>
      <div className="flex">
        {/* Image */}
        <div className="relative w-32 flex-shrink-0 bg-stone-100 overflow-hidden">
          {deal.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={deal.image_url}
              alt={deal.title}
              className="w-full h-full object-cover"
              style={{ minHeight: "120px" }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center" style={{ minHeight: "120px" }}>
              <span className="text-stone-300 text-4xl font-serif">◇</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 p-4">
          <div className="flex items-start justify-between gap-3 mb-1">
            <div className="flex-1 min-w-0">
              {deal.artist && (
                <div className="text-2xs font-semibold tracking-widest uppercase text-amber-700 mb-0.5">
                  {deal.artist}
                </div>
              )}
              <h3 className="text-sm font-medium text-stone-900 line-clamp-2 leading-snug">
                {deal.title}
              </h3>
            </div>

            {/* Deal class badge */}
            <div className={`flex items-center gap-1 px-2 py-1 rounded border text-xs font-bold flex-shrink-0 ${config.badgeClass}`}>
              <Icon className="w-3 h-3" />
              {config.label}
            </div>
          </div>

          {/* Meta */}
          <div className="flex items-center gap-3 text-2xs text-stone-400 mt-2 mb-3">
            {deal.auction_house && (
              <span className="flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                {deal.auction_house.split("—")[0].trim()}
              </span>
            )}
            {deal.source && !deal.auction_house && (
              <span className="flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                <SourceLabel source={deal.source} />
              </span>
            )}
            {deal.auction_date && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {formatDate(deal.auction_date)}
              </span>
            )}
            {deal.category && (
              <span className="text-stone-300">•</span>
            )}
            {deal.category && <span>{deal.category}</span>}
          </div>

          {/* Prices */}
          <div className="flex items-center gap-4">
            <div>
              <div className="text-2xs text-stone-400">Mise à prix</div>
              <div className="font-mono text-sm font-semibold text-stone-900 tabular-nums">
                {formatPrice(deal.current_price, deal.currency)}
              </div>
            </div>
            {deal.estimate_low && (
              <>
                <div className="text-stone-300 text-xs">→</div>
                <div>
                  <div className="text-2xs text-stone-400">Estimation basse</div>
                  <div className="font-mono text-sm text-stone-400 line-through tabular-nums">
                    {formatPrice(deal.estimate_low, deal.currency)}
                  </div>
                </div>
              </>
            )}
            {savingPct && (
              <div className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-50 border border-emerald-200 ml-auto">
                <TrendingDown className="w-3 h-3 text-emerald-600" />
                <span className="text-xs font-semibold text-emerald-700 font-mono">
                  -{savingPct}%
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Score + CTA */}
        <div className="flex flex-col items-center justify-center px-5 border-l border-stone-100 gap-3 flex-shrink-0" style={{ minWidth: "90px" }}>
          <div className="text-center">
            <div className="font-mono text-3xl font-bold tabular-nums" style={{ color: config.scoreColor }}>
              {deal.deal_score?.toFixed(0)}
            </div>
            <div className="text-2xs text-stone-400">/100</div>
          </div>

          {deal.url ? (
            <a
              href={deal.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-2xs text-stone-500 hover:text-amber-700 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Voir
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function HotDealsPage() {
  const { data, isLoading } = useSWR(
    "hot-deals",
    () => lotsApi.hotDeals(100, 30).then((r) => r.data),
    { refreshInterval: 60000 }
  );

  const deals: HotDeal[] = data || [];
  const fire = deals.filter((d) => d.deal_class === "FIRE");
  const hot = deals.filter((d) => d.deal_class === "HOT");
  const good = deals.filter((d) => d.deal_class === "GOOD");

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-stone-50">
      <Sidebar />
      <div className="flex-1 ml-[52px] min-w-0 flex flex-col">
      <TopBar
        title="Hot Deals"
        subtitle="Lots actuellement sous leur valeur de marché — triés par score"
      />

      <main className="flex-1 px-8 py-6 max-w-5xl">
        {/* Counts */}
        {!isLoading && deals.length > 0 && (
          <div className="flex items-center gap-6 mb-8">
            {fire.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-red-50 border border-red-200">
                <Flame className="w-4 h-4 text-red-600" />
                <span className="text-sm font-semibold text-red-700">{fire.length} FIRE</span>
              </div>
            )}
            {hot.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-amber-50 border border-amber-200">
                <Zap className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-semibold text-amber-700">{hot.length} HOT</span>
              </div>
            )}
            {good.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-emerald-50 border border-emerald-200">
                <ThumbsUp className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-semibold text-emerald-700">{good.length} GOOD</span>
              </div>
            )}
            <div className="ml-auto text-xs text-stone-400">
              Mis à jour à chaque ingest scraper
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-32 bg-white border border-stone-200 rounded-sm animate-pulse" />
            ))}
          </div>
        ) : deals.length === 0 ? (
          <div className="text-center py-24 bg-white border border-stone-200 rounded-sm">
            <div className="text-stone-200 text-6xl mb-4 font-serif">◇</div>
            <div className="text-stone-500 font-medium">Aucun deal chaud détecté</div>
            <div className="text-stone-400 text-sm mt-1">
              Revenez dans quelques minutes — le moteur tourne en continu
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {deals.map((deal) => (
              <HotDealCard key={deal.id} deal={deal} />
            ))}
          </div>
        )}
      </main>
      </div>
    </div>
  );
}
