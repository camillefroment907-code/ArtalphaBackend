"use client";

import { TrendingUp, TrendingDown, AlertTriangle, Sparkles } from "lucide-react";
import { useLanguageStore } from "@/lib/useLanguage";
import { formatCurrency } from "@/lib/currency";
import type { Lot, ProjectionAlternative } from "@/lib/api";

// ── Design tokens (match rest of app) ────────────────────────────────────────
const NAVY   = "#1A2A44";
const GOLD   = "#C6A85A";
const BORDER = "#E5E7EB";
const SUCCESS = "#16A34A";
const WARNING = "#EA580C";
const DANGER  = "#DC2626";
const NEUTRAL = "#6B7280";

const MEDIUM_DISPLAY: Record<string, string> = {
  oil_on_canvas:  "Oil on canvas",
  prints:         "Prints",
  works_on_paper: "Works on Paper",
  sculpture:      "Sculpture",
  photography:    "Photography",
};

// ── Signal config ─────────────────────────────────────────────────────────────
const SIGNAL_CONFIG = {
  BUY:     { color: SUCCESS, bg: "rgba(22,163,74,0.08)",   border: "rgba(22,163,74,0.25)",   label: "BUY",     Icon: TrendingUp   },
  NEUTRAL: { color: NEUTRAL, bg: "rgba(107,114,128,0.08)", border: "rgba(107,114,128,0.25)", label: "NEUTRAL", Icon: TrendingUp   },
  WATCH:   { color: WARNING, bg: "rgba(234,88,12,0.08)",   border: "rgba(234,88,12,0.25)",   label: "WATCH",   Icon: AlertTriangle },
  AVOID:   { color: DANGER,  bg: "rgba(220,38,38,0.08)",   border: "rgba(220,38,38,0.25)",   label: "AVOID",   Icon: TrendingDown  },
} as const;

// ── Main component ────────────────────────────────────────────────────────────
export function InvestmentTimeline({ lot }: { lot: Lot }) {
  const lang = useLanguageStore((s) => s.lang);
  const proj = lot.projection;

  // If no projection data at all, render nothing
  if (!proj) return null;

  const signal   = proj.signal ?? "NEUTRAL";
  const cfg      = SIGNAL_CONFIG[signal];
  const { Icon } = cfg;

  // CAGR is a percentage in the API (e.g. 8.5 = 8.5%).
  // Do NOT default to 0 — a missing CAGR must not appear as "flat growth".
  const cagrPct   = proj.cagr_pct ?? null;
  const holdYears = proj.recommended_hold_years ?? 5;

  // Base for projection: all_in_cost if available, else current_price
  const allIn = proj.all_in_cost ?? lot.current_price ?? 0;

  // Projected exit price: use backend pre-computed value when available,
  // otherwise compute from CAGR only if CAGR is a real value (not null).
  // Never fabricate a range when the backend didn't provide one.
  const yearData  = proj.years?.[holdYears];
  const exitPrice = yearData?.base_eur
    ?? (allIn > 0 && cagrPct != null ? allIn * Math.pow(1 + cagrPct / 100, holdYears) : null);
  // Range: only show backend-supplied conservative/optimistic — no ±15% invention
  const exitLow   = yearData?.conservative_eur ?? null;
  const exitHigh  = yearData?.optimistic_eur   ?? null;

  // Medium display label
  const mediumLabel = proj.cagr_medium_used
    ? (MEDIUM_DISPLAY[proj.cagr_medium_used] || proj.cagr_medium_used)
    : null;

  const fmt = (v: number) => formatCurrency(v, lang, { compact: true });

  const alternatives = proj.alternatives ?? [];

  return (
    <div style={{ marginBottom: "24px" }}>

      {/* ── Section header ────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: "12px",
      }}>
        <div style={{
          fontSize: "9px", fontWeight: 700, letterSpacing: "0.18em",
          textTransform: "uppercase", color: "var(--text-muted)",
        }}>
          Investment Timeline
        </div>

        {/* Signal badge */}
        <div style={{
          display: "flex", alignItems: "center", gap: "6px",
          padding: "4px 10px", borderRadius: "6px",
          background: cfg.bg, border: `1px solid ${cfg.border}`,
          fontSize: "11px", fontWeight: 700, color: cfg.color,
        }}>
          <Icon size={12} />
          <span>{cfg.label}</span>
          {signal === "BUY" && cagrPct != null && cagrPct > 0 && (
            <span style={{ opacity: 0.7, fontWeight: 500 }}>
              · {cagrPct.toFixed(1)}% CAGR
            </span>
          )}
          {signal === "AVOID" && proj.cagr_raw_pct != null && proj.cagr_raw_pct < 0 && (
            <span style={{ opacity: 0.7, fontWeight: 500 }}>
              · {(proj.cagr_raw_pct!).toFixed(1)}% trend
            </span>
          )}
        </div>
      </div>

      {/* ── Signal description — data-driven only ────────────────────── */}
      {(proj.cagr_source || proj.cagr_n_sales) && (
        <p style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.55, marginBottom: "16px" }}>
          {proj.cagr_source === "medium_specific" && mediumLabel && lot.artist_name_raw ? (
            <>
              Based on <strong style={{ color: NAVY }}>{proj.cagr_n_sales?.toLocaleString() ?? "—"} historical sales</strong> of {lot.artist_name_raw} {mediumLabel}.
              {proj.cagr_confidence ? ` Confidence: ${proj.cagr_confidence}.` : ""}
            </>
          ) : proj.cagr_source === "COMPUTED" ? (
            <>
              Based on <strong style={{ color: NAVY }}>{proj.cagr_n_sales?.toLocaleString() ?? "—"} historical sales</strong> across all mediums for this artist.
            </>
          ) : (
            <>
              No sufficient historical data for this artist — CAGR estimated from market tier.
            </>
          )}
        </p>
      )}

      {/* ── Timeline card ────────────────────────────────────────────── */}
      <div style={{
        background: "var(--white)", border: `1px solid ${BORDER}`,
        borderRadius: "8px", padding: "24px 32px",
      }}>
        {/* Horizontal timeline */}
        <div style={{ position: "relative", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>

          {/* Connecting line */}
          <div style={{
            position: "absolute",
            top: "10px",
            left: "10%", right: "10%",
            height: "2px",
            background: BORDER,
            zIndex: 0,
          }} />

          {/* TODAY node */}
          <TimelineNode
            label="TODAY"
            value={allIn > 0 ? fmt(allIn) : "—"}
            sub={
              proj.projection_price_basis === "hammer"       ? "All-in (hammer + premium)" :
              proj.projection_price_basis === "estimate_mid" ? "All-in (est. mid + premium)" :
              proj.projection_price_basis === "estimate_low" ? "All-in (est. low + premium)" :
              "All-in (current bid)"
            }
            dotColor={NAVY}
            labelColor={NAVY}
            valueColor={NAVY}
            align="left"
          />

          {/* HORIZON node */}
          <TimelineNode
            label="HORIZON"
            value={`${holdYears}y`}
            sub="Recommended hold"
            dotColor={GOLD}
            labelColor="var(--text-muted)"
            valueColor={GOLD}
            align="center"
          />

          {/* EXIT node */}
          <TimelineNode
            label="EXIT"
            value={exitPrice != null && exitPrice > 0 ? fmt(exitPrice) : "—"}
            sub={
              exitPrice != null && exitPrice > 0
                ? (exitLow != null && exitHigh != null
                    ? `${fmt(exitLow)} – ${fmt(exitHigh)}`
                    : `${holdYears}y at ${cagrPct != null ? cagrPct.toFixed(1) + "% CAGR" : "—"}`)
                : "Insufficient data"
            }
            dotColor={cfg.color}
            labelColor={cfg.color}
            valueColor={cfg.color}
            align="right"
          />
        </div>

        {/* CAGR source note */}
        {proj.cagr_source && (
          <div style={{
            marginTop: "20px", paddingTop: "16px",
            borderTop: `1px solid ${BORDER}`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexWrap: "wrap" as const, gap: "8px",
          }}>
            <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
              Data source:{" "}
              <strong style={{ color: NAVY }}>
                {proj.cagr_source === "medium_specific"
                  ? `${mediumLabel || "medium"} — ${proj.cagr_confidence ?? ""}`.replace("—  ", "")
                  : proj.cagr_source === "COMPUTED"
                  ? "Artist aggregate"
                  : "Market tier estimate"}
              </strong>
            </span>
            {proj.cagr_aggregate_pct != null && proj.cagr_source !== "medium_specific" && (
              <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                Aggregate CAGR: <strong style={{ color: NAVY }}>{proj.cagr_aggregate_pct.toFixed(1)}%</strong>
              </span>
            )}
          </div>
        )}

        {/* Optimal exit label */}
        {proj.optimal_exit_label && (
          <div style={{
            marginTop: "12px",
            display: "flex", alignItems: "center", gap: "6px",
            fontSize: "11px", color: "var(--text-muted)",
          }}>
            <Sparkles size={11} style={{ color: GOLD, flexShrink: 0 }} />
            <span>
              <strong style={{ color: NAVY }}>Optimal exit:</strong>{" "}
              {proj.optimal_exit_label}
            </span>
          </div>
        )}
      </div>

      {/* ── Better Opportunities ─────────────────────────────────────── */}
      {alternatives.length > 0 && (
        <BetterOpportunities
          alternatives={alternatives}
          artistName={lot.artist_name_raw}
        />
      )}

      {/* ── Disclaimer ───────────────────────────────────────────────── */}
      <p style={{
        fontSize: "10px", fontStyle: "italic",
        color: "var(--text-muted)", lineHeight: 1.5,
        marginTop: "14px",
      }}>
        Projections based on historical auction data, CAGR capped at 15% to reflect
        long-term market realism. Past performance does not guarantee future returns.
        Nautilus is not a financial advisor — this is not investment advice.
      </p>
    </div>
  );
}

// ── Timeline node ─────────────────────────────────────────────────────────────
function TimelineNode({
  label, value, sub,
  dotColor, labelColor, valueColor,
  align,
}: {
  label: string;
  value: string;
  sub?: string;
  dotColor: string;
  labelColor: string;
  valueColor: string;
  align: "left" | "center" | "right";
}) {
  const textAlign = align === "center" ? "center" : align === "right" ? "right" : "left";
  const alignItems = align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start";

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems,
      zIndex: 1, position: "relative",
      minWidth: "100px",
    }}>
      {/* Dot */}
      <div style={{
        width: "20px", height: "20px", borderRadius: "50%",
        background: dotColor,
        border: "3px solid var(--white)",
        boxShadow: `0 0 0 2px ${dotColor}`,
        marginBottom: "10px", flexShrink: 0,
      }} />

      {/* Label */}
      <div style={{
        fontSize: "9px", fontWeight: 700, letterSpacing: "0.16em",
        textTransform: "uppercase", color: labelColor,
        marginBottom: "4px", textAlign,
      }}>
        {label}
      </div>

      {/* Value */}
      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: "18px", fontWeight: 700,
        color: valueColor, lineHeight: 1,
        marginBottom: "4px", textAlign,
      }}>
        {value}
      </div>

      {/* Sub */}
      {sub && (
        <div style={{
          fontSize: "10px", color: "var(--text-muted)",
          textAlign, lineHeight: 1.4,
        }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ── Better Opportunities ──────────────────────────────────────────────────────
function BetterOpportunities({
  alternatives,
  artistName,
}: {
  alternatives: ProjectionAlternative[];
  artistName?: string;
}) {
  return (
    <div style={{
      marginTop: "16px",
      background: "rgba(198,168,90,0.04)",
      border: "1px solid rgba(198,168,90,0.2)",
      borderRadius: "8px", padding: "20px",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: "6px", marginBottom: "14px",
      }}>
        <Sparkles size={12} style={{ color: GOLD }} />
        <div style={{
          fontSize: "9px", fontWeight: 700, letterSpacing: "0.18em",
          textTransform: "uppercase", color: NAVY,
        }}>
          Better opportunities for {artistName || "this artist"}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {alternatives.map((alt, i) => {
          const medLabel = alt.medium_display
            || MEDIUM_DISPLAY[alt.medium]
            || alt.medium.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
          const altCagrDisplay = typeof alt.cagr_pct === "number"
            ? alt.cagr_pct.toFixed(1)
            : "—";
          const deltaDisplay = typeof alt.delta_pct === "number"
            ? alt.delta_pct.toFixed(1)
            : "—";

          return (
            <div key={i} style={{
              display: "flex", alignItems: "flex-start", justifyContent: "space-between",
              gap: "16px", padding: "12px 16px",
              background: "var(--white)", border: `1px solid ${BORDER}`,
              borderRadius: "6px",
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: "12px", fontWeight: 700, color: NAVY, marginBottom: "3px",
                }}>
                  {medLabel}
                </div>
                <div style={{
                  fontSize: "11px", color: "var(--text-muted)", lineHeight: 1.5,
                }}>
                  {alt.rationale}
                </div>
                {alt.n_sales > 0 && (
                  <div style={{
                    fontSize: "10px", color: "var(--text-muted)", marginTop: "3px",
                  }}>
                    Based on {alt.n_sales.toLocaleString()} historical sales
                  </div>
                )}
              </div>

              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "16px", fontWeight: 700, color: SUCCESS,
                }}>
                  {altCagrDisplay}%
                </div>
                <div style={{
                  fontSize: "10px", color: SUCCESS, display: "flex",
                  alignItems: "center", gap: "3px", justifyContent: "flex-end",
                }}>
                  <TrendingUp size={10} />
                  +{deltaDisplay}% vs current
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
