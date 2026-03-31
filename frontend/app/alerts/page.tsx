"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import useSWR from "swr";
import { motion } from "framer-motion";
import { Bell, Mail, Send, Check, X, ExternalLink, Trash2 } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { alertsApi, type Alert } from "@/lib/api";
import { formatPrice, formatDateRelative, getSourceLabel, cn } from "@/lib/utils";

function AlertRow({ alert, index, onDelete }: { alert: Alert; index: number; onDelete: () => void }) {
  const lot = alert.lot;
  const isEmail = alert.channel === "email";
  const isTelegram = alert.channel === "telegram";
  const score = alert.deal_score_at_send;
  const isHot = (score || 0) >= 85;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.04, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "flex items-start gap-4 p-5 border-b transition-all duration-200 group",
        isHot ? "border-red-500/10 hover:bg-red-500/[0.02]" : "border-white/[0.04] hover:bg-white/[0.02]"
      )}
    >
      {/* Channel icon */}
      <div
        className={cn(
          "w-9 h-9 rounded-sm flex items-center justify-center flex-shrink-0 border mt-0.5",
          isEmail ? "bg-blue-500/10 border-blue-500/20" : "bg-blue-400/10 border-blue-400/20"
        )}
      >
        {isEmail ? (
          <Mail className="w-4 h-4 text-blue-400" />
        ) : (
          <Send className="w-4 h-4 text-blue-300" />
        )}
      </div>

      {/* Thumbnail */}
      {lot?.image_url && (
        <div className="relative w-12 h-12 rounded-sm overflow-hidden flex-shrink-0 bg-obsidian-50 mt-0.5">
          <img src={lot.image_url} alt="" className="absolute inset-0 w-full h-full object-cover opacity-70" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        {lot ? (
          <div>
            {lot.artist_name_raw && (
              <div className="text-2xs text-gold/70 tracking-wider mb-0.5">{lot.artist_name_raw}</div>
            )}
            <Link href={`/lot/${lot.id}`} className="text-sm text-ivory hover:text-gold-200 transition-colors line-clamp-1">
              {lot.title}
            </Link>
            <div className="flex items-center gap-3 mt-1.5 text-2xs text-ivory/35">
              <span>{getSourceLabel(lot.source)}</span>
              {lot.current_price && (
                <span className="font-mono">{formatPrice(lot.current_price, lot.currency)}</span>
              )}
            </div>
          </div>
        ) : (
          <div className="text-sm text-ivory/50 line-clamp-2">{alert.message.slice(0, 120)}…</div>
        )}

        <div className="flex items-center gap-3 mt-2 text-2xs text-ivory/30">
          <span>via {alert.channel}</span>
          <span>·</span>
          <span>{formatDateRelative(alert.sent_at)}</span>
          <span>·</span>
          {alert.is_delivered ? (
            <span className="flex items-center gap-1 text-deal">
              <Check className="w-3 h-3" /> delivered
            </span>
          ) : (
            <span className="flex items-center gap-1 text-red-400">
              <X className="w-3 h-3" /> failed
            </span>
          )}
        </div>
      </div>

      {/* Score */}
      {score != null && (
        <div className="flex-shrink-0 text-right">
          <div
            className={cn(
              "font-mono text-xl font-bold tabular-nums",
              isHot ? "text-red-400" : "text-deal"
            )}
          >
            {score.toFixed(0)}
          </div>
          <div className="text-2xs text-ivory/25">score</div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        {lot && (
          <Link href={`/lot/${lot.id}`} className="p-1.5 rounded text-ivory/30 hover:text-ivory/70">
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        )}
        <button
          onClick={onDelete}
          className="p-1.5 rounded text-ivory/20 hover:text-red-400 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
}

export default function AlertsPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading, mutate } = useSWR(
    ["alerts", page],
    () => alertsApi.list({ page, page_size: 30 }).then((r) => r.data),
    { refreshInterval: 30000 }
  );

  const alerts: Alert[] = data?.items || [];
  const total: number = data?.total || 0;
  const pages: number = data?.pages || 0;

  const handleDelete = async (id: string) => {
    await alertsApi.delete(id);
    mutate();
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 ml-[52px]">
        <TopBar
          title="Alert History"
          subtitle={`${total} alerts sent in total`}
        />

        <main className="px-8 py-6">
          {isLoading ? (
            <div className="card-luxury overflow-hidden">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-5 border-b border-white/[0.04] animate-pulse">
                  <div className="w-9 h-9 bg-white/[0.04] rounded-sm" />
                  <div className="w-12 h-12 bg-white/[0.04] rounded-sm" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-white/[0.05] rounded w-2/3" />
                    <div className="h-3 bg-white/[0.03] rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : alerts.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-28"
            >
              <div className="w-16 h-16 rounded-sm bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-6">
                <Bell className="w-6 h-6 text-ivory/20" />
              </div>
              <div className="heading-serif text-lg text-ivory/30 mb-2">No alerts yet</div>
              <p className="text-sm text-ivory/20 text-center max-w-xs">
                Alerts will appear here when deals matching your preferences are found.
              </p>
              <Link href="/settings" className="mt-6 btn-outline-gold text-xs">
                Configure alerts →
              </Link>
            </motion.div>
          ) : (
            <>
              <div className="card-luxury overflow-hidden mb-6">
                {/* Header row */}
                <div className="flex items-center gap-4 px-5 py-3 border-b border-white/[0.06]">
                  <div className="flex-1">
                    <span className="label-caps">Alert</span>
                  </div>
                  <div className="w-16 text-right">
                    <span className="label-caps">Score</span>
                  </div>
                </div>
                {alerts.map((alert, i) => (
                  <AlertRow
                    key={alert.id}
                    alert={alert}
                    index={i}
                    onDelete={() => handleDelete(alert.id)}
                  />
                ))}
              </div>

              {/* Pagination */}
              {pages > 1 && (
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="btn-ghost text-xs py-1.5 px-3 disabled:opacity-30"
                  >
                    ← Prev
                  </button>
                  <span className="text-xs text-ivory/40 font-mono">
                    {page} / {pages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(pages, p + 1))}
                    disabled={page === pages}
                    className="btn-ghost text-xs py-1.5 px-3 disabled:opacity-30"
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
