// services/api.ts — Typed endpoint layer over lib/api
// All API calls go through here. lib/api handles auth headers + error parsing.

import { api } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  plan: 'free' | 'starter' | 'investor' | 'pro';
  token: string;
  is_verified?: boolean;
}

export interface PortfolioItem {
  id: string;
  title?: string;
  artist_name?: string;
  artist_id?: string | null;
  medium?: string;
  year?: number | null;
  dimensions?: string | null;
  estimated_current_value_eur?: number | null;
  purchase_price_eur?: number | null;
  purchase_date?: string | null;
  document_urls?: string[];
  image_url?: string | null;
  notes?: string | null;
}

export interface ArtistProfile {
  id: string;
  name: string;
  nationality?: string;
  birth_year?: number | null;
  death_year?: number | null;
  bio?: string | null;
  image_url?: string | null;
  tier?: string | null;
  // Stats
  total_lots?: number;
  sold_lots?: number;
  sell_through_rate?: number | null;
  median_price_eur?: number | null;
  min_price_eur?: number | null;
  max_price_eur?: number | null;
  last_auction_date?: string | null;
}

export interface ArtistScore {
  artist_id: string;
  composite_score?: number | null;
  liquidity_score?: number | null;
  momentum_score?: number | null;
  market_depth_score?: number | null;
  consistency_score?: number | null;
  tier?: string | null;
}

export interface AuctionLot {
  id: string;
  title?: string;
  artist_name?: string;
  artist_id?: string | null;
  auction_house?: string;
  auction_date?: string | null;
  estimate_low_eur?: number | null;
  estimate_high_eur?: number | null;
  price_result_eur?: number | null;
  lot_performance?: 'sold' | 'unsold' | 'withdrawn' | null;
  currency?: string;
  source?: string;
  image_url?: string | null;
  medium?: string | null;
  dimensions?: string | null;
  provenance?: string | null;
}

export interface Alert {
  id: string;
  type: string;
  title: string;
  body: string;
  source_url?: string;
  created_at?: string;
  is_read?: boolean;
  artist_id?: string | null;
  artist_name?: string | null;
}

export interface ValuationResult {
  estimated_value_eur: number | null;
  confidence?: 'high' | 'medium' | 'low' | null;
  methodology?: string | null;
  comparables_count?: number | null;
  last_updated?: string | null;
}

export interface PricePoint {
  date: string;
  price_eur: number;
  auction_house?: string;
  lot_id?: string;
}

export interface MarketOpportunity {
  artist_id: string;
  artist_name: string;
  reason: string;
  score?: number;
  recent_lot?: AuctionLot;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const authService = {
  login: (email: string, password: string) =>
    api.post<AuthUser>('/api/auth/login', { email, password }),

  register: (email: string, password: string, name: string) =>
    api.post<AuthUser>('/api/auth/register', { email, password, name }),

  me: () => api.get<AuthUser>('/api/auth/me'),
};

// ─── Portfolio ────────────────────────────────────────────────────────────────

export const portfolioService = {
  list: () =>
    api.get<PortfolioItem[]>('/api/portfolio/items'),

  get: (id: string) =>
    api.get<PortfolioItem>(`/api/portfolio/items/${id}`),

  create: (data: Partial<PortfolioItem>) =>
    api.post<PortfolioItem>('/api/portfolio/items', data),

  update: (id: string, data: Partial<PortfolioItem>) =>
    api.patch<PortfolioItem>(`/api/portfolio/items/${id}`, data),

  delete: (id: string) =>
    api.delete<void>(`/api/portfolio/items/${id}`),

  valuation: (id: string) =>
    api.get<ValuationResult>(`/api/portfolio/items/${id}/valuation`),
};

// ─── Artists ──────────────────────────────────────────────────────────────────

export const artistService = {
  get: (id: string) =>
    api.get<ArtistProfile>(`/api/artists/${id}`),

  score: (id: string) =>
    api.get<ArtistScore>(`/api/artists/${id}/score`),

  lots: (id: string, params?: { limit?: number; offset?: number }) => {
    const qs = params ? `?limit=${params.limit ?? 20}&offset=${params.offset ?? 0}` : '';
    return api.get<AuctionLot[]>(`/api/artists/${id}/lots${qs}`);
  },

  priceHistory: (id: string) =>
    api.get<PricePoint[]>(`/api/artists/${id}/price-history`),

  search: (query: string) =>
    api.get<ArtistProfile[]>(`/api/artists/search?q=${encodeURIComponent(query)}`),
};

// ─── Market ───────────────────────────────────────────────────────────────────

export const marketService = {
  opportunities: () =>
    api.get<MarketOpportunity[]>('/api/market/opportunities'),

  recentLots: (params?: { limit?: number; offset?: number }) => {
    const qs = `?limit=${params?.limit ?? 30}&offset=${params?.offset ?? 0}`;
    return api.get<AuctionLot[]>(`/api/market/recent-lots${qs}`);
  },

  lotDetail: (id: string) =>
    api.get<AuctionLot>(`/api/lots/${id}`),
};

// ─── Alerts ───────────────────────────────────────────────────────────────────

export const alertService = {
  list: () =>
    api.get<Alert[]>('/api/alerts'),

  markRead: (id: string) =>
    api.patch<void>(`/api/alerts/${id}/read`, {}),

  markAllRead: () =>
    api.post<void>('/api/alerts/read-all', {}),
};

// ─── Larry (AI advisor) ───────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  message: string;
  sources?: string[];
}

export const larryService = {
  chat: (messages: ChatMessage[], context?: { portfolio_summary?: string }) =>
    api.post<ChatResponse>('/api/larry/chat', { messages, context }),
};
