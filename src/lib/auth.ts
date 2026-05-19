const AUTH_KEY = 'artalpha_auth';

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  plan: 'free' | 'starter' | 'investor' | 'pro' | 'elite' | 'institutional';
  token: string;
  is_verified?: boolean;
}

export interface PlanLimits {
  name: string;
  maxOpportunities: number;
  maxWatchlist: number;
  hasFullAnalysis: boolean;
  hasAlerts: boolean;
  hasPortfolio: boolean;
  hasMarketData: boolean;
  // Investment intelligence gates
  hasArtistCotation: boolean;
  hasProjections: boolean;
  hasProvenance: boolean;
  hasAIVerdict: boolean;
  hasMarketTiming: boolean;
  hasComparables: boolean;
  hasFullArtistProfile: boolean;
  projectionYears: number[];
}

export const PLAN_LIMITS: Record<string, PlanLimits> = {
  free: {
    name: 'Free',
    maxOpportunities: 3,
    maxWatchlist: 0,
    hasFullAnalysis: false,
    hasAlerts: false,
    hasPortfolio: false,
    hasMarketData: false,
    hasArtistCotation: false,
    hasProjections: false,
    hasProvenance: false,
    hasAIVerdict: false,
    hasMarketTiming: false,
    hasComparables: false,
    hasFullArtistProfile: false,
    projectionYears: [],
  },
  starter: {
    name: 'Collector',
    maxOpportunities: 10,
    maxWatchlist: 5,
    hasFullAnalysis: false,
    hasAlerts: false,
    hasPortfolio: true,
    hasMarketData: false,
    hasArtistCotation: true,
    hasProjections: true,
    hasProvenance: false,
    hasAIVerdict: false,
    hasMarketTiming: false,
    hasComparables: false,
    hasFullArtistProfile: false,
    projectionYears: [5],
  },
  investor: {
    name: 'Investor',
    maxOpportunities: 9999,
    maxWatchlist: 20,
    hasFullAnalysis: true,
    hasAlerts: true,
    hasPortfolio: true,
    hasMarketData: true,
    hasArtistCotation: true,
    hasProjections: true,
    hasProvenance: true,
    hasAIVerdict: true,
    hasMarketTiming: true,
    hasComparables: true,
    hasFullArtistProfile: false,
    projectionYears: [5, 10, 20],
  },
  pro: {
    name: 'Family Office',
    maxOpportunities: 9999,
    maxWatchlist: 9999,
    hasFullAnalysis: true,
    hasAlerts: true,
    hasPortfolio: true,
    hasMarketData: true,
    hasArtistCotation: true,
    hasProjections: true,
    hasProvenance: true,
    hasAIVerdict: true,
    hasMarketTiming: true,
    hasComparables: true,
    hasFullArtistProfile: true,
    projectionYears: [5, 10, 20, 50],
  },
  elite: {
    name: 'Institutional',
    maxOpportunities: 9999,
    maxWatchlist: 9999,
    hasFullAnalysis: true,
    hasAlerts: true,
    hasPortfolio: true,
    hasMarketData: true,
    hasArtistCotation: true,
    hasProjections: true,
    hasProvenance: true,
    hasAIVerdict: true,
    hasMarketTiming: true,
    hasComparables: true,
    hasFullArtistProfile: true,
    projectionYears: [5, 10, 20, 50],
  },
  institutional: {
    name: 'Institutional',
    maxOpportunities: 9999,
    maxWatchlist: 9999,
    hasFullAnalysis: true,
    hasAlerts: true,
    hasPortfolio: true,
    hasMarketData: true,
    hasArtistCotation: true,
    hasProjections: true,
    hasProvenance: true,
    hasAIVerdict: true,
    hasMarketTiming: true,
    hasComparables: true,
    hasFullArtistProfile: true,
    projectionYears: [5, 10, 20, 50],
  },
};

export function getUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setUser(user: AuthUser): void {
  localStorage.setItem(AUTH_KEY, JSON.stringify(user));
  window.dispatchEvent(new Event('auth-change'));
}

export function logout(): void {
  localStorage.removeItem(AUTH_KEY);
  window.dispatchEvent(new Event('auth-change'));
}

export function getToken(): string | null {
  return getUser()?.token ?? null;
}

export function isAuthenticated(): boolean {
  return getUser() !== null;
}

export function getUserPlan(): string {
  try {
    const raw = localStorage.getItem('artalpha_auth');
    if (!raw) return 'free';
    const user = JSON.parse(raw);
    return user.plan || 'free';
  } catch {
    return 'free';
  }
}

export function getPlanLimits(): PlanLimits {
  const plan = getUserPlan();
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
}

export function getFreeLimit(): number {
  return getPlanLimits().maxOpportunities;
}

export function canAccessFeature(feature: keyof Omit<PlanLimits, 'projectionYears' | 'name' | 'maxOpportunities' | 'maxWatchlist'>): boolean {
  return !!getPlanLimits()[feature];
}
