import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { getUser } from "../../lib/auth";
import { WelcomeTour } from "../components/WelcomeTour";

type ExploreTab = "best" | "auctions" | "primary" | "convictions" | "for-you";
type ViewMode = "grid-large" | "grid" | "list";

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

// Maps sidebar pill labels to exact DB category values
const CATEGORY_API_MAP: Record<string, string> = {
  'Paintings': 'Paintings',
  'Prints': 'Prints & Multiples',
  'Drawings': 'Drawings',
  'Sculpture': 'Sculpture',
  'Photography': 'Photography',
  'Street Art': 'Street Art',
  'Jewelry': 'Jewelry',
  'Watches': 'Watches',
  'Furniture': 'Furniture',
  'Ceramics': 'Ceramics',
  'Books': 'Books',
  'Asian Art': 'Asian Art',
  'Maroquinerie': 'Leather Goods',
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
  if (filter === "3months") { const d = new Date(now); d.setMonth(d.getMonth() + 3); return { auction_date_from: today, auction_date_to: d.toISOString().split("T")[0] }; }
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

// ── Nautilus Loader ──────────────────────────────────────────
function NautilusLoader({ label = "SCANNING..." }: { label?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', background: '#FAFAF8' }}>
      <span style={{ fontFamily: 'Georgia,serif', fontSize: 13, letterSpacing: '0.3em', color: '#1A2A44', opacity: 0.5, textTransform: 'uppercase', animation: 'fade 1.4s ease-in-out infinite' }}>
        {label}
      </span>
      <style>{'@keyframes fade{0%,100%{opacity:0.3}50%{opacity:0.8}}'}</style>
    </div>
  );
}

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

// ── LotImage — lazy load + skeleton + error fallback ─────────
function LotImage({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  if (!src) return <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: '22px', opacity: 0.2, fontFamily: 'var(--font-serif)', color: 'var(--border)' }}>◇</span></div>;
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: 'var(--bg-subtle)' }}>
      {!loaded && !error && <div className="skeleton" style={{ position: 'absolute', inset: 0 }} />}
      {!error ? (
        <img
          src={src} alt={alt} loading="lazy" decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', opacity: loaded ? 1 : 0, transition: 'transform 0.5s ease, opacity 0.3s ease' }}
        />
      ) : (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: '22px', opacity: 0.2 }}>◎</span></div>
      )}
    </div>
  );
}

// ── AlphaCard ────────────────────────────────────────────────
function AlphaCard({ lot, onClick, locked }: { lot: MappedLot; onClick: () => void; locked: boolean }) {
  const nav = useNavigate();
  const ds = lot.dealScore;
  const tier      = ds >= 80 ? "EXCEPTIONAL" : ds >= 65 ? "STRONG" : "INTERESTING";
  const tierColor = tier === "EXCEPTIONAL" ? "#C0392B" : tier === "STRONG" ? "var(--navy)" : "var(--gold-dim)";
  const tierBg    = tier === "EXCEPTIONAL" ? "rgba(192,57,43,0.08)" : tier === "STRONG" ? "rgba(26,42,68,0.08)" : "rgba(198,168,90,0.06)";
  return (
    <div
      onClick={locked ? undefined : onClick}
      onMouseEnter={e => { if (locked) return; const el = e.currentTarget as HTMLDivElement; el.style.transform = "translateY(-4px)"; el.style.boxShadow = "0 12px 40px rgba(0,0,0,0.1)"; const img = el.querySelector("img") as HTMLImageElement | null; if (img) img.style.transform = "scale(1.05)"; }}
      onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.transform = "translateY(0)"; el.style.boxShadow = "none"; el.style.borderColor = "var(--border)"; const img = el.querySelector("img") as HTMLImageElement | null; if (img) img.style.transform = "scale(1)"; }}
      style={{ background: "white", border: "1px solid var(--border)", borderRadius: "10px", overflow: "hidden", cursor: locked ? "default" : "pointer", transition: "transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease", contain: "layout style paint" }}
    >
      <div style={{ position: "relative", paddingTop: "75%", background: "var(--bg-subtle)", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0 }}><LotImage src={lot.imageUrl} alt={lot.title} /></div>
        <div style={{ position: "absolute", top: "10px", left: "10px", padding: "4px 10px", background: tierBg, border: `1px solid ${tierColor}40`, borderRadius: "4px" }}><span style={{ fontSize: "10px", fontWeight: 800, color: tierColor, letterSpacing: "0.1em" }}>{tier}</span></div>
        <div style={{ position: "absolute", top: "10px", right: "10px", padding: "4px 8px", background: "rgba(250,250,248,0.92)", backdropFilter: "blur(4px)", borderRadius: "4px", border: "1px solid var(--border)" }}><span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 700, color: "var(--navy)" }}>{Math.round(ds)}</span><span style={{ fontSize: "9px", color: "var(--text-3)" }}>/100</span></div>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "60px", background: "linear-gradient(to top, rgba(250,250,248,0.9), transparent)" }} />
      </div>
      <div style={{ padding: "14px 16px" }}>
        {lot.artistName !== "Unknown Artist" && (
          <div
            onClick={e => { e.stopPropagation(); nav(`/app/artists/${encodeURIComponent(lot.artistName)}`); }}
            style={{ fontSize: "10px", fontWeight: 700, color: "var(--navy)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer", transition: "color 0.15s" }}
            onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.color = "var(--electric)"}
            onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.color = "var(--navy)"}
          >{lot.artistName}</div>
        )}
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
  const nav  = useNavigate();
  return (
    <div onClick={onClick} onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.transform = "translateY(-4px)"; el.style.boxShadow = "0 12px 40px rgba(0,0,0,0.1)"; const img = el.querySelector("img") as HTMLImageElement | null; if (img) img.style.transform = "scale(1.05)"; }} onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.transform = "translateY(0)"; el.style.boxShadow = "none"; el.style.borderColor = "var(--border)"; const img = el.querySelector("img") as HTMLImageElement | null; if (img) img.style.transform = "scale(1)"; }} style={{ background: "white", borderRadius: "8px", overflow: "hidden", cursor: "pointer", border: "1px solid var(--border)", transition: "transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease", contain: "layout style paint" }}>
      <div style={{ position: "relative", paddingTop: "65%", background: "var(--bg-subtle)", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0 }}><LotImage src={lot.imageUrl} alt={lot.title} /></div>
        {lot.auctionDate && <div style={{ position: "absolute", bottom: "7px", right: "7px", background: "var(--navy)", color: "white", padding: "2px 7px", borderRadius: "3px", fontSize: "10px", fontWeight: 700 }}>{new Date(lot.auctionDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</div>}
        {lot.category && <div style={{ position: "absolute", bottom: "7px", left: "8px", background: "rgba(250,250,248,0.88)", backdropFilter: "blur(3px)", padding: "2px 6px", borderRadius: "3px", fontSize: "9px", fontWeight: 600, color: "var(--text-2)", border: "1px solid rgba(0,0,0,0.08)" }}>{lot.category}</div>}
      </div>
      <div style={{ padding: "10px 12px" }}>
        {lot.artistName !== "Unknown Artist" && (
          <div
            onClick={e => { e.stopPropagation(); nav(`/app/artists/${encodeURIComponent(lot.artistName)}`); }}
            style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-2)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer", transition: "color 0.15s" }}
            onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.color = "var(--electric)"}
            onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.color = "var(--text-2)"}
          >{lot.artistName}</div>
        )}
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
  const nav  = useNavigate();
  const src  = (lot.source || "").toLowerCase();
  const flag = SOURCE_FLAG[src] || "🌐";
  return (
    <div onClick={onClick} style={{ display: "grid", gridTemplateColumns: "48px 1fr 160px 100px 130px 80px", gap: "12px", padding: "10px 16px", borderBottom: "1px solid var(--border-light)", cursor: "pointer", transition: "background 0.1s", alignItems: "center" }} onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = "var(--bg-subtle)"; }} onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "white"; }}>
      <div style={{ width: "44px", height: "44px", borderRadius: "4px", overflow: "hidden", background: "var(--bg-subtle)" }}><LotImage src={lot.imageUrl} alt="" /></div>
      <div style={{ minWidth: 0 }}>
        {lot.artistName !== "Unknown Artist" ? (
          <div
            onClick={e => { e.stopPropagation(); nav(`/app/artists/${encodeURIComponent(lot.artistName)}`); }}
            style={{ fontSize: "10px", fontWeight: 700, color: "var(--navy)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer", transition: "color 0.15s" }}
            onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.color = "var(--electric)"}
            onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.color = "var(--navy)"}
          >{lot.artistName}</div>
        ) : <div style={{ marginBottom: "2px" }} />}
        <div style={{ fontSize: "12px", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lot.title}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "5px", minWidth: 0 }}><span style={{ fontSize: "13px", flexShrink: 0 }}>{flag}</span><span style={{ fontSize: "11px", color: "var(--text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{SOURCE_LABEL[src] || lot.source}</span></div>
      <div style={{ fontSize: "11px", color: "var(--text-2)" }}>{lot.auctionDate ? new Date(lot.auctionDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "2-digit" }) : "—"}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-2)" }}>{lot.estimateLow > 0 ? (lot.estimateHigh > 0 && lot.estimateHigh !== lot.estimateLow ? `${lot.estimateLowFmt} – ${lot.estimateHighFmt}` : lot.estimateLowFmt) : lot.price}</div>
      <div>{lot.category && <span style={{ fontSize: "9px", fontWeight: 600, color: "var(--text-3)", background: "var(--bg-subtle)", padding: "2px 6px", borderRadius: "3px", border: "1px solid var(--border-light)" }}>{lot.category}</span>}</div>
    </div>
  );
}



// ── Explore component ─────────────────────────────────────────
export default function Explore() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const exploreTab = (searchParams.get('tab') || 'best') as ExploreTab;
  const searchFromUrl = searchParams.get('search') || '';

  // For You tab state
  const [recos, setRecos]           = useState<any[]>([]);
  const [recoLoading, setRecoLoading] = useState(false);
  const [recoDone, setRecoDone]     = useState(false);

  // Opportunities state
  const [lots, setLots]             = useState<MappedLot[]>([]);
  const [total, setTotal]           = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading]       = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasError, setHasError]     = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [primaryStats, setPrimaryStats] = useState<{ total?: number; avg_score?: number; avg_price?: number; new_this_week?: number } | null>(null);
  const [viewMode, setViewMode]     = useState<ViewMode>("grid");
  const [dateFilter, setDateFilter] = useState(searchParams.get('date') || 'all');
  const [sourceStats, setSourceStats] = useState<SourceStat[]>([]);

  // ── Filter state ─────────────────────────────────────────────
  const [search, setSearch]           = useState(searchFromUrl);
  const [minScore, setMinScore]       = useState(0);
  const [maxScore, setMaxScore]       = useState(0);
  const [minPrice, setMinPrice]       = useState(0);
  const [maxPrice, setMaxPrice]       = useState(0);
  const [category, setCategory]       = useState(searchParams.get('category') || '');
  const [sources, setSources]         = useState<string[]>([]);
  const [sortBy, setSortBy]           = useState(searchParams.get('sort_by') || 'deal_score');
  const [sortDir, setSortDir]         = useState(searchParams.get('sort_dir') || 'desc');

  const resetFilters = () => {
    setMinScore(0); setMaxScore(0); setMinPrice(0); setMaxPrice(0);
    setCategory(''); setSources([]);
    setSearch(''); setDateFilter('all');
    setSortBy('deal_score'); setSortDir('desc');
    setSearchParams(prev => { const p = new URLSearchParams(prev); p.delete('search'); return p; });
  };

  const hasActiveFilters = minScore > 0 || minPrice > 0 || maxPrice > 0 || category !== '' || sources.length > 0 || dateFilter !== 'all';

  // Sync filter state → URL
  useEffect(() => {
    setSearchParams(prev => {
      const p = new URLSearchParams(prev);
      if (category) p.set('category', category); else p.delete('category');
      if (sortBy && sortBy !== 'deal_score') p.set('sort_by', sortBy); else p.delete('sort_by');
      if (sortDir && sortDir !== 'desc') p.set('sort_dir', sortDir); else p.delete('sort_dir');
      if (dateFilter && dateFilter !== 'all') p.set('date', dateFilter); else p.delete('date');
      return p;
    }, { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, sortBy, sortDir, dateFilter]);

  // Fetch recommendations for "For You" tab
  useEffect(() => {
    if (exploreTab !== 'for-you') return;
    if (recoDone) return;
    const token = getToken();
    if (!token) { setRecoDone(true); return; }
    setRecoLoading(true);
    fetch(`${BACKEND}/api/recommendations/for-you?limit=20`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        const items = Array.isArray(data) ? data : (data.recommendations || data.items || []);
        setRecos(items);
      })
      .catch(() => setRecos([]))
      .finally(() => { setRecoLoading(false); setRecoDone(true); });
  }, [exploreTab, recoDone]);

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

  const [dailyDeal, setDailyDeal] = useState<any>(null);
  useEffect(() => {
    if (userPlan === 'free') {
      fetch(`${BACKEND}/api/lots/daily-unlock`)
        .then(r => r.json())
        .then(data => setDailyDeal(data))
        .catch(() => {});
    }
  }, [userPlan]);

  const PLAN_LIMITS: Record<string, number> = {
    free: 6, starter: 10, investor: 99999, pro: 99999, institutional: 99999, elite: 99999,
  };
  const visibleLimit = isAdmin ? 99999 : (PLAN_LIMITS[userPlan] ?? 3);
  const maxVisible = visibleLimit;

  // tab alias used throughout JSX: "alpha" = best lots, "live" = all auctions
  const tab = exploreTab === "auctions" ? "live" : "alpha";

  const alphaLots   = lots;
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

  const [refreshKey, setRefreshKey] = useState(0);
  const doFetch = () => { sessionStorage.removeItem(`lots_${exploreTab}`); setRefreshKey(k => k + 1); };

  const gridRef = useRef<HTMLDivElement>(null);

  // ── fetchLots (300ms debounce) ────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(async () => {
      setLots([]);
      setCurrentPage(1);
      setLoading(true);
      setHasError(false);
      gridRef.current?.scrollIntoView({ behavior: 'smooth' });
      try {
        const p = new URLSearchParams();
        p.set('page_size', '24');
        const defaultSort = exploreTab === 'auctions' ? 'created_at' : 'deal_score';
        p.set('sort_by', sortBy || defaultSort);
        p.set('sort_dir', sortDir || 'desc');
        p.set('min_score', minScore > 0 ? String(minScore) : '60');
        if (maxScore > 0)    p.set('max_score', String(maxScore));

        if (exploreTab === 'best' || exploreTab === 'auctions') {
          p.set('market_type', 'auction');
        }
        if (exploreTab === 'auctions') {
          p.delete('min_score');
          p.delete('max_score');
        }
        if (exploreTab === 'convictions') {
          p.set('min_score', '75');
          p.delete('max_score');
        }

        if (minPrice > 0)    p.set('min_price', String(minPrice));
        if (maxPrice > 0)    p.set('max_price', String(maxPrice));
        if (category)        p.set('category', CATEGORY_API_MAP[category] || category);
        if (sources.length)  p.set('sources', sources.join(','));
        if (search.trim())   p.set('search', search.trim());
        Object.entries(getDateParams(dateFilter)).forEach(([k, v]) => p.set(k, v));

        const url = exploreTab === 'primary'
          ? `${BACKEND}/api/lots/primary?page_size=24`
          : `${BACKEND}/api/lots?${p.toString()}`;

        const token = getToken();
        const resp = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await resp.json();
        const items = Array.isArray(data) ? data : (data.items || data.lots || data.results || []);
        setLots(items.map(mapLot));
        setTotal(data.total || items.length || 0);
        setTotalPages(data.pages || 1);
        setCurrentPage(1);
      } catch {
        setHasError(true);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exploreTab, refreshKey, minScore, maxScore, minPrice, maxPrice, category, sources, search, sortBy, sortDir, dateFilter]);

  const loadMore = async () => {
    if (loadingMore || currentPage >= totalPages) return;
    const nextPage = currentPage + 1;
    setLoadingMore(true);
    try {
      const p: Record<string, any> = {
        page: nextPage, page_size: 24,
        sort_by: sortBy, sort_dir: sortDir,
        search: search || undefined,
        min_price: minPrice > 0 ? minPrice : undefined,
        max_price: maxPrice > 0 ? maxPrice : undefined,
        category: category ? (CATEGORY_API_MAP[category] || category) : undefined,
        sources: sources.length ? sources.join(',') : undefined,
      };
      if (exploreTab === 'best') p.min_score = Math.max(minScore, 60);
      else if (minScore > 0) p.min_score = minScore;
      const data = await fetchLotsFromAPI(p);
      setLots(prev => [...prev, ...data.items.map(mapLot)]);
      setCurrentPage(nextPage);
    } catch { /* silent */ } finally { setLoadingMore(false); }
  };

  const cols = viewMode === "list" ? 1 : viewMode === "grid" ? (tab === "live" ? 5 : 4) : (tab === "live" ? 4 : 3);
  const gap  = cols >= 5 ? "12px" : "16px";



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
        display: 'flex', alignItems: 'center',
        padding: '10px 24px', background: 'white',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        {/* LEFT: Tab pills */}
        <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
          {([
            { key: 'best', label: 'Best Lots' },
            { key: 'auctions', label: 'All Auctions' },
            { key: 'primary', label: 'Primary Market' },
            { key: 'convictions', label: 'Convictions' },
            { key: 'for-you', label: '✦ For You' },
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
        </div>

        {/* RIGHT: Filters + View mode + LIVE */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {/* Filters button */}
          <button
            onClick={() => setShowFilters(f => !f)}
            style={{
              padding: '6px 12px', borderRadius: '6px',
              border: `1px solid ${showFilters || hasActiveFilters ? 'var(--navy)' : 'var(--border)'}`,
              background: showFilters ? 'var(--navy)' : 'transparent',
              color: showFilters ? 'white' : 'var(--text-3)',
              fontSize: '12px', fontWeight: 500, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '5px',
              transition: 'all 0.15s', whiteSpace: 'nowrap',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="1" y1="3" x2="12" y2="3" />
              <line x1="1" y1="7" x2="12" y2="7" />
              <line x1="1" y1="11" x2="12" y2="11" />
              <circle cx="4" cy="3" r="1.5" fill="currentColor" stroke="none" />
              <circle cx="9" cy="7" r="1.5" fill="currentColor" stroke="none" />
              <circle cx="4" cy="11" r="1.5" fill="currentColor" stroke="none" />
            </svg>
            Filters
            {hasActiveFilters && (
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: showFilters ? 'white' : 'var(--gold)', display: 'inline-block' }} />
            )}
          </button>

          {/* View mode */}
          <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden', flexShrink: 0 }}>
            {([
              { mode: 'grid-large' as ViewMode, label: '⊟', title: 'Large grid' },
              { mode: 'grid' as ViewMode, label: '⊞', title: 'Grid' },
              { mode: 'list' as ViewMode, label: '☰', title: 'List' },
            ]).map(({ mode, label, title }, idx) => (
              <button key={mode} onClick={() => setViewMode(mode)} title={title}
                style={{ padding: '5px 10px', border: 'none', borderRight: idx < 2 ? '1px solid var(--border)' : 'none', cursor: 'pointer', background: viewMode === mode ? 'var(--navy)' : 'white', color: viewMode === mode ? 'white' : 'var(--text-3)', transition: 'all 0.1s', fontSize: '13px', lineHeight: 1 }}
              >{label}</button>
            ))}
          </div>

          {/* LIVE dot */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginLeft: '4px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--electric)', animation: 'pulse 2s infinite' }} />
            <span style={{ fontSize: '10px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>LIVE</span>
          </div>
        </div>
      </div>


{/* ── All tabs — unified content ──────────────────────── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Sidebar — slide-in filter panel */}
        {showFilters && (
          <div
            className="no-scrollbar"
            style={{
              width: '220px', minWidth: '220px',
              height: '100%', overflowY: 'auto', overflowX: 'hidden',
              borderRight: '1px solid var(--border)',
              background: 'white', flexShrink: 0,
              animation: 'slideInLeft 0.2s ease',
            }}
          >
            {/* Filter header — sticky */}
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #E8E4DD', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'white', zIndex: 1 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text)' }}>Filters</span>
              {hasActiveFilters && (
                <button onClick={resetFilters} style={{ fontSize: '11px', color: 'var(--electric)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                  Reset
                </button>
              )}
            </div>

            <div style={{ padding: '16px 14px 40px' }}>

              {/* 1 — SIGNAL TIER */}
              <div style={{ marginBottom: '6px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: '#9CA3AF', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '8px' }}>Signal Tier</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {([
                    { label: 'All',         minVal: 0,  maxVal: 0,  badge: null },
                    { label: 'Exceptional', minVal: 80, maxVal: 0,  badge: 'EXCEP.', badgeColor: '#C0392B', badgeBg: 'rgba(192,57,43,0.08)' },
                    { label: 'Strong',      minVal: 65, maxVal: 79, badge: 'STRONG', badgeColor: 'var(--navy)', badgeBg: 'rgba(26,42,68,0.08)' },
                    { label: 'Interesting', minVal: 45, maxVal: 64, badge: 'INT.',   badgeColor: '#64748B', badgeBg: 'rgba(100,116,139,0.08)' },
                  ] as { label: string; minVal: number; maxVal: number; badge: string | null; badgeColor?: string; badgeBg?: string }[]).map(({ label, minVal, maxVal, badge, badgeColor, badgeBg }) => {
                    const active = minScore === minVal && maxScore === maxVal;
                    return (
                      <button key={label} onClick={() => { setMinScore(minVal); setMaxScore(maxVal); }}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', borderRadius: '5px', border: `1px solid ${active ? 'var(--navy)' : 'transparent'}`, background: active ? 'rgba(26,42,68,0.05)' : 'transparent', cursor: 'pointer', textAlign: 'left', transition: 'all 0.1s' }}>
                        <span style={{ fontSize: '12px', color: active ? 'var(--navy)' : 'var(--text-2)', fontWeight: active ? 600 : 400 }}>{label}</span>
                        {badge && <span style={{ fontSize: '8px', fontWeight: 700, fontFamily: 'var(--font-mono)', padding: '1px 5px', borderRadius: '3px', color: badgeColor, background: badgeBg }}>{badge}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div style={{ borderBottom: '1px solid #E8E4DD', margin: '12px 0' }} />

              {/* 2 — BUDGET */}
              <div style={{ marginBottom: '6px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: '#9CA3AF', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '8px' }}>Budget</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {([
                    { label: 'Any', min: 0, max: 0 },
                    { label: '<€1K', min: 0, max: 1000 },
                    { label: '€1K–5K', min: 1000, max: 5000 },
                    { label: '€5K–20K', min: 5000, max: 20000 },
                    { label: '€20K–100K', min: 20000, max: 100000 },
                    { label: '€100K+', min: 100000, max: 0 },
                  ] as { label: string; min: number; max: number }[]).map(({ label, min, max }) => {
                    const isAny = min === 0 && max === 0;
                    const active = isAny ? (minPrice === 0 && maxPrice === 0) : (minPrice === min && maxPrice === max);
                    return (
                      <button key={label}
                        onClick={() => {
                          if (isAny || active) { setMinPrice(0); setMaxPrice(0); }
                          else { setMinPrice(min); setMaxPrice(max); }
                        }}
                        style={{ padding: '4px 8px', borderRadius: '20px', fontSize: '11px', cursor: 'pointer', background: active ? 'var(--navy)' : 'transparent', color: active ? 'white' : 'var(--text-2)', border: `1px solid ${active ? 'var(--navy)' : 'var(--border)'}`, transition: 'all 0.12s', whiteSpace: 'nowrap' }}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div style={{ borderBottom: '1px solid #E8E4DD', margin: '12px 0' }} />

              {/* 3 — CATEGORY */}
              <div style={{ marginBottom: '6px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: '#9CA3AF', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '8px' }}>Category</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {['Paintings', 'Prints', 'Drawings', 'Sculpture', 'Photography', 'Street Art', 'Jewelry', 'Watches', 'Furniture', 'Ceramics', 'Books', 'Asian Art', 'Maroquinerie'].map(cat => (
                    <button key={cat} onClick={() => setCategory(category === cat ? '' : cat)}
                      style={{ padding: '4px 8px', borderRadius: '20px', fontSize: '11px', cursor: 'pointer', background: category === cat ? 'var(--navy)' : 'transparent', color: category === cat ? 'white' : 'var(--text-2)', border: `1px solid ${category === cat ? 'var(--navy)' : 'var(--border)'}`, transition: 'all 0.12s', whiteSpace: 'nowrap' }}>
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ borderBottom: '1px solid #E8E4DD', margin: '12px 0' }} />

              {/* 5 — AUCTION DATE */}
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: '#9CA3AF', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '8px' }}>Auction Date</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {([
                    { label: 'All dates', value: 'all' },
                    { label: 'Today', value: 'today' },
                    { label: 'This week', value: 'week' },
                    { label: 'This month', value: 'month' },
                  ] as { label: string; value: string }[]).map(({ label, value }) => (
                    <button key={value} onClick={() => setDateFilter(value)}
                      style={{ padding: '6px 8px', borderRadius: '5px', border: `1px solid ${dateFilter === value ? 'var(--navy)' : 'transparent'}`, background: dateFilter === value ? 'rgba(26,42,68,0.05)' : 'transparent', cursor: 'pointer', textAlign: 'left', fontSize: '12px', color: dateFilter === value ? 'var(--navy)' : 'var(--text-2)', fontWeight: dateFilter === value ? 600 : 400, transition: 'all 0.1s' }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ borderBottom: '1px solid #E8E4DD', margin: '12px 0' }} />

              {/* 6 — SORT BY */}
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: '#9CA3AF', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '8px' }}>Sort by</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {([
                    { label: 'Best signal',     by: 'deal_score',    dir: 'desc' },
                    { label: 'Newest first',    by: 'created_at',    dir: 'desc' },
                    { label: 'Oldest first',    by: 'created_at',    dir: 'asc'  },
                    { label: 'Price: low → high', by: 'current_price', dir: 'asc'  },
                    { label: 'Price: high → low', by: 'current_price', dir: 'desc' },
                  ] as { label: string; by: string; dir: string }[]).map(({ label, by, dir }) => {
                    const active = sortBy === by && sortDir === dir;
                    return (
                      <button key={label} onClick={() => { setSortBy(by); setSortDir(dir); }}
                        style={{ padding: '6px 8px', borderRadius: '5px', border: `1px solid ${active ? 'var(--navy)' : 'transparent'}`, background: active ? 'rgba(26,42,68,0.05)' : 'transparent', cursor: 'pointer', textAlign: 'left', fontSize: '12px', color: active ? 'var(--navy)' : 'var(--text-2)', fontWeight: active ? 600 : 400, transition: 'all 0.1s' }}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>
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
              <button onClick={() => navigate("/app/pricing")} style={{ fontSize: "13px", padding: "12px 36px", marginBottom: "10px", background: "#2563EB", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: 600 }}>
                Get Investor access — €19/mo →
              </button>
              <div style={{fontSize:12,color:'#999',marginTop:8}}>Founding price · Increases to €49 at launch</div>
            </div>
          ) : (
            <div className="no-scrollbar" style={{ flex: 1, overflowY: "auto", padding: "0 24px 60px" }}>
              <div ref={gridRef} />
              {userPlan === 'free' && dailyDeal && (
                <div style={{marginBottom:24,padding:16,background:'#1A2A44',borderRadius:8,display:'flex',gap:16,alignItems:'center',cursor:'pointer'}}
                  onClick={() => window.location.href=`/app/opportunities/${dailyDeal.id}`}>
                  <img src={dailyDeal.image_url} style={{width:64,height:64,objectFit:'cover',borderRadius:4}} />
                  <div>
                    <div style={{fontSize:10,color:'#C6A85A',letterSpacing:'0.15em',fontWeight:700,marginBottom:4}}>⚡ DEAL OF THE DAY · FULLY UNLOCKED</div>
                    <div style={{color:'#fff',fontSize:15,fontWeight:600}}>{dailyDeal.artist_name_raw}</div>
                    <div style={{color:'rgba(255,255,255,0.6)',fontSize:13}}>{dailyDeal.title}</div>
                  </div>
                  <div style={{marginLeft:'auto',color:'#C6A85A',fontSize:13,fontWeight:600}}>View deal →</div>
                </div>
              )}
              {/* Active filter chips */}
              {hasActiveFilters && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '10px 0 4px', alignItems: 'center' }}>
                  {minScore > 0 && (
                    <button onClick={() => setMinScore(0)} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px 3px 10px', fontSize: '11px', borderRadius: '20px', border: '1px solid var(--navy)', background: 'rgba(26,42,68,0.07)', color: 'var(--navy)', cursor: 'pointer', fontWeight: 600 }}>
                      Score ≥{minScore} <span style={{ opacity: 0.6, fontSize: '12px' }}>×</span>
                    </button>
                  )}
                  {(minPrice > 0 || maxPrice > 0) && (() => {
                    const fmt = (v: number) => v >= 1000 ? `€${(v/1000).toFixed(0)}K` : `€${v}`;
                    const label = minPrice > 0 && maxPrice > 0 ? `${fmt(minPrice)}–${fmt(maxPrice)}` : minPrice > 0 ? `≥${fmt(minPrice)}` : `≤${fmt(maxPrice)}`;
                    return (
                      <button onClick={() => { setMinPrice(0); setMaxPrice(0); }} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px 3px 10px', fontSize: '11px', borderRadius: '20px', border: '1px solid var(--navy)', background: 'rgba(26,42,68,0.07)', color: 'var(--navy)', cursor: 'pointer', fontWeight: 600 }}>
                        {label} <span style={{ opacity: 0.6, fontSize: '12px' }}>×</span>
                      </button>
                    );
                  })()}
                  {sources.map(s => (
                    <button key={s} onClick={() => setSources(prev => prev.filter(x => x !== s))} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px 3px 10px', fontSize: '11px', borderRadius: '20px', border: '1px solid var(--navy)', background: 'rgba(26,42,68,0.07)', color: 'var(--navy)', cursor: 'pointer', fontWeight: 600 }}>
                      {SOURCE_LABEL[s] || s} <span style={{ opacity: 0.6, fontSize: '12px' }}>×</span>
                    </button>
                  ))}
                  {category && (
                    <button onClick={() => setCategory('')} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px 3px 10px', fontSize: '11px', borderRadius: '20px', border: '1px solid var(--navy)', background: 'rgba(26,42,68,0.07)', color: 'var(--navy)', cursor: 'pointer', fontWeight: 600 }}>
                      {category} <span style={{ opacity: 0.6, fontSize: '12px' }}>×</span>
                    </button>
                  )}
                  {dateFilter !== 'all' && (
                    <button onClick={() => setDateFilter('all')} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px 3px 10px', fontSize: '11px', borderRadius: '20px', border: '1px solid var(--navy)', background: 'rgba(26,42,68,0.07)', color: 'var(--navy)', cursor: 'pointer', fontWeight: 600 }}>
                      {dateFilter === 'today' ? 'Today' : dateFilter === 'week' ? 'This week' : 'This month'} <span style={{ opacity: 0.6, fontSize: '12px' }}>×</span>
                    </button>
                  )}
                  <button onClick={resetFilters} style={{ fontSize: '11px', color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: '3px 4px' }}>
                    Clear all
                  </button>
                </div>
              )}

              {/* Per-tab description */}
              {!loading && (
                <div style={{ padding: hasActiveFilters ? '4px 0 4px' : '12px 0 4px', fontSize: '12px', color: 'var(--text-3)', fontStyle: 'italic', lineHeight: 1.5 }}>
                  {exploreTab === 'best' && 'Lots priced below their real market value — ranked by conviction score.'}
                  {exploreTab === 'auctions' && 'Every lot currently on the market, across all tracked auction houses.'}
                  {exploreTab === 'primary' && 'Gallery and primary market listings — buy directly from galleries and artists.'}
                  {exploreTab === 'convictions' && 'AI-selected opportunities with score ≥ 75 — our highest-conviction signals.'}
                  {exploreTab === 'for-you' && 'Your personalized market intelligence — updated every 6 hours based on your collector profile.'}
                </div>
              )}
              {/* Count line */}
              {total > 0 && !loading && (
                <div style={{ padding: '4px 0 8px', fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                  {total.toLocaleString()} lots
                </div>
              )}

              {/* Loading */}
              {exploreTab !== 'for-you' && loading && <NautilusLoader />}

              {/* Error */}
              {exploreTab !== 'for-you' && !loading && hasError && lots.length === 0 && (
                <div style={{ textAlign: "center", padding: "60px 40px", display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                  <div style={{ fontFamily: "var(--font-serif)", fontSize: "18px", color: "var(--text)" }}>
                    Unable to connect
                  </div>
                  <p style={{ fontSize: "13px", color: "var(--text-3)", margin: 0, maxWidth: '280px' }}>
                    Check your connection and try again.
                  </p>
                  <button
                    onClick={doFetch}
                    style={{ padding: "10px 24px", background: "var(--navy)", color: "white", border: "none", borderRadius: "6px", fontSize: "13px", fontWeight: 700, cursor: "pointer", marginTop: '4px' }}
                  >
                    Retry
                  </button>
                </div>
              )}


              {/* ─── FOR YOU TAB ────────────────────────────── */}
              {exploreTab === 'for-you' && (
                <div style={{ padding: '8px 0' }}>
                  {!isAdmin && userPlan === 'free' ? (
                    <div style={{textAlign:'center',padding:'64px 24px',background:'#f8f8f6',borderRadius:8,marginTop:32,border:'1px solid #e8e4dc'}}>
                      <div style={{fontSize:11,letterSpacing:'0.2em',color:'#C6A85A',marginBottom:12,fontWeight:700}}>INVESTOR+ FEATURE</div>
                      <div style={{fontSize:22,fontFamily:'Georgia,serif',color:'#1A2A44',marginBottom:12}}>Personalized recommendations require an Investor plan</div>
                      <a href="/app/pricing" style={{display:'inline-block',background:'#2563EB',color:'#fff',padding:'14px 32px',fontSize:13,fontWeight:600,textDecoration:'none',borderRadius:4}}>Get Investor access — €19/mo →</a>
                    </div>
                  ) : (
                  <>
                  {recoLoading && <NautilusLoader label="SCANNING..." />}
                  {!recoLoading && !getToken() && (
                    <div style={{ textAlign: 'center', padding: '60px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                      <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)' }}>Sign in to see your recommendations</div>
                      <p style={{ fontSize: '13px', color: 'var(--text-3)', margin: 0, maxWidth: '300px' }}>Nautilus builds a personalized collector profile for you — sign in to unlock.</p>
                      <button onClick={() => navigate('/app/login')} style={{ background: 'var(--navy)', color: 'white', border: 'none', borderRadius: '6px', padding: '12px 28px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', marginTop: '4px' }}>
                        Sign in
                      </button>
                    </div>
                  )}
                  {!recoLoading && recoDone && getToken() && recos.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '60px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                      <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)' }}>Your recommendations are being generated</div>
                      <p style={{ fontSize: '13px', color: 'var(--text-3)', margin: 0, maxWidth: '320px' }}>Add works to your portfolio and tell Larry your preferences to unlock personalized recommendations.</p>
                      <p style={{ fontSize: '12px', color: 'var(--text-3)', margin: 0 }}>This usually takes less than 7 days of activity on the platform.</p>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '4px' }}>
                        <button onClick={() => navigate('/app/portfolio')} style={{ background: 'var(--navy)', color: 'white', border: 'none', borderRadius: '6px', padding: '12px 24px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                          Add to portfolio →
                        </button>
                        <button onClick={() => navigate('/app/agent')} style={{ background: 'transparent', color: 'var(--navy)', border: '1px solid rgba(10,22,40,0.2)', borderRadius: '6px', padding: '12px 24px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                          Talk to Larry
                        </button>
                      </div>
                    </div>
                  )}
                  {!recoLoading && recos.length > 0 && (
                    <>
                      <div style={{ marginBottom: '20px' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'var(--gold-subtle)', border: '1px solid var(--gold-border)', borderRadius: '20px', padding: '4px 12px', marginBottom: '12px' }}>
                          <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--gold-dim)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>
                            {recos.length} RECOMMENDATIONS · UPDATED 6H AGO
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                        {recos.map((reco: any, i: number) => {
                          const lot = reco.lot || reco;
                          const mapped = mapLot(lot);
                          const reason = reco.reason || reco.recommendation_reason || reco.type || '';
                          const reasonLabel = reason.includes('collection') ? 'Matches your collection' :
                            reason.includes('momentum') ? 'Artist momentum signal' :
                            reason.includes('price') ? 'Price below market median' :
                            reason.includes('style') ? 'Matches your taste' :
                            reason.includes('portfolio') ? 'Portfolio fit' :
                            'Recommended for you';
                          return (
                            <div key={reco.id || i} style={{ position: 'relative' }}>
                              <div style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 10, background: 'var(--navy)', color: 'var(--gold)', padding: '3px 8px', borderRadius: '3px', fontSize: '9px', fontWeight: 700, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', boxShadow: '0 2px 8px rgba(10,22,40,0.3)' }}>
                                ✦ {reasonLabel.toUpperCase()}
                              </div>
                              <AlphaCard lot={mapped} onClick={() => navigate(`/app/opportunities/${mapped.id}`)} locked={false} />
                              <div style={{ marginTop: '6px', padding: '6px 10px', background: 'var(--bg-subtle)', borderRadius: '5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '10px', color: 'var(--gold-dim)' }}>✦</span>
                                <span style={{ fontSize: '11px', color: 'var(--text-2)', lineHeight: 1.4 }}>{reasonLabel}</span>
                                <button
                                  onClick={async () => {
                                    const token = getToken();
                                    if (!token) return;
                                    try {
                                      const lotId = reco.lot?.id || reco.id;
                                      await fetch(`${BACKEND}/api/recommendations/dismiss/${lotId}`, {
                                        method: 'POST', headers: { Authorization: `Bearer ${token}` },
                                      });
                                    } catch { /* silent */ }
                                    setRecos(prev => prev.filter((_, idx) => idx !== i));
                                  }}
                                  style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', flexShrink: 0 }}
                                  title="Dismiss"
                                >✕</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                  </>
                  )}
                </div>
              )}

              {/* List view */}
              {exploreTab !== 'for-you' && !loading && !hasError && lots.length > 0 && viewMode === "list" && (
                <div style={{ background: "white", border: "1px solid var(--border)", borderRadius: "10px", overflow: "hidden" }}>
                  {tab === "live" ? (
                    <>{/* Live list header */}<div style={{ display: "grid", gridTemplateColumns: "48px 1fr 160px 100px 130px 80px", gap: "12px", padding: "9px 16px", background: "var(--bg-subtle)", borderBottom: "1px solid var(--border)" }}>{["", "Artwork", "House", "Date", "Estimate", "Category"].map(h => <div key={h} className="label-caps">{h}</div>)}</div>{visibleLots.map(lot => <LiveListRow key={lot.id} lot={lot} onClick={() => navigate(`/app/opportunities/${lot.id}`)} />)}</>
                  ) : (
                    <>{/* Alpha list header */}<div style={{ display: "grid", gridTemplateColumns: "52px 2fr 1fr 90px 72px 64px", gap: "12px", padding: "10px 16px", background: "var(--bg-subtle)", borderBottom: "1px solid var(--border)" }}>{["", "Artwork", "Price", "Score", "Upside", "Date"].map(h => <div key={h} className="label-caps">{h}</div>)}</div>{[...visibleLots, ...lockedLots].map((lot, i) => { const isLocked = i >= visibleLots.length; return <div key={lot.id} style={{ position: "relative" }}><div onClick={isLocked ? undefined : () => navigate(`/app/opportunities/${lot.id}`)} style={{ display: "grid", gridTemplateColumns: "52px 2fr 1fr 90px 72px 64px", gap: "12px", padding: "11px 16px", borderBottom: "1px solid var(--border-light)", cursor: isLocked ? "default" : "pointer", transition: "background 0.1s", filter: isLocked ? "blur(3px)" : "none", userSelect: isLocked ? "none" : "auto", alignItems: "center" }} onMouseEnter={e => { if (!isLocked) (e.currentTarget as HTMLDivElement).style.background = "var(--bg-subtle)"; }} onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "white"; }}><div style={{ width: "44px", height: "44px", borderRadius: "4px", overflow: "hidden", background: "var(--bg-subtle)" }}><LotImage src={lot.imageUrl} alt="" /></div><div style={{ minWidth: 0 }}><div style={{ fontSize: "10px", fontWeight: 700, color: "var(--navy)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lot.artistName}</div><div style={{ fontSize: "12px", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lot.title}</div></div><div style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-2)" }}>{lot.price}</div><div style={{ display: "flex", gap: "3px", alignItems: "center" }}>{Array.from({ length: 5 }).map((_, j) => <div key={j} className={j < lot.score ? "score-dot filled" : "score-dot unfilled"} />)}</div><div>{lot.upsidePercent > 0 ? <span className="upside-badge">+{lot.upsidePercent}%</span> : <span style={{ color: "var(--text-3)" }}>—</span>}</div><div style={{ fontSize: "11px", color: "var(--text-3)" }}>{lot.auctionDate ? new Date(lot.auctionDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : "—"}</div></div>{isLocked && <div onClick={() => navigate("/app/pricing")} style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", background: "rgba(250,250,248,0.88)", backdropFilter: "blur(2px)", cursor: "pointer" }}><span style={{ fontSize: "14px" }}>🔒</span><span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text)" }}>Investor plan</span><span style={{ fontSize: "11px", color: "var(--text-3)" }}>from €29/month</span></div>}</div>; })}</>
                  )}
                </div>
              )}

              {/* Grid view */}
              {exploreTab !== 'for-you' && !loading && !hasError && lots.length > 0 && viewMode !== "list" && (
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
