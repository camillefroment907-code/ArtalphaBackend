"use client";

import { useState, useEffect, useCallback } from "react";
import { wishlistApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

export function useWishlist() {
  const { user } = useAuthStore();
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    wishlistApi.ids()
      .then((r) => setIds(new Set(r.data)))
      .catch(() => {});
  }, [user]);

  const toggle = useCallback(async (lotId: string) => {
    if (!user) return;
    setLoading(true);
    try {
      if (ids.has(lotId)) {
        await wishlistApi.remove(lotId);
        setIds((prev) => {
          const next = new Set(prev);
          next.delete(lotId);
          return next;
        });
      } else {
        await wishlistApi.add(lotId);
        setIds((prev) => new Set([...prev, lotId]));
      }
    } catch {}
    setLoading(false);
  }, [ids, user]);

  return { ids, toggle, loading, isWishlisted: (id: string) => ids.has(id) };
}
