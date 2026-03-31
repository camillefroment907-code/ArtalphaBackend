"use client";

import { useState } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import { Sidebar } from "@/components/layout/Sidebar";
import { formatPrice, cn } from "@/lib/utils";
import { Shield, TrendingUp, Users, Bell, Database, Zap, RefreshCw } from "lucide-react";

const ADMIN_KEY = "hono-admin-2024";

interface AdminStats {
  lots: {
    total: number;
    today: number;
    this_week: number;
    deals_total: number;
    deals_today: number;
    deal_rate_pct: number;
  };
  scoring: { avg_score: number; top_score: number };
  users: { total: number };
  alerts: { total: number; today: number };
  sources: Record<string, number>;
  top_deals: Array<{
    id: string;
    title: string;
    deal_score: number;
    artist?: string;
    source: string;
    current_price?: number;
    currency?: string;
  }>;
  generated_at: string;
}

function StatCard({ icon: Icon, label, value, sub, accent = false }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className={cn(
      "card-luxury p-5 space-y-3",
      accent && "border-amber-200 bg-amber-50/30"
    )}>
      <div className="flex items-center gap-2">
        <Icon className={cn("w-4 h-4", accent ? "text-amber-600" : "text-stone-400")} />
        <span className="text-2xs text-stone-400 tracking-wider uppercase font-semibold">{label}</span>
      </div>
      <div className="font-mono text-2xl font-semibold text-stone-900 tabular-nums">{value}</div>
      {sub && <div className="text-xs text-stone-400">{sub}</div>}
    </div>
  );
}

export default function AdminPage() {
  const [key] = useState(ADMIN_KEY);

  const { data, isLoading, mutate, isValidating } = useSWR<AdminStats>(
    "admin-stats",
    () => api.get("/api/admin/stats", { headers: { "X-Admin-Key": key } }).then((r) => r.data),
    { revalidateOnFocus: false }
  );

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-[#0a0a0b]">
      <Sidebar />
      <div className="flex-1 ml-[52px] min-w-0 flex flex-col">
        {/* Header */}
        <div className="border-b border-stone-100 bg-white px-8 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-sm bg-stone-900 flex items-center justify-center">
                <Shield className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <h1 className="font-serif text-lg text-stone-900">Admin Dashboard</h1>
                <div className="text-xs text-stone-400">
                  {data ? `Updated ${new Date(data.generated_at).toLocaleTimeString()}` : "ArtAlpha KPI Console"}
                </div>
              </div>
            </div>
            <button
              onClick={() => mutate()}
              disabled={isValidating}
              className="btn-ghost text-xs py-2"
            >
              <RefreshCw className={cn("w-3.5 h-3.5 mr-2", isValidating && "animate-spin")} />
              Refresh
            </button>
          </div>
        </div>

        <main className="flex-1 px-8 py-6 space-y-8">
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="card-luxury h-24 animate-pulse" />
              ))}
            </div>
          ) : !data ? (
            <div className="flex flex-col items-center py-24 text-center">
              <Shield className="w-12 h-12 text-stone-200 mb-4" />
              <div className="text-stone-500">Impossible de charger les statistiques admin</div>
            </div>
          ) : (
            <>
              {/* KPI Grid */}
              <div>
                <div className="label-caps mb-4">Lots & Deals</div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <StatCard icon={Database} label="Total Lots" value={data.lots.total.toLocaleString()} accent />
                  <StatCard icon={TrendingUp} label="Lots Today" value={data.lots.today} />
                  <StatCard icon={Zap} label="This Week" value={data.lots.this_week} />
                  <StatCard icon={TrendingUp} label="Deals Total" value={data.lots.deals_total} />
                  <StatCard icon={TrendingUp} label="Deals Today" value={data.lots.deals_today} />
                  <StatCard
                    icon={TrendingUp}
                    label="Deal Rate"
                    value={`${data.lots.deal_rate_pct}%`}
                    accent={data.lots.deal_rate_pct > 20}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Scoring */}
                <div>
                  <div className="label-caps mb-4">Scoring</div>
                  <div className="space-y-3">
                    <StatCard icon={Zap} label="Avg Score" value={data.scoring.avg_score} />
                    <StatCard icon={Zap} label="Top Score" value={data.scoring.top_score} accent={data.scoring.top_score >= 85} />
                  </div>
                </div>

                {/* Users & Alerts */}
                <div>
                  <div className="label-caps mb-4">Users & Alerts</div>
                  <div className="space-y-3">
                    <StatCard icon={Users} label="Total Users" value={data.users.total} />
                    <StatCard icon={Bell} label="Alerts Today" value={data.alerts.today} sub={`${data.alerts.total} total`} />
                  </div>
                </div>

                {/* Sources */}
                <div>
                  <div className="label-caps mb-4">Sources</div>
                  <div className="card-luxury p-5 space-y-3">
                    {Object.entries(data.sources).map(([source, count]) => (
                      <div key={source} className="flex items-center justify-between">
                        <span className="text-xs text-stone-600 capitalize">{source}</span>
                        <span className="font-mono text-sm text-stone-900">{count.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Top Deals */}
              {data.top_deals.length > 0 && (
                <div>
                  <div className="label-caps mb-4">Top 5 Deals</div>
                  <div className="card-luxury overflow-hidden">
                    <div className="divide-y divide-stone-100">
                      {data.top_deals.map((deal, i) => (
                        <div key={deal.id} className="flex items-center gap-4 px-5 py-3.5">
                          <span className="w-6 text-xs font-mono text-stone-300">#{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-stone-800 truncate">{deal.title}</div>
                            <div className="text-2xs text-stone-400 mt-0.5">
                              {deal.artist || "—"} · {deal.source}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="font-mono text-sm text-stone-900">
                              {deal.current_price ? formatPrice(deal.current_price, deal.currency) : "—"}
                            </div>
                            <div className={cn(
                              "text-xs font-mono font-semibold mt-0.5",
                              deal.deal_score >= 85 ? "text-red-600" : "text-emerald-600"
                            )}>
                              {deal.deal_score?.toFixed(1)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
