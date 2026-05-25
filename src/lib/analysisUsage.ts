/**
 * Track AI analysis usage per month.
 * Stored in localStorage — resets automatically each calendar month.
 */

const STORAGE_KEY = 'artalpha_analysis_usage';

interface UsageData {
  month: string; // "2026-04"
  count: number;
  plan: string;
}

export const PLAN_LIMITS: Record<string, number> = {
  free:     0,
  starter:  0,
  investor:      20,
  pro:           100,
  elite:         999, // legacy — maps to institutional
  institutional: 999,
};

function getCurrentMonth(): string {
  return new Date().toISOString().slice(0, 7); // "2026-04"
}

function getUsageData(): UsageData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { month: getCurrentMonth(), count: 0, plan: 'free' };
    const data = JSON.parse(raw) as UsageData;
    if (data.month !== getCurrentMonth()) {
      return { month: getCurrentMonth(), count: 0, plan: data.plan };
    }
    return data;
  } catch {
    return { month: getCurrentMonth(), count: 0, plan: 'free' };
  }
}

function saveUsageData(data: UsageData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getUsageStatus(planId: string): {
  used: number;
  limit: number;
  remaining: number;
  canAnalyze: boolean;
  percentUsed: number;
} {
  const limit = PLAN_LIMITS[planId] ?? 0;
  if (limit === 0) {
    return { used: 0, limit: 0, remaining: 0, canAnalyze: false, percentUsed: 100 };
  }
  const data = getUsageData();
  const used = data.count;
  const remaining = Math.max(0, limit - used);
  return {
    used,
    limit,
    remaining,
    canAnalyze: remaining > 0,
    percentUsed: Math.round((used / limit) * 100),
  };
}

export function incrementUsage(planId: string): void {
  const data = getUsageData();
  data.count += 1;
  data.plan = planId;
  saveUsageData(data);
}

export function resetUsage(): void {
  localStorage.removeItem(STORAGE_KEY);
}
