"use client";

import Link from "next/link";
import useSWR from "swr";
import {
  ArrowLeft, ExternalLink, Calendar, Building2, Tag,
  Ruler, Palette, Star, CheckCircle, Sparkles, TrendingUp,
} from "lucide-react";
import { lotsApi, artistsApi, type Lot, type OracleSignal } from "@/lib/api";
import { Sidebar } from "@/components/layout/Sidebar";
import { WishlistButton } from "@/components/lots/WishlistButton";
import { GalleryCard } from "@/components/lots/GalleryCard";
import { useLanguageStore, formatPriceInCurrency } from "@/lib/useLanguage";
import { useAuthStore } from "@/lib/store";

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmtPrice(v?: number | null, currency = "EUR", locale = "fr-FR"): string {
  if (v == null) return "—";
  return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
}

function project(price: number, years: number): number {
  return Math.round(price * Math.pow(1.08, years));
}

function formatDate(date?: string): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

// ── ScoreGauge ───────────────────────────────────────────────────────────────

function ScoreGauge({ score }: { score: number }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const clampedScore = Math.max(0, Math.min(100, score));
  const offset = circumference - (clampedScore / 100) * circumference;

  const color =
    clampedScore >= 90 ? "#ef4444" :
    clampedScore >= 80 ? "#f97316" :
    clampedScore >= 70 ? "#22c55e" :
    clampedScore >= 50 ? "#eab308" : "#9a9aa3";

  const label =
    clampedScore >= 90 ? "FIRE" :
    clampedScore >= 80 ? "HOT" :
    clampedScore >= 70 ? "DEAL" :
    clampedScore >= 50 ? "WATCH" : "—";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
      <div style={{ position: "relative", width: "140px", height: "140px" }}>
        <svg width="140" height="140" style={{ transform: "rotate(-90deg)" }}>
          <circle
            cx="70" cy="70" r={radius}
            fill="none"
            stroke="var(--border)"
            strokeWidth="8"
          />
          <circle
            cx="70" cy="70" r={radius}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)", filter: `drop-shadow(0 0 8px ${color}40)` }}
          />
        </svg>
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
        }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "32px", fontWeight: 700, color, lineHeight: 1 }}>
            {Math.round(clampedScore)}
          </div>
          <div style={{ fontSize: "9px", fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color, marginTop: "4px" }}>
            {label}
          </div>
        </div>
      </div>
      <div style={{ fontSize: "11px", color: "var(--text-muted)", textAlign: "center" }}>
        Deal Score / 100
      </div>
    </div>
  );
}

// ── ProjectionBar ────────────────────────────────────────────────────────────

function ProjectionBar({ price, currency, locale }: { price: number; currency: string; locale: string }) {
  const now   = price;
  const y5    = project(price, 5);
  const y10   = project(price, 10);
  const y20   = project(price, 20);
  const max   = y20;

  const bars = [
    { label: "NOW",  value: now,  years: 0 },
    { label: "5 YR", value: y5,   years: 5 },
    { label: "10 YR", value: y10, years: 10 },
    { label: "20 YR", value: y20, years: 20 },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
        <TrendingUp size={12} style={{ color: "var(--gold)" }} />
        <span style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--gold)" }}>
          ROI Projection (8% CAGR)
        </span>
      </div>
      {bars.map(({ label, value }) => {
        const pct = (value / max) * 100;
        const multiple = value / now;
        return (
          <div key={label}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "5px" }}>
              <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", color: "var(--text-muted)", fontFamily: "'JetBrains Mono', monospace" }}>{label}</span>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", color: "var(--text-primary)", fontWeight: 600 }}>
                  {formatPriceInCurrency(value, currency, locale)}
                </span>
                {multiple > 1 && (
                  <span style={{ fontFamily: "monospace", fontSize: "10px", color: "var(--green)", background: "rgba(34,197,94,0.1)", padding: "1px 5px", borderRadius: "3px", border: "1px solid rgba(34,197,94,0.2)" }}>
                    ×{multiple.toFixed(1)}
                  </span>
                )}
              </div>
            </div>
            <div style={{ height: "4px", background: "var(--border)", borderRadius: "2px", overflow: "hidden" }}>
              <div style={{
                height: "100%", width: `${pct}%`, borderRadius: "2px",
                background: `linear-gradient(90deg, var(--gold-dim), var(--gold))`,
                transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)",
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── RelatedLots ──────────────────────────────────────────────────────────────

function RelatedLots({ lotId }: { lotId: string }) {
  const { data: similar } = useSWR<Lot[]>(
    `similar-${lotId}`,
    () => lotsApi.similar(lotId).then((r) => r.data)
  );

  if (!similar || similar.length === 0) return null;

  return (
    <div style={{ marginTop: "40px", paddingTop: "32px", borderTop: "1px solid var(--border)" }}>
      <div style={{ marginBottom: "20px" }}>
        <span style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--text-muted)" }}>
          Opportunités Similaires
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "16px" }}>
        {similar.slice(0, 4).map((lot, i) => (
          <GalleryCard key={lot.id} lot={lot} index={i} />
        ))}
      </div>
    </div>
  );
}

// ── ComparablesPanel ─────────────────────────────────────────────────────────

function ComparablesPanel({ lotId }: { lotId: string }) {
  const { data: comparables } = useSWR<Lot[]>(
    `comparables-${lotId}`,
    () => lotsApi.comparables(lotId).then((r) => r.data)
  );

  if (!comparables || comparables.length === 0) return null;

  return (
    <div style={{ background: "var(--graphite)", border: "1px solid var(--border)", borderRadius: "6px", padding: "20px" }}>
      <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "16px" }}>
        Ventes Comparables
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {comparables.slice(0, 4).map((lot) => (
          <Link key={lot.id} href={`/lot/${lot.id}`} style={{ textDecoration: "none" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: "10px",
              padding: "10px", borderRadius: "4px",
              border: "1px solid var(--border)",
              background: "var(--slate)",
              transition: "border-color 0.15s ease",
            }}>
              <div style={{ width: "44px", height: "44px", borderRadius: "3px", overflow: "hidden", background: "var(--border)", flexShrink: 0, position: "relative" }}>
                {lot.image_url && (
                  <img src={lot.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "12px", color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {lot.title}
                </div>
                <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "2px" }}>{formatDate(lot.auction_date)}</div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", color: "var(--text-primary)", fontWeight: 600 }}>
                  {fmtPrice(lot.current_price, lot.currency)}
                </div>
                {lot.deal_score != null && (
                  <div style={{ fontFamily: "monospace", fontSize: "10px", color: lot.deal_score >= 80 ? "var(--green)" : "var(--text-muted)", marginTop: "2px" }}>
                    {lot.deal_score.toFixed(0)}/100
                  </div>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ── NautilusOracle ───────────────────────────────────────────────────────────

const SIGNAL_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  BUY_NOW: { bg: "var(--gold)",   color: "#080809", border: "var(--gold)" },
  WATCH:   { bg: "var(--slate)",  color: "var(--text-primary)", border: "var(--gold-dim)" },
  HOLD:    { bg: "var(--graphite)", color: "var(--text-secondary)", border: "var(--border)" },
  AVOID:   { bg: "#3b0f0f",       color: "#f87171", border: "#7f1d1d" },
};

function OracleBar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
        <span style={{ fontSize: "10px", color: "var(--text-muted)", fontFamily: "'JetBrains Mono', monospace" }}>{label}</span>
        <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--gold)", fontFamily: "'JetBrains Mono', monospace" }}>{pct.toFixed(0)}%</span>
      </div>
      <div style={{ height: "5px", background: "var(--slate)", borderRadius: "3px", overflow: "hidden", border: "1px solid var(--border)" }}>
        <div style={{
          height: "100%", width: `${pct}%`, borderRadius: "3px",
          background: `linear-gradient(90deg, var(--gold-dim), var(--gold))`,
          boxShadow: "0 0 6px var(--gold-glow)",
          transition: "width 1s cubic-bezier(0.4,0,0.2,1)",
        }} />
      </div>
    </div>
  );
}

function NautilusOracle({ artistId }: { artistId: string }) {
  const { plan } = useAuthStore();
  const unlocked = plan !== "free";

  const { data: oracle } = useSWR<OracleSignal>(
    unlocked && artistId ? `oracle-${artistId}` : null,
    () => artistsApi.oracle(artistId).then((r) => r.data).catch(() => null)
  );

  const signalStyle = oracle ? (SIGNAL_STYLES[oracle.oracle_signal] ?? SIGNAL_STYLES.HOLD) : null;

  return (
    <div style={{
      background: "var(--graphite)", border: "1px solid var(--border-light)",
      borderRadius: "6px", overflow: "hidden",
      boxShadow: "0 0 24px rgba(201,168,76,0.04)",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 18px",
        borderBottom: "1px solid var(--border)",
        background: "linear-gradient(135deg, var(--slate) 0%, var(--graphite) 100%)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "13px", color: "var(--gold)" }}>⚡</span>
          <span style={{ fontSize: "9px", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--gold)" }}>
            Nautilus Oracle
          </span>
        </div>
        {oracle && signalStyle && (
          <span style={{
            fontSize: "9px", fontWeight: 800, letterSpacing: "0.14em",
            textTransform: "uppercase", padding: "3px 8px", borderRadius: "3px",
            background: signalStyle.bg, color: signalStyle.color, border: `1px solid ${signalStyle.border}`,
          }}>
            {oracle.oracle_signal.replace("_", " ")}
          </span>
        )}
      </div>

      {/* Locked overlay */}
      {!unlocked && (
        <div style={{ padding: "28px 18px", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", textAlign: "center" }}>
          <div style={{ fontSize: "20px", color: "var(--gold-dim)" }}>⚡</div>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "0.05em" }}>
            Oracle Intelligence
          </div>
          <div style={{ fontSize: "10px", color: "var(--text-muted)", lineHeight: 1.5 }}>
            Predictive price signals,<br />buy window & upside targets
          </div>
          <a href="/billing" style={{
            marginTop: "4px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em",
            textTransform: "uppercase", textDecoration: "none",
            color: "var(--gold)", border: "1px solid var(--gold-dim)",
            padding: "6px 14px", borderRadius: "3px",
          }}>
            Pro · Unlock Oracle →
          </a>
        </div>
      )}

      {/* No data yet */}
      {unlocked && !oracle && (
        <div style={{ padding: "20px 18px" }}>
          <div style={{ fontSize: "10px", color: "var(--text-muted)", textAlign: "center" }}>
            Oracle en cours de calcul…
          </div>
        </div>
      )}

      {/* Oracle data */}
      {unlocked && oracle && (
        <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: "14px" }}>
          {/* Progress bars */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <OracleBar label="6-month outlook" value={oracle.oracle_score_6m} />
            <OracleBar label="18-month outlook" value={oracle.oracle_score_18m} />
          </div>

          {/* Active signals */}
          {oracle.active_signals.length > 0 && (
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
              <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "8px" }}>
                Active Signals
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {oracle.active_signals.map((sig, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "7px" }}>
                    <span style={{ color: "var(--gold)", fontSize: "9px", marginTop: "1px", flexShrink: 0 }}>◆</span>
                    <span style={{ fontSize: "11px", color: "var(--text-secondary)", lineHeight: 1.4 }}>{sig}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Narrative */}
          {oracle.oracle_narrative && (
            <p style={{
              fontSize: "11px", color: "var(--text-secondary)", lineHeight: 1.6,
              borderTop: "1px solid var(--border)", paddingTop: "12px",
              fontStyle: "italic",
            }}>
              {oracle.oracle_narrative}
            </p>
          )}

          {/* Verdict footer */}
          <div style={{
            borderTop: "1px solid var(--border)", paddingTop: "12px",
            display: "flex", flexDirection: "column", gap: "4px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Window</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "var(--text-primary)", fontWeight: 600 }}>{oracle.oracle_window}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Target upside</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "var(--gold)", fontWeight: 700 }}>{oracle.oracle_target_upside}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Confidence</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "var(--text-secondary)" }}>{(oracle.confidence * 100).toFixed(0)}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── ArtistPanel ──────────────────────────────────────────────────────────────

function ArtistPanel({ lot }: { lot: Lot }) {
  const artist = lot.artist;
  if (!artist) return null;

  const stats = [
    { label: "Prix Moyen",  value: fmtPrice(artist.avg_auction_price) },
    { label: "Tendance",    value: artist.trend === "up" ? "↑ Hausse" : artist.trend === "down" ? "↓ Baisse" : "→ Stable" },
    { label: "Liquidité",   value: `${artist.liquidity_score.toFixed(0)}/100` },
    { label: "Taux Vente",  value: `${(artist.sell_through_rate * 100).toFixed(0)}%` },
    { label: "Lots Vendus", value: artist.total_lots_sold.toLocaleString() },
    { label: "Popularité",  value: `${artist.popularity_score.toFixed(0)}/100` },
  ];

  return (
    <div style={{ background: "var(--graphite)", border: "1px solid var(--border)", borderRadius: "6px", padding: "20px" }}>
      <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "16px" }}>
        Profil Artiste
      </div>

      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "16px" }}>
        <div style={{ width: "44px", height: "44px", borderRadius: "4px", background: "var(--slate)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {artist.portrait_url ? (
            <img src={artist.portrait_url} alt={artist.name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "4px" }} />
          ) : (
            <span style={{ fontFamily: "serif", fontSize: "20px", color: "var(--border-light)" }}>{artist.name[0]}</span>
          )}
        </div>
        <div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "16px", color: "var(--text-primary)", marginBottom: "4px" }}>{artist.name}</div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            {[artist.nationality, artist.movement, artist.birth_year ? `b. ${artist.birth_year}` : null].filter(Boolean).join(" · ")}
          </div>
          {artist.wikipedia_url && (
            <a href={artist.wikipedia_url} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: "10px", color: "var(--gold)", textDecoration: "none", marginTop: "4px", display: "inline-block" }}>
              Wikipedia ↗
            </a>
          )}
        </div>
      </div>

      {artist.biography_fr && (
        <p style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.6, borderTop: "1px solid var(--border)", paddingTop: "12px", marginBottom: "16px" }}>
          {artist.biography_fr}
        </p>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
        {stats.map(({ label, value }) => (
          <div key={label} style={{ padding: "10px 12px", background: "var(--slate)", border: "1px solid var(--border)", borderRadius: "4px" }}>
            <div style={{ fontSize: "9px", color: "var(--text-muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "4px" }}>{label}</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "13px", color: "var(--text-primary)", fontWeight: 600 }}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── LoadingState ─────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div style={{ padding: "40px 32px" }}>
      <div style={{ height: "280px", background: "var(--graphite)", borderRadius: "6px", marginBottom: "24px", animation: "pulse 1.5s infinite" }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "24px" }}>
        <div style={{ height: "400px", background: "var(--graphite)", borderRadius: "6px", animation: "pulse 1.5s infinite" }} />
        <div style={{ height: "400px", background: "var(--graphite)", borderRadius: "6px", animation: "pulse 1.5s infinite" }} />
      </div>
    </div>
  );
}

// ── ErrorState ───────────────────────────────────────────────────────────────

function ErrorState() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 32px" }}>
      <span style={{ fontFamily: "serif", fontSize: "64px", color: "var(--border)", marginBottom: "16px" }}>◇</span>
      <div style={{ color: "var(--text-muted)", marginBottom: "20px" }}>Lot introuvable</div>
      <Link href="/dashboard" className="btn-ghost" style={{ fontSize: "12px" }}>
        ← Retour au feed
      </Link>
    </div>
  );
}

// ── LotPage ──────────────────────────────────────────────────────────────────

function OracleBadge({ artistId }: { artistId: string }) {
  const { plan } = useAuthStore();
  const unlocked = plan !== "free";

  const { data: oracle } = useSWR<OracleSignal>(
    unlocked && artistId ? `oracle-${artistId}` : null,
    () => artistsApi.oracle(artistId).then((r) => r.data).catch(() => null)
  );

  if (!oracle || !unlocked) return null;
  if (oracle.oracle_signal !== "BUY_NOW" && oracle.oracle_signal !== "WATCH") return null;

  const signalStyle = SIGNAL_STYLES[oracle.oracle_signal];

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "8px" }}>
      <span style={{ fontSize: "11px", color: "var(--gold)" }}>⚡</span>
      <span style={{
        fontSize: "9px", fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase",
        padding: "2px 7px", borderRadius: "3px",
        background: signalStyle.bg, color: signalStyle.color, border: `1px solid ${signalStyle.border}`,
      }}>
        Oracle: {oracle.oracle_signal.replace("_", " ")}
      </span>
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "var(--text-muted)" }}>
        · {oracle.oracle_score_6m.toFixed(0)}% confidence · {oracle.oracle_target_upside} upside
      </span>
    </div>
  );
}

export default function LotPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const { currency, locale } = useLanguageStore();

  const { data: lot, isLoading, error } = useSWR<Lot>(
    id ? `lot-${id}` : null,
    () => lotsApi.get(id).then((r) => r.data)
  );

  const fmt = (v?: number | null) => v != null ? formatPriceInCurrency(v, currency, locale) : "—";

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--obsidian)" }}>
      <Sidebar />
      <div style={{ flex: 1, marginLeft: "52px", minWidth: 0, overflowX: "hidden" }}>
        {isLoading ? (
          <LoadingState />
        ) : error || !lot ? (
          <ErrorState />
        ) : (
          <div>
            {/* ── HERO ──────────────────────────────────────────── */}
            <div style={{ position: "relative", height: "320px", overflow: "hidden", background: "var(--carbon)" }}>
              {/* Blurred background */}
              {lot.image_url && (
                <div style={{
                  position: "absolute", inset: 0,
                  backgroundImage: `url(${lot.image_url})`,
                  backgroundSize: "cover", backgroundPosition: "center",
                  filter: "blur(32px) brightness(0.25)",
                  transform: "scale(1.1)",
                }} />
              )}

              {/* Dark overlays */}
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, var(--obsidian) 0%, rgba(8,8,9,0.5) 60%, transparent 100%)" }} />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, rgba(8,8,9,0.7) 0%, transparent 60%)" }} />

              {/* Content over hero */}
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-end", padding: "0 32px 32px" }}>
                <div style={{ display: "flex", gap: "28px", alignItems: "flex-end", width: "100%" }}>
                  {/* Artwork thumbnail */}
                  {lot.image_url && (
                    <div style={{
                      width: "120px", height: "160px", flexShrink: 0,
                      borderRadius: "4px", overflow: "hidden",
                      border: "1px solid var(--border-light)",
                      boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
                    }}>
                      <img src={lot.image_url} alt={lot.title}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    </div>
                  )}

                  {/* Title block */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {lot.artist_name_raw && (
                      <div style={{ marginBottom: "8px" }}>
                        <div style={{ fontSize: "11px", fontWeight: 800, color: "var(--gold)", letterSpacing: "0.16em", textTransform: "uppercase" }}>
                          {lot.artist_name_raw}
                        </div>
                        {lot.artist?.id && <OracleBadge artistId={lot.artist.id} />}
                      </div>
                    )}
                    <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "26px", fontWeight: 600, color: "white", lineHeight: 1.3, marginBottom: "12px", maxWidth: "600px" }}>
                      {lot.title}
                    </h1>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                      {lot.category && (
                        <span style={{ fontSize: "10px", color: "var(--text-muted)", background: "var(--slate)", padding: "3px 8px", borderRadius: "3px", border: "1px solid var(--border)" }}>
                          {lot.category}
                        </span>
                      )}
                      {lot.auction_house_name && (
                        <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                          {lot.auction_house_name.split("—")[0].trim()}
                        </span>
                      )}
                      {lot.auction_date && (
                        <span style={{ fontFamily: "monospace", fontSize: "11px", color: "var(--text-muted)" }}>
                          {formatDate(lot.auction_date)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Price + actions */}
                  <div style={{ flexShrink: 0, textAlign: "right" }}>
                    {(lot.current_price || lot.estimate_low) && (
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "28px", fontWeight: 700, color: "white", lineHeight: 1, marginBottom: "4px" }}>
                        {fmt(lot.current_price || lot.estimate_low)}
                      </div>
                    )}
                    {lot.pct_below_low_estimate != null && Math.abs(lot.pct_below_low_estimate) > 5 && (
                      <div style={{ fontFamily: "monospace", fontSize: "13px", color: "var(--green)", marginBottom: "12px" }}>
                        -{lot.pct_below_low_estimate.toFixed(0)}% sous estimation
                      </div>
                    )}
                    <WishlistButton lotId={id} size="md" />
                  </div>
                </div>
              </div>

              {/* Back button */}
              <div style={{ position: "absolute", top: "20px", left: "32px" }}>
                <Link href="/dashboard" className="btn-ghost" style={{ fontSize: "11px" }}>
                  <ArrowLeft size={12} />
                  Retour
                </Link>
              </div>
            </div>

            {/* ── CONTENT ───────────────────────────────────────── */}
            <div style={{ padding: "28px 32px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "24px", alignItems: "start" }}>

                {/* LEFT COLUMN */}
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

                  {/* Pricing detail */}
                  <div style={{ background: "var(--graphite)", border: "1px solid var(--border)", borderRadius: "6px", padding: "20px" }}>
                    <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "16px" }}>
                      Pricing
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "16px" }}>
                      {lot.current_price != null && lot.current_price > 0 &&
                        (!lot.estimate_low || Math.abs(lot.current_price - lot.estimate_low) > 50) && (
                        <div>
                          <div style={{ fontSize: "10px", color: "var(--text-muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "6px" }}>Prix actuel</div>
                          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "22px", fontWeight: 700, color: "var(--text-primary)" }}>
                            {fmt(lot.current_price)}
                          </div>
                        </div>
                      )}
                      {lot.estimate_low != null && lot.estimate_low > 0 && (
                        <div>
                          <div style={{ fontSize: "10px", color: "var(--text-muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "6px" }}>Estimation</div>
                          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "22px", fontWeight: 700, color: "var(--text-primary)" }}>
                            {fmt(lot.estimate_low)}
                            {lot.estimate_high != null && lot.estimate_high > lot.estimate_low && (
                              <span style={{ fontSize: "16px", color: "var(--text-secondary)" }}>
                                {" "}– {fmt(lot.estimate_high)}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      {lot.pct_below_low_estimate != null && Math.abs(lot.pct_below_low_estimate) > 5 && (
                        <div>
                          <div style={{ fontSize: "10px", color: "var(--text-muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "6px" }}>vs Estimation basse</div>
                          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "22px", fontWeight: 700, color: lot.pct_below_low_estimate > 0 ? "var(--green)" : "var(--red)" }}>
                            {lot.pct_below_low_estimate > 0 ? "-" : "+"}{Math.abs(lot.pct_below_low_estimate).toFixed(0)}%
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ROI Projection */}
                    {(lot.current_price || lot.estimate_low) && (
                      <div style={{ marginTop: "20px", paddingTop: "20px", borderTop: "1px solid var(--border)" }}>
                        <ProjectionBar
                          price={lot.current_price || lot.estimate_low || 0}
                          currency={currency}
                          locale={locale}
                        />
                      </div>
                    )}
                  </div>

                  {/* AI Insight */}
                  {lot.ai_insight && (
                    <div style={{ background: "var(--graphite)", border: "1px solid var(--border)", borderRadius: "6px", padding: "20px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                        <Sparkles size={13} style={{ color: "var(--gold)" }} />
                        <span style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--gold)" }}>
                          Analyse ArtAlpha
                        </span>
                      </div>
                      <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.7 }}>{lot.ai_insight}</p>
                      {lot.rationale && lot.rationale.length > 0 && (
                        <div style={{ marginTop: "14px", paddingTop: "14px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "8px" }}>
                          {lot.rationale.map((r, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                              <CheckCircle size={12} style={{ color: "var(--green)", marginTop: "2px", flexShrink: 0 }} />
                              <span style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.5 }}>{r}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Description */}
                  {lot.description && (
                    <div style={{ background: "var(--graphite)", border: "1px solid var(--border)", borderRadius: "6px", padding: "20px" }}>
                      <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "12px" }}>
                        Description
                      </div>
                      <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.7 }}>{lot.description}</p>
                    </div>
                  )}

                  {/* Lot details */}
                  <div style={{ background: "var(--graphite)", border: "1px solid var(--border)", borderRadius: "6px", padding: "20px" }}>
                    <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "16px" }}>
                      Détails du Lot
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                      {[
                        { icon: Tag,       label: "N° de lot",   value: lot.lot_number },
                        { icon: Palette,   label: "Technique",   value: lot.medium },
                        { icon: Ruler,     label: "Dimensions",  value: lot.dimensions },
                        { icon: Calendar,  label: "Date de vente", value: formatDate(lot.auction_date) },
                        { icon: Building2, label: "Maison",      value: lot.auction_house_name },
                        { icon: Star,      label: "Titre vente", value: lot.auction_sale_title },
                      ].filter((item) => item.value).map(({ icon: Icon, label, value }) => (
                        <div key={label} style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                          <Icon size={13} style={{ color: "var(--text-muted)", marginTop: "2px", flexShrink: 0 }} />
                          <div>
                            <div style={{ fontSize: "9px", color: "var(--text-muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "3px" }}>{label}</div>
                            <div style={{ fontSize: "13px", color: "var(--text-primary)" }}>{value}</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Source note */}
                    <div style={{ marginTop: "16px", padding: "12px", background: "var(--slate)", border: "1px solid var(--border)", borderRadius: "4px", borderLeft: "2px solid var(--gold-dim)" }}>
                      <p style={{ fontSize: "11px", color: "var(--gold)", fontWeight: 600 }}>
                        Source : {lot.auction_house_name || String(lot.source)}
                        {lot.status === "upcoming" && " · Vente à venir"}
                      </p>
                      <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                        Données agrégées automatiquement. Le lien vous amène sur la plateforme source.
                      </p>
                    </div>

                    {/* View on source */}
                    {lot.url && (
                      <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid var(--border)" }}>
                        <a
                          href={lot.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-gold"
                          style={{ textDecoration: "none" }}
                        >
                          <ExternalLink size={13} />
                          Voir sur {lot.auction_house_name?.split("—")[0].trim() || String(lot.source)}
                        </a>
                        <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "8px" }}>
                          Ouvre la plateforme source dans un nouvel onglet
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Comparables */}
                  <ComparablesPanel lotId={id} />
                </div>

                {/* RIGHT COLUMN */}
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

                  {/* Score gauge */}
                  {lot.deal_score != null && (
                    <div style={{ background: "var(--graphite)", border: "1px solid var(--border)", borderRadius: "6px", padding: "24px", display: "flex", flexDirection: "column", alignItems: "center", gap: "20px" }}>
                      <ScoreGauge score={lot.deal_score} />

                      {lot.score_breakdown && (
                        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "8px", borderTop: "1px solid var(--border)", paddingTop: "16px" }}>
                          {[
                            { label: "Sous estimation",  value: lot.score_breakdown.below_estimate_score },
                            { label: "Sous marché",      value: lot.score_breakdown.below_market_score },
                            { label: "Liquidité",        value: lot.score_breakdown.liquidity_score },
                            { label: "Maison de vente",  value: lot.score_breakdown.house_reputation_score },
                            { label: "Confiance",        value: lot.score_breakdown.confidence_score },
                          ].map(({ label, value }) => value != null ? (
                            <div key={label}>
                              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                                <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>{label}</span>
                                <span style={{ fontFamily: "monospace", fontSize: "10px", color: "var(--text-secondary)" }}>{value.toFixed(0)}</span>
                              </div>
                              <div style={{ height: "3px", background: "var(--border)", borderRadius: "2px", overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${Math.max(0, Math.min(100, value))}%`, background: "var(--gold)", borderRadius: "2px" }} />
                              </div>
                            </div>
                          ) : null)}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Artist info */}
                  <ArtistPanel lot={lot} />

                  {/* Nautilus Oracle */}
                  {lot.artist?.id && (
                    <NautilusOracle artistId={lot.artist.id} />
                  )}
                </div>
              </div>

              {/* Related lots */}
              <RelatedLots lotId={id} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
