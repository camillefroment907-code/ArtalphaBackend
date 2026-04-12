// Use Vite proxy for dev (empty string), direct Railway URL for prod
const API = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';

// --------------- helpers ---------------

function getStoredToken(): string | null {
  try {
    const raw = localStorage.getItem("artalpha_auth");
    return raw ? JSON.parse(raw)?.token ?? null : null;
  } catch {
    return null;
  }
}

// --------------- auth ---------------

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user_id: string;
  email: string;
  name?: string;
  plan?: "free" | "starter" | "investor" | "pro" | "elite";
}

export async function loginApi(email: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Login failed (${res.status})`);
  }
  return res.json();
}

export async function registerApi(email: string, password: string, name?: string): Promise<LoginResponse> {
  const res = await fetch(`${API}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Registration failed (${res.status})`);
  }
  return res.json();
}

// --------------- billing ---------------

export async function getSubscription(_token?: string): Promise<{
  plan: string;
  status: string;
  billing_interval?: string;
  current_period_end?: string;
  cancel_at_period_end?: boolean;
  trial_end?: string;
  limits?: Record<string, any>;
}> {
  try {
    const token = _token || getStoredToken();
    if (!token) return { plan: "free", status: "active" };
    const res = await fetch(`${API}/api/billing/subscription`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { plan: "free", status: "active" };
    return res.json();
  } catch {
    return { plan: "free", status: "active" };
  }
}

export async function createCheckoutSession(priceKey: string): Promise<{
  checkout_url?: string;
  url?: string;
  error?: string;
  detail?: string;
}> {
  try {
    const token = getStoredToken();
    if (!token) return { error: "not_authenticated" };
    const res = await fetch(`${API}/api/billing/create-checkout-session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ price_key: priceKey }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: err.detail || err.message || `HTTP ${res.status}` };
    }
    return res.json();
  } catch (e: any) {
    return { error: e.message || "Network error" };
  }
}

export async function cancelSubscription(): Promise<{ success: boolean; message: string }> {
  try {
    const token = getStoredToken();
    const res = await fetch(`${API}/api/billing/cancel-subscription`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token ?? ""}` },
    });
    return res.json();
  } catch {
    return { success: false, message: "Network error" };
  }
}

export async function createPortalSession(): Promise<{ url?: string; error?: string }> {
  try {
    const token = getStoredToken();
    const res = await fetch(`${API}/api/billing/create-portal-session`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token ?? ""}` },
    });
    return res.json();
  } catch {
    return { error: "Network error" };
  }
}

export async function sendContactForm(data: {
  name: string;
  email: string;
  company: string;
  message: string;
  plan: string;
}): Promise<{ success: boolean }> {
  try {
    const res = await fetch(`${API}/api/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return { success: res.ok };
  } catch {
    return { success: false };
  }
}

// --------------- lots ---------------

function formatPrice(value: number, currency = "EUR"): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export async function fetchLots(params: {
  page?: number;
  page_size?: number;
  sort_by?: string;
  sort_dir?: string;
  is_deal?: boolean;
  category?: string;
  search?: string;
  source?: string;
  min_score?: number;
  auction_date_from?: string;
  auction_date_to?: string;
  [key: string]: any;
} = {}) {
  const qs = new URLSearchParams();
  qs.set("page", String(params.page || 1));
  qs.set("page_size", String(params.page_size || 24));
  qs.set("sort_by", params.sort_by || "deal_score");
  qs.set("sort_dir", params.sort_dir || "desc");
  if (params.is_deal) qs.set("is_deal", "true");
  if (params.category) qs.set("category", params.category);
  if (params.search) qs.set("search", params.search);
  if (params.source) qs.set("source", params.source);
  if (params.min_score) qs.set("min_score", String(params.min_score));
  if (params.auction_date_from) qs.set("auction_date_from", params.auction_date_from);
  if (params.auction_date_to) qs.set("auction_date_to", params.auction_date_to);

  const res = await fetch(`${API}/api/lots?${qs.toString()}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const d = await res.json();
  return {
    items: Array.isArray(d) ? d : (d.items || []),
    total: Array.isArray(d) ? d.length : (d.total || 0),
    pages: d.pages || 1,
  };
}

export async function fetchLot(id: string) {
  const res = await fetch(`${API}/api/lots/${id}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Maps an Nautilus API lot to the Artwork shape expected by Figma components
export function mapLotToArtwork(lot: any) {
  const price = lot.current_price || lot.estimate_low || 0;
  const estimate = lot.estimate_high || lot.estimate_low || price;
  const upside = lot.pct_below_low_estimate || 0;
  const score = lot.deal_score ? Math.min(5, Math.max(1, Math.round((lot.deal_score / 100) * 5))) : 0;
  const currency = lot.currency || "EUR";

  return {
    id: String(lot.id),
    imageUrl: lot.image_url || "",
    artistName: lot.artist_name_raw?.trim() || "Unknown Artist",
    title: lot.title || "",
    price: price ? formatPrice(price, currency) : "Prix sur demande",
    estimatedValue: estimate ? formatPrice(estimate, currency) : "",
    upside: upside > 0 ? `${Math.round(upside)}%` : "0%",
    score,
    technique: lot.medium || lot.category || "",
    dimensions: lot.dimensions || "",
    platform: lot.auction_house_name?.split("—")[0].trim() || lot.source || "",
    rationale: lot.description || lot.catalogue_description || "",
    pricePerCm2: "",
    comparables: [] as Array<{ title: string; price: string; date: string }>,
  };
}
