import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { getUser } from "../../lib/auth";
import { WelcomeTour } from "../components/WelcomeTour";

type ExploreTab = "best" | "auctions" | "primary" | "convictions";
type ViewMode = "grid4" | "grid6" | "list";

// ── Source metadata ──────────────────────────────────────────
const SOURCE_FLAG: Record<string, string> = {
  drouot: "🇫🇷", interencheres: "🇫🇷", artcurial: "🇫🇷", artsper: "🇫🇷", singulart: "🇫🇷",
  invaluable: "🇺🇸", liveauctioneers: "🇺🇸", phillips: "🇺🇸",
  sothebys: "🇬🇧", christies: "🇬🇧", bonhams: "🇬🇧", saatchi_art: "🇬🇧",
  artsy: "🌐", catawiki: "🇳🇱", other: "🌐",
};
const SOURCE_LABEL: Record<string, string> = {
  drouot: "Drouot", interencheres: "Interenchères", artcurial: "Artcurial",
  artsper: "Artsper", singulart: "Singulart", invaluable: "Invaluable",
  liveauctioneers: "LiveAuctioneers", phillips: "Phillips",
  sothebys: "Sotheby's", christies: "Christie's", bonhams: "Bonhams",
  saatchi_art: "Saatchi Art", artsy: "Artsy", catawiki: "Catawiki", other: "Other",
};

const LIVE_SORT_MAP: Record<string, { by: string; dir: string }> = {
  "auction_date_asc":  { by: "auction_date",  dir: "asc"  },
  "estimate_asc":      { by: "current_price", dir: "asc"  },
  "estimate_desc":     { by: "current_price", dir: "desc" },
  "created_at_desc":   { by: "created_at",    dir: "desc" },
};
const ALPHA_SORT_MAP: Record<string, { by: string; dir: string }> = {
  "deal_score_desc":   { by: "deal_score",    dir: "desc" },
  "upside_desc":       { by: "deal_score",    dir: "desc" },
  "auction_date_asc":  { by: "auction_date",  dir: "asc"  },
  "price_asc":         { by: "current_price", dir: "asc"  },
  "created_at_desc":   { by: "created_at",    dir: "desc" },
};
const PLATFORM_API: Record<string, string> = {
  "Drouot": "drouot", "Interenchères": "interencheres",
  "Invaluable": "invaluable", "Sothebys": "sothebys",
  "Christies": "christies", "Bonhams": "bonhams",
  "Christie's": "christies", "Sotheby's": "sothebys",
};

interface SourceStat {
  source: string; lot_count: number;
  last_added: string | null; age_minutes: number | null;
  status: "fresh" | "stale" | "offline";
}

const BACKEND = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';

function getToken(): string {
  try {
    const raw = localStorage.getItem("artalpha_auth");
    return raw ? (JSON.parse(raw)?.token ?? "") : "";
  } catch { return ""; }
}

const _cache: Record<string, { data: any; ts: number }> = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function cachedFetch(url: string, options?: RequestInit): Promise<any> {
  const now = Date.now();
  if (_cache[url] && now - _cache[url].ts < CACHE_TTL) {
    return _cache[url].data;
  }
  const resp = await fetch(url, options);
  const data = await resp.json();
  _cache[url] = { data, ts: now };
  return data;
}

async function fetchLotsFromAPI(params: Record<string, any>) {
  const qs = new URLSearchParams();
  qs.set("page", String(params.page || 1));
  qs.set("page_size", String(params.page_size || 24));
  qs.set("sort_by", params.sort_by || "deal_score");
  qs.set("sort_dir", params.sort_dir || "desc");
  if (params.search)             qs.set("search", params.search);
  if (params.source)             qs.set("source", params.source);
  if (params.sources)            qs.set("sources", params.sources);
  if (params.min_score)          qs.set("min_score", String(params.min_score));
  if (params.is_deal)            qs.set("is_deal", "true");
  if (params.auction_date_from)  qs.set("auction_date_from", params.auction_date_from);
  if (params.auction_date_to)    qs.set("auction_date_to", params.auction_date_to);
  if (params.min_price)          qs.set("min_price", String(params.min_price));
  if (params.max_price)          qs.set("max_price", String(params.max_price));
  if (params.artist)             qs.set("artist", params.artist);
  if (params.category)           qs.set("category", params.category);
  if (params.medium)             qs.set("medium", params.medium);
  if (params.auction_house)      qs.set("auction_house", params.auction_house);
  if (params.artist_tier)        qs.set("artist_tier", params.artist_tier);
  if (params.size_category)      qs.set("size_category", params.size_category);
  if (params.min_upside)         qs.set("min_upside", String(params.min_upside));
  const url = `${BACKEND}/api/lots?${qs.toString()}`;
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const d = await cachedFetch(url, { headers });
  const items = Array.isArray(d) ? d : (d.items || []);
  return { items, total: d.total || items.length, pages: d.pages || 1 };
}

async function fetchInvestorLots(budgetMin?: number, budgetMax?: number | null, horizon?: string) {
  const qs = new URLSearchParams();
  if (budgetMin != null && budgetMin > 0) qs.set("budget_min", String(budgetMin));
  if (budgetMax != null) qs.set("budget_max", String(budgetMax));
  if (horizon) qs.set("horizon", horizon);
  qs.set("limit", "12");
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const d = await cachedFetch(`${BACKEND}/api/lots/for-investor?${qs}`, { headers });
  return { items: d.items || [], total: d.total || 0, pages: 1 };
}

async function loadSourceStats(): Promise<SourceStat[]> {
  try {
    return await cachedFetch(`${BACKEND}/api/lots/sources`);
  } catch { return []; }
}

function getDateParams(filter: string): Record<string, string> {
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  if (filter === "today") return { auction_date_from: today, auction_date_to: today };
  if (filter === "3days") { const d = new Date(now); d.setDate(d.getDate() + 3); return { auction_date_from: today, auction_date_to: d.toISOString().split("T")[0] }; }
  if (filter === "week")  { const d = new Date(now); d.setDate(d.getDate() + 7); return { auction_date_from: today, auction_date_to: d.toISOString().split("T")[0] }; }
  if (filter === "month") { const d = new Date(now); d.setMonth(d.getMonth() + 1); return { auction_date_from: today, auction_date_to: d.toISOString().split("T")[0] }; }
  return {};
}

function mapLot(lot: any) {
  const price = lot.current_price || lot.estimate_low || 0;
  const estimateLow  = lot.estimate_low  || 0;
  const estimateHigh = lot.estimate_high || 0;
  const estimate = estimateHigh || estimateLow || price;
  const score = lot.deal_score ? Math.min(Math.round((lot.deal_score / 100) * 5), 5) : 0;
  const upside = Math.round(lot.pct_below_low_estimate || 0);
  const currency = lot.currency || "EUR";
  const fmt = (v: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
  return {
    id: String(lot.id), artistName: lot.artist_name_raw?.trim() || "Unknown Artist",
    title: lot.title || "Untitled", price: price ? fmt(price) : "Prix sur demande",
    estimatedValue: estimate ? fmt(estimate) : "",
    estimateLow, estimateHigh,
    estimateLowFmt: estimateLow ? fmt(estimateLow) : "",
    estimateHighFmt: estimateHigh ? fmt(estimateHigh) : "",
    upside: upside > 0 ? `${upside}%` : "0%", score, dealScore: lot.deal_score || 0,
    imageUrl: lot.image_url || "", technique: lot.medium || lot.category || "",
    category: lot.category || "",
    platform: lot.auction_house_name?.split("—")[0].trim() || lot.source || "",
    rawPrice: price, auctionDate: lot.auction_date || "",
    upsidePercent: upside, source: lot.source || "",
  };
}
type MappedLot = ReturnType<typeof mapLot>;

// ── Skeleton ─────────────────────────────────────────────────
function AlphaSkeleton() {
  return (
    <div style={{ borderRadius: "10px", overflow: "hidden", border: "1px solid var(--border)" }}>
      <div className="skeleton" style={{ paddingTop: "133%", position: "relative" }} />
      <div style={{ padding: "12px" }}>
        <div className="skeleton" style={{ height: "10px", width: "60%", borderRadius: "4px", marginBottom: "8px" }} />
        <div className="skeleton" style={{ height: "14px", width: "90%", borderRadius: "4px", marginBottom: "8px" }} />
        <div className="skeleton" style={{ height: "18px", width: "40%", borderRadius: "4px" }} />
      </div>
    </div>
  );
}
function LiveSkeleton() {
  return (
    <div style={{ borderRadius: "8px", overflow: "hidden", border: "1px solid var(--border)" }}>
      <div className="skeleton" style={{ paddingTop: "65%", position: "relative" }} />
      <div style={{ padding: "10px" }}>
        <div className="skeleton" style={{ height: "12px", width: "80%", borderRadius: "3px", marginBottom: "6px" }} />
        <div className="skeleton" style={{ height: "14px", width: "50%", borderRadius: "3px" }} />
      </div>
    </div>
  );
}

// ── AlphaCard ────────────────────────────────────────────────
function AlphaCard({ lot, onClick, locked }: { lot: MappedLot; onClick: () => void; locked: boolean }) {
  const ds = lot.dealScore;
  const tier      = ds >= 80 ? "EXCEPTIONAL" : ds >= 65 ? "STRONG" : "INTERESTING";
  const tierColor = tier === "EXCEPTIONAL" ? "#C0392B" : tier === "STRONG" ? "var(--navy)" : "var(--gold-dim)";
  const tierBg    = tier === "EXCEPTIONAL" ? "rgba(192,57,43,0.08)" : tier === "STRONG" ? "rgba(26,42,68,0.08)" : "rgba(198,168,90,0.06)";
  return (
    <div
      onClick={locked ? undefined : onClick}
      onMouseEnter={e => { if (locked) return; const el = e.currentTarget as HTMLDivElement; el.style.transform = "translateY(-4px)"; el.style.boxShadow = "0 12px 40px rgba(0,0,0,0.1)"; const img = el.querySelector("img") as HTMLImageElement | null; if (img) img.style.transform = "scale(1.05)"; }}
      onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.transform = "translateY(0)"; el.style.boxShadow = "none"; el.style.borderColor = "var(--border)"; const img = el.querySelector("img") as HTMLImageElement | null; if (img) img.style.transform = "scale(1)"; }}
      style={{ background: "white", border: "1px solid var(--border)", borderRadius: "10px", overflow: "hidden", cursor: locked ? "default" : "pointer", transition: "transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease" }}
    >
      <div style={{ position: "relative", paddingTop: "75%", background: "var(--bg-subtle)", overflow: "hidden" }}>
        {lot.imageUrl ? <img src={lot.imageUrl} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top", transition: "transform 0.5s ease" }} loading="lazy" decoding="async" /> : <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontFamily: "var(--font-serif)", fontSize: "22px", color: "var(--border)" }}>◇</span></div>}
        <div style={{ position: "absolute", top: "10px", left: "10px", padding: "4px 10px", background: tierBg, border: `1px solid ${tierColor}40`, borderRadius: "4px" }}><span style={{ fontSize: "10px", fontWeight: 800, color: tierColor, letterSpacing: "0.1em" }}>{tier}</span></div>
        <div style={{ position: "absolute", top: "10px", right: "10px", padding: "4px 8px", background: "rgba(250,250,248,0.92)", backdropFilter: "blur(4px)", borderRadius: "4px", border: "1px solid var(--border)" }}><span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 700, color: "var(--navy)" }}>{Math.round(ds)}</span><span style={{ fontSize: "9px", color: "var(--text-3)" }}>/100</span></div>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "60px", background: "linear-gradient(to top, rgba(250,250,248,0.9), transparent)" }} />
      </div>
      <div style={{ padding: "14px 16px" }}>
        {lot.artistName !== "Unknown Artist" && <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--navy)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lot.artistName}</div>}
        <div style={{ fontFamily: "var(--font-serif)", fontSize: "14px", color: "var(--text)", marginBottom: "10px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lot.title}</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "10px" }}>
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "15px", fontWeight: 700, color: "var(--text)" }}>{lot.price}</div>
            {lot.estimateLow > 0 && <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-3)" }}>est. {lot.estimateLowFmt}</div>}
          </div>
          {lot.upsidePercent > 5 && <div style={{ padding: "3px 8px", background: "rgba(26,42,68,0.08)", border: "1px solid rgba(26,42,68,0.15)", borderRadius: "4px" }}><span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 700, color: "var(--navy)" }}>+{lot.upsidePercent}% upside</span></div>}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "10px", borderTop: "1px solid var(--border-light)" }}>
          <span style={{ fontSize: "11px", color: "var(--text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "140px" }}>{lot.platform}</span>
          {lot.auctionDate && <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-3)", flexShrink: 0 }}>{new Date(lot.auctionDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>}
        </div>
      </div>
    </div>
  );
}

// ── LiveCard ─────────────────────────────────────────────────
function LiveCard({ lot, onClick }: { lot: MappedLot; onClick: () => void }) {
  const src  = (lot.source || "").toLowerCase();
  const flag = SOURCE_FLAG[src] || "🌐";
  return (
    <div onClick={onClick} onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.transform = "translateY(-4px)"; el.style.boxShadow = "0 12px 40px rgba(0,0,0,0.1)"; const img = el.querySelector("img") as HTMLImageElement | null; if (img) img.style.transform = "scale(1.05)"; }} onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.transform = "translateY(0)"; el.style.boxShadow = "none"; el.style.borderColor = "var(--border)"; const img = el.querySelector("img") as HTMLImageElement | null; if (img) img.style.transform = "scale(1)"; }} style={{ background: "white", borderRadius: "8px", overflow: "hidden", cursor: "pointer", border: "1px solid var(--border)", transition: "transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease" }}>
      <div style={{ position: "relative", paddingTop: "65%", background: "var(--bg-subtle)", overflow: "hidden" }}>
        {lot.imageUrl ? <img src={lot.imageUrl} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top", transition: "transform 0.4s ease" }} loading="lazy" decoding="async" /> : <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontFamily: "var(--font-serif)", fontSize: "18px", color: "var(--border)" }}>◇</span></div>}
        <div style={{ position: "absolute", top: "8px", left: "8px", padding: "2px 7px", background: "rgba(250,250,248,0.92)", backdropFilter: "blur(4px)", borderRadius: "3px", border: "1px solid var(--border)", fontSize: "11px", display: "flex", alignItems: "center", gap: "4px" }}><span>{flag}</span><span style={{ color: "var(--text-2)", fontSize: "10px" }}>{SOURCE_LABEL[src] || lot.source}</span></div>
        {lot.auctionDate && <div style={{ position: "absolute", bottom: "7px", right: "7px", background: "var(--navy)", color: "white", padding: "2px 7px", borderRadius: "3px", fontSize: "10px", fontWeight: 700 }}>{new Date(lot.auctionDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</div>}
        {lot.category && <div style={{ position: "absolute", bottom: "7px", left: "8px", background: "rgba(250,250,248,0.88)", backdropFilter: "blur(3px)", padding: "2px 6px", borderRadius: "3px", fontSize: "9px", fontWeight: 600, color: "var(--text-2)", border: "1px solid rgba(0,0,0,0.08)" }}>{lot.category}</div>}
      </div>
      <div style={{ padding: "10px 12px" }}>
        {lot.artistName !== "Unknown Artist" && <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-2)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lot.artistName}</div>}
        <div style={{ fontSize: "12px", color: "var(--text)", marginBottom: "6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lot.title}</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "13px", fontWeight: 600, color: "var(--text)" }}>{lot.price}</span>
          {lot.estimateLow > 0 && <span style={{ fontSize: "10px", color: "var(--text-3)", fontFamily: "var(--font-mono)" }}>est. {lot.estimateLowFmt}</span>}
        </div>
      </div>
    </div>
  );
}

// ── LiveListRow ───────────────────────────────────────────────
function LiveListRow({ lot, onClick }: { lot: MappedLot; onClick: () => void }) {
  const src  = (lot.source || "").toLowerCase();
  const flag = SOURCE_FLAG[src] || "🌐";
  return (
    <div onClick={onClick} style={{ display: "grid", gridTemplateColumns: "48px 1fr 160px 100px 130px 80px", gap: "12px", padding: "10px 16px", borderBottom: "1px solid var(--border-light)", cursor: "pointer", transition: "background 0.1s", alignItems: "center" }} onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = "var(--bg-subtle)"; }} onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "white"; }}>
      <div style={{ width: "44px", height: "44px", borderRadius: "4px", overflow: "hidden", background: "var(--bg-subtle)" }}>{lot.imageUrl && <img src={lot.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--navy)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lot.artistName !== "Unknown Artist" ? lot.artistName : ""}</div>
        <div style={{ fontSize: "12px", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lot.title}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "5px", minWidth: 0 }}><span style={{ fontSize: "13px", flexShrink: 0 }}>{flag}</span><span style={{ fontSize: "11px", color: "var(--text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{SOURCE_LABEL[src] || lot.source}</span></div>
      <div style={{ fontSize: "11px", color: "var(--text-2)" }}>{lot.auctionDate ? new Date(lot.auctionDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "2-digit" }) : "—"}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-2)" }}>{lot.estimateLow > 0 ? (lot.estimateHigh > 0 && lot.estimateHigh !== lot.estimateLow ? `${lot.estimateLowFmt} – ${lot.estimateHighFmt}` : lot.estimateLowFmt) : lot.price}</div>
      <div>{lot.category && <span style={{ fontSize: "9px", fontWeight: 600, color: "var(--text-3)", background: "var(--bg-subtle)", padding: "2px 6px", borderRadius: "3px", border: "1px solid var(--border-light)" }}>{lot.category}</span>}</div>
    </div>
  );
}

// ── Icons ────────────────────────────────────────────────────
function IconGrid4() { return <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor"><rect x="1" y="1" width="5.5" height="5.5" rx="1" /><rect x="8.5" y="1" width="5.5" height="5.5" rx="1" /><rect x="1" y="8.5" width="5.5" height="5.5" rx="1" /><rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1" /></svg>; }
function IconGrid6() { return <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor"><rect x="1" y="1" width="3.5" height="3.5" rx="0.5" /><rect x="5.75" y="1" width="3.5" height="3.5" rx="0.5" /><rect x="10.5" y="1" width="3.5" height="3.5" rx="0.5" /><rect x="1" y="5.75" width="3.5" height="3.5" rx="0.5" /><rect x="5.75" y="5.75" width="3.5" height="3.5" rx="0.5" /><rect x="10.5" y="5.75" width="3.5" height="3.5" rx="0.5" /><rect x="1" y="10.5" width="3.5" height="3.5" rx="0.5" /><rect x="5.75" y="10.5" width="3.5" height="3.5" rx="0.5" /><rect x="10.5" y="10.5" width="3.5" height="3.5" rx="0.5" /></svg>; }
function IconList() { return <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor"><rect x="1" y="2" width="3.5" height="3" rx="0.5" /><rect x="6" y="2.5" width="8" height="1" rx="0.5" /><rect x="6" y="4" width="5" height="1" rx="0.5" /><rect x="1" y="6" width="3.5" height="3" rx="0.5" /><rect x="6" y="6.5" width="8" height="1" rx="0.5" /><rect x="6" y="8" width="5" height="1" rx="0.5" /><rect x="1" y="10" width="3.5" height="3" rx="0.5" /><rect x="6" y="10.5" width="8" height="1" rx="0.5" /><rect x="6" y="12" width="5" height="1" rx="0.5" /></svg>; }


// ── Explore component ─────────────────────────────────────────
export default function Explore() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const exploreTab = (searchParams.get('tab') || 'best') as ExploreTab;
  const searchFromUrl = searchParams.get('search') || '';

  // Opportunities state
  const [lots, setLots]             = useState<MappedLot[]>([]);
  const [total, setTotal]           = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading]       = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasError, setHasError]     = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [primaryStats, setPrimaryStats] = useState<{ total?: number; avg_score?: number; avg_price?: number; new_this_week?: number } | null>(null);
  const [viewMode, setViewMode]     = useState<ViewMode>("grid4");
  const [dateFilter, setDateFilter] = useState("all");
  const [sourceStats, setSourceStats] = useState<SourceStat[]>([]);

  // ── Filter state ─────────────────────────────────────────────
  const [search, setSearch]           = useState(searchFromUrl);
  const [minScore, setMinScore]       = useState(0);
  const [minUpside, setMinUpside]     = useState('');
  const [minPrice, setMinPrice]       = useState(0);
  const [maxPrice, setMaxPrice]       = useState(0);
  const [category, setCategory]       = useState('');
  const [artistTier, setArtistTier]   = useState('');
  const [auctionHouse, setAuctionHouse] = useState('');
  const [sizeFilter, setSizeFilter]   = useState('');

  const resetFilters = () => {
    setMinScore(0); setMinUpside(''); setMinPrice(0); setMaxPrice(0);
    setCategory(''); setArtistTier(''); setAuctionHouse(''); setSizeFilter('');
    setSearch('');
    setSearchParams(prev => { const p = new URLSearchParams(prev); p.delete('search'); return p; });
  };

  const hasActiveFilters = minScore > 0 || minUpside !== '' || minPrice > 0 || maxPrice > 0 || category !== '' || artistTier !== '' || auctionHouse !== '' || sizeFilter !== '';

  // Sync search from URL (e.g. navigating from header search bar)
  useEffect(() => {
    if (searchFromUrl) setSearch(searchFromUrl);
  }, [searchFromUrl]);

  const [showTour, setShowTour] = useState(false);
  useEffect(() => {
    const shouldShow = localStorage.getItem('nautilus_show_tour') === '1';
    const alreadySeen = localStorage.getItem('nautilus_tour_seen') === 'true';
    if (shouldShow || !alreadySeen) {
      localStorage.removeItem('nautilus_show_tour');
      setShowTour(true);
    }
  }, []);

  const user     = getUser();
  const isAdmin  = user?.email === "camillefroment907@gmail.com";

  const [userPlan, setUserPlan] = useState<string>("free");
  const [planLoading, setPlanLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) { setPlanLoading(false); return; }
    fetch(`${BACKEND}/api/billing/subscription`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        const plan = (data.plan || "free").toLowerCase();
        const status = (data.status || "").toLowerCase();
        setUserPlan(["active", "trialing"].includes(status) && plan !== "free" ? plan : "free");
      })
      .catch(() => setUserPlan("free"))
      .finally(() => setPlanLoading(false));
  }, []);

  const PLAN_LIMITS: Record<string, number> = {
    free: 3, starter: 10, investor: 99999, pro: 99999, institutional: 99999, elite: 99999,
  };
  const visibleLimit = isAdmin ? 99999 : (PLAN_LIMITS[userPlan] ?? 3);
  const maxVisible = visibleLimit;

  // tab alias used throughout JSX: "alpha" = best lots, "live" = all auctions
  const tab = exploreTab === "auctions" ? "live" : "alpha";

  const alphaLots   = tab === "alpha" ? lots.filter(l => l.dealScore >= 45) : lots;
  const EXCEPTIONAL = alphaLots.filter(l => l.dealScore >= 80);
  const STRONG      = alphaLots.filter(l => l.dealScore >= 65 && l.dealScore < 80);
  const INTERESTING = alphaLots.filter(l => l.dealScore >= 45 && l.dealScore < 65);
  const avgScore    = alphaLots.length > 0
    ? alphaLots.reduce((a, l) => a + l.dealScore, 0) / alphaLots.length : 0;
  const visibleLots = tab === "alpha" ? alphaLots.slice(0, maxVisible) : lots.slice(0, maxVisible);
  const lockedLots  = tab === "alpha" ? alphaLots.slice(maxVisible, maxVisible + 3) : [];
  const isLimited   = !isAdmin && visibleLimit < 99999 && (
    tab === "alpha" ? alphaLots.length > maxVisible : lots.length > maxVisible
  );

  // ── New loadLots — closes over all filter state ─────────────
  const loadLots = useCallback(async () => {
    setLoading(true);
    setHasError(false);
    try {
      const params = new URLSearchParams();
      params.set('page_size', '24');
      params.set('page', String(currentPage));

      if (exploreTab === 'best') {
        params.set('sort_by', 'deal_score');
        params.set('sort_dir', 'desc');
        params.set('min_score', String(Math.max(minScore, 60)));
      } else if (exploreTab === 'auctions') {
        params.set('sort_by', 'created_at');
        params.set('sort_dir', 'desc');
      } else if (exploreTab === 'convictions') {
        params.set('min_score', '75');
        params.set('sort_by', 'deal_score');
        params.set('sort_dir', 'desc');
      }

      if (minScore > 0 && exploreTab !== 'best') params.set('min_score', String(minScore));
      if (minPrice > 0)  params.set('min_price', String(minPrice));
      if (maxPrice > 0)  params.set('max_price', String(maxPrice));
      if (category)      params.set('category', category);
      if (auctionHouse)  params.set('auction_house', auctionHouse);
      if (sizeFilter)    params.set('size_category', sizeFilter);
      if (search)        params.set('search', search);
      if (minUpside)     params.set('min_upside', minUpside);
      if (artistTier)    params.set('artist_tier', artistTier);

      const today = new Date().toISOString().split('T')[0];
      if (dateFilter === 'today') {
        params.set('auction_date_from', today);
        params.set('auction_date_to', today);
      } else if (dateFilter === '3days') {
        const d = new Date(); d.setDate(d.getDate() + 3);
        params.set('auction_date_from', today);
        params.set('auction_date_to', d.toISOString().split('T')[0]);
      } else if (dateFilter === 'week') {
        const d = new Date(); d.setDate(d.getDate() + 7);
        params.set('auction_date_from', today);
        params.set('auction_date_to', d.toISOString().split('T')[0]);
      } else if (dateFilter === 'month') {
        const d = new Date(); d.setMonth(d.getMonth() + 1);
        params.set('auction_date_from', today);
        params.set('auction_date_to', d.toISOString().split('T')[0]);
      }

      const token = getToken();
      const resp = await fetch(`${BACKEND}/api/lots?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await resp.json();
      const items = Array.isArray(data) ? data : (data.items || data.lots || []);
      setLots(items.map(mapLot));
      setTotal(data.total || items.length);
      setTotalPages(data.pages || 1);
    } catch (e) {
      console.error('loadLots error', e);
      setHasError(true);
    } finally {
      setLoading(false);
    }
  }, [exploreTab, dateFilter, search, minScore, minUpside, minPrice, maxPrice, category, artistTier, auctionHouse, sizeFilter, currentPage]);

  // Reset page to 1 on any filter/tab change
  useEffect(() => {
    setCurrentPage(1);
  }, [exploreTab, dateFilter, search, minScore, minUpside, minPrice, maxPrice, category, artistTier, auctionHouse, sizeFilter]);

  // Fetch whenever loadLots reference changes (i.e. any dep changes)
  useEffect(() => {
    loadLots();
  }, [loadLots]);

  const doFetch = useCallback(() => { loadLots(); }, [loadLots]);

  const loadMore = useCallback(async () => {
    if (loadingMore || currentPage >= totalPages) return;
    const nextPage = currentPage + 1;
    setLoadingMore(true);
    try {
      const p: Record<string, any> = {
        page: nextPage, page_size: 24,
        sort_by: exploreTab === 'best' ? 'deal_score' : 'created_at',
        sort_dir: 'desc',
        search: search || undefined,
        min_price: minPrice > 0 ? minPrice : undefined,
        max_price: maxPrice > 0 ? maxPrice : undefined,
        category: category || undefined,
        auction_house: auctionHouse || undefined,
        artist_tier: artistTier || undefined,
        size_category: sizeFilter || undefined,
        min_upside: minUpside || undefined,
      };
      if (exploreTab === 'best') p.min_score = Math.max(minScore, 60);
      else if (minScore > 0) p.min_score = minScore;
      const data = await fetchLotsFromAPI(p);
      setLots(prev => [...prev, ...data.items.map(mapLot)]);
      setCurrentPage(nextPage);
    } catch { /* silent */ } finally { setLoadingMore(false); }
  }, [loadingMore, currentPage, totalPages, exploreTab, minScore, minUpside, minPrice, maxPrice, category, artistTier, auctionHouse, sizeFilter, search]);

  const cols = viewMode === "list" ? 1 : viewMode === "grid6" ? 6 : tab === "live" ? 5 : 4;
  const gap  = cols >= 5 ? "12px" : "16px";
  const VIEW_MODES: { mode: ViewMode; icon: React.ReactNode; title: string }[] = [
    { mode: "grid4", icon: <IconGrid4 />, title: "4 columns" },
    { mode: "grid6", icon: <IconGrid6 />, title: "6 columns" },
    { mode: "list",  icon: <IconList />,  title: "List view" },
  ];


  return (
    <div
      className="page"
      style={{
        display: "flex", flexDirection: "column",
        width: "100%", height: "calc(100vh - 60px)",
        overflow: "hidden", background: "var(--bg)",
      }}
    >
      {showTour && <WelcomeTour onClose={() => { setShowTour(false); localStorage.setItem('nautilus_tour_seen', 'true'); }} />}
      {/* ── Compact toolbar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '12px 24px', background: 'white',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0, flexWrap: 'wrap',
      }}>
        {/* Tab pills */}
        {([
          { key: 'best', label: 'Best Lots' },
          { key: 'auctions', label: 'All Auctions' },
          { key: 'primary', label: 'Primary Market' },
          { key: 'convictions', label: 'Convictions' },
        ] as { key: ExploreTab; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setSearchParams(prev => { const p = new URLSearchParams(prev); p.set('tab', key); return p; })}
            style={{
              padding: '6px 14px', borderRadius: '20px', border: 'none',
              background: exploreTab === key ? 'var(--navy)' : 'transparent',
              color: exploreTab === key ? 'white' : 'var(--text-3)',
              fontSize: '12px', fontWeight: exploreTab === key ? 700 : 400,
              cursor: 'pointer', transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </button>
        ))}

        {/* Divider */}
        <div style={{ width: '1px', height: '20px', background: 'var(--border)', margin: '0 4px' }} />

        {/* Date filters — only on Best Lots + All Auctions */}
        {(exploreTab === 'best' || exploreTab === 'auctions') && (
          <>
            {['All dates', 'Today', '3 days', 'This week', 'This month'].map(d => {
              const val = d === 'All dates' ? 'all' : d === '3 days' ? '3days' : d === 'This week' ? 'week' : d === 'This month' ? 'month' : d.toLowerCase();
              return (
                <button
                  key={d}
                  onClick={() => setDateFilter(val)}
                  style={{
                    padding: '5px 12px', borderRadius: '20px',
                    border: `1px solid ${dateFilter === val ? 'var(--navy)' : 'var(--border)'}`,
                    background: dateFilter === val ? 'var(--navy)' : 'transparent',
                    color: dateFilter === val ? 'white' : 'var(--text-3)',
                    fontSize: '11px', cursor: 'pointer', transition: 'all 0.15s',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {d}
                </button>
              );
            })}
            <div style={{ width: '1px', height: '20px', background: 'var(--border)', margin: '0 4px' }} />
          </>
        )}

        {/* Search */}
        <div style={{ flex: 1, position: 'relative', maxWidth: '240px' }}>
          <input
            className="input"
            placeholder="Artist, title..."
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setSearchParams(prev => { const p = new URLSearchParams(prev); if (e.target.value) p.set('search', e.target.value); else p.delete('search'); return p; });
            }}
            style={{ padding: '6px 12px 6px 32px', fontSize: '12px', height: '32px' }}
          />
          <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: 'var(--text-3)' }}>⌕</span>
        </div>

        {/* Filters toggle */}
        {(exploreTab === 'best' || exploreTab === 'auctions') && (
          <button
            onClick={() => setShowFilters(f => !f)}
            style={{
              padding: '6px 14px', borderRadius: '20px',
              border: `1px solid ${showFilters ? 'var(--navy)' : 'var(--border)'}`,
              background: showFilters ? 'var(--navy)' : 'transparent',
              color: showFilters ? 'white' : 'var(--text-3)',
              fontSize: '12px', fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px',
              transition: 'all 0.15s', whiteSpace: 'nowrap',
            }}
          >
            <span>⚙</span>
            Filters
            {hasActiveFilters && (
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--gold)', display: 'inline-block' }} />
            )}
          </button>
        )}

        {/* View mode */}
        <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden', flexShrink: 0, marginLeft: 'auto' }}>
          {VIEW_MODES.map(({ mode, icon, title }, idx) => (
            <button key={mode} onClick={() => setViewMode(mode)} title={title} style={{ padding: '5px 10px', border: 'none', borderRight: idx < 2 ? '1px solid var(--border)' : 'none', cursor: 'pointer', background: viewMode === mode ? 'var(--navy)' : 'white', color: viewMode === mode ? 'white' : 'var(--text-3)', transition: 'all 0.1s', display: 'flex', alignItems: 'center' }}>{icon}</button>
          ))}
        </div>

        {/* Live dot — Best Lots + All Auctions only */}
        {(exploreTab === 'best' || exploreTab === 'auctions') && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--electric)', animation: 'pulse 2s infinite' }} />
            <span style={{ fontSize: '10px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>LIVE</span>
          </div>
        )}
      </div>

      {/* ── Primary stats bar ── */}
      {exploreTab === 'primary' && primaryStats && (
        <div style={{ padding: '6px 24px', display: 'flex', gap: '20px', alignItems: 'center', borderBottom: '1px solid var(--border-light)', background: 'var(--bg-subtle)', flexShrink: 0 }}>
          {[
            { label: 'Listings', value: primaryStats.total?.toLocaleString() },
            { label: 'Avg score', value: `${primaryStats.avg_score}/100` },
            { label: 'Avg price', value: `€${primaryStats.avg_price?.toLocaleString()}` },
            { label: 'New this week', value: primaryStats.new_this_week },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', gap: '4px', alignItems: 'baseline' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: 'var(--text)' }}>{value}</span>
              <span style={{ fontSize: '10px', color: 'var(--text-3)' }}>{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── All tabs — unified content ──────────────────────── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Sidebar — best / auctions only */}
        {(exploreTab === 'best' || exploreTab === 'auctions') && (
          <div
            className="no-scrollbar"
            style={{
              width: showFilters ? "280px" : "0px", minWidth: showFilters ? "280px" : "0px",
              height: "100%", overflowY: showFilters ? "auto" : "hidden", overflowX: "hidden",
              borderRight: showFilters ? "1px solid var(--border)" : "none",
              background: "white", flexShrink: 0,
              transition: "width 0.25s ease, min-width 0.25s ease",
            }}
          >
            {showFilters && (
              <div style={{ padding: '20px 20px 40px' }}>
                {/* 1. CONVICTION SCORE */}
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: '10px', fontFamily: 'var(--font-mono)' }}>Conviction Score</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {[{ label: 'All opportunities', value: 0, sub: '' }, { label: 'Strong signal', value: 55, sub: 'Score 55+' }, { label: 'High conviction', value: 65, sub: 'Score 65+' }, { label: 'Exceptional only', value: 80, sub: 'Score 80+' }].map(({ label, value, sub }) => (
                      <button key={value} onClick={() => setMinScore(value)} style={{ padding: '8px 12px', textAlign: 'left', background: minScore === value ? 'var(--navy)' : 'white', color: minScore === value ? 'white' : 'var(--text-2)', border: `1px solid ${minScore === value ? 'var(--navy)' : 'var(--border)'}`, borderRadius: '6px', fontSize: '12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'all 0.15s' }}>
                        <span>{label}</span>
                        {sub && <span style={{ fontSize: '10px', opacity: 0.6, fontFamily: 'var(--font-mono)' }}>{sub}</span>}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. UPSIDE POTENTIAL */}
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: '10px', fontFamily: 'var(--font-mono)' }}>Upside Potential</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {[{ label: 'Any upside', value: '' }, { label: '+10% and above', value: '10' }, { label: '+20% and above', value: '20' }, { label: '+33% and above', value: '33' }, { label: '+50% and above', value: '50' }].map(({ label, value }) => (
                      <button key={value} onClick={() => setMinUpside(value)} style={{ padding: '8px 12px', textAlign: 'left', background: minUpside === value ? 'var(--navy)' : 'white', color: minUpside === value ? 'white' : 'var(--text-2)', border: `1px solid ${minUpside === value ? 'var(--navy)' : 'var(--border)'}`, borderRadius: '6px', fontSize: '12px', cursor: 'pointer', transition: 'all 0.15s' }}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. BUDGET */}
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: '10px', fontFamily: 'var(--font-mono)' }}>Budget</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {[{ label: '< €1K', min: 0, max: 1000 }, { label: '€1K–10K', min: 1000, max: 10000 }, { label: '€10K–50K', min: 10000, max: 50000 }, { label: '€50K–200K', min: 50000, max: 200000 }, { label: '> €200K', min: 200000, max: 0 }].map(({ label, min, max }) => (
                      <button key={label} onClick={() => { setMinPrice(min); setMaxPrice(max); }} style={{ padding: '6px 12px', background: (minPrice === min && maxPrice === max && (min > 0 || max > 0)) ? 'var(--navy)' : 'white', color: (minPrice === min && maxPrice === max && (min > 0 || max > 0)) ? 'white' : 'var(--text-2)', border: `1px solid ${(minPrice === min && maxPrice === max && (min > 0 || max > 0)) ? 'var(--navy)' : 'var(--border)'}`, borderRadius: '20px', fontSize: '11px', cursor: 'pointer', transition: 'all 0.15s' }}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4. CATEGORY */}
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: '10px', fontFamily: 'var(--font-mono)' }}>Category</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {['Paintings', 'Drawings', 'Sculpture', 'Prints', 'Photography', 'Street Art', 'Contemporary', 'Modern'].map(cat => (
                      <button key={cat} onClick={() => setCategory(category === cat ? '' : cat)} style={{ padding: '6px 12px', background: category === cat ? 'var(--navy)' : 'white', color: category === cat ? 'white' : 'var(--text-2)', border: `1px solid ${category === cat ? 'var(--navy)' : 'var(--border)'}`, borderRadius: '20px', fontSize: '11px', cursor: 'pointer', transition: 'all 0.15s' }}>
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 5. ARTIST TIER */}
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: '10px', fontFamily: 'var(--font-mono)' }}>Artist Tier</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {[{ label: 'All artists', value: '', sub: '' }, { label: 'Blue chip', value: 'blue_chip', sub: 'Warhol, Hirst, Basquiat...' }, { label: 'Established', value: 'established', sub: 'Secondary market presence' }, { label: 'Emerging', value: 'emerging', sub: 'High growth potential' }].map(({ label, value, sub }) => (
                      <button key={value} onClick={() => setArtistTier(value)} style={{ padding: '8px 12px', textAlign: 'left', background: artistTier === value ? 'var(--navy)' : 'white', color: artistTier === value ? 'white' : 'var(--text-2)', border: `1px solid ${artistTier === value ? 'var(--navy)' : 'var(--border)'}`, borderRadius: '6px', fontSize: '12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', transition: 'all 0.15s' }}>
                        <span>{label}</span>
                        {sub && <span style={{ fontSize: '10px', opacity: 0.5 }}>{sub}</span>}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 6. AUCTION HOUSE */}
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: '10px', fontFamily: 'var(--font-mono)' }}>Auction House</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {["Christie's", "Sotheby's", 'Phillips', 'Drouot', 'Artcurial', 'Invaluable', 'Artsy'].map(house => (
                      <button key={house} onClick={() => setAuctionHouse(auctionHouse === house ? '' : house)} style={{ padding: '6px 12px', background: auctionHouse === house ? 'var(--navy)' : 'white', color: auctionHouse === house ? 'white' : 'var(--text-2)', border: `1px solid ${auctionHouse === house ? 'var(--navy)' : 'var(--border)'}`, borderRadius: '20px', fontSize: '11px', cursor: 'pointer', transition: 'all 0.15s' }}>
                        {house}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 7. SIZE */}
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: '10px', fontFamily: 'var(--font-mono)' }}>Artwork Size</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {[{ label: 'Any size', value: '' }, { label: 'Small (< 40cm)', value: 'small' }, { label: 'Medium (40–100cm)', value: 'medium' }, { label: 'Large (> 100cm)', value: 'large' }].map(({ label, value }) => (
                      <button key={value} onClick={() => setSizeFilter(value)} style={{ padding: '8px 12px', textAlign: 'left', background: sizeFilter === value ? 'var(--navy)' : 'white', color: sizeFilter === value ? 'white' : 'var(--text-2)', border: `1px solid ${sizeFilter === value ? 'var(--navy)' : 'var(--border)'}`, borderRadius: '6px', fontSize: '12px', cursor: 'pointer', transition: 'all 0.15s' }}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Reset */}
                <button onClick={resetFilters} style={{ width: '100%', padding: '10px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px', color: 'var(--text-3)', cursor: 'pointer' }}>
                  Reset all filters
                </button>
              </div>
            )}
          </div>
        )}

        {/* Main */}
        <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
          {/* Convictions paywall for free users */}
          {exploreTab === "convictions" && !isAdmin && userPlan === "free" ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", padding: "60px 20px", textAlign: "center" }}>
              <div style={{ fontSize: "32px", marginBottom: "20px" }}>★</div>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: "22px", color: "var(--text)", marginBottom: "10px" }}>Convictions IA</div>
              <p style={{ fontSize: "13px", color: "var(--text-2)", marginBottom: "28px", lineHeight: 1.7, maxWidth: "380px" }}>
                Our curated high-conviction picks are reserved for Starter and above. Upgrade to access Nautilus AI's top-rated opportunities.
              </p>
              <button onClick={() => navigate("/app/pricing")} className="btn btn-navy" style={{ fontSize: "13px", padding: "12px 36px", marginBottom: "10px" }}>
                Unlock Convictions →
              </button>
              <div style={{ fontSize: "11px", color: "var(--text-3)", fontFamily: "var(--font-mono)" }}>From €9/month · Cancel anytime</div>
            </div>
          ) : (
            <div className="no-scrollbar" style={{ flex: 1, overflowY: "auto", padding: "0 24px 60px" }}>
              {/* Convictions subtitle */}
              {exploreTab === 'convictions' && (
                <div style={{ padding: '8px 0 0', fontSize: '11px', color: 'var(--text-3)' }}>
                  AI-selected · Score 75+ · Updated every 15 min
                </div>
              )}
              {/* Count line */}
              {total > 0 && !loading && (
                <div style={{ padding: '8px 0 0', fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                  {total.toLocaleString()} lots
                </div>
              )}

              {/* Best Lots stats */}
              {exploreTab === 'best' && !loading && alphaLots.length > 0 && (
                <div style={{ display: "flex", gap: "24px", padding: "12px 0 16px", marginBottom: "8px", borderBottom: "1px solid var(--border-light)", flexWrap: "wrap", alignItems: "center" }}>
                  {[{ label: "Exceptional", value: EXCEPTIONAL.length, color: "#C0392B" }, { label: "Strong", value: STRONG.length, color: "var(--navy)" }, { label: "Interesting", value: INTERESTING.length, color: "var(--gold-dim)" }, { label: "Avg score", value: `${avgScore.toFixed(0)}/100`, color: "var(--text-2)" }].map(({ label, value, color }) => (
                    <div key={label}><div style={{ fontFamily: "var(--font-mono)", fontSize: "20px", fontWeight: 700, color }}>{value}</div><div className="label-caps" style={{ marginTop: "2px" }}>{label}</div></div>
                  ))}
                </div>
              )}

              {/* Skeletons */}
              {loading && viewMode === "list" && <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>{Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton" style={{ height: "64px", marginBottom: "1px" }} />)}</div>}
              {loading && viewMode !== "list" && <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap }}>{Array.from({ length: cols * 2 }).map((_, i) => tab === "live" ? <LiveSkeleton key={i} /> : <AlphaSkeleton key={i} />)}</div>}

              {/* Error */}
              {!loading && hasError && (
                <div style={{ textAlign: "center", padding: "80px 20px" }}>
                  <div style={{ fontFamily: "var(--font-serif)", fontSize: "36px", color: "var(--border)", marginBottom: "16px" }}>◇</div>
                  <div style={{ fontSize: "15px", color: "var(--text-2)", marginBottom: "20px" }}>Unable to connect to the auction database</div>
                  <button onClick={doFetch} className="btn btn-navy" style={{ fontSize: "12px", padding: "9px 20px" }}>Try again</button>
                </div>
              )}

              {/* Empty */}
              {!loading && !hasError && lots.length === 0 && (
                <div style={{ textAlign: "center", padding: "80px 20px" }}>
                  <div style={{ fontFamily: "var(--font-serif)", fontSize: "36px", color: "var(--border)", marginBottom: "16px" }}>◇</div>
                  <div style={{ fontSize: "15px", color: "var(--text-2)", marginBottom: "8px" }}>{tab === "alpha" ? "No high-score opportunities right now" : "No lots match your filters"}</div>
                  <div style={{ fontSize: "13px", color: "var(--text-3)" }}>{tab === "alpha" ? "We scan every 15 minutes — check back soon." : "Try broadening your search or removing filters."}</div>
                </div>
              )}

              {/* List view */}
              {!loading && !hasError && lots.length > 0 && viewMode === "list" && (
                <div style={{ background: "white", border: "1px solid var(--border)", borderRadius: "10px", overflow: "hidden" }}>
                  {tab === "live" ? (
                    <>{/* Live list header */}<div style={{ display: "grid", gridTemplateColumns: "48px 1fr 160px 100px 130px 80px", gap: "12px", padding: "9px 16px", background: "var(--bg-subtle)", borderBottom: "1px solid var(--border)" }}>{["", "Artwork", "House", "Date", "Estimate", "Category"].map(h => <div key={h} className="label-caps">{h}</div>)}</div>{visibleLots.map(lot => <LiveListRow key={lot.id} lot={lot} onClick={() => navigate(`/app/opportunities/${lot.id}`)} />)}</>
                  ) : (
                    <>{/* Alpha list header */}<div style={{ display: "grid", gridTemplateColumns: "52px 2fr 1fr 90px 72px 64px", gap: "12px", padding: "10px 16px", background: "var(--bg-subtle)", borderBottom: "1px solid var(--border)" }}>{["", "Artwork", "Price", "Score", "Upside", "Date"].map(h => <div key={h} className="label-caps">{h}</div>)}</div>{[...visibleLots, ...lockedLots].map((lot, i) => { const isLocked = i >= visibleLots.length; return <div key={lot.id} style={{ position: "relative" }}><div onClick={isLocked ? undefined : () => navigate(`/app/opportunities/${lot.id}`)} style={{ display: "grid", gridTemplateColumns: "52px 2fr 1fr 90px 72px 64px", gap: "12px", padding: "11px 16px", borderBottom: "1px solid var(--border-light)", cursor: isLocked ? "default" : "pointer", transition: "background 0.1s", filter: isLocked ? "blur(3px)" : "none", userSelect: isLocked ? "none" : "auto", alignItems: "center" }} onMouseEnter={e => { if (!isLocked) (e.currentTarget as HTMLDivElement).style.background = "var(--bg-subtle)"; }} onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "white"; }}><div style={{ width: "44px", height: "44px", borderRadius: "4px", overflow: "hidden", background: "var(--bg-subtle)" }}>{lot.imageUrl && <img src={lot.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />}</div><div style={{ minWidth: 0 }}><div style={{ fontSize: "10px", fontWeight: 700, color: "var(--navy)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lot.artistName}</div><div style={{ fontSize: "12px", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lot.title}</div></div><div style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-2)" }}>{lot.price}</div><div style={{ display: "flex", gap: "3px", alignItems: "center" }}>{Array.from({ length: 5 }).map((_, j) => <div key={j} className={j < lot.score ? "score-dot filled" : "score-dot unfilled"} />)}</div><div>{lot.upsidePercent > 0 ? <span className="upside-badge">+{lot.upsidePercent}%</span> : <span style={{ color: "var(--text-3)" }}>—</span>}</div><div style={{ fontSize: "11px", color: "var(--text-3)" }}>{lot.auctionDate ? new Date(lot.auctionDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : "—"}</div></div>{isLocked && <div onClick={() => navigate("/app/pricing")} style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", background: "rgba(250,250,248,0.88)", backdropFilter: "blur(2px)", cursor: "pointer" }}><span style={{ fontSize: "14px" }}>🔒</span><span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text)" }}>Investor plan</span><span style={{ fontSize: "11px", color: "var(--text-3)" }}>from €29/month</span></div>}</div>; })}</>
                  )}
                </div>
              )}

              {/* Grid view */}
              {!loading && !hasError && lots.length > 0 && viewMode !== "list" && (
                <>
                  <div className="animate-stagger" style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap, width: "100%" }}>
                    {visibleLots.map((lot, i) => (
                      <div key={lot.id} className="fade-up" style={{ animationDelay: `${Math.min(i * 0.04, 0.4)}s`, minWidth: 0 }}>
                        {tab === "live" ? <LiveCard lot={lot} onClick={() => navigate(`/app/opportunities/${lot.id}`)} /> : <AlphaCard lot={lot} onClick={() => navigate(`/app/opportunities/${lot.id}`)} locked={false} />}
                      </div>
                    ))}
                  </div>

                  {isLimited && (
                    <div style={{ position: "relative", marginTop: "16px" }}>
                      {/* Blurred fake cards */}
                      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap, filter: "blur(5px)", pointerEvents: "none", opacity: 0.5, userSelect: "none" }}>
                        {[...Array(4)].map((_, i) => (
                          <div key={i} style={{ background: "white", border: "1px solid var(--border)", borderRadius: "8px", overflow: "hidden", height: "300px" }}>
                            <div style={{ height: "180px", background: "var(--bg-subtle)" }} />
                            <div style={{ padding: "16px" }}>
                              <div style={{ height: "10px", width: "50%", borderRadius: "4px", marginBottom: "8px", background: "var(--border)" }} />
                              <div style={{ height: "14px", width: "80%", borderRadius: "4px", marginBottom: "12px", background: "var(--border)" }} />
                              <div style={{ height: "18px", width: "40%", borderRadius: "4px", background: "var(--border)" }} />
                            </div>
                          </div>
                        ))}
                      </div>
                      {/* Overlay */}
                      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(250,250,250,0) 0%, rgba(250,250,250,0.98) 25%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", paddingBottom: "40px" }}>
                        <div style={{ textAlign: "center", maxWidth: "440px", padding: "0 24px" }}>
                          <div style={{ fontFamily: "var(--font-serif)", fontSize: "24px", color: "var(--text)", marginBottom: "10px" }}>
                            500+ opportunities available
                          </div>
                          <p style={{ fontSize: "14px", color: "var(--text-2)", marginBottom: "24px", lineHeight: 1.7 }}>
                            {userPlan === "free"
                              ? `You're seeing ${visibleLimit} of 500+ lots. Upgrade to unlock the full market intelligence platform.`
                              : "Upgrade to Investor for unlimited access."
                            }
                          </p>
                          <button onClick={() => navigate("/app/pricing")} className="btn-electric" style={{ fontSize: "13px", padding: "14px 40px", width: "100%", justifyContent: "center", marginBottom: "12px" }}>
                            Get full access →
                          </button>
                          <div style={{ fontSize: "11px", color: "var(--text-3)", fontFamily: "var(--font-mono)" }}>
                            From €9/month · Cancel anytime · Instant access
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {!loading && !hasError && lots.length > 0 && currentPage < totalPages && (
                    <div style={{ display: "flex", justifyContent: "center", marginTop: "32px" }}>
                      <button onClick={loadMore} disabled={loadingMore} className="btn btn-ghost" style={{ fontSize: "12px", padding: "10px 32px" }}>{loadingMore ? "Loading…" : "Load more"}</button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
