"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Zap, Flame, TrendingUp, LayoutGrid,
  List, Columns3, RefreshCw, X, Search
} from "lucide-react";
import { GalleryCard } from "@/components/lots/GalleryCard";
import { LotRow } from "@/components/lots/LotCard";

type ViewMode = "masonry" | "grid" | "list";
type FeedMode = "all" | "deals" | "trending";

const CATEGORIES = [
  { value: "",                     label: "All Markets" },
  { value: "Peintures",            label: "Paintings"   },
  { value: "Dessins",              label: "Drawings"    },
  { value: "Art Asiatique",        label: "Asian Art"   },
  { value: "Livres & Manuscrits",  label: "Books"       },
  { value: "Bijoux & Montres",     label: "Jewelry"     },
  { value: "Rings",                label: "Rings"       },
  { value: "Necklaces & Pendants", label: "Necklaces"   },
  { value: "Earrings",             label: "Earrings"    },
];

export default function DashboardPage() {
  const [lots, setLots]           = useState<any[]>([]);
  const [total, setTotal]         = useState(0);
  const [pages, setPages]         = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage]           = useState(1);

  const [viewMode, setViewMode]         = useState<ViewMode>("masonry");
  const [feedMode, setFeedMode]         = useState<FeedMode>("all");
  const [category, setCategory]         = useState("");
  const [searchInput, setSearchInput]   = useState("");
  const [searchQuery, setSearchQuery]   = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [minScore, setMinScore]         = useState(0);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setSearchQuery(searchInput); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const fetchLots = useCallback(async () => {
    setIsLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.set("page", String(page));
      qs.set("page_size", viewMode === "list" ? "30" : "24");
      qs.set("sort_by", feedMode === "trending" ? "auction_date" : "deal_score");
      qs.set("sort_dir", "desc");
      if (feedMode === "deals") qs.set("is_deal", "true");
      if (category)     qs.set("category", category);
      if (searchQuery)  qs.set("search", searchQuery);
      if (sourceFilter) qs.set("source", sourceFilter);
      if (minScore > 0) qs.set("min_score", String(minScore));

      const res = await fetch(`/api/lots?${qs.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();

      if (Array.isArray(d)) {
        setLots(d); setTotal(d.length); setPages(1);
      } else {
        setLots(d.items || []); setTotal(d.total || 0); setPages(d.pages || 1);
      }
    } catch (e) {
      console.error("Fetch error:", e);
      setLots([]);
    } finally {
      setIsLoading(false);
    }
  }, [page, viewMode, feedMode, category, searchQuery, sourceFilter, minScore]);

  useEffect(() => { fetchLots(); }, [fetchLots]);

  const hasActiveFilters = !!(category || searchQuery || sourceFilter || minScore > 0 || feedMode !== "all");

  const clearAll = () => {
    setFeedMode("all"); setCategory(""); setSearchInput("");
    setSearchQuery(""); setSourceFilter(""); setMinScore(0); setPage(1);
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--obsidian)" }}>

      {/* ── TOP BAR ─────────────────────────────────────────── */}
      <div style={{
        height: "52px",
        borderBottom: "1px solid var(--border)",
        backgroundColor: "rgba(8,8,9,0.95)",
        display: "flex",
        alignItems: "center",
        padding: "0 20px",
        gap: "12px",
        position: "sticky",
        top: 0,
        zIndex: 30,
        backdropFilter: "blur(12px)",
      }}>
        {/* Brand + subtitle */}
        <div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", letterSpacing: "0.01em" }}>
            Live Feed
          </div>
          <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "1px", fontFamily: "monospace" }}>
            {isLoading ? "Loading…" : `${total.toLocaleString()} lots · Updated every 15min`}
          </div>
        </div>

        {/* Live badge */}
        <div style={{ display: "flex", alignItems: "center", gap: "5px", padding: "3px 9px", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: "3px" }}>
          <div className="live-dot" />
          <span style={{ fontSize: "10px", color: "#22c55e", fontWeight: 700, letterSpacing: "0.1em" }}>LIVE</span>
        </div>

        <div style={{ flex: 1 }} />

        {/* Feed mode tabs */}
        <div style={{ display: "flex", border: "1px solid var(--border)", borderRadius: "4px", overflow: "hidden" }}>
          {([
            { mode: "all"      as FeedMode, icon: <Zap size={12} />,        label: "All"      },
            { mode: "deals"    as FeedMode, icon: <Flame size={12} />,      label: "Deals"    },
            { mode: "trending" as FeedMode, icon: <TrendingUp size={12} />, label: "Trending" },
          ]).map(({ mode, icon, label }) => (
            <button
              key={mode}
              onClick={() => { setFeedMode(mode); setPage(1); }}
              style={{
                display: "flex", alignItems: "center", gap: "5px",
                padding: "6px 12px", border: "none", cursor: "pointer",
                background: feedMode === mode ? "rgba(201,168,76,0.12)" : "transparent",
                color: feedMode === mode ? "var(--gold)" : "var(--text-muted)",
                fontSize: "12px", fontWeight: feedMode === mode ? 600 : 400,
                transition: "all 0.15s ease",
                borderRight: "1px solid var(--border)",
              }}
            >
              {icon}{label}
            </button>
          ))}
        </div>

        {/* View mode */}
        <div style={{ display: "flex", border: "1px solid var(--border)", borderRadius: "4px", overflow: "hidden" }}>
          {([
            { mode: "masonry" as ViewMode, icon: <Columns3 size={13} /> },
            { mode: "grid"    as ViewMode, icon: <LayoutGrid size={13} /> },
            { mode: "list"    as ViewMode, icon: <List size={13} /> },
          ]).map(({ mode, icon }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              style={{
                padding: "6px 10px", border: "none", cursor: "pointer",
                background: viewMode === mode ? "var(--gold)" : "transparent",
                color: viewMode === mode ? "#09090b" : "var(--text-muted)",
                transition: "all 0.1s ease",
                borderRight: "1px solid var(--border)",
              }}
            >
              {icon}
            </button>
          ))}
        </div>

        {/* Refresh */}
        <button
          onClick={fetchLots}
          style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: "4px", padding: "6px 9px", cursor: "pointer", color: "var(--text-muted)", transition: "all 0.15s ease", display: "flex", alignItems: "center" }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--gold)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--gold)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)"; }}
        >
          <RefreshCw size={13} style={{ animation: isLoading ? "spin 1s linear infinite" : "none" }} />
        </button>
      </div>

      {/* ── SEARCH + FILTERS BAR ────────────────────────────── */}
      <div style={{
        padding: "10px 20px",
        borderBottom: "1px solid var(--border)",
        backgroundColor: "var(--carbon)",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        flexWrap: "wrap",
      }}>
        {/* Search */}
        <div style={{ position: "relative", flex: "1 1 200px", maxWidth: "360px" }}>
          <Search size={13} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
          <input
            type="text"
            placeholder="Search artworks, artists…"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="input"
            style={{ paddingLeft: "32px", paddingRight: searchInput ? "32px" : "12px" }}
          />
          {searchInput && (
            <button onClick={() => { setSearchInput(""); setPage(1); }} style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "2px" }}>
              <X size={12} />
            </button>
          )}
        </div>

        {/* Source filter */}
        <select value={sourceFilter} onChange={e => { setSourceFilter(e.target.value); setPage(1); }} style={{ minWidth: "140px" }}>
          <option value="">All Sources</option>
          <option value="drouot">Drouot</option>
          <option value="interencheres">Interenchères</option>
          <option value="invaluable">Invaluable</option>
        </select>

        {/* Score filter */}
        <select value={minScore} onChange={e => { setMinScore(Number(e.target.value)); setPage(1); }} style={{ minWidth: "130px" }}>
          <option value={0}>Any score</option>
          <option value={60}>Score 60+</option>
          <option value={70}>Score 70+</option>
          <option value={75}>Score 75+ (Deal)</option>
          <option value={80}>Score 80+ (Hot)</option>
          <option value={90}>Score 90+ (Fire)</option>
        </select>

        {/* Clear */}
        {hasActiveFilters && (
          <button onClick={clearAll} style={{ display: "flex", alignItems: "center", gap: "5px", padding: "7px 12px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "4px", color: "#ef4444", fontSize: "12px", cursor: "pointer" }}>
            <X size={11} /> Clear
          </button>
        )}

        <div style={{ marginLeft: "auto", fontFamily: "monospace", fontSize: "11px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
          {isLoading ? "…" : `${total.toLocaleString()} results`}
        </div>
      </div>

      {/* ── CATEGORY TABS ───────────────────────────────────── */}
      <div style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--obsidian)", overflowX: "auto", display: "flex" }} className="no-scrollbar">
        <div style={{ display: "flex", padding: "0 20px", minWidth: "max-content" }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat.value}
              onClick={() => { setCategory(cat.value); setPage(1); }}
              style={{
                padding: "11px 16px",
                background: "transparent", border: "none",
                borderBottom: category === cat.value ? "2px solid var(--gold)" : "2px solid transparent",
                color: category === cat.value ? "var(--gold)" : "var(--text-muted)",
                fontSize: "12px",
                fontWeight: category === cat.value ? 600 : 400,
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.15s ease",
                letterSpacing: "0.02em",
              }}
              onMouseEnter={e => { if (category !== cat.value) (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)"; }}
              onMouseLeave={e => { if (category !== cat.value) (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)"; }}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── CONTENT ─────────────────────────────────────────── */}
      <main style={{ padding: "20px" }}>

        {/* Loading skeletons */}
        {isLoading && lots.length === 0 && (
          <div className="masonry-grid">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="masonry-item skeleton" style={{ height: `${220 + (i % 3) * 60}px` }} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && lots.length === 0 && (
          <div style={{ textAlign: "center", padding: "80px 20px" }}>
            <div style={{ fontFamily: "serif", fontSize: "48px", color: "var(--border)", marginBottom: "16px" }}>◇</div>
            <div style={{ color: "var(--text-muted)", fontSize: "14px", marginBottom: "12px" }}>No lots found</div>
            {hasActiveFilters && (
              <button onClick={clearAll} className="btn-ghost" style={{ margin: "0 auto" }}>Clear filters</button>
            )}
          </div>
        )}

        {/* Masonry */}
        {!isLoading && lots.length > 0 && viewMode === "masonry" && (
          <div className="masonry-grid">
            {lots.map((lot, i) => (
              <div key={lot.id} className="masonry-item">
                <GalleryCard lot={lot} index={i} />
              </div>
            ))}
          </div>
        )}

        {/* Grid */}
        {!isLoading && lots.length > 0 && viewMode === "grid" && (
          <div className="grid-view">
            {lots.map((lot, i) => (
              <GalleryCard key={lot.id} lot={lot} index={i} />
            ))}
          </div>
        )}

        {/* List */}
        {!isLoading && lots.length > 0 && viewMode === "list" && (
          <div style={{ background: "var(--graphite)", border: "1px solid var(--border)", borderRadius: "6px", overflow: "hidden" }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: "2fr 120px 120px 80px 100px 40px",
              gap: "12px",
              padding: "10px 16px",
              borderBottom: "1px solid var(--border)",
              background: "var(--carbon)",
            }}>
              {["ARTWORK", "ESTIMATE", "CURRENT", "SCORE", "DATE", ""].map(h => (
                <div key={h} style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", color: "var(--text-muted)" }}>{h}</div>
              ))}
            </div>
            {lots.map((lot, i) => <LotRow key={lot.id} lot={lot} index={i} />)}
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "4px", marginTop: "40px" }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: "7px 14px", background: "var(--graphite)", border: "1px solid var(--border)", borderRadius: "4px", color: "var(--text-muted)", cursor: page === 1 ? "not-allowed" : "pointer", fontSize: "12px", opacity: page === 1 ? 0.4 : 1 }}>
              ←
            </button>

            {Array.from({ length: Math.min(pages, 9) }, (_, i) => {
              const p = page <= 5 ? i + 1 : page - 4 + i;
              if (p < 1 || p > pages) return null;
              return (
                <button key={p} onClick={() => setPage(p)} style={{ padding: "7px 12px", background: page === p ? "var(--gold)" : "var(--graphite)", border: "1px solid var(--border)", borderRadius: "4px", color: page === p ? "#09090b" : "var(--text-muted)", cursor: "pointer", fontSize: "12px", fontWeight: page === p ? 700 : 400, fontFamily: "monospace", minWidth: "36px" }}>
                  {p}
                </button>
              );
            })}

            <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} style={{ padding: "7px 14px", background: "var(--graphite)", border: "1px solid var(--border)", borderRadius: "4px", color: "var(--text-muted)", cursor: page === pages ? "not-allowed" : "pointer", fontSize: "12px", opacity: page === pages ? 0.4 : 1 }}>
              →
            </button>

            <span style={{ fontFamily: "monospace", fontSize: "11px", color: "var(--text-muted)", marginLeft: "8px" }}>
              {page} / {pages}
            </span>
          </div>
        )}
      </main>
    </div>
  );
}
