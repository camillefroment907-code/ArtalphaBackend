"use client";

import { motion } from "framer-motion";
import { TrendingUp, Zap, Bell, Database, Radio } from "lucide-react";
import useSWR from "swr";
import { lotsApi, type DashboardStats } from "@/lib/api";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  accent?: string;
  index: number;
}

function StatCard({ label, value, sub, icon, accent = "text-amber-600", index }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
      className="card-luxury px-5 py-4 flex items-start gap-4"
    >
      <div className={`mt-0.5 ${accent}`}>{icon}</div>
      <div>
        <div className="label-caps mb-1.5">{label}</div>
        <div className="font-mono text-2xl font-medium text-stone-900 tabular-nums">{value}</div>
        {sub && <div className="text-2xs text-stone-400 mt-1">{sub}</div>}
      </div>
    </motion.div>
  );
}

export function StatsBar() {
  const { data, isLoading } = useSWR(
    "dashboard-stats",
    () => lotsApi.stats().then((r) => r.data),
    { refreshInterval: 30000 }
  );

  const stats: DashboardStats = data || {
    total_lots_tracked: 0,
    deals_detected_today: 0,
    avg_deal_score: 0,
    top_deal_score: 0,
    alerts_sent_today: 0,
    sources_active: 0,
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 px-8 py-5">
      <StatCard
        index={0}
        label="Lots Tracked"
        value={isLoading ? "—" : stats.total_lots_tracked.toLocaleString()}
        sub="across all sources"
        icon={<Database className="w-4 h-4" />}
        accent="text-stone-500"
      />
      <StatCard
        index={1}
        label="Deals Today"
        value={isLoading ? "—" : stats.deals_detected_today}
        sub="score ≥ 75"
        icon={<Zap className="w-4 h-4" />}
        accent="text-emerald-600"
      />
      <StatCard
        index={2}
        label="Top Score"
        value={isLoading ? "—" : `${stats.top_deal_score.toFixed(0)}/100`}
        sub="best deal right now"
        icon={<TrendingUp className="w-4 h-4" />}
        accent="text-red-500"
      />
      <StatCard
        index={3}
        label="Alerts Sent"
        value={isLoading ? "—" : stats.alerts_sent_today}
        sub="today"
        icon={<Bell className="w-4 h-4" />}
        accent="text-amber-600"
      />
      <StatCard
        index={4}
        label="Sources Live"
        value={isLoading ? "—" : `${stats.sources_active}/3`}
        sub="Drouot · IE · Invaluable"
        icon={<Radio className="w-4 h-4" />}
        accent="text-emerald-600"
      />
    </div>
  );
}
