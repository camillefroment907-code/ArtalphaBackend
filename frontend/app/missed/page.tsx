"use client";

import { useState } from "react";
import useSWR from "swr";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { LotCard } from "@/components/lots/LotCard";
import { lotsApi, type LotListResponse } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

export default function MissedDealsPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useSWR<LotListResponse>(
    ["missed", page],
    () => lotsApi.missed({ page, page_size: PAGE_SIZE }).then((r) => r.data),
    { revalidateOnFocus: false }
  );

  const lots = data?.items || [];
  const pages = data?.pages || 0;

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-[#0a0a0b]">
      <Sidebar />
      <div className="flex-1 ml-[52px] min-w-0 flex flex-col">
        <TopBar
          title="Opportunités Manquées"
          subtitle="Deals passés — analysez les tendances pour mieux anticiper"
        />

        <main className="flex-1 px-8 py-6">
          {isLoading && lots.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="card-luxury overflow-hidden animate-pulse">
                  <div className="h-44 bg-stone-100" />
                  <div className="p-4 space-y-3">
                    <div className="h-3 bg-stone-100 rounded w-1/3" />
                    <div className="h-4 bg-stone-100 rounded w-4/5" />
                  </div>
                </div>
              ))}
            </div>
          ) : lots.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-24 text-center"
            >
              <Clock className="w-12 h-12 text-stone-200 mb-4" />
              <div className="font-serif text-xl text-stone-500 mb-2">Aucune opportunité passée</div>
              <p className="text-sm text-stone-400 max-w-xs">
                Les deals expirés apparaîtront ici au fil du temps.
              </p>
            </motion.div>
          ) : (
            <>
              <div className="mb-6 flex items-center gap-3">
                <div className="text-xs text-stone-400 font-mono">{data?.total || 0} deals analysés</div>
                <div className="text-xs text-stone-400">·</div>
                <div className="text-xs text-stone-500">
                  Utilisez ces données pour calibrer votre stratégie d&apos;acquisition
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <AnimatePresence mode="popLayout">
                  {lots.map((lot, i) => (
                    <LotCard key={lot.id} lot={lot} index={i} />
                  ))}
                </AnimatePresence>
              </div>

              {pages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-8 pb-4">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="btn-ghost text-xs py-1.5 px-3 disabled:opacity-30"
                  >
                    ← Précédent
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(pages, 7) }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={cn(
                          "w-8 h-8 rounded-sm text-xs font-mono transition-all",
                          page === p
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "text-stone-400 hover:text-stone-700 hover:bg-stone-50"
                        )}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setPage((p) => Math.min(pages, p + 1))}
                    disabled={page === pages}
                    className="btn-ghost text-xs py-1.5 px-3 disabled:opacity-30"
                  >
                    Suivant →
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
