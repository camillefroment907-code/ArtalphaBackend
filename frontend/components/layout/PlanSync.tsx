"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/lib/store";
import { billingApi } from "@/lib/api";

/**
 * Fetches the current subscription plan from the server on mount
 * and syncs it into the Zustand auth store.
 * Renders nothing — purely a side-effect component.
 */
export function PlanSync() {
  const { isAuthenticated, setPlan } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) return;
    billingApi.getSubscription()
      .then(({ data }) => {
        if (data?.plan) setPlan(data.plan as any);
      })
      .catch(() => {/* silently ignore — store keeps last known plan */});
  }, [isAuthenticated, setPlan]);

  return null;
}
