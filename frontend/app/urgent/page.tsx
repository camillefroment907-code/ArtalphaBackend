"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TopPickLot {
  id: string;
  title: string | null;
  artist_name_raw: string | null;
  deal_score: number | null;
  pct_below_low_estimate: number | null;
  image_url: string | null;
  auction_house_name: string | null;
  auction_date: string | null;
  estimate_low: number | null;
  estimate_high: number | null;
  category: string | null;
  status: string | null;
}

interface TopPick {
  rec_type: string;
  score: number;
  reason: string;
  lot: TopPickLot;
}

interface LotCard {
  id: string;
  title: string | null;
  artist_name_raw: string | null;
  deal_score: number | null;
  pct_below_low_estimate: number | null;
  image_url: string | null;
  auction_house_name: string | null;
  auction_date: string | null;
  estimate_low: number | null;
  estimate_high: number | null;
  status: string | null;
}

interface MarketBrief {
  since: string;
  new_lots_count: number;
  closing_today_count: number;
  closing_soon: LotCard[];
  top_picks: TopPick[];
  agent_unread: number;
}

interface SaleSummary {
  house: string;
  lotCount: number;
  firstDate: string;
  displayDate: string;
  relevanceLabel: string | null;
  isUrgent: boolean;
}

interface Badge { label: string; color: string }

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseUTC(iso: string): number {
  return new Date(iso.endsWith("Z") ? iso : iso + "Z").getTime();
}

function hoursUntil(iso: string | null): number | null {
  if (!iso) return null;
  return (parseUTC(iso) - Date.now()) / 3_600_000;
}

function fmt(n: number | null | undefined): string {
  if (!n) return "—";
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `€${Math.round(n / 1_000)}K`;
  return `€${n.toLocaleString("fr-FR")}`;
}

function scoreColor(score: number | null): string {
  if (!score) return "#B8922A";
  if (score >= 85) return "#ef4444";
  if (score >= 75) return "#d97706";
  return "#B8922A";
}

function relativeDate(iso: string): string {
  const ms = parseUTC(iso);
  const h = (ms - Date.now()) / 3_600_000;
  if (h < 0) return "Terminée";
  const d = new Date(ms);
  const t = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (h < 1) return `Dans ${Math.round(h * 60)} min`;
  if (h < 6) return `Ce soir · ${t}`;
  if (h < 24) return `Aujourd'hui · ${t}`;
  if (h < 48) return `Demain · ${t}`;
  return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }) + ` · ${t}`;
}

function timeLabel(iso: string, live: boolean): { label: string; urgent: boolean; color: string } {
  const h = hoursUntil(iso);
  if (live) return { label: "En cours", urgent: true, color: "#22c55e" };
  if (h === null) return { label: "—", urgent: false, color: "#71717a" };
  if (h < 0) return { label: "Terminée", urgent: false, color: "#71717a" };
  if (h < 1) return { label: `Dans ${Math.round(h * 60)} min`, urgent: true, color: "#ef4444" };
  if (h < 6) return { label: `Dans ${Math.round(h)}h`, urgent: true, color: "#f97316" };
  if (h < 24) return { label: `Aujourd'hui`, urgent: false, color: "#d97706" };
  return { label: relativeDate(iso), urgent: false, color: "#71717a" };
}

// ── Badge logic ───────────────────────────────────────────────────────────────

function primaryBadge(pick: TopPick): Badge {
  const lot = pick.lot;
  const h = hoursUntil(lot.auction_date);

  if (h !== null && h > 0 && h < 6 && (lot.deal_score ?? 0) >= 80) {
    return { label: `⚡ Clôture dans ${Math.round(h)}h — conviction forte`, color: "#ef4444" };
  }

  switch (pick.rec_type) {
    case "agent_match":
      return { label: "◈ Correspond à votre stratégie", color: "#d97706" };
    case "preference_match":
      return { label: "◈ Correspond à vos préférences", color: "#d97706" };
    case "artist_momentum":
      return { label: "◈ Artiste dans votre profil", color: "#d97706" };
    case "category_match":
      return { label: "◈ Catégorie favorite", color: "#d97706" };
    case "budget_match":
      return { label: "◈ Dans votre budget", color: "#d97706" };
    case "period_match":
      return { label: "◈ Votre période de prédilection", color: "#d97706" };
    case "similar_to_saved":
      return { label: "◈ Similaire à vos favoris", color: "#d97706" };
    case "below_estimate":
    case "distressed_sale": {
      const pct = lot.pct_below_low_estimate;
      if (pct && pct >= 10) return { label: `↓ ${Math.round(pct)}% sous l'estimation basse`, color: "#22c55e" };
      return { label: "◈ Anomalie de prix détectée", color: "#22c55e" };
    }
    default: {
      const pct = lot.pct_below_low_estimate;
      if (pct && pct >= 15) return { label: `↓ ${Math.round(pct)}% sous l'estimation basse`, color: "#22c55e" };
      return { label: "◈ Opportunité du moment", color: "#d97706" };
    }
  }
}

function secondaryBadge(pick: TopPick): Badge | null {
  const pct = pick.lot.pct_below_low_estimate;
  if (pick.rec_type === "preference_match" && pct && pct >= 10) {
    return { label: `↓ ${Math.round(pct)}% sous l'estimation`, color: "#22c55e" };
  }
  return null;
}

// ── Derive sales ──────────────────────────────────────────────────────────────

function deriveSales(closingSoon: LotCard[], topPicks: TopPick[]): SaleSummary[] {
  const personalHouses = new Set(
    topPicks.map(p => p.lot.auction_house_name).filter(Boolean) as string[]
  );

  const map = new Map<string, SaleSummary>();
  for (const lot of closingSoon) {
    if (!lot.auction_house_name || !lot.auction_date) continue;
    const dateKey = lot.auction_date.slice(0, 10);
    const key = `${lot.auction_house_name}::${dateKey}`;
    const h = hoursUntil(lot.auction_date);
    if (!map.has(key)) {
      map.set(key, {
        house: lot.auction_house_name,
        lotCount: 0,
        firstDate: lot.auction_date,
        displayDate: relativeDate(lot.auction_date),
        relevanceLabel: personalHouses.has(lot.auction_house_name) ? "◈ Lots dans votre profil" : null,
        isUrgent: h !== null && h > 0 && h <= 6,
      });
    }
    map.get(key)!.lotCount++;
  }

  return [...map.values()]
    .sort((a, b) => {
      if (a.relevanceLabel && !b.relevanceLabel) return -1;
      if (!a.relevanceLabel && b.relevanceLabel) return 1;
      return parseUTC(a.firstDate) - parseUTC(b.firstDate);
    })
    .slice(0, 5);
}

// ── Larry signal ──────────────────────────────────────────────────────────────

function buildLarrySignal(brief: MarketBrief): string | null {
  if (brief.agent_unread > 0) {
    return `${brief.agent_unread} alerte${brief.agent_unread > 1 ? "s" : ""} de votre stratégie en attente de lecture.`;
  }
  const sinceH = Math.round((Date.now() - parseUTC(brief.since)) / 3_600_000);
  if (brief.new_lots_count > 0 && sinceH <= 48) {
    const t = sinceH < 1 ? "moins d'une heure" : sinceH === 1 ? "1h" : `${sinceH}h`;
    return `${brief.new_lots_count.toLocaleString("fr-FR")} nouveaux lots analysés depuis votre dernière visite (il y a ${t}).`;
  }
  if (brief.closing_today_count > 0) {
    const n = brief.closing_today_count;
    return `${n} vente${n > 1 ? "s clôturent" : " clôture"} dans les 24 prochaines heures.`;
  }
  return null;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ label, meta, color, action }: {
  label: string; meta?: string; color: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span style={{ fontFamily: "monospace", fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color }}>
          {label}
        </span>
        {meta && <span style={{ fontFamily: "monospace", fontSize: "10px", color: "#71717a" }}>{meta}</span>}
      </div>
      {action && (
        <button onClick={action.onClick} style={{ fontFamily: "monospace", fontSize: "10px", color: "#71717a", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          {action.label}
        </button>
      )}
    </div>
  );
}

function ConvictionCard({ pick, onClick }: { pick: TopPick; onClick: () => void }) {
  const lot = pick.lot;
  const pb = primaryBadge(pick);
  const sb = secondaryBadge(pick);
  const score = lot.deal_score ?? pick.score;
  const sColor = scoreColor(score);
  const h = hoursUntil(lot.auction_date);
  const live = lot.status === "live";
  const time = lot.auction_date ? timeLabel(lot.auction_date, live) : null;
  const isUrgent = h !== null && h > 0 && h < 24;

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === "Enter" && onClick()}
      style={{
        background: "#fff",
        border: "1px solid #e7e5e4",
        borderRadius: "8px",
        overflow: "hidden",
        cursor: "pointer",
        transition: "border-color 0.15s, box-shadow 0.15s",
        display: "flex",
        flexDirection: "column",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "#a8a29e";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "#e7e5e4";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
      }}
    >
      {/* Image */}
      <div style={{ width: "100%", aspectRatio: "4/3", position: "relative", overflow: "hidden", background: "#f5f5f4", flexShrink: 0 }}>
        {lot.image_url
          ? <img src={lot.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top", display: "block" }} />
          : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#d6d3d1", fontSize: "40px" }}>◇</div>
        }
        {/* Score badge */}
        <div style={{ position: "absolute", bottom: "10px", left: "10px", background: "rgba(10,10,11,0.75)", backdropFilter: "blur(6px)", borderRadius: "4px", padding: "4px 8px", display: "flex", alignItems: "baseline", gap: "2px" }}>
          <span style={{ fontFamily: "monospace", fontSize: "16px", fontWeight: 700, color: sColor, lineHeight: 1 }}>{Math.round(score)}</span>
          <span style={{ fontFamily: "monospace", fontSize: "9px", color: "rgba(255,255,255,0.4)" }}>/100</span>
        </div>
        {isUrgent && h !== null && (
          <div style={{ position: "absolute", bottom: "10px", right: "10px", background: "rgba(239,68,68,0.85)", backdropFilter: "blur(6px)", borderRadius: "4px", padding: "4px 8px", fontFamily: "monospace", fontSize: "9px", fontWeight: 700, color: "white", letterSpacing: "0.06em" }}>
            ⚡ {Math.round(h)}H
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: "14px 16px 16px", flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ fontFamily: "monospace", fontSize: "10px", fontWeight: 700, color: pb.color, letterSpacing: "0.04em", marginBottom: sb ? "2px" : "10px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {pb.label}
        </div>
        {sb && (
          <div style={{ fontFamily: "monospace", fontSize: "9px", color: sb.color, letterSpacing: "0.04em", marginBottom: "10px" }}>
            {sb.label}
          </div>
        )}
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "17px", fontWeight: 400, color: "#1c1917", lineHeight: 1.2, marginBottom: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {lot.artist_name_raw || "—"}
        </div>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "12px", fontStyle: "italic", color: "#57534e", lineHeight: 1.4, marginBottom: "12px", minHeight: "16px", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {lot.title || ""}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", fontSize: "11px", fontFamily: "monospace", color: "#78716c", marginBottom: "14px", marginTop: "auto" }}>
          {(lot.estimate_low || lot.estimate_high) && (
            <span>Est. {fmt(lot.estimate_low)}{lot.estimate_high ? ` – ${fmt(lot.estimate_high)}` : ""}</span>
          )}
          {lot.auction_house_name && <span>· {lot.auction_house_name}</span>}
          {time && (
            <span style={{ color: time.urgent ? time.color : "inherit" }}>
              · {time.urgent ? "⚡ " : ""}{time.label}
            </span>
          )}
        </div>
        <button
          onClick={e => { e.stopPropagation(); onClick(); }}
          style={{ width: "100%", padding: "10px", background: "#1c1917", color: "#fff", border: "none", borderRadius: "5px", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "sans-serif", letterSpacing: "0.01em", transition: "background 0.15s" }}
          onMouseEnter={e => (e.currentTarget.style.background = "#292524")}
          onMouseLeave={e => (e.currentTarget.style.background = "#1c1917")}
        >
          Voir le lot →
        </button>
      </div>
    </div>
  );
}

function TimerRow({ lot, onClick }: { lot: LotCard; onClick: () => void }) {
  const live = lot.status === "live";
  const h = hoursUntil(lot.auction_date);
  const time = lot.auction_date ? timeLabel(lot.auction_date, live) : null;
  const progressFraction = h !== null ? Math.max(0, Math.min(1, h / 6)) : 0;
  const barColor = h !== null ? (h < 1 ? "#ef4444" : h < 3 ? "#f97316" : "#d97706") : "#d97706";

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === "Enter" && onClick()}
      style={{ display: "grid", gridTemplateColumns: "44px 1fr 100px 150px", alignItems: "center", gap: "12px", padding: "10px 14px", background: "#fff", border: "1px solid #e7e5e4", borderRadius: "4px", cursor: "pointer", transition: "background 0.1s" }}
      onMouseEnter={e => (e.currentTarget.style.background = "#fafaf9")}
      onMouseLeave={e => (e.currentTarget.style.background = "#fff")}
    >
      <div style={{ width: "44px", height: "44px", borderRadius: "4px", overflow: "hidden", background: "#f5f5f4", flexShrink: 0 }}>
        {lot.image_url
          ? <img src={lot.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#d6d3d1", fontSize: "14px" }}>◇</div>
        }
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: "13px", fontWeight: 600, color: "#1c1917", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {lot.artist_name_raw || "—"}
        </div>
        {lot.title && (
          <div style={{ fontSize: "11px", color: "#78716c", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {lot.title}
          </div>
        )}
      </div>
      <div style={{ textAlign: "right", minWidth: 0 }}>
        <div style={{ fontSize: "12px", fontFamily: "monospace", color: "#1c1917", marginBottom: "2px" }}>{fmt(lot.estimate_low)}</div>
        {lot.auction_house_name && (
          <div style={{ fontSize: "10px", color: "#78716c", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {lot.auction_house_name.length > 18 ? lot.auction_house_name.slice(0, 16) + "…" : lot.auction_house_name}
          </div>
        )}
      </div>
      <div style={{ flexShrink: 0 }}>
        <div style={{ fontSize: "11px", fontFamily: "monospace", fontWeight: 700, color: time?.urgent ? time.color : barColor, marginBottom: "5px", textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {time ? `${time.urgent ? "⚡ " : ""}${time.label}` : "—"}
        </div>
        <div style={{ width: "100%", height: "2px", background: "rgba(28,25,23,0.1)", borderRadius: "1px", overflow: "hidden" }}>
          <div style={{ width: `${progressFraction * 100}%`, height: "100%", background: barColor, borderRadius: "1px" }} />
        </div>
      </div>
    </div>
  );
}

function SaleCard({ sale }: { sale: SaleSummary }) {
  const has = Boolean(sale.relevanceLabel);
  return (
    <div style={{ background: "#fff", border: `1px solid ${has ? "rgba(217,119,6,0.3)" : "#e7e5e4"}`, borderRadius: "8px", padding: "18px 20px", opacity: has ? 1 : 0.55 }}>
      <div style={{ fontFamily: "monospace", fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#1c1917", marginBottom: "8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {sale.house}
      </div>
      {has ? (
        <div style={{ fontFamily: "monospace", fontSize: "10px", color: "#d97706", marginBottom: "10px", fontWeight: 600 }}>{sale.relevanceLabel}</div>
      ) : (
        <div style={{ fontFamily: "monospace", fontSize: "10px", color: "#78716c", fontStyle: "italic", marginBottom: "10px" }}>Hors de votre profil</div>
      )}
      <div style={{ fontSize: "12px", color: "#57534e", marginBottom: "10px" }}>{sale.lotCount} lot{sale.lotCount > 1 ? "s" : ""} en clôture</div>
      <div style={{ fontFamily: "monospace", fontSize: "11px", fontWeight: 700, color: sale.isUrgent ? "#ef4444" : "#78716c" }}>
        {sale.isUrgent ? "⚡ " : ""}{sale.displayDate}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div style={{ borderRadius: "8px", overflow: "hidden", border: "1px solid #e7e5e4" }}>
      <div style={{ aspectRatio: "4/3", background: "#f5f5f4", animation: "shimmer 1.4s ease-in-out infinite" }} />
      <div style={{ padding: "14px 16px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
        {[70, 85, 55, 100].map((w, i) => (
          <div key={i} style={{ height: i === 2 ? "17px" : "10px", width: `${w}%`, background: "#f5f5f4", borderRadius: "3px", animation: "shimmer 1.4s ease-in-out infinite" }} />
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EnDirectPage() {
  const router = useRouter();
  const [brief, setBrief] = useState<MarketBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchedAt] = useState(() => new Date());
  const [showAll, setShowAll] = useState(false);
  const [allRecs, setAllRecs] = useState<TopPick[]>([]);
  const [loadingAll, setLoadingAll] = useState(false);

  useEffect(() => {
    api.get<MarketBrief>("/api/recommendations/market-brief")
      .then(r => setBrief(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function loadAllRecs() {
    if (showAll) { setShowAll(false); return; }
    if (allRecs.length > 0) { setShowAll(true); return; }
    setLoadingAll(true);
    api.get<{ recommendations: TopPick[] }>("/api/recommendations/for-you?limit=20")
      .then(r => {
        const topIds = new Set((brief?.top_picks ?? []).map(p => p.lot.id));
        setAllRecs((r.data.recommendations ?? []).filter((x: TopPick) => !topIds.has(x.lot.id)));
        setShowAll(true);
      })
      .catch(() => {})
      .finally(() => setLoadingAll(false));
  }

  const closingImminently = brief?.closing_soon.filter(l => {
    const h = hoursUntil(l.auction_date);
    return h !== null && h > 0 && h <= 6;
  }) ?? [];

  const sales = brief ? deriveSales(brief.closing_soon, brief.top_picks) : [];
  const signal = brief ? buildLarrySignal(brief) : null;

  const chips = brief ? [
    brief.top_picks.length > 0 && { label: `${brief.top_picks.length} opportunité${brief.top_picks.length > 1 ? "s" : ""} pour vous`, urgent: false },
    brief.agent_unread > 0 && { label: `${brief.agent_unread} alerte${brief.agent_unread > 1 ? "s" : ""} stratégie`, urgent: false },
    brief.new_lots_count > 0 && { label: `${brief.new_lots_count.toLocaleString("fr-FR")} nouveaux lots`, urgent: false },
    brief.closing_today_count > 0 && { label: `⚡ ${brief.closing_today_count} clôture${brief.closing_today_count > 1 ? "s" : ""} aujourd'hui`, urgent: true },
  ].filter((c): c is { label: string; urgent: boolean } => Boolean(c)) : [];

  const minsAgo = Math.round((Date.now() - fetchedAt.getTime()) / 60_000);
  const updatedStr = minsAgo < 1 ? "À l'instant" : `Il y a ${minsAgo} min`;

  return (
    <>
      <style>{`@keyframes shimmer{0%,100%{opacity:.4}50%{opacity:.75}}`}</style>
      <div style={{ display: "flex", height: "100vh", backgroundColor: "#f5f5f4" }}>
        <Sidebar />
        <div style={{ flex: 1, marginLeft: "52px", minWidth: 0, display: "flex", flexDirection: "column" }}>
          <TopBar
            title="En direct"
            subtitle="Cockpit personnalisé"
            actions={
              !loading ? (
                <span style={{ fontFamily: "monospace", fontSize: "10px", color: "#71717a", letterSpacing: "0.04em" }}>{updatedStr}</span>
              ) : undefined
            }
          />

          <main style={{ flex: 1, overflowY: "auto", padding: "32px 32px 80px", maxWidth: "1480px" }}>

            {/* Loading */}
            {loading && (
              <>
                <div style={{ display: "flex", gap: "8px", marginBottom: "32px" }}>
                  {[90, 130, 110].map((w, i) => (
                    <div key={i} style={{ height: "28px", width: `${w}px`, background: "#e7e5e4", borderRadius: "14px", animation: "shimmer 1.4s ease-in-out infinite" }} />
                  ))}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "20px" }}>
                  {[0, 1, 2].map(i => <SkeletonCard key={i} />)}
                </div>
              </>
            )}

            {/* Error */}
            {!loading && !brief && (
              <div style={{ textAlign: "center", padding: "80px 20px", color: "#78716c" }}>
                <div style={{ fontSize: "32px", marginBottom: "12px" }}>◇</div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "18px", color: "#1c1917", marginBottom: "8px" }}>Données momentanément indisponibles</div>
                <div style={{ fontSize: "13px" }}>Réessayez dans quelques instants.</div>
              </div>
            )}

            {!loading && brief && (
              <>
                {/* Synthesis chips */}
                {chips.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: signal ? "12px" : "32px" }}>
                    {chips.map((chip, i) => (
                      <div key={i} style={{ padding: "0 12px", height: "28px", display: "flex", alignItems: "center", background: chip.urgent ? "rgba(239,68,68,0.07)" : "rgba(28,25,23,0.05)", border: `1px solid ${chip.urgent ? "rgba(239,68,68,0.2)" : "rgba(28,25,23,0.1)"}`, borderRadius: "14px", fontFamily: "monospace", fontSize: "11px", letterSpacing: "0.04em", color: chip.urgent ? "#ef4444" : "#57534e", whiteSpace: "nowrap" as const }}>
                        {chip.label}
                      </div>
                    ))}
                  </div>
                )}

                {/* Larry signal */}
                {signal && (
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 16px", marginBottom: "32px", background: "rgba(217,119,6,0.05)", border: "1px solid rgba(217,119,6,0.2)", borderRadius: "6px" }}>
                    <span style={{ fontFamily: "monospace", fontSize: "10px", fontWeight: 700, color: "#d97706", letterSpacing: "0.1em", flexShrink: 0 }}>◆ LARRY</span>
                    <span style={{ fontSize: "12px", color: "#57534e", fontFamily: "monospace", lineHeight: 1.5 }}>{signal}</span>
                  </div>
                )}

                {/* POUR VOUS */}
                <section style={{ marginBottom: "48px" }}>
                  <SectionLabel
                    label="Pour vous"
                    meta={brief.top_picks.length > 0 ? `${brief.top_picks.length} sélection${brief.top_picks.length > 1 ? "s" : ""}` : undefined}
                    color="#d97706"
                    action={{ label: loadingAll ? "Chargement…" : showAll ? "Réduire ↑" : "Voir tout →", onClick: loadAllRecs }}
                  />
                  {brief.top_picks.length === 0 ? (
                    <div style={{ background: "rgba(28,25,23,0.03)", border: "1px dashed rgba(28,25,23,0.15)", borderRadius: "8px", padding: "48px 32px", display: "flex", flexDirection: "column", alignItems: "center", gap: "14px", textAlign: "center" }}>
                      <div style={{ fontSize: "28px", opacity: 0.2 }}>◇</div>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "18px", color: "#1c1917", fontWeight: 400 }}>Votre radar est inactif.</div>
                      <div style={{ fontSize: "13px", color: "#57534e", maxWidth: "380px", lineHeight: 1.65 }}>
                        Nautilus ne connaît pas encore vos catégories ni votre budget. Configurez vos préférences pour activer la personnalisation.
                      </div>
                      <button onClick={() => router.push("/profile")} style={{ marginTop: "4px", padding: "10px 22px", background: "#1c1917", color: "#fff", border: "none", borderRadius: "6px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                        Configurer mes préférences →
                      </button>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "20px" }}>
                        {brief.top_picks.slice(0, 4).map(pick => (
                          <ConvictionCard key={pick.lot.id} pick={pick} onClick={() => router.push(`/lot/${pick.lot.id}`)} />
                        ))}
                      </div>
                      {showAll && allRecs.length > 0 && (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "20px", marginTop: "20px", paddingTop: "20px", borderTop: "1px solid #e7e5e4" }}>
                          {allRecs.map(pick => (
                            <ConvictionCard key={pick.lot.id} pick={pick} onClick={() => router.push(`/lot/${pick.lot.id}`)} />
                          ))}
                        </div>
                      )}
                      {showAll && allRecs.length === 0 && !loadingAll && (
                        <div style={{ marginTop: "20px", fontSize: "13px", color: "#78716c", fontStyle: "italic" }}>
                          Aucune opportunité supplémentaire pour le moment.
                        </div>
                      )}
                    </>
                  )}
                </section>

                {/* CLÔTURE IMMINENTE */}
                {closingImminently.length > 0 && (
                  <section style={{ marginBottom: "48px" }}>
                    <SectionLabel label="Clôture imminente" meta="Dans les 6 prochaines heures" color="#ef4444" />
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      {closingImminently.slice(0, 8).map(lot => (
                        <TimerRow key={lot.id} lot={lot} onClick={() => router.push(`/lot/${lot.id}`)} />
                      ))}
                    </div>
                  </section>
                )}

                {/* VENTES EN COURS */}
                {sales.length > 0 && (
                  <section>
                    <SectionLabel label="Ventes en cours" color="#71717a" action={{ label: "Calendrier →", onClick: () => router.push("/calendar") }} />
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 260px))", gap: "16px" }}>
                      {sales.map((sale, i) => <SaleCard key={i} sale={sale} />)}
                    </div>
                  </section>
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </>
  );
}
