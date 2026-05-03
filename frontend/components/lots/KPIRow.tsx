"use client";

import type { Lot } from "@/lib/api";
import { formatPriceInCurrency } from "@/lib/useLanguage";
import { computeFairValue, formatTimeLeft, getConfidenceLabel } from "@/lib/lotHelpers";

const SUCCESS = "#16A34A";

interface KPITile {
  label: string;
  value: string;
  sub?: string | null;
  subColor?: string;
}

interface KPIRowProps {
  lot: Lot;
  currency: string;
  locale: string;
}

export function KPIRow({ lot, currency, locale }: KPIRowProps) {
  const fmt = (v?: number | null) =>
    v != null ? formatPriceInCurrency(v, currency, locale) : "—";

  const fairValue = computeFairValue(lot);
  const upside = lot.pct_below_low_estimate;
  const confidence = lot.score_breakdown?.confidence_score;

  const tiles: KPITile[] = [
    {
      label: "CURRENT PRICE",
      value: fmt(lot.current_price),
    },
    {
      label: "ESTIMATE",
      value: lot.estimate_low != null ? fmt(lot.estimate_low) : "—",
      sub:
        lot.estimate_high != null &&
        lot.estimate_low != null &&
        lot.estimate_high > lot.estimate_low
          ? `– ${fmt(lot.estimate_high)}`
          : null,
    },
    {
      label: "FAIR VALUE AI",
      value: fairValue != null ? fmt(fairValue) : "—",
      sub:
        upside != null && upside > 0
          ? `+${upside.toFixed(0)}% upside`
          : null,
      subColor: SUCCESS,
    },
    {
      label: "CONFIDENCE",
      value: confidence != null ? `${confidence.toFixed(0)}/100` : "—",
      sub: confidence != null ? getConfidenceLabel(confidence) : "Based on market data",
    },
    {
      label: "TIME REMAINING",
      value: formatTimeLeft(lot.time_left_hours),
      sub: lot.time_left_hours != null && lot.time_left_hours > 0 ? "until auction" : null,
    },
  ];

  return (
    <div
      style={{
        display: "flex",
        background: "var(--white)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {tiles.map((tile, i) => (
        <div
          key={tile.label}
          style={{
            flex: 1,
            padding: "14px 20px",
            borderRight: i < tiles.length - 1 ? "1px solid var(--border)" : "none",
          }}
        >
          <div
            style={{
              fontSize: "9px",
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              marginBottom: "5px",
            }}
          >
            {tile.label}
          </div>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "15px",
              fontWeight: 700,
              color: "var(--navy)",
              lineHeight: 1.2,
            }}
          >
            {tile.value}
          </div>
          {tile.sub && (
            <div
              style={{
                fontSize: "10px",
                color: tile.subColor || "var(--text-muted)",
                marginTop: "3px",
              }}
            >
              {tile.sub}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
