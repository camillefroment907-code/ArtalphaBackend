"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  ArrowLeft, ExternalLink, Bell, CheckCircle, Sparkles, Info,
  ChevronRight, Download, FileText, Clock, AlertCircle, AlertTriangle,
  Bookmark, Share2, TrendingUp, TrendingDown, Minus,
} from "lucide-react";
import {
  ResponsiveContainer, ComposedChart, XAxis, YAxis, CartesianGrid,
  Scatter, ReferenceLine, Tooltip,
} from "recharts";
import { lotsApi, artistsApi, type Lot, type OracleSignal } from "@/lib/api";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { WishlistButton } from "@/components/lots/WishlistButton";
import { GalleryCard } from "@/components/lots/GalleryCard";
import { TabsNav } from "@/components/lot/TabsNav";
import { ComparablesTab } from "@/components/lot/ComparablesTab";
import { ComparablesHero } from "@/components/lot/ComparablesHero";
import { AnalysisTab } from "@/components/lot/AnalysisTab";
import { InvestmentTimeline } from "@/components/lot/InvestmentTimeline";
import { ProvenanceTab } from "@/components/lot/ProvenanceTab";
import { DocumentsTab } from "@/components/lot/DocumentsTab";
import { useLanguageStore, formatPriceInCurrency } from "@/lib/useLanguage";
import { convertPrice } from "@/lib/i18n";
import { useAuthStore } from "@/lib/store";
import { computeFairValue } from "@/lib/lotHelpers";

// ── Design tokens ─────────────────────────────────────────────────────────────
const SUCCESS = "#16A34A";
const DANGER  = "#DC2626";
const WARNING = "#EA580C";
const NAVY    = "#1A2A44";
const GOLD    = "#C6A85A";
const BORDER  = "#E5E7EB";

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(d?: string): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateShort(d?: string): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function getLabel(score: number): string {
  if (score >= 90) return "FIRE";
  if (score >= 80) return "STRONG BUY";
  if (score >= 70) return "BUY";
  if (score >= 50) return "WATCH";
  return "HOLD";
}

function getScoreColor(score: number): string {
  if (score >= 80) return SUCCESS;
  if (score >= 70) return SUCCESS;
  if (score >= 50) return WARNING;
  return "#9CA3AF";
}

function pillarColor(v: number): string {
  if (v >= 70) return SUCCESS;
  if (v >= 50) return WARNING;
  return DANGER;
}

// ── ScoreGauge ────────────────────────────────────────────────────────────────
function ScoreGauge({ score }: { score: number }) {
  const R = 44, SIZE = 120, C = SIZE / 2;
  const circ = 2 * Math.PI * R;
  const pct = Math.max(0, Math.min(100, score));
  const offset = circ - (pct / 100) * circ;
  const color = getScoreColor(pct);

  return (
    <div style={{
      background: "var(--white)", border: `1px solid ${BORDER}`,
      borderRadius: "8px", padding: "16px 20px",
      display: "flex", flexDirection: "column", alignItems: "center", gap: "4px",
    }}>
      <div style={{ fontSize: "8px", fontWeight: 700, letterSpacing: "0.14em", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "4px" }}>
        OPPORTUNITY SCORE
        <Info size={9} style={{ display: "inline", marginLeft: "3px", verticalAlign: "middle", opacity: 0.5 }} />
      </div>
      <div style={{ position: "relative", width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={C} cy={C} r={R} fill="none" stroke={BORDER} strokeWidth="7" />
          <circle cx={C} cy={C} r={R} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)" }}
          />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "26px", fontWeight: 700, color, lineHeight: 1 }}>{Math.round(pct)}</span>
          <span style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "1px" }}>/100</span>
        </div>
      </div>
      <div style={{ fontSize: "11px", fontWeight: 700, color, letterSpacing: "0.08em" }}>{getLabel(pct)}</div>
      <div style={{ display: "flex", gap: "4px", marginTop: "4px" }}>
        <button style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", color: "var(--text-muted)", borderRadius: "3px" }}><Bookmark size={13} /></button>
        <button style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", color: "var(--text-muted)", borderRadius: "3px" }}><Share2 size={13} /></button>
      </div>
    </div>
  );
}

// ── CountdownTimer ────────────────────────────────────────────────────────────
function CountdownTimer({ hours, style: s }: { hours: number; style?: React.CSSProperties }) {
  const [rem, setRem] = useState(Math.round(hours * 3600));

  useEffect(() => {
    if (rem <= 0) return;
    const id = setInterval(() => setRem(r => Math.max(0, r - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  if (rem <= 0) return <span style={s}>Sale ended</span>;
  const h = Math.floor(rem / 3600);
  const m = Math.floor((rem % 3600) / 60);
  const sec = rem % 60;
  const urgent = rem < 7200;
  return (
    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: urgent ? DANGER : WARNING, ...s }}>
      {h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m ${String(sec).padStart(2, "0")}s`}
    </span>
  );
}

// ── KPIStrip ──────────────────────────────────────────────────────────────────
function KPIStrip({ lot, fmt }: { lot: Lot; fmt: (v?: number | null) => string }) {
  const fairValue = computeFairValue(lot);
  const nSales = lot.real_data_n_sales ?? 0;
  const salesLabel = nSales === 0 ? "—" : nSales >= 30 ? "Strong" : nSales >= 10 ? "Solid" : nSales >= 3 ? "Limited" : "Sparse";
  const salesColor = nSales >= 10 ? SUCCESS : nSales >= 3 ? "#CA8A04" : nSales > 0 ? DANGER : "var(--text-muted)";

  return (
    <div style={{ display: "flex", background: "var(--white)", borderBottom: `1px solid ${BORDER}` }}>
      {/* Current price */}
      <div style={{ flex: 1, padding: "14px 20px", borderRight: `1px solid ${BORDER}` }}>
        <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "4px" }}>Current price</div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "15px", fontWeight: 700, color: NAVY }}>{fmt(lot.current_price)}</div>
        {lot.auction_date && <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "3px" }}>
          {lot.status === "sold" ? `Hammer (${formatDate(lot.auction_date)})` : lot.status === "live" ? "Current bid" : `Estimate date: ${formatDate(lot.auction_date)}`}
        </div>}
      </div>

      {/* Estimate */}
      <div style={{ flex: 1, padding: "14px 20px", borderRight: `1px solid ${BORDER}` }}>
        <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "4px" }}>Estimate</div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "15px", fontWeight: 700, color: NAVY, lineHeight: 1.3 }}>
          {fmt(lot.estimate_low)} –<br />{fmt(lot.estimate_high)}
        </div>
      </div>

      {/* Fair value */}
      <div style={{ flex: 1, padding: "14px 20px", borderRight: `1px solid ${BORDER}` }}>
        <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "4px" }}>Fair value</div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "15px", fontWeight: 700, color: NAVY }}>{fairValue != null ? fmt(fairValue) : "—"}</div>
        {fairValue != null
          ? <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "3px" }}>Median 24-month sales</div>
          : <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "3px" }}>Insufficient data</div>
        }
      </div>

      {/* Est. discount */}
      <div style={{ flex: 1, padding: "14px 20px", borderRight: `1px solid ${BORDER}` }}>
        <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "4px" }}>
          Est. discount
          <Info size={9} style={{ display: "inline", marginLeft: "3px", verticalAlign: "middle", opacity: 0.5, cursor: "help" }} />
        </div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "15px", fontWeight: 700, color: lot.pct_below_low_estimate != null && lot.pct_below_low_estimate > 0 ? SUCCESS : NAVY }}>
          {lot.pct_below_low_estimate != null ? `${lot.pct_below_low_estimate > 0 ? "-" : "+"}${Math.abs(lot.pct_below_low_estimate).toFixed(0)}%` : "—"}
        </div>
        <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "3px" }}>vs low estimate</div>
      </div>

      {/* Market data coverage */}
      <div style={{ flex: 1, padding: "14px 20px", borderRight: `1px solid ${BORDER}` }}>
        <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "4px" }}>
          Market data
        </div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "15px", fontWeight: 700, color: salesColor }}>{salesLabel}</div>
        <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "3px" }}>
          {nSales === 0 ? "No hammer prices" : `${nSales} sale${nSales > 1 ? "s" : ""} (24m)`}
        </div>
      </div>

      {/* Time remaining */}
      <div style={{ flex: 1, padding: "14px 20px" }}>
        <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "4px" }}>Time remaining</div>
        <div style={{ fontSize: "15px" }}>
          {lot.time_left_hours != null && lot.time_left_hours > 0
            ? <CountdownTimer hours={lot.time_left_hours} />
            : <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "15px", fontWeight: 700, color: "#9CA3AF" }}>—</span>
          }
        </div>
        {lot.auction_date && (
          <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "3px" }}>
            Closes {new Date(lot.auction_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── PriceChart ────────────────────────────────────────────────────────────────
function PriceChart({ comparables, lot, fmt }: { comparables: Lot[]; lot: Lot; fmt: (v?: number | null) => string }) {
  const { symbol, currency: chartCurrency } = useLanguageStore();
  const fmtShort = (v: number): string => {
    const c = convertPrice(v, chartCurrency);
    if (c >= 1_000_000) return `${symbol}${(c / 1_000_000).toFixed(1)}M`;
    if (c >= 1_000) return `${symbol}${Math.round(c / 1_000)}K`;
    return `${symbol}${Math.round(c)}`;
  };
  const fairValue = computeFairValue(lot);

  const points = comparables
    .filter(c => c.auction_date && c.current_price && c.current_price > 0)
    .map(c => {
      const d = new Date(c.auction_date!);
      return { year: d.getFullYear() + d.getMonth() / 12, price: c.current_price!, isCurrent: false, name: c.title };
    })
    .sort((a, b) => a.year - b.year);

  if (lot.auction_date && lot.current_price && lot.current_price > 0) {
    const d = new Date(lot.auction_date);
    points.push({ year: d.getFullYear() + d.getMonth() / 12 + 0.01, price: lot.current_price, isCurrent: true, name: lot.title });
  }

  const allP = [...points.map(p => p.price)];
  if (lot.estimate_high) allP.push(lot.estimate_high);
  if (fairValue) allP.push(fairValue);
  const maxP = allP.length > 0 ? Math.max(...allP) * 1.2 : 100_000;
  const minYear = points.length > 0 ? Math.floor(Math.min(...points.map(p => p.year))) : new Date().getFullYear() - 4;
  const maxYear = points.length > 0 ? Math.ceil(Math.max(...points.map(p => p.year))) + 1 : new Date().getFullYear() + 1;

  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (!cx || !cy) return null;
    if (payload.isCurrent) return <circle cx={cx} cy={cy} r={7} fill={GOLD} stroke="white" strokeWidth={2} />;
    return <circle cx={cx} cy={cy} r={5} fill="#9CA3AF" stroke="white" strokeWidth={1.5} opacity={0.8} />;
  };

  if (points.length === 0) {
    return (
      <div style={{ height: "200px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "12px" }}>
        No comparable price data to display yet.
      </div>
    );
  }

  return (
    <div>
      {/* Legend */}
      <div style={{ display: "flex", gap: "16px", marginBottom: "10px", flexWrap: "wrap" }}>
        {[
          { color: "#9CA3AF", label: "Auction results", dot: true },
          { color: "#2563EB", label: "Estimate range", dot: false },
          { color: WARNING,   label: "Fair value (24m median)", dot: false },
          { color: GOLD,      label: "Current price",  dot: true },
        ].map(({ color, label, dot }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "10px", color: "var(--text-muted)" }}>
            {dot
              ? <svg width="10" height="10"><circle cx="5" cy="5" r="4" fill={color} /></svg>
              : <svg width="22" height="10"><line x1="0" y1="5" x2="22" y2="5" stroke={color} strokeWidth="2" strokeDasharray="4,2" /></svg>
            }
            {label}
          </div>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={points} margin={{ top: 8, right: 70, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
          <XAxis
            dataKey="year" type="number"
            domain={[minYear, maxYear]}
            tickCount={maxYear - minYear + 1}
            tickFormatter={v => String(Math.floor(v))}
            tick={{ fontSize: 10, fill: "#9CA3AF" }}
            axisLine={false} tickLine={false}
          />
          <YAxis
            domain={[0, maxP]} tickFormatter={fmtShort}
            tick={{ fontSize: 10, fill: "#9CA3AF" }}
            axisLine={false} tickLine={false} width={40}
          />
          <Tooltip
            contentStyle={{ background: NAVY, border: "none", borderRadius: "4px", fontSize: "11px", color: "white", padding: "8px 12px" }}
            formatter={(v: unknown) => [fmt(v as number), ""]}
            labelFormatter={v => String(Math.floor(Number(v)))}
          />
          {lot.estimate_low != null && (
            <ReferenceLine y={lot.estimate_low} stroke="#2563EB" strokeDasharray="5 3" strokeWidth={1.5}
              label={{ value: `Est. low ${fmtShort(lot.estimate_low)}`, position: "right", fontSize: 9, fill: "#2563EB", dy: -4 }} />
          )}
          {lot.estimate_high != null && (
            <ReferenceLine y={lot.estimate_high} stroke="#2563EB" strokeDasharray="5 3" strokeWidth={1.5} opacity={0.65}
              label={{ value: `Est. high ${fmtShort(lot.estimate_high)}`, position: "right", fontSize: 9, fill: "#2563EB", dy: -4 }} />
          )}
          {fairValue != null && (
            <ReferenceLine y={fairValue} stroke={WARNING} strokeDasharray="5 3" strokeWidth={2}
              label={{ value: `Fair value ${fmtShort(fairValue)}`, position: "right", fontSize: 9, fill: WARNING, dy: -4 }} />
          )}
          {lot.current_price != null && (
            <ReferenceLine y={lot.current_price} stroke={GOLD} strokeDasharray="3 6" strokeWidth={1} opacity={0.5}
              label={{ value: `Current ${fmtShort(lot.current_price)}`, position: "right", fontSize: 9, fill: GOLD, dy: -4 }} />
          )}
          <Scatter dataKey="price" shape={<CustomDot />} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>

      {fairValue != null && lot.current_price != null && lot.current_price > 0 && (
        <div style={{ marginTop: "8px", padding: "8px 12px", background: "rgba(37,99,235,0.04)", border: "1px solid rgba(37,99,235,0.14)", borderRadius: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
          <Info size={12} style={{ color: "#2563EB", flexShrink: 0 }} />
          <span style={{ fontSize: "11px", color: "#2563EB" }}>
            Fair value <strong>{fmtShort(fairValue)}</strong> — based on median of past 24-month sales for this artist.
          </span>
        </div>
      )}
    </div>
  );
}

// ── ScoreBreakdownPanel ───────────────────────────────────────────────────────
const PILLARS = [
  { key: "below_estimate_score"   as const, label: "Below Estimate" },
  { key: "below_market_score"     as const, label: "Below Market Avg" },
  { key: "liquidity_score"        as const, label: "Liquidity" },
  { key: "house_reputation_score" as const, label: "House Reputation" },
  { key: "confidence_score"       as const, label: "Data Confidence" },
];

function ScoreBreakdownPanel({ lot }: { lot: Lot }) {
  const sb = lot.score_breakdown;
  const score = lot.deal_score ?? 0;
  const color = getScoreColor(score);
  const label = getLabel(score);

  return (
    <div style={{ background: "var(--white)", border: `1px solid ${BORDER}`, borderRadius: "6px", padding: "20px" }}>
      <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "16px" }}>
        Score breakdown
      </div>

      {sb && (
        <div style={{ display: "flex", flexDirection: "column", gap: "13px", marginBottom: "16px" }}>
          {PILLARS.map(({ key, label: pl }) => {
            const v = sb[key];
            // 45.0 is the sentinel for "no real market data" — hide rather than mislead
            if (v == null || (key === "below_market_score" && v === 45)) return null;
            const pc = pillarColor(v);
            return (
              <div key={key}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
                  <span style={{ fontSize: "12px", color: "var(--navy)", fontWeight: 500 }}>{pl}</span>
                  <span style={{ fontFamily: "monospace", fontSize: "11px", color: "var(--text-muted)" }}>
                    <span style={{ color: NAVY, fontWeight: 700 }}>{v.toFixed(0)}</span> /100
                  </span>
                </div>
                <div style={{ height: "6px", background: BORDER, borderRadius: "3px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.max(0, Math.min(100, v))}%`, background: pc, borderRadius: "3px", transition: "width 0.8s ease" }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button style={{ marginTop: "10px", display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: GOLD, background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 600 }}>
        How we score <ChevronRight size={12} />
      </button>
    </div>
  );
}

// ── ComparablesMiniTable ──────────────────────────────────────────────────────
function ComparablesMiniTable({ comparables, lot, fmt, onViewAll }: {
  comparables: Lot[];
  lot: Lot;
  fmt: (v?: number | null) => string;
  onViewAll: () => void;
}) {
  const rows = comparables.filter(c => c.current_price && c.current_price > 0).slice(0, 5);
  const prices = comparables.map(c => c.current_price).filter((p): p is number => p != null && p > 0);
  const avg = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : null;
  const avgDiff = avg != null && lot.current_price && lot.current_price > 0
    ? ((avg - lot.current_price) / lot.current_price) * 100 : null;

  return (
    <div>
      <div style={{ fontSize: "13px", fontWeight: 700, color: NAVY, marginBottom: "12px" }}>
        Recent comparable sales ({comparables.length})
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 55px 60px", gap: 0, marginBottom: "4px" }}>
        {["Artwork", "Sale", "Date", "vs. lot"].map(h => (
          <div key={h} style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", textAlign: h === "vs. lot" ? "right" : "left" }}>{h}</div>
        ))}
      </div>
      {rows.map((c, i) => {
        const diff = lot.current_price && lot.current_price > 0 && c.current_price
          ? ((c.current_price - lot.current_price) / lot.current_price) * 100 : null;
        return (
          <Link key={c.id} href={`/lot/${c.id}`} style={{ textDecoration: "none", display: "block" }}>
            <div
              style={{ display: "grid", gridTemplateColumns: "1fr 80px 55px 60px", gap: 0, padding: "6px 0", borderTop: `1px solid ${BORDER}` }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = "#F9FAFB")}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = "transparent")}
            >
              <div style={{ fontSize: "11px", color: NAVY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: "8px" }}>{c.title}</div>
              <div style={{ fontSize: "10px", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.auction_house_name?.split("—")[0].trim().slice(0, 16)}</div>
              <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>{formatDateShort(c.auction_date)}</div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: "monospace", fontSize: "10px", fontWeight: 600, color: diff != null ? (diff > 0 ? SUCCESS : DANGER) : "var(--text-muted)" }}>
                  {fmt(c.current_price)}
                </div>
                {diff != null && <div style={{ fontSize: "9px", color: diff > 0 ? SUCCESS : DANGER, fontWeight: 600 }}>{diff > 0 ? "+" : ""}{Math.round(diff)}%</div>}
              </div>
            </div>
          </Link>
        );
      })}
      {avg != null && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 55px 60px", gap: 0, padding: "7px 0", borderTop: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: NAVY }}>Average</div>
          <div /><div />
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "monospace", fontSize: "11px", fontWeight: 700, color: NAVY }}>{fmt(avg)}</div>
            {avgDiff != null && <div style={{ fontSize: "9px", color: avgDiff > 0 ? SUCCESS : DANGER, fontWeight: 600 }}>{avgDiff > 0 ? "+" : ""}{Math.round(avgDiff)}%</div>}
          </div>
        </div>
      )}
      <button onClick={onViewAll} style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "8px", fontSize: "11px", color: GOLD, fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
        View all {comparables.length} comparables <ChevronRight size={12} />
      </button>
    </div>
  );
}

// ── FullSpecs ─────────────────────────────────────────────────────────────────
function FullSpecs({ lot, fmt }: { lot: Lot; fmt: (v?: number | null) => string }) {
  const artwork = [
    { label: "Medium",     value: lot.medium },
    { label: "Dimensions", value: lot.dimensions },
    { label: "Category",   value: lot.category },
  ].filter(f => f.value);
  const auction = [
    { label: "Auction house", value: lot.auction_house_name?.split("—")[0].trim() },
    { label: "Sale",          value: lot.auction_sale_title },
    { label: "Sale date",     value: lot.auction_date ? formatDate(lot.auction_date) : null },
    { label: "Lot",           value: lot.lot_number },
    { label: "Estimate",      value: lot.estimate_low != null ? `${fmt(lot.estimate_low)} – ${fmt(lot.estimate_high)}` : null },
  ].filter(f => f.value);

  const Row = ({ label, value }: { label: string; value?: string | null }) => (
    <div style={{ display: "flex", gap: "8px", padding: "4px 0", borderBottom: `1px solid ${BORDER}` }}>
      <div style={{ fontSize: "9px", color: "var(--text-muted)", width: "76px", flexShrink: 0, paddingTop: "1px" }}>{label}</div>
      <div style={{ fontSize: "10px", color: value ? NAVY : "#D1D5DB", fontWeight: value ? 500 : 400 }}>{value || "—"}</div>
    </div>
  );

  return (
    <div>
      <div style={{ fontSize: "13px", fontWeight: 700, color: NAVY, marginBottom: "12px" }}>Full specifications</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <div>
          <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "6px" }}>Artwork</div>
          {artwork.map(f => <Row key={f.label} label={f.label} value={f.value} />)}
        </div>
        <div>
          <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "6px" }}>Auction</div>
          {auction.map(f => <Row key={f.label} label={f.label} value={f.value} />)}
        </div>
      </div>
      {lot.url && (
        <a href={lot.url} target="_blank" rel="noopener noreferrer"
          style={{ display: "inline-flex", alignItems: "center", gap: "4px", marginTop: "10px", fontSize: "11px", color: GOLD, fontWeight: 600, textDecoration: "none" }}>
          View lot catalogue on {lot.auction_house_name?.split("—")[0].trim() || "source"}
          <ExternalLink size={11} />
        </a>
      )}
    </div>
  );
}

// ── DocsSection ───────────────────────────────────────────────────────────────
function DocsSection({ lot }: { lot: Lot }) {
  const docs = [
    { label: "Catalogue (PDF)" },
    { label: "Condition report" },
    { label: "Provenance documents" },
    { label: "Certificate of authenticity" },
  ];
  return (
    <div>
      <div style={{ fontSize: "13px", fontWeight: 700, color: NAVY, marginBottom: "12px" }}>Documents</div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
        {docs.map(d => (
          <div key={d.label} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 0", borderBottom: `1px solid ${BORDER}` }}>
            <FileText size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "11px", color: NAVY, fontWeight: 500 }}>{d.label}</div>
            </div>
            {lot.url
              ? <a href={lot.url} target="_blank" rel="noopener noreferrer"><Download size={11} style={{ color: "var(--text-muted)" }} /></a>
              : <span style={{ fontSize: "9px", color: "#D1D5DB" }}>—</span>
            }
          </div>
        ))}
      </div>
      {lot.url && (
        <a href={lot.url} target="_blank" rel="noopener noreferrer"
          style={{ display: "inline-flex", alignItems: "center", gap: "4px", marginTop: "8px", fontSize: "11px", color: GOLD, fontWeight: 600, textDecoration: "none" }}>
          View on source <ExternalLink size={11} />
        </a>
      )}
    </div>
  );
}

// ── AiInsightsSection ─────────────────────────────────────────────────────────
function AiInsightsSection({ lot }: { lot: Lot }) {
  const bullets = lot.rationale?.slice(0, 4) || [];
  const insight = lot.ai_insight;
  if (bullets.length === 0 && !insight) return null;

  const items = bullets.length > 0
    ? bullets
    : insight ? [insight.slice(0, 100) + "..."] : [];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "12px" }}>
        <Sparkles size={13} style={{ color: GOLD }} />
        <div style={{ fontSize: "13px", fontWeight: 700, color: NAVY }}>AI Insights</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {items.map((b, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "7px" }}>
            <CheckCircle size={12} style={{ color: SUCCESS, flexShrink: 0, marginTop: "1px" }} />
            <span style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: 1.5 }}>{b}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Risk Flags — factual only ─────────────────────────────────────────────────
interface RiskFlag { icon: "clock" | "alert" | "triangle"; title: string; detail: string }

function deriveRisks(lot: Lot): RiskFlag[] {
  const flags: RiskFlag[] = [];
  const sb = lot.score_breakdown;

  // Factual: low liquidity based on artist liquidity_score from DB
  if (sb && sb.liquidity_score < 50)
    flags.push({ icon: "clock", title: "Low artist liquidity", detail: `Score: ${sb.liquidity_score.toFixed(0)}/100 — resale may take time` });

  // Factual: current price above 88% of auction house estimate ceiling
  if (lot.estimate_high && lot.current_price && lot.current_price > lot.estimate_high * 0.88)
    flags.push({ icon: "alert", title: "Near estimate ceiling", detail: `Current price ≥ 88% of estimate high (${lot.estimate_high.toLocaleString()})` });

  // Factual: no market comparison data available
  if (sb && sb.below_market_score === 45)
    flags.push({ icon: "triangle", title: "No market comparison", detail: "Insufficient historical sales to benchmark this artist" });

  return flags.slice(0, 3);
}

function RiskIcon({ t }: { t: RiskFlag["icon"] }) {
  if (t === "clock") return <Clock size={12} style={{ color: WARNING }} />;
  if (t === "alert") return <AlertCircle size={12} style={{ color: WARNING }} />;
  return <AlertTriangle size={12} style={{ color: "#9CA3AF" }} />;
}

// ── Right Panel ───────────────────────────────────────────────────────────────
function RightPanel({ lot, lotId }: { lot: Lot; lotId: string }) {
  const score = lot.deal_score ?? 0;
  const upside = lot.pct_below_low_estimate;
  const risks = deriveRisks(lot);
  const color = getScoreColor(score);

  return (
    <div style={{
      width: "272px", flexShrink: 0, background: NAVY,
      position: "sticky", top: "52px", height: "calc(100vh - 52px)",
      overflowY: "auto", display: "flex", flexDirection: "column",
    }}>
      {/* Recommended action */}
      <div style={{ padding: "20px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.38)", marginBottom: "6px" }}>
          RECOMMENDED ACTION
        </div>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "22px", fontWeight: 700, color, marginBottom: "6px" }}>
          {getLabel(score)}
        </div>
        {upside != null && upside > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>Below low estimate</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "18px", fontWeight: 700, color: GOLD }}>-{upside.toFixed(0)}%</span>
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
          {lot.url && (
            <a href={lot.url} target="_blank" rel="noopener noreferrer" style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
              padding: "10px 16px", borderRadius: "6px", background: GOLD, color: "#FFFFFF",
              fontSize: "12px", fontWeight: 700, textDecoration: "none", letterSpacing: "0.02em",
            }}>
              View on {lot.auction_house_name?.split("—")[0].trim() || "source"} <ExternalLink size={12} />
            </a>
          )}
          <WishlistButton lotId={lotId} size="md" />
          <button style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
            padding: "9px 16px", borderRadius: "6px",
            border: "1px solid rgba(255,255,255,0.15)", background: "transparent",
            color: "rgba(255,255,255,0.75)", fontSize: "11px", cursor: "pointer",
          }}>
            <Bell size={12} /> Set price alert
          </button>
        </div>
      </div>

      {/* Countdown */}
      {lot.time_left_hours != null && lot.time_left_hours > 0 && (
        <div style={{ padding: "12px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Clock size={11} style={{ color: DANGER }} />
            <span style={{ fontSize: "11px", fontWeight: 700, color: DANGER }}>
              Sale ends in <CountdownTimer hours={lot.time_left_hours} style={{ fontSize: "11px" }} />
            </span>
          </div>
        </div>
      )}

      {/* Risk flags */}
      {risks.length > 0 && (
        <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "10px" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.65)" }}>Key risk flags</span>
            <Info size={10} style={{ color: "rgba(255,255,255,0.28)" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
            {risks.map((r, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                <div style={{ marginTop: "1px", flexShrink: 0 }}><RiskIcon t={r.icon} /></div>
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 600, color: "rgba(255,255,255,0.72)" }}>{r.title}</div>
                  <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.38)", marginTop: "1px" }}>{r.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── RelatedLots ───────────────────────────────────────────────────────────────
function RelatedLots({ lotId }: { lotId: string }) {
  const { data: similar } = useSWR<Lot[]>(`similar-${lotId}`, () => lotsApi.similar(lotId).then(r => r.data));
  if (!similar || similar.length === 0) return null;
  return (
    <div style={{ marginTop: "40px", paddingTop: "32px", borderTop: `1px solid ${BORDER}` }}>
      <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "20px" }}>
        Similar Opportunities
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "16px" }}>
        {similar.slice(0, 4).map((lot, i) => <GalleryCard key={lot.id} lot={lot} index={i} />)}
      </div>
    </div>
  );
}

// ── Loading / Error ───────────────────────────────────────────────────────────
function LoadingState() {
  return (
    <div style={{ flex: 1, display: "flex" }}>
      <div style={{ flex: 1, padding: "32px" }}>
        <div style={{ height: "260px", background: "#F3F4F6", borderRadius: "6px", marginBottom: "12px", animation: "pulse 1.5s infinite" }} />
        <div style={{ height: "48px", background: "#F3F4F6", borderRadius: "6px", marginBottom: "12px", animation: "pulse 1.5s infinite" }} />
        <div style={{ height: "36px", background: "#F3F4F6", borderRadius: "6px", marginBottom: "24px", animation: "pulse 1.5s infinite" }} />
        <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: "20px" }}>
          <div style={{ height: "320px", background: "#F3F4F6", borderRadius: "6px", animation: "pulse 1.5s infinite" }} />
          <div style={{ height: "320px", background: "#F3F4F6", borderRadius: "6px", animation: "pulse 1.5s infinite" }} />
        </div>
      </div>
      <div style={{ width: "272px", background: "#E5E7EB", animation: "pulse 1.5s infinite" }} />
    </div>
  );
}

function ErrorState() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px" }}>
      <span style={{ fontFamily: "serif", fontSize: "64px", color: BORDER, marginBottom: "16px" }}>◇</span>
      <div style={{ color: "var(--text-muted)", marginBottom: "20px" }}>Lot not found</div>
      <Link href="/dashboard" className="btn-ghost" style={{ fontSize: "12px" }}>← Back to opportunities</Link>
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function LotPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const { currency, locale, lang } = useLanguageStore();
  const [activeTab, setActiveTab] = useState("overview");

  const { data: lot, isLoading, error } = useSWR<Lot>(
    id ? `lot-${id}` : null,
    () => lotsApi.get(id).then(r => r.data)
  );

  const { data: _rawComparables } = useSWR(
    id ? `comparables-${id}` : null,
    () => lotsApi.comparables(id).then(r => r.data)
  );
  const comparables: Lot[] = Array.isArray(_rawComparables)
    ? (_rawComparables as Lot[])
    : Array.isArray((_rawComparables as unknown as Record<string, unknown>)?.comparables)
      ? ((_rawComparables as unknown as Record<string, unknown>).comparables as Lot[])
      : [];

  const fmt = (v?: number | null) => v != null ? formatPriceInCurrency(v, currency, locale) : "—";

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--cream)" }}>
      <Sidebar />
      <div style={{ flex: 1, marginLeft: "52px", minWidth: 0, display: "flex", flexDirection: "column" }}>
        <TopBar title="Lot Detail" />

        {isLoading ? <LoadingState /> : error || !lot ? <ErrorState /> : (
          <div style={{ display: "flex", flex: 1, minHeight: 0 }}>

            {/* ── SCROLLABLE MAIN ─────────────────────────────── */}
            <div style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>

              {/* Back nav */}
              <div style={{ padding: "10px 32px 0", background: "var(--white)" }}>
                <Link href="/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "12px", color: "var(--text-muted)", textDecoration: "none" }}>
                  <ArrowLeft size={12} /> Back to Opportunities
                </Link>
              </div>

              {/* ── HEADER ──────────────────────────────────────── */}
              <div style={{ background: "var(--white)", borderBottom: `1px solid ${BORDER}`, padding: "16px 32px 22px" }}>
                <div style={{ display: "flex", gap: "24px", alignItems: "flex-start" }}>

                  {/* Artwork image */}
                  {lot.image_url && (
                    <div style={{ position: "relative", width: "190px", height: "228px", flexShrink: 0, borderRadius: "6px", overflow: "hidden", border: `1px solid ${BORDER}`, background: "#F3F4F6" }}>
                      <img src={lot.image_url} alt={lot.title} style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      <div style={{ position: "absolute", bottom: "8px", left: "8px", right: "8px", display: "flex", justifyContent: "center" }}>
                        <button style={{ fontSize: "10px", padding: "4px 10px", background: "rgba(0,0,0,0.5)", color: "white", border: "none", borderRadius: "3px", cursor: "pointer" }}>
                          View full size
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Title + auction info */}
                  <div style={{ flex: 1, minWidth: 0, paddingTop: "2px" }}>
                    {lot.artist_name_raw && (
                      <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "24px", fontWeight: 700, color: NAVY, marginBottom: "3px", lineHeight: 1.2 }}>
                        {lot.artist_name_raw}
                      </h1>
                    )}
                    <div style={{ fontSize: "15px", color: "var(--text-muted)", marginBottom: "5px" }}>{lot.title}</div>
                    {(lot.category || lot.medium || lot.dimensions) && (
                      <div style={{ fontSize: "12px", color: "#9CA3AF", marginBottom: "18px" }}>
                        {[lot.category, lot.medium, lot.dimensions].filter(Boolean).join(" · ")}
                      </div>
                    )}

                    {/* Auction info row */}
                    <div style={{ display: "flex", gap: "0", flexWrap: "nowrap" }}>
                      {lot.auction_house_name && (
                        <div style={{ paddingRight: "24px", borderRight: `1px solid ${BORDER}` }}>
                          <div style={{ fontSize: "13px", fontWeight: 700, color: NAVY }}>{lot.auction_house_name.split("—")[0].trim()}</div>
                          {lot.auction_sale_title && <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>{lot.auction_sale_title}</div>}
                        </div>
                      )}
                      {lot.auction_date && (
                        <div style={{ padding: "0 24px", borderRight: lot.lot_number ? `1px solid ${BORDER}` : "none" }}>
                          <div style={{ fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "2px" }}>Sale date</div>
                          <div style={{ fontSize: "13px", fontWeight: 600, color: NAVY }}>{formatDate(lot.auction_date)}</div>
                        </div>
                      )}
                      {lot.lot_number && (
                        <div style={{ paddingLeft: "24px" }}>
                          <div style={{ fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "2px" }}>Lot</div>
                          <div style={{ fontSize: "13px", fontWeight: 600, color: NAVY }}>{lot.lot_number}</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Score gauge */}
                  {lot.deal_score != null && <div style={{ flexShrink: 0 }}><ScoreGauge score={lot.deal_score} /></div>}
                </div>
              </div>

              {/* ── KPI STRIP ───────────────────────────────────── */}
              <KPIStrip lot={lot} fmt={fmt} />


              {/* ── COMPARABLES HERO ────────────────────────────── */}
              <ComparablesHero
                lotId={id}
                currentLotPrice={lot.current_price}
                currency={currency}
                locale={locale}
              />

              {/* ── TABS ────────────────────────────────────────── */}
              <TabsNav
                activeTab={activeTab}
                onChange={setActiveTab}
                tabs={[
                  { id: "overview",      label: "Overview" },
                  { id: "comparables",   label: "Comparables", count: comparables.length || null },
                  { id: "price-history", label: "Price History", disabled: true },
                  { id: "analysis",      label: "Analysis" },
                  { id: "provenance",    label: "Provenance" },
                  { id: "documents",     label: "Documents" },
                ]}
              />

              {/* ── TAB CONTENT ─────────────────────────────────── */}
              <div style={{ padding: "24px 32px" }}>

                {activeTab === "comparables" && (
                  <ComparablesTab lotId={id} currentPrice={lot.current_price} currency={currency} locale={locale} />
                )}
                {activeTab === "price-history" && (
                  <div style={{ background: "var(--white)", border: `1px solid ${BORDER}`, borderRadius: "6px", padding: "64px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
                    Price history chart — coming in Sprint C.
                  </div>
                )}
                {activeTab === "analysis" && (
                  <>
                    <InvestmentTimeline lot={lot} />
                    <AnalysisTab lot={lot} />
                  </>
                )}
                {activeTab === "provenance" && <ProvenanceTab lot={lot} />}
                {activeTab === "documents" && <DocumentsTab lot={lot} />}

                {/* ── OVERVIEW TAB ──────────────────────────────── */}
                {activeTab === "overview" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

                    {/* Row 1: Price chart + Score breakdown */}
                    <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: "20px", alignItems: "start" }}>
                      <div style={{ background: "var(--white)", border: `1px solid ${BORDER}`, borderRadius: "6px", padding: "20px" }}>
                        <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "14px" }}>
                          Price vs. Fair Value
                        </div>
                        <PriceChart comparables={comparables} lot={lot} fmt={fmt} />
                      </div>
                      <ScoreBreakdownPanel lot={lot} />
                    </div>

                    {/* Row 2: 4-column bottom grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "20px", alignItems: "start" }}>
                      <div style={{ background: "var(--white)", border: `1px solid ${BORDER}`, borderRadius: "6px", padding: "16px" }}>
                        <ComparablesMiniTable
                          comparables={comparables} lot={lot} fmt={fmt}
                          onViewAll={() => setActiveTab("comparables")}
                        />
                      </div>
                      <div style={{ background: "var(--white)", border: `1px solid ${BORDER}`, borderRadius: "6px", padding: "16px" }}>
                        <FullSpecs lot={lot} fmt={fmt} />
                      </div>
                      <div style={{ background: "var(--white)", border: `1px solid ${BORDER}`, borderRadius: "6px", padding: "16px" }}>
                        <DocsSection lot={lot} />
                      </div>
                      <div style={{ background: "var(--white)", border: `1px solid ${BORDER}`, borderRadius: "6px", padding: "16px" }}>
                        <AiInsightsSection lot={lot} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Related lots — always show */}
                <RelatedLots lotId={id} />
              </div>
            </div>

            {/* ── RIGHT STICKY PANEL ──────────────────────────── */}
            <RightPanel lot={lot} lotId={id} />
          </div>
        )}
      </div>
    </div>
  );
}
