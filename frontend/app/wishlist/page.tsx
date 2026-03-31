"use client";

import useSWR from "swr";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { LotCard } from "@/components/lots/LotCard";
import { wishlistApi, type Lot } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { Heart } from "lucide-react";

export default function WishlistPage() {
  const { data: lots, isLoading } = useSWR<Lot[]>(
    "wishlist",
    () => wishlistApi.list().then((r) => r.data),
    { revalidateOnFocus: true }
  );

  const items = lots || [];

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-[#0a0a0b]">
      <Sidebar />
      <div className="flex-1 ml-[52px] min-w-0 flex flex-col">
        <TopBar
          title="Ma Liste"
          subtitle={`${items.length} lot${items.length !== 1 ? "s" : ""} sauvegardé${items.length !== 1 ? "s" : ""}`}
        />

        <main className="flex-1 px-8 py-6">
          {isLoading && items.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="card-luxury overflow-hidden animate-pulse">
                  <div className="h-44 bg-stone-100" />
                  <div className="p-4 space-y-3">
                    <div className="h-3 bg-stone-100 rounded w-1/3" />
                    <div className="h-4 bg-stone-100 rounded w-4/5" />
                  </div>
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-24 text-center"
            >
              <Heart className="w-12 h-12 text-stone-200 mb-4" />
              <div className="font-serif text-xl text-stone-500 mb-2">Votre liste est vide</div>
              <p className="text-sm text-stone-400 max-w-xs">
                Cliquez sur l&apos;icône cœur sur n&apos;importe quel lot pour l&apos;ajouter ici.
              </p>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <AnimatePresence mode="popLayout">
                {items.map((lot, i) => (
                  <LotCard key={lot.id} lot={lot} index={i} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
