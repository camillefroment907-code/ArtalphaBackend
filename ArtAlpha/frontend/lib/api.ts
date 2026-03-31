import axios from "axios";
import Cookies from "js-cookie";

// In the browser, use relative URLs so requests go through the Next.js proxy (next.config.js rewrites).
// On the server (SSR), use the direct backend URL.
const getBaseURL = () => {
  if (typeof window !== "undefined") return "";   // browser → use rewrites proxy
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
};

export const api = axios.create({
  baseURL: getBaseURL(),
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = Cookies.get("hono_token") || (typeof window !== "undefined" && localStorage.getItem("hono_token"));
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      Cookies.remove("hono_token");
      if (typeof window !== "undefined") {
        localStorage.removeItem("hono_token");
        window.location.href = "/auth/login";
      }
    }
    return Promise.reject(err);
  }
);

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Artist {
  id: string;
  name: string;
  nationality?: string;
  birth_year?: number;
  death_year?: number;
  movement?: string;
  popularity_score: number;
  avg_auction_price?: number;
  liquidity_score: number;
  trend: "up" | "stable" | "down";
  sell_through_rate: number;
  total_lots_sold: number;
  biography_fr?: string;
  portrait_url?: string;
  wikipedia_url?: string;
}

export interface ScoreBreakdown {
  below_estimate_score: number;
  below_market_score: number;
  liquidity_score: number;
  house_reputation_score: number;
  confidence_score: number;
  pct_below_low_estimate?: number;
  pct_below_market_avg?: number;
  rationale?: string[];
  ai_insight?: string;
}

export interface Lot {
  id: string;
  external_id?: string;
  source: "drouot" | "interencheres" | "invaluable" | "christies" | "sothebys" | "bonhams" | "other";
  title: string;
  description?: string;
  lot_number?: string;
  category?: string;
  medium?: string;
  dimensions?: string;
  artist_name_raw?: string;
  artist?: Artist;
  estimate_low?: number;
  estimate_high?: number;
  current_price?: number;
  currency: string;
  auction_date?: string;
  auction_house_name?: string;
  auction_sale_title?: string;
  status: "upcoming" | "live" | "sold" | "unsold" | "withdrawn";
  deal_score?: number;
  pct_below_low_estimate?: number;
  pct_below_market_avg?: number;
  score_breakdown?: ScoreBreakdown;
  is_deal: boolean;
  url?: string;
  image_url?: string;
  created_at: string;
  rationale?: string[];
  ai_insight?: string;
  time_left_hours?: number;
  fomo_level?: "critical" | "high" | "medium" | "low";
}

export interface LotListResponse {
  items: Lot[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface TopDeal {
  lot: Lot;
  rank: number;
  estimated_saving_eur?: number;
  estimated_saving_pct?: number;
}

export interface DashboardStats {
  total_lots_tracked: number;
  deals_detected_today: number;
  avg_deal_score: number;
  top_deal_score: number;
  alerts_sent_today: number;
  sources_active: number;
}

export interface Alert {
  id: string;
  channel: "telegram" | "email" | "both";
  recipient: string;
  message: string;
  deal_score_at_send?: number;
  sent_at: string;
  is_delivered: boolean;
  lot?: Lot;
}

export interface Preferences {
  id: string;
  favorite_artists: string[];
  categories: string[];
  budget_max?: number;
  min_deal_score: number;
  alert_channel: "telegram" | "email" | "both";
  telegram_chat_id?: string;
  alert_email?: string;
  auction_houses: string[];
  is_alerts_enabled: boolean;
}

export interface HotDeal {
  id: string;
  title: string;
  artist?: string;
  source?: string;
  deal_score: number;
  deal_class: "FIRE" | "HOT" | "GOOD";
  current_price?: number;
  estimate_low?: number;
  estimate_high?: number;
  pct_below_estimate?: number;
  pct_below_market?: number;
  currency: string;
  auction_date?: string;
  auction_house?: string;
  url?: string;
  image_url?: string;
  category?: string;
}

// ── API Functions ─────────────────────────────────────────────────────────────

export const lotsApi = {
  list: (params?: Record<string, unknown>) => api.get<LotListResponse>("/api/lots", { params }),
  get: (id: string) => api.get<Lot>(`/api/lots/${id}`),
  topDeals: (limit = 10) => api.get<TopDeal[]>("/api/lots/top-deals", { params: { limit } }),
  hotDeals: (limit = 30, minScore = 70) => api.get<HotDeal[]>("/api/lots/hot-deals", { params: { limit, min_score: minScore } }),
  stats: () => api.get<DashboardStats>("/api/lots/stats"),
  categories: () => api.get<string[]>("/api/lots/categories"),
  trending: (params?: Record<string, unknown>) => api.get<LotListResponse>("/api/lots/trending", { params }),
  missed: (params?: Record<string, unknown>) => api.get<LotListResponse>("/api/lots/missed", { params }),
  comparables: (id: string) => api.get<Lot[]>(`/api/lots/${id}/comparables`),
  similar: (id: string) => api.get<Lot[]>(`/api/lots/${id}/similar`),
};

export const wishlistApi = {
  ids: () => api.get<string[]>("/api/wishlist/ids"),
  list: () => api.get<Lot[]>("/api/wishlist"),
  add: (id: string) => api.post(`/api/wishlist/${id}`),
  remove: (id: string) => api.delete(`/api/wishlist/${id}`),
};

export const alertsApi = {
  list: (params?: Record<string, unknown>) => api.get("/api/alerts", { params }),
  delete: (id: string) => api.delete(`/api/alerts/${id}`),
};

export const prefsApi = {
  get: () => api.get<Preferences>("/api/preferences"),
  update: (data: Partial<Preferences>) => api.patch<Preferences>("/api/preferences", data),
};

export const artistsApi = {
  list: (params?: Record<string, unknown>) => api.get<Artist[]>("/api/artists", { params }),
  get: (id: string) => api.get<Artist>(`/api/artists/${id}`),
};

export const authApi = {
  login: (email: string, password: string) =>
    api.post("/api/auth/login", { email, password }),
  register: (email: string, password: string, full_name?: string) =>
    api.post("/api/auth/register", { email, password, full_name }),
  me: () => api.get("/api/auth/me"),
};

export interface BillingPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: string | null;
  features: string[];
  deal_limit: number | null;
  stripe_price_id: string | null;
}

export interface SubscriptionStatus {
  plan: "free" | "pro" | "expert";
  status: string;
  current_period_end: string | null;
}

export const billingApi = {
  plans: () => api.get<BillingPlan[]>("/api/billing/plans"),
  createCheckout: (plan_id: string) =>
    api.post<{ url: string }>("/api/billing/checkout", {
      plan_id,
      success_url: `${typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}/billing/success`,
      cancel_url: `${typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}/pricing`,
    }),
  createPortal: () => api.post<{ url: string }>("/api/billing/portal"),
  getSubscription: () => api.get<SubscriptionStatus>("/api/billing/subscription"),
};

export const portfolioApi = {
  list: () => api.get("/api/portfolio"),
  get: (id: string) => api.get(`/api/portfolio/${id}`),
  add: (data: {
    title: string;
    artist_name?: string;
    medium?: string;
    dimensions?: string;
    purchase_price_eur: number;
    purchase_date?: string;
    purchase_source?: string;
    notes?: string;
    lot_id?: string;
    image_url?: string;
  }) => api.post("/api/portfolio", data),
  update: (id: string, data: Partial<{
    title: string;
    artist_name: string;
    notes: string;
    is_for_sale: boolean;
    asking_price_eur: number;
    purchase_source: string;
    estimated_current_value_eur: number;
  }>) => api.patch(`/api/portfolio/${id}`, data),
  remove: (id: string) => api.delete(`/api/portfolio/${id}`),
};
