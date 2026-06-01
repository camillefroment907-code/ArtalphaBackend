"use client";

import { Sparkles, CheckCircle } from "lucide-react";
import type { Lot } from "@/lib/api";

const SUCCESS = "#16A34A";
const WARNING = "#EA580C";

const PILLAR_DISPLAY: Record<string, string> = {
  below_estimate_score: "Below Estimate",
  below_market_score: "Below Market Avg",
  liquidity_score: "Liquidity",
  house_reputation_score: "House Reputation",
  confidence_score: "Data Confidence",
};

interface AnalysisTabProps {
  lot: Lot;
}

export function AnalysisTab({ lot }: AnalysisTabProps) {
  const aiInsight = lot.score_breakdown?.ai_insight || lot.ai_insight;
  const rationale = lot.score_breakdown?.rationale || lot.rationale || [];

  const breakdown = lot.score_breakdown;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "20px", alignItems: "start" }}>
      {/* LEFT */}
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {/* AI Insight */}
        {aiInsight ? (
          <div
            style={{
              background: "var(--white)",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              padding: "20px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
              <Sparkles size={13} style={{ color: "var(--gold)" }} />
              <span
                style={{
                  fontSize: "9px",
                  fontWeight: 700,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "var(--gold)",
                }}
              >
                Nautilus AI Analysis
              </span>
            </div>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.75 }}>
              {aiInsight}
            </p>
          </div>
        ) : null}

        {/* Key Signals */}
        {rationale.length > 0 && (
          <div
            style={{
              background: "var(--white)",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              padding: "20px",
            }}
          >
            <div
              style={{
                fontSize: "9px",
                fontWeight: 700,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--text-muted)",
                marginBottom: "14px",
              }}
            >
              Key Signals
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {rationale.map((r, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                  <CheckCircle size={12} style={{ color: SUCCESS, marginTop: "2px", flexShrink: 0 }} />
                  <span style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.6 }}>
                    {r}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!aiInsight && rationale.length === 0 && (
          <div
            style={{
              background: "var(--white)",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              padding: "64px 40px",
              textAlign: "center",
              color: "var(--text-muted)",
              fontSize: "13px",
            }}
          >
            AI analysis is being generated for this lot.
            <br />
            <span style={{ fontSize: "11px" }}>Check back shortly.</span>
          </div>
        )}
      </div>

      {/* RIGHT — Score pillar breakdown */}
      {breakdown && (
        <div
          style={{
            background: "var(--white)",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            padding: "20px",
          }}
        >
          <div
            style={{
              fontSize: "9px",
              fontWeight: 700,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              marginBottom: "16px",
            }}
          >
            Score Breakdown
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {(
              [
                { key: "below_estimate_score", value: breakdown.below_estimate_score },
                { key: "below_market_score", value: breakdown.below_market_score },
                { key: "liquidity_score", value: breakdown.liquidity_score },
                { key: "house_reputation_score", value: breakdown.house_reputation_score },
                { key: "confidence_score", value: breakdown.confidence_score },
              ] as { key: string; value: number }[]
            )
              // below_market_score === 45.0 is a sentinel: no real market data available
              .filter(({ key, value }) => value != null && !(key === "below_market_score" && value === 45))
              .map(({ key, value }) => (
                <div key={key}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "4px",
                    }}
                  >
                    <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                      {PILLAR_DISPLAY[key] ?? key}
                    </span>
                    <span
                      style={{
                        fontFamily: "monospace",
                        fontSize: "10px",
                        color: "var(--navy)",
                        fontWeight: 600,
                      }}
                    >
                      {value.toFixed(0)}
                    </span>
                  </div>
                  <div
                    style={{
                      height: "4px",
                      background: "var(--border)",
                      borderRadius: "2px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.max(0, Math.min(100, value))}%`,
                        background: value >= 70 ? SUCCESS : value >= 50 ? WARNING : "#9CA3AF",
                        borderRadius: "2px",
                        transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)",
                      }}
                    />
                  </div>
                </div>
              ))}
          </div>

          {/* Overall score */}
          {lot.deal_score != null && (
            <div
              style={{
                marginTop: "16px",
                paddingTop: "16px",
                borderTop: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                }}
              >
                Deal Score
              </span>
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "20px",
                  fontWeight: 700,
                  color: "var(--navy)",
                }}
              >
                {lot.deal_score.toFixed(0)}
                <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 400 }}>
                  /100
                </span>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
