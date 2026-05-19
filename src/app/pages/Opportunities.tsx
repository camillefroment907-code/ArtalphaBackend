import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router";
import { getPlanLimits, getUser } from "../../lib/auth";

const BACKEND = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';
import { FilterSidebar } from "../components/FilterSidebar";
import type { Filters } from "../components/FilterSidebar";

type ViewMode = "grid4" | "grid6" | "list";

// ── Source metadata ──────────────────────────────────────────
const SOURCE_FLAG: Record<string, string> = {
  drouot: "🇫🇷", interencheres: "🇫🇷",
  invaluable: "🇺🇸", liveauctioneers: "🇺🇸",
  sothebys: "🇬🇧", christies: "🇬🇧", bonhams: "🇬🇧",
  artsy: "🌐", catawiki: "🇳🇱", other: "🌐",
  phillips: "🇺🇸",
  artcurial: "🇫🇷",
  artsper: "🇫🇷",
  saatchi_art: "🇬🇧",
  singulart: "🇫🇷",
};

const SOURCE_LABEL: Record<string, string> = {
  drouot: "Drouot", interencheres: "Interenchères",
  invaluable: "Invaluable", liveauctioneers: "LiveAuctioneers",
  sothebys: "Sotheby's", christies: "Christie's", bonhams: "Bonhams",
  artsy: "Artsy", catawiki: "Catawiki", other: "Other",
  phillips: "Phillips",
  artcurial: "Artcurial",
  artsper: "Artsper",
  saatchi_art: "Saatchi Art",
  singulart: "Singulart",
};

// ── Sort maps ────────────────────────────────────────────────
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

// Alpha tab: label → API source value
const PLATFORM_API: Record<string, string> = {
  "Drouot": "drouot", "Interenchères": "interencheres",
  "Invaluable": "invaluable", "Sothebys": "sothebys",
  "Christies": "christies", "Bonhams": "bonhams",
  "Christie's": "christies", "Sotheby's": "sothebys",
};

// ── Source stats type ────────────────────────────────────────
interface SourceStat {
  source: string;
  lot_count: number;
  last_added: string | null;
  age_minutes: number | null;
  status: "fresh" | "stale" | "offline";
}

// ── Auth helper ──────────────────────────────────────────────
function getToken(): string {
  try {
    const raw = localStorage.getItem("artalpha_auth");
    return raw ? (JSON.parse(raw)?.token ?? "") : "";
  } catch { return ""; }
}

// ── API calls ────────────────────────────────────────────────
async function loadLots(params: Record<string, any>) {
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
  if (params.low_supply)         qs.set("low_supply", "true");

  const url = `/api/lots?${qs.toString()}`;
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${txt.slice(0, 100)}`);
  }
  const d = await res.json();
  const items = Array.isArray(d) ? d : (d.items || []);
  return { items, total: d.total || items.length, pages: d.pages || 1 };
}

async function fetchInvestorLots(budgetMin?: number, budgetMax?: number | null, horizon?: string): Promise<{ items: any[], total: number, pages: number }> {
  const qs = new URLSearchParams();
  if (budgetMin != null && budgetMin > 0) qs.set('budget_min', String(budgetMin));
  if (budgetMax != null) qs.set('budget_max', String(budgetMax));
  if (horizon) qs.set('horizon', horizon);
  qs.set('limit', '12');

  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BACKEND}/api/lots/for-investor?${qs}`, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const d = await res.json();
  return { items: d.items || [], total: d.total || 0, pages: 1 };
}

async function loadSourceStats(): Promise<SourceStat[]> {
  try {
    const res = await fetch(`${BACKEND}/api/lots/sources`);
    if (!res.ok) return [];
    return await res.json();
  } catch { return []; }
}

// ── Lot mapping ──────────────────────────────────────────────
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
    id: String(lot.id),
    artistName: lot.artist_name_raw?.trim() || "Unknown Artist",
    title: lot.title || "Untitled",
    price: price ? fmt(price) : "Prix sur demande",
    estimatedValue: estimate ? fmt(estimate) : "",
    estimateLow,
    estimateHigh,
    estimateLowFmt: estimateLow ? fmt(estimateLow) : "",
    estimateHighFmt: estimateHigh ? fmt(estimateHigh) : "",
    upside: upside > 0 ? `${upside}%` : "0%",
    score,
    dealScore: lot.deal_score || 0,
    imageUrl: lot.image_url || "",
    technique: lot.medium || lot.category || "",
    category: lot.category || "",
    platform: lot.auction_house_name?.split("—")[0].trim() || lot.source || "",
    rawPrice: price,
    auctionDate: lot.auction_date || "",
    upsidePercent: upside,
    source: lot.source || "",
    score_rationale: lot.score_rationale || null,
    confidence_score: lot.confidence_score || null,
    real_cost: lot.real_cost || null,
    supplyCount: lot.supply_count ?? null,
    isLowSupply: lot.is_low_supply ?? false,
  };
}

type MappedLot = ReturnType<typeof mapLot>;

// ── Skeleton components ──────────────────────────────────────
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
      onMouseEnter={e => {
        if (locked) return;
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = "translateY(-4px)";
        el.style.boxShadow = "0 12px 40px rgba(0,0,0,0.1)";
        el.style.borderColor = "rgba(26,42,68,0.2)";
        const img = el.querySelector("img") as HTMLImageElement | null;
        if (img) img.style.transform = "scale(1.05)";
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = "translateY(0)";
        el.style.boxShadow = "none";
        el.style.borderColor = "var(--border)";
        const img = el.querySelector("img") as HTMLImageElement | null;
        if (img) img.style.transform = "scale(1)";
      }}
      style={{
        background: "white", border: "1px solid var(--border)", borderRadius: "10px",
        overflow: "hidden", cursor: locked ? "default" : "pointer",
        transition: "transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease",
      }}
    >
      {/* Image + badges */}
      <div style={{ position: "relative", paddingTop: "75%", background: "var(--bg-subtle)", overflow: "hidden" }}>
        {lot.imageUrl ? (
          <img
            src={lot.imageUrl} alt=""
            style={{
              position: "absolute", inset: 0, width: "100%", height: "100%",
              objectFit: "cover", objectPosition: "center top",
              transition: "transform 0.5s ease",
            }}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: "var(--font-serif)", fontSize: "22px", color: "var(--border)" }}>◇</span>
          </div>
        )}

        {/* Tier badge top-left */}
        <div style={{
          position: "absolute", top: "10px", left: "10px",
          padding: "4px 10px",
          background: tierBg,
          border: `1px solid ${tierColor}40`,
          borderRadius: "4px",
        }}>
          <span style={{ fontSize: "10px", fontWeight: 800, color: tierColor, letterSpacing: "0.1em" }}>{tier}</span>
        </div>

        {/* Score badge top-right */}
        <div style={{
          position: "absolute", top: "10px", right: "10px",
          padding: "4px 8px",
          background: "rgba(250,250,248,0.92)", backdropFilter: "blur(4px)",
          borderRadius: "4px", border: "1px solid var(--border)",
        }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 700, color: "var(--navy)" }}>{Math.round(ds)}</span>
          <span style={{ fontSize: "9px", color: "var(--text-3)" }}>/100</span>
        </div>

        {/* Low supply badge */}
        {lot.isLowSupply && (
          <div style={{
            position: "absolute", bottom: "10px", left: "10px",
            padding: "3px 8px",
            background: "rgba(217,119,6,0.12)",
            border: "1px solid rgba(217,119,6,0.4)",
            borderRadius: "4px",
          }}>
            <span style={{ fontSize: "9px", fontWeight: 800, color: "#D97706", letterSpacing: "0.1em" }}>
              ◆ LOW SUPPLY
            </span>
          </div>
        )}

        {/* Bottom gradient */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "60px", background: "linear-gradient(to top, rgba(250,250,248,0.9), transparent)" }} />
      </div>

      {/* Info */}
      <div style={{ padding: "14px 16px" }}>
        {lot.artistName !== "Unknown Artist" && (
          <div style={{
            fontSize: "10px", fontWeight: 700, color: "var(--navy)",
            letterSpacing: "0.1em", textTransform: "uppercase",
            marginBottom: "3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {lot.artistName}
          </div>
        )}
        <div style={{
          fontFamily: "var(--font-serif)", fontSize: "14px", color: "var(--text)",
          marginBottom: "10px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {lot.title}
        </div>

        {/* Price + upside */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "10px" }}>
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--text-3)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "2px" }}>Mise à prix</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "15px", fontWeight: 700, color: "var(--text)" }}>
              {lot.price}
            </div>
            {lot.estimateLow > 0 && lot.rawPrice !== lot.estimateLow && (
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-3)" }}>
                est. {lot.estimateLowFmt}
              </div>
            )}
          </div>
          {lot.upsidePercent > 5 && (
            <div style={{ padding: "3px 8px", background: "rgba(26,42,68,0.08)", border: "1px solid rgba(26,42,68,0.15)", borderRadius: "4px" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 700, color: "var(--navy)" }}>
                +{lot.upsidePercent}% upside
              </span>
            </div>
          )}
        </div>
        {lot.real_cost && (
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "rgba(184,152,90,0.7)", marginTop: "-4px", marginBottom: "6px", letterSpacing: "0.05em" }}>
            Break-even: {lot.real_cost.breakeven_hammer >= 1_000_000
              ? `€${(lot.real_cost.breakeven_hammer / 1_000_000).toFixed(1)}M`
              : `€${(lot.real_cost.breakeven_hammer / 1_000).toFixed(0)}K`} (+{lot.real_cost.needed_gain_pct}%)
          </div>
        )}

        {/* AI Rationale */}
        {lot.score_rationale && (
          <div style={{ fontSize: "10px", color: "var(--text-3)", fontStyle: "italic", marginBottom: "10px", lineHeight: 1.45, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>
            {lot.score_rationale}
          </div>
        )}

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "10px", borderTop: "1px solid var(--border-light)" }}>
          <span style={{ fontSize: "11px", color: "var(--text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "140px" }}>
            {lot.platform}
          </span>
          {lot.auctionDate && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-3)", flexShrink: 0 }}>
              {new Date(lot.auctionDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── LiveCard ─────────────────────────────────────────────────
function LiveCard({ lot, onClick }: { lot: MappedLot; onClick: () => void }) {
  const src  = (lot.source || "").toLowerCase();
  const flag = SOURCE_FLAG[src] || "🌐";
  const ds = lot.dealScore;
  const tier      = ds >= 80 ? "EXCEPTIONAL" : ds >= 65 ? "STRONG" : ds >= 45 ? "INTERESTING" : null;
  const tierColor = tier === "EXCEPTIONAL" ? "#92400E" : tier === "STRONG" ? "#065F46" : "#1E40AF";
  const tierBg    = tier === "EXCEPTIONAL" ? "rgba(217,119,6,0.12)" : tier === "STRONG" ? "rgba(6,95,70,0.10)" : "rgba(30,64,175,0.10)";
  const tierBorder= tier === "EXCEPTIONAL" ? "rgba(217,119,6,0.4)" : tier === "STRONG" ? "rgba(6,95,70,0.3)" : "rgba(30,64,175,0.3)";

  return (
    <div
      onClick={onClick}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = "translateY(-4px)";
        el.style.boxShadow = "0 12px 40px rgba(0,0,0,0.1)";
        el.style.borderColor = "rgba(26,42,68,0.2)";
        const img = el.querySelector("img") as HTMLImageElement | null;
        if (img) img.style.transform = "scale(1.05)";
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = "translateY(0)";
        el.style.boxShadow = "none";
        el.style.borderColor = "var(--border)";
        const img = el.querySelector("img") as HTMLImageElement | null;
        if (img) img.style.transform = "scale(1)";
      }}
      style={{
        background: "white", borderRadius: "8px", overflow: "hidden", cursor: "pointer",
        border: "1px solid var(--border)",
        transition: "transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease",
      }}
    >
      {/* Image */}
      <div style={{ position: "relative", paddingTop: "65%", background: "var(--bg-subtle)", overflow: "hidden" }}>
        {lot.imageUrl ? (
          <img
            src={lot.imageUrl} alt=""
            style={{
              position: "absolute", inset: 0, width: "100%", height: "100%",
              objectFit: "cover", objectPosition: "center top",
              transition: "transform 0.4s ease",
            }}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: "var(--font-serif)", fontSize: "18px", color: "var(--border)" }}>◇</span>
          </div>
        )}

        {/* Source flag top-left */}
        <div style={{
          position: "absolute", top: "8px", left: "8px",
          padding: "2px 7px",
          background: "rgba(250,250,248,0.92)", backdropFilter: "blur(4px)",
          borderRadius: "3px", border: "1px solid var(--border)",
          fontSize: "11px", display: "flex", alignItems: "center", gap: "4px",
        }}>
          <span>{flag}</span>
          <span style={{ color: "var(--text-2)", fontSize: "10px" }}>{SOURCE_LABEL[src] || lot.source}</span>
        </div>

        {/* Deal score badge top-right */}
        {tier && (
          <div style={{
            position: "absolute", top: "8px", right: "8px",
            padding: "2px 7px",
            background: tierBg, border: `1px solid ${tierBorder}`,
            borderRadius: "3px",
          }}>
            <span style={{ fontSize: "8px", fontWeight: 800, color: tierColor, letterSpacing: "0.08em" }}>{tier}</span>
          </div>
        )}

        {/* Auction date bottom-right */}
        {lot.auctionDate && (
          <div style={{
            position: "absolute", bottom: "7px", right: "7px",
            background: "var(--navy)", color: "white",
            padding: "2px 7px", borderRadius: "3px", fontSize: "10px", fontWeight: 700,
          }}>
            {new Date(lot.auctionDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
          </div>
        )}

        {/* Low supply badge */}
        {lot.isLowSupply && (
          <div style={{
            position: "absolute", bottom: "7px", left: "7px",
            padding: "2px 7px",
            background: "rgba(217,119,6,0.12)",
            border: "1px solid rgba(217,119,6,0.4)",
            borderRadius: "3px",
          }}>
            <span style={{ fontSize: "8px", fontWeight: 800, color: "#D97706", letterSpacing: "0.08em" }}>◆ LOW SUPPLY</span>
          </div>
        )}

        {/* Category bottom-left */}
        {lot.category && (
          <div style={{
            position: "absolute", bottom: "7px", left: "8px",
            background: "rgba(250,250,248,0.88)", backdropFilter: "blur(3px)",
            padding: "2px 6px", borderRadius: "3px",
            fontSize: "9px", fontWeight: 600, color: "var(--text-2)",
            border: "1px solid rgba(0,0,0,0.08)",
          }}>
            {lot.category}
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: "10px 12px" }}>
        {lot.artistName !== "Unknown Artist" && (
          <div style={{
            fontSize: "10px", fontWeight: 700, color: "var(--text-2)",
            letterSpacing: "0.08em", textTransform: "uppercase",
            marginBottom: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {lot.artistName}
          </div>
        )}
        <div style={{ fontSize: "12px", color: "var(--text)", marginBottom: "6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {lot.title}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "13px", fontWeight: 600, color: "var(--text)" }}>
            {lot.price}
          </span>
          {(lot.estimateLow > 0 || lot.estimateHigh > 0) && (
            <span style={{ fontSize: "10px", color: "var(--text-3)", fontFamily: "var(--font-mono)" }}>
              est. {lot.estimateLowFmt}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── List row for live tab ────────────────────────────────────
function LiveListRow({ lot, onClick }: { lot: MappedLot; onClick: () => void }) {
  const src  = (lot.source || "").toLowerCase();
  const flag = SOURCE_FLAG[src] || "🌐";

  return (
    <div
      onClick={onClick}
      style={{
        display: "grid",
        gridTemplateColumns: "48px 1fr 160px 100px 130px 80px",
        gap: "12px", padding: "10px 16px",
        borderBottom: "1px solid var(--border-light)",
        cursor: "pointer", transition: "background 0.1s", alignItems: "center",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = "var(--bg-subtle)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "white"; }}
    >
      <div style={{ width: "44px", height: "44px", borderRadius: "4px", overflow: "hidden", background: "var(--bg-subtle)" }}>
        {lot.imageUrl && <img src={lot.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--navy)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {lot.artistName !== "Unknown Artist" ? lot.artistName : ""}
        </div>
        <div style={{ fontSize: "12px", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {lot.title}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "5px", minWidth: 0 }}>
        <span style={{ fontSize: "13px", flexShrink: 0 }}>{flag}</span>
        <span style={{ fontSize: "11px", color: "var(--text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {SOURCE_LABEL[src] || lot.source}
        </span>
      </div>
      <div style={{ fontSize: "11px", color: "var(--text-2)" }}>
        {lot.auctionDate ? new Date(lot.auctionDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "2-digit" }) : "—"}
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-2)" }}>
        {lot.estimateLow > 0
          ? (lot.estimateHigh > 0 && lot.estimateHigh !== lot.estimateLow
            ? `${lot.estimateLowFmt} – ${lot.estimateHighFmt}`
            : lot.estimateLowFmt)
          : lot.price}
      </div>
      <div>
        {lot.category && (
          <span style={{ fontSize: "9px", fontWeight: 600, color: "var(--text-3)", background: "var(--bg-subtle)", padding: "2px 6px", borderRadius: "3px", border: "1px solid var(--border-light)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
            {lot.category}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Icons ────────────────────────────────────────────────────
function IconGrid4() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor">
      <rect x="1" y="1" width="5.5" height="5.5" rx="1" />
      <rect x="8.5" y="1" width="5.5" height="5.5" rx="1" />
      <rect x="1" y="8.5" width="5.5" height="5.5" rx="1" />
      <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1" />
    </svg>
  );
}
function IconGrid6() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor">
      <rect x="1"    y="1"    width="3.5" height="3.5" rx="0.5" />
      <rect x="5.75" y="1"    width="3.5" height="3.5" rx="0.5" />
      <rect x="10.5" y="1"    width="3.5" height="3.5" rx="0.5" />
      <rect x="1"    y="5.75" width="3.5" height="3.5" rx="0.5" />
      <rect x="5.75" y="5.75" width="3.5" height="3.5" rx="0.5" />
      <rect x="10.5" y="5.75" width="3.5" height="3.5" rx="0.5" />
      <rect x="1"    y="10.5" width="3.5" height="3.5" rx="0.5" />
      <rect x="5.75" y="10.5" width="3.5" height="3.5" rx="0.5" />
      <rect x="10.5" y="10.5" width="3.5" height="3.5" rx="0.5" />
    </svg>
  );
}
function IconList() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor">
      <rect x="1" y="2"    width="3.5" height="3"   rx="0.5" />
      <rect x="6" y="2.5"  width="8"   height="1"   rx="0.5" />
      <rect x="6" y="4"    width="5"   height="1"   rx="0.5" />
      <rect x="1" y="6"    width="3.5" height="3"   rx="0.5" />
      <rect x="6" y="6.5"  width="8"   height="1"   rx="0.5" />
      <rect x="6" y="8"    width="5"   height="1"   rx="0.5" />
      <rect x="1" y="10"   width="3.5" height="3"   rx="0.5" />
      <rect x="6" y="10.5" width="8"   height="1"   rx="0.5" />
      <rect x="6" y="12"   width="5"   height="1"   rx="0.5" />
    </svg>
  );
}

// ── Date param helpers ───────────────────────────────────────
function getDateParams(filter: string): Record<string, string> {
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  if (filter === "today") return { auction_date_from: today, auction_date_to: today };
  if (filter === "3days") {
    const d = new Date(now); d.setDate(d.getDate() + 3);
    return { auction_date_from: today, auction_date_to: d.toISOString().split("T")[0] };
  }
  if (filter === "week") {
    const d = new Date(now); d.setDate(d.getDate() + 7);
    return { auction_date_from: today, auction_date_to: d.toISOString().split("T")[0] };
  }
  if (filter === "month") {
    const d = new Date(now); d.setMonth(d.getMonth() + 1);
    return { auction_date_from: today, auction_date_to: d.toISOString().split("T")[0] };
  }
  return {};
}

// ── Default filter state ─────────────────────────────────────
const DEFAULT_FILTERS: Filters = {
  searchQuery: "", sortBy: "", sources: [], auctionHouseSearch: "",
  platforms: [], scoreRange: [0, 5], upsideRange: "all",
  categories: [], mediums: [], minPrice: 0, maxPrice: 0,
  artistSearch: "", auctionDateFrom: "", auctionDateTo: "",
  countries: [], artistRating: "all", auctionTiming: "all",
  priceRange: [0, 1000000], artworkTypes: [], artists: [], sizes: [],
};

// ── Main component ───────────────────────────────────────────
export default function Opportunities() {
  const navigate = useNavigate();
  const [lots, setLots] = useState<MappedLot[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("grid4");
  const [dateFilter, setDateFilter] = useState("all");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [tab, setTab] = useState<"alpha" | "live">("alpha");
  const [sourceStats, setSourceStats] = useState<SourceStat[]>([]);
  const [lowSupply, setLowSupply] = useState(false);

  // Plan gating
  const limits     = getPlanLimits();
  const user       = getUser();
  const isAdmin    = user?.email === "camillefroment907@gmail.com";
  const maxVisible = isAdmin ? 9999 : (limits.maxOpportunities || 3);

  const fetchIdRef   = useRef(0);
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevSearchRef = useRef({ q: "", artist: "", house: "" });

  // ── Tier separation (alpha only) ─────────────────────────
  const alphaLots   = tab === "alpha" ? lots.filter(l => l.dealScore >= 45) : lots;
  const EXCEPTIONAL = alphaLots.filter(l => l.dealScore >= 80);
  const STRONG      = alphaLots.filter(l => l.dealScore >= 65 && l.dealScore < 80);
  const INTERESTING = alphaLots.filter(l => l.dealScore >= 45 && l.dealScore < 65);
  const avgScore    = alphaLots.length > 0
    ? alphaLots.reduce((a, l) => a + l.dealScore, 0) / alphaLots.length
    : 0;

  const visibleLots = tab === "alpha" ? alphaLots.slice(0, maxVisible) : lots;
  const lockedLots  = tab === "alpha" ? alphaLots.slice(maxVisible, maxVisible + 3) : [];

  // ── Build fetch params ───────────────────────────────────
  const buildFetchParams = useCallback((page = 1): Record<string, any> => {
    if (tab === "live") {
      const sort = LIVE_SORT_MAP[filters.sortBy || "created_at_desc"] || { by: "created_at", dir: "desc" };
      const dateFrom = filters.auctionDateFrom || getDateParams(dateFilter).auction_date_from;
      const dateTo   = filters.auctionDateTo   || getDateParams(dateFilter).auction_date_to;
      const sourcesStr = filters.sources?.length ? filters.sources.join(",") : undefined;
      return {
        page, page_size: 60,
        sort_by: sort.by, sort_dir: sort.dir,
        search:            filters.searchQuery || undefined,
        sources:           sourcesStr,
        auction_date_from: dateFrom || undefined,
        auction_date_to:   dateTo   || undefined,
        min_price:         filters.minPrice > 0 ? filters.minPrice : undefined,
        max_price:         filters.maxPrice > 0 ? filters.maxPrice : undefined,
        artist:            filters.artistSearch || undefined,
        category:          filters.categories?.length === 1 ? filters.categories[0] : undefined,
        medium:            filters.mediums?.length === 1 ? filters.mediums[0] : undefined,
        auction_house:     filters.auctionHouseSearch || undefined,
      };
    } else {
      const sort = ALPHA_SORT_MAP[filters.sortBy || "deal_score_desc"] || { by: "deal_score", dir: "desc" };
      const scoreMin = filters.scoreRange?.[0] > 0 ? filters.scoreRange[0] * 20 : undefined;
      const sourceKey = filters.platforms?.length === 1 ? filters.platforms[0] : null;
      const source = sourceKey ? (PLATFORM_API[sourceKey] || sourceKey.toLowerCase()) : undefined;
      const timingDates = filters.auctionTiming && filters.auctionTiming !== "all"
        ? getDateParams(filters.auctionTiming === "24h" ? "today" : filters.auctionTiming === "week" ? "week" : "month")
        : getDateParams(dateFilter);
      return {
        page, page_size: 48,
        sort_by: sort.by, sort_dir: sort.dir,
        search:      filters.searchQuery || undefined,
        source,
        min_score:   scoreMin,
        min_price:   filters.minPrice > 0 ? filters.minPrice : undefined,
        max_price:   filters.maxPrice > 0 ? filters.maxPrice : undefined,
        category:    filters.categories?.length === 1 ? filters.categories[0] : undefined,
        artist_tier: filters.artistRating !== "all" ? filters.artistRating : undefined,
        low_supply: lowSupply || undefined,
        ...timingDates,
      };
    }
  }, [filters, dateFilter, tab, lowSupply]);

  const buildFetchParamsRef = useRef(buildFetchParams);
  buildFetchParamsRef.current = buildFetchParams;

  // ── Reactive fetch ───────────────────────────────────────
  useEffect(() => {
    const id = ++fetchIdRef.current;

    const run = () => {
      setLoading(true);
      setHasError(false);
      setCurrentPage(1);

      let fetchPromise: Promise<{ items: any[], total: number, pages: number }>;
      if (tab === 'alpha') {
        const savedBudget = localStorage.getItem('artalpha-budget');
        const savedHorizon = localStorage.getItem('artalpha-horizon');
        if (savedBudget && savedHorizon) {
          try {
            const b = JSON.parse(savedBudget);
            fetchPromise = fetchInvestorLots(b.min, b.max, savedHorizon);
          } catch {
            fetchPromise = loadLots(buildFetchParamsRef.current(1));
          }
        } else {
          fetchPromise = loadLots(buildFetchParamsRef.current(1));
        }
      } else {
        fetchPromise = loadLots(buildFetchParamsRef.current(1));
      }

      fetchPromise
        .then(data => {
          if (id !== fetchIdRef.current) return;
          setLots(data.items.map(mapLot));
          setTotal(data.total);
          setTotalPages(data.pages);
        })
        .catch(() => { if (id === fetchIdRef.current) setHasError(true); })
        .finally(() => { if (id === fetchIdRef.current) setLoading(false); });
    };

    const isTextChange =
      filters.searchQuery        !== prevSearchRef.current.q      ||
      filters.artistSearch       !== prevSearchRef.current.artist  ||
      filters.auctionHouseSearch !== prevSearchRef.current.house;
    prevSearchRef.current = {
      q:      filters.searchQuery,
      artist: filters.artistSearch,
      house:  filters.auctionHouseSearch,
    };

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(run, isTextChange ? 300 : 0);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [
    tab, dateFilter,
    filters.searchQuery, filters.artistSearch, filters.auctionHouseSearch,
    filters.sortBy, filters.minPrice, filters.maxPrice,
    filters.auctionDateFrom, filters.auctionDateTo,
    filters.artistRating, filters.auctionTiming, filters.upsideRange,
    filters.scoreRange[0],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(filters.categories),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(filters.mediums),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(filters.sources),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(filters.platforms),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(filters.countries),
    lowSupply,
  ]);

  const doFetch = useCallback(() => {
    const id = ++fetchIdRef.current;
    setLoading(true);
    setHasError(false);
    setCurrentPage(1);
    loadLots(buildFetchParamsRef.current(1))
      .then(data => {
        if (id !== fetchIdRef.current) return;
        setLots(data.items.map(mapLot));
        setTotal(data.total);
        setTotalPages(data.pages);
      })
      .catch(() => { if (id === fetchIdRef.current) setHasError(true); })
      .finally(() => { if (id === fetchIdRef.current) setLoading(false); });
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || currentPage >= totalPages) return;
    const nextPage = currentPage + 1;
    setLoadingMore(true);
    try {
      const data = await loadLots(buildFetchParamsRef.current(nextPage));
      setLots(prev => [...prev, ...data.items.map(mapLot)]);
      setCurrentPage(nextPage);
    } catch { /* silent */ } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, currentPage, totalPages]);

  // Source stats for live tab
  useEffect(() => {
    if (tab !== "live") return;
    loadSourceStats().then(setSourceStats);
  }, [tab]);

  // Browser tab title
  useEffect(() => {
    document.title = tab === "alpha"
      ? "Best Lots · Nautilus"
      : "All Auctions · Nautilus";
  }, [tab]);

  // ── Derived values ───────────────────────────────────────
  const activeFilterCount = [
    filters.searchQuery,
    ...(filters.sources || []),
    ...(tab === "alpha" ? (filters.platforms || []) : []),
    ...(filters.categories || []),
    ...(filters.mediums || []),
    ...(filters.countries || []),
    filters.scoreRange?.[0] > 0,
    filters.upsideRange !== "all",
    filters.artistRating !== "all",
    filters.auctionTiming !== "all",
    filters.minPrice > 0 || filters.maxPrice > 0,
    filters.auctionDateFrom,
    filters.artistSearch,
    filters.auctionHouseSearch,
  ].filter(Boolean).length;

  const cols = viewMode === "list" ? 1 : viewMode === "grid6" ? 6 : tab === "live" ? 5 : 4;
  const gap  = cols >= 5 ? "12px" : "16px";

  const VIEW_MODES: { mode: ViewMode; icon: React.ReactNode; title: string }[] = [
    { mode: "grid4", icon: <IconGrid4 />, title: "4 columns" },
    { mode: "grid6", icon: <IconGrid6 />, title: "6 columns" },
    { mode: "list",  icon: <IconList />,  title: "List view" },
  ];

  const DATE_CHIPS = [
    { v: "all",   l: "All dates"  },
    { v: "today", l: "Today"      },
    { v: "3days", l: "3 days"     },
    { v: "week",  l: "This week"  },
    { v: "month", l: "This month" },
  ];

  const sourceDotColor = (status: string) =>
    status === "fresh" ? "var(--navy)" : status === "stale" ? "#B8961E" : "var(--text-3)";

  return (
    <div
      className="page"
      style={{
        display: "flex", width: "100vw", height: "100vh",
        overflow: "hidden", background: "var(--bg)",
        position: "fixed", top: 0, left: 0,
      }}
    >
      {/* ── SIDEBAR ────────────────────────────────────────── */}
      <div
        className="no-scrollbar"
        style={{
          width: sidebarOpen ? "280px" : "0px",
          minWidth: sidebarOpen ? "280px" : "0px",
          height: "100%",
          overflowY: sidebarOpen ? "auto" : "hidden",
          overflowX: "hidden",
          borderRight: sidebarOpen ? "1px solid var(--border)" : "none",
          background: "white", flexShrink: 0,
          transition: "width 0.25s ease, min-width 0.25s ease",
        }}
      >
        {sidebarOpen && (
          <FilterSidebar onFilterChange={setFilters} tab={tab} />
        )}
      </div>

      {/* ── MAIN ───────────────────────────────────────────── */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>

        {/* Sticky toolbar */}
        <div style={{
          padding: "10px 20px", borderBottom: "1px solid var(--border)",
          background: "rgba(250,250,248,0.96)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", gap: "10px",
          flexShrink: 0, flexWrap: "wrap",
        }}>
          {/* Sidebar toggle */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <button
              onClick={() => setSidebarOpen(o => !o)}
              style={{
                display: "flex", alignItems: "center", gap: "6px",
                padding: "7px 13px", background: "white",
                border: "1px solid var(--border)", borderRadius: "6px",
                cursor: "pointer", fontSize: "12px", color: "var(--text-2)",
                transition: "all 0.15s var(--ease)",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--navy)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--navy)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-2)"; }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <rect x="0" y="2"    width="14" height="1.5" rx="0.5" />
                <rect x="0" y="6.25" width="9"  height="1.5" rx="0.5" />
                <rect x="0" y="10.5" width="11" height="1.5" rx="0.5" />
              </svg>
              {sidebarOpen ? "Hide" : "Filters"}
            </button>
            {!sidebarOpen && activeFilterCount > 0 && (
              <span style={{
                position: "absolute", top: "-6px", right: "-6px",
                minWidth: "17px", height: "17px", borderRadius: "9px",
                background: "var(--gold)", color: "white",
                fontSize: "9px", fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px",
              }}>
                {activeFilterCount}
              </span>
            )}
          </div>

          {/* Source health monitor — live tab */}
          {tab === "live" && sourceStats.filter(s => s.lot_count > 0).length > 0 && (
            <div style={{
              display: "flex", gap: "10px", alignItems: "center",
              padding: "5px 12px", background: "white",
              border: "1px solid var(--border)", borderRadius: "6px", flexShrink: 0,
            }}>
              {sourceStats.filter(s => s.lot_count > 0).slice(0, 6).map(s => (
                <div
                  key={s.source}
                  style={{ display: "flex", alignItems: "center", gap: "4px" }}
                  title={`${SOURCE_LABEL[s.source] || s.source}: ${s.lot_count.toLocaleString()} lots · ${s.status}${s.age_minutes != null ? ` · updated ${s.age_minutes}min ago` : ""}`}
                >
                  <span style={{
                    width: "6px", height: "6px", borderRadius: "50%",
                    background: sourceDotColor(s.status), display: "inline-block", flexShrink: 0,
                  }} />
                  <span style={{ fontSize: "10px", color: "var(--text-3)", whiteSpace: "nowrap" }}>
                    {SOURCE_LABEL[s.source] || s.source}
                    <span style={{ color: "var(--text-3)", fontFamily: "var(--font-mono)", marginLeft: "3px", fontSize: "9px" }}>
                      {s.lot_count > 999 ? `${(s.lot_count / 1000).toFixed(1)}k` : s.lot_count}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Title + count */}
          <div style={{ display: "flex", alignItems: "baseline", gap: "10px", flex: 1, minWidth: 0 }}>
            <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "20px", fontWeight: 600, color: "var(--navy)", whiteSpace: "nowrap" }}>
              {tab === "live" ? "All Auctions" : "Best Lots"}
            </h1>
            <span style={{ fontSize: "12px", color: "var(--text-3)" }}>
              {loading ? "…" : `${total.toLocaleString()} lots`}
            </span>
          </div>

          {/* Date chips */}
          <div style={{ display: "flex", gap: "5px", flexShrink: 0 }}>
            {DATE_CHIPS.map(({ v, l }) => (
              <button
                key={v}
                onClick={() => setDateFilter(v)}
                style={{
                  padding: "5px 11px",
                  background: dateFilter === v ? "var(--navy)" : "white",
                  color: dateFilter === v ? "white" : "var(--text-2)",
                  border: `1px solid ${dateFilter === v ? "var(--navy)" : "var(--border)"}`,
                  borderRadius: "20px", fontSize: "11px",
                  fontWeight: dateFilter === v ? 600 : 400,
                  cursor: "pointer", transition: "all 0.15s var(--ease)", whiteSpace: "nowrap",
                }}
              >{l}</button>
            ))}
          </div>

          {/* Low Supply filter chip */}
          <button
            onClick={() => setLowSupply(v => !v)}
            style={{
              display: "flex", alignItems: "center", gap: "5px",
              padding: "5px 12px",
              background: lowSupply ? "rgba(217,119,6,0.1)" : "white",
              border: `1px solid ${lowSupply ? "rgba(217,119,6,0.5)" : "var(--border)"}`,
              borderRadius: "20px", cursor: "pointer",
              fontSize: "11px", fontWeight: lowSupply ? 700 : 500,
              color: lowSupply ? "#D97706" : "var(--text-2)",
              transition: "all 0.15s", flexShrink: 0, whiteSpace: "nowrap",
            }}
          >
            <span style={{ fontSize: "9px" }}>◆</span>
            Low Supply
          </button>

          {/* View mode switcher */}
          <div style={{ display: "flex", border: "1px solid var(--border)", borderRadius: "6px", overflow: "hidden", flexShrink: 0 }}>
            {VIEW_MODES.map(({ mode, icon, title }, idx) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                title={title}
                style={{
                  padding: "7px 11px", border: "none",
                  borderRight: idx < 2 ? "1px solid var(--border)" : "none",
                  cursor: "pointer",
                  background: viewMode === mode ? "var(--navy)" : "white",
                  color: viewMode === mode ? "white" : "var(--text-3)",
                  transition: "all 0.1s", display: "flex", alignItems: "center",
                }}
              >{icon}</button>
            ))}
          </div>
        </div>

        {/* ── TAB BAR ─────────────────────────────────────── */}
        <div style={{
          display: "flex", borderBottom: "2px solid var(--border)",
          background: "white", flexShrink: 0, paddingLeft: "20px",
        }}>
          {([
            { id: "alpha" as const, label: "Best Lots",    desc: "AI-detected undervalued artworks", icon: "◆" },
            { id: "live"  as const, label: "All Auctions", desc: "All upcoming lots worldwide",      icon: "◉" },
          ] as const).map(({ id, label, desc, icon }) => (
            <button
              key={id}
              onClick={() => { setTab(id); setFilters(DEFAULT_FILTERS); }}
              style={{
                padding: "12px 20px", background: "transparent", border: "none",
                borderBottom: tab === id ? "2px solid var(--navy)" : "2px solid transparent",
                marginBottom: "-2px", cursor: "pointer", textAlign: "left",
                transition: "all 0.15s ease", display: "flex", flexDirection: "column", gap: "2px",
              }}
            >
              <div style={{
                display: "flex", alignItems: "center", gap: "7px",
                fontSize: "13px", fontWeight: tab === id ? 600 : 400,
                color: tab === id ? "var(--navy)" : "var(--text-2)",
              }}>
                <span style={{ color: tab === id ? "var(--gold)" : "var(--text-3)", fontSize: "11px" }}>{icon}</span>
                {label}
              </div>
              <div style={{ fontSize: "10px", color: "var(--text-3)", letterSpacing: "0.02em" }}>{desc}</div>
            </button>
          ))}

          <div style={{ flex: 1 }} />

          <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "0 20px" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--gold)", animation: "pulseDot 2s infinite" }} />
            <span style={{ fontSize: "10px", color: "var(--text-3)", fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              LIVE · 15min
            </span>
          </div>
        </div>

        {/* ── SCROLLABLE CONTENT ──────────────────────────── */}
        <div className="no-scrollbar" style={{ flex: 1, overflowY: "auto", padding: "20px 24px 60px" }}>

          {/* Alpha stats bar */}
          {tab === "alpha" && !loading && alphaLots.length > 0 && (
            <div style={{
              display: "flex", gap: "24px", padding: "12px 0 16px",
              marginBottom: "8px", borderBottom: "1px solid var(--border-light)",
              flexWrap: "wrap", alignItems: "center",
            }}>
              {[
                { label: "Exceptional", value: EXCEPTIONAL.length, color: "#C0392B" },
                { label: "Strong",      value: STRONG.length,      color: "var(--navy)" },
                { label: "Interesting", value: INTERESTING.length,  color: "var(--gold-dim)" },
                { label: "Avg score",   value: `${avgScore.toFixed(0)}/100`, color: "var(--text-2)" },
              ].map(({ label, value, color }) => (
                <div key={label}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "20px", fontWeight: 700, color }}>{value}</div>
                  <div className="label-caps" style={{ marginTop: "2px" }}>{label}</div>
                </div>
              ))}
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "6px" }}>
                <div className="pulse-dot" />
                <span style={{ fontSize: "11px", color: "var(--text-3)" }}>LIVE · 15min</span>
              </div>
            </div>
          )}

          {/* Live stats bar */}
          {tab === "live" && !loading && (
            <div style={{
              display: "flex", gap: "32px", padding: "14px 0", marginBottom: "16px",
              borderBottom: "1px solid var(--border)",
            }}>
              {[
                { label: "Total lots",     value: total.toLocaleString() },
                { label: "Sources active", value: String(sourceStats.filter(s => s.status === "fresh").length || sourceStats.filter(s => s.lot_count > 0).length || "—") },
                { label: "Updated",        value: "< 15 min" },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "20px", fontWeight: 700, color: "var(--navy)" }}>{value}</div>
                  <div className="label-caps" style={{ marginTop: "3px" }}>{label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Skeleton */}
          {loading && viewMode === "list" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="skeleton" style={{ height: "64px", marginBottom: "1px" }} />
              ))}
            </div>
          )}
          {loading && viewMode !== "list" && (
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap }}>
              {Array.from({ length: cols * 2 }).map((_, i) => (
                tab === "live" ? <LiveSkeleton key={i} /> : <AlphaSkeleton key={i} />
              ))}
            </div>
          )}

          {/* Error */}
          {!loading && hasError && (
            <div style={{ textAlign: "center", padding: "80px 20px" }}>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: "36px", color: "var(--border)", marginBottom: "16px" }}>◇</div>
              <div style={{ fontSize: "15px", color: "var(--text-2)", marginBottom: "20px" }}>Unable to connect to the auction database</div>
              <button onClick={doFetch} className="btn btn-navy" style={{ fontSize: "12px", padding: "9px 20px" }}>Try again</button>
            </div>
          )}


          {/* ── LIST VIEW ────────────────────────────────── */}
          {!loading && !hasError && lots.length > 0 && viewMode === "list" && (
            <div style={{ background: "white", border: "1px solid var(--border)", borderRadius: "10px", overflow: "hidden" }}>
              {tab === "live" ? (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "48px 1fr 160px 100px 130px 80px", gap: "12px", padding: "9px 16px", background: "var(--bg-subtle)", borderBottom: "1px solid var(--border)" }}>
                    {["", "Artwork", "House", "Date", "Estimate", "Category"].map(h => (
                      <div key={h} className="label-caps">{h}</div>
                    ))}
                  </div>
                  {lots.map(lot => (
                    <LiveListRow
                      key={lot.id}
                      lot={lot}
                      onClick={() => navigate(`/app/opportunities/${lot.id}`)}
                    />
                  ))}
                </>
              ) : (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "52px 2fr 1fr 90px 72px 64px", gap: "12px", padding: "10px 16px", background: "var(--bg-subtle)", borderBottom: "1px solid var(--border)" }}>
                    {["", "Artwork", "Price", "Score", "Upside", "Date"].map(h => (
                      <div key={h} className="label-caps">{h}</div>
                    ))}
                  </div>
                  {[...visibleLots, ...lockedLots].map((lot, i) => {
                    const isLocked = i >= visibleLots.length;
                    return (
                      <div key={lot.id} style={{ position: "relative" }}>
                        <div
                          onClick={isLocked ? undefined : () => navigate(`/app/opportunities/${lot.id}`)}
                          style={{
                            display: "grid", gridTemplateColumns: "52px 2fr 1fr 90px 72px 64px",
                            gap: "12px", padding: "11px 16px",
                            borderBottom: "1px solid var(--border-light)",
                            cursor: isLocked ? "default" : "pointer", transition: "background 0.1s",
                            filter: isLocked ? "blur(3px)" : "none",
                            userSelect: isLocked ? "none" : "auto",
                            alignItems: "center",
                          }}
                          onMouseEnter={e => { if (!isLocked) (e.currentTarget as HTMLDivElement).style.background = "var(--bg-subtle)"; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "white"; }}
                        >
                          <div style={{ width: "44px", height: "44px", borderRadius: "4px", overflow: "hidden", background: "var(--bg-subtle)" }}>
                            {lot.imageUrl && <img src={lot.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--navy)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lot.artistName}</div>
                            <div style={{ fontSize: "12px", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lot.title}</div>
                          </div>
                          <div style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-2)" }}>{lot.price}</div>
                          <div style={{ display: "flex", gap: "3px", alignItems: "center" }}>
                            {Array.from({ length: 5 }).map((_, j) => (
                              <div key={j} className={j < lot.score ? "score-dot filled" : "score-dot unfilled"} />
                            ))}
                          </div>
                          <div>
                            {lot.upsidePercent > 0
                              ? <span className="upside-badge">+{lot.upsidePercent}%</span>
                              : <span style={{ color: "var(--text-3)" }}>—</span>}
                          </div>
                          <div style={{ fontSize: "11px", color: "var(--text-3)" }}>
                            {lot.auctionDate ? new Date(lot.auctionDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : "—"}
                          </div>
                        </div>
                        {isLocked && (
                          <div
                            onClick={() => navigate("/app/pricing")}
                            style={{
                              position: "absolute", inset: 0,
                              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                              background: "rgba(250,250,248,0.88)", backdropFilter: "blur(2px)",
                              cursor: "pointer",
                            }}
                          >
                            <span style={{ fontSize: "14px" }}>🔒</span>
                            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text)" }}>Investor plan</span>
                            <span style={{ fontSize: "11px", color: "var(--text-3)" }}>from €19/month</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}

          {/* ── GRID VIEWS ──────────────────────────────── */}
          {!loading && !hasError && lots.length > 0 && viewMode !== "list" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap, width: "100%" }}>
                {visibleLots.map((lot, i) => (
                  <div key={lot.id} className="fade-up" style={{ animationDelay: `${Math.min(i * 0.04, 0.4)}s`, minWidth: 0 }}>
                    {tab === "live" ? (
                      <LiveCard lot={lot} onClick={() => navigate(`/app/opportunities/${lot.id}`)} />
                    ) : (
                      <AlphaCard lot={lot} onClick={() => navigate(`/app/opportunities/${lot.id}`)} locked={false} />
                    )}
                  </div>
                ))}

                {/* Locked alpha cards */}
                {tab === "alpha" && lockedLots.map(lot => (
                  <div key={lot.id} style={{ position: "relative", minWidth: 0 }}>
                    <AlphaCard lot={lot} onClick={() => {}} locked={true} />
                    <div
                      onClick={() => navigate("/app/pricing")}
                      style={{
                        position: "absolute", inset: 0,
                        display: "flex", flexDirection: "column",
                        alignItems: "center", justifyContent: "center",
                        background: "rgba(250,250,248,0.88)", backdropFilter: "blur(2px)",
                        borderRadius: "10px", cursor: "pointer",
                      }}
                    >
                      <div style={{ fontSize: "16px", marginBottom: "6px" }}>🔒</div>
                      <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text)" }}>Investor plan</div>
                      <div style={{ fontSize: "11px", color: "var(--text-3)" }}>from €19/month</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Upgrade banner — alpha tab */}
              {tab === "alpha" && !isAdmin && alphaLots.length > maxVisible && (
                <div style={{
                  marginTop: "32px", padding: "32px 40px",
                  background: "white", border: "1px solid var(--border)",
                  borderRadius: "12px", textAlign: "center", boxShadow: "var(--shadow-sm)",
                }}>
                  <div style={{ fontFamily: "var(--font-serif)", fontSize: "22px", color: "var(--navy)", marginBottom: "8px" }}>
                    {alphaLots.length - maxVisible} more opportunities available
                  </div>
                  <p style={{ fontSize: "14px", color: "var(--text-2)", margin: "0 auto 24px", maxWidth: "420px", lineHeight: 1.7 }}>
                    Upgrade to Investor to unlock all AI-screened opportunities, full analysis, and real-time alerts.
                  </p>
                  <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
                    <button onClick={() => navigate("/app/pricing")} className="btn btn-navy" style={{ fontSize: "12px" }}>
                      Unlock All Opportunities →
                    </button>
                  </div>
                  <div style={{ marginTop: "12px", fontSize: "12px", color: "var(--text-3)" }}>
                    7-day free trial · No credit card required
                  </div>
                </div>
              )}

              {/* Load more — live tab */}
              {tab === "live" && !loading && !hasError && lots.length > 0 && currentPage < totalPages && (
                <div style={{ display: "flex", justifyContent: "center", marginTop: "32px" }}>
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    style={{
                      padding: "10px 32px", background: "white",
                      border: "1px solid var(--border)", borderRadius: "6px",
                      fontSize: "13px", color: "var(--text-2)",
                      cursor: loadingMore ? "default" : "pointer",
                      transition: "all 0.15s", opacity: loadingMore ? 0.6 : 1,
                    }}
                    onMouseEnter={e => { if (!loadingMore) { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--navy)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--navy)"; } }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-2)"; }}
                  >
                    {loadingMore ? "Loading…" : `Load more · ${Math.min((totalPages - currentPage) * 60, total - lots.length)} remaining`}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
