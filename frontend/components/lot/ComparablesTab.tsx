"use client";

import Link from "next/link";
import useSWR from "swr";
import { lotsApi, type Lot } from "@/lib/api";
import { formatPriceInCurrency } from "@/lib/useLanguage";

const SUCCESS = "#16A34A";
const DANGER = "#DC2626";

interface ComparablesTabProps {
  lotId: string;
  currentPrice?: number | null;
  currency: string;
  locale: string;
}

function formatDate(date?: string): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function ComparablesTab({ lotId, currentPrice, currency, locale }: ComparablesTabProps) {
  const fmt = (v?: number | null) =>
    v != null ? formatPriceInCurrency(v, currency, locale) : "—";

  const { data: comparables, isLoading, error } = useSWR<Lot[]>(
    `comparables-${lotId}`,
    () => lotsApi.comparables(lotId).then((r) => r.data)
  );

  if (isLoading) {
    return (
      <div
        style={{
          background: "var(--white)",
          border: "1px solid var(--border)",
          borderRadius: "6px",
          padding: "40px",
          textAlign: "center",
          color: "var(--text-muted)",
          fontSize: "13px",
        }}
      >
        Loading comparables…
      </div>
    );
  }

  if (error || !comparables || comparables.length === 0) {
    return (
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
        No comparable sales found for this artist yet.
      </div>
    );
  }

  // Derive market stats from the lot array
  const prices = comparables
    .map((c) => c.current_price)
    .filter((p): p is number => p != null && p > 0);

  const avgPrice =
    prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : null;

  const pctAboveCurrent =
    avgPrice != null && currentPrice != null && currentPrice > 0
      ? ((avgPrice - currentPrice) / currentPrice) * 100
      : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Market analysis summary */}
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
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              fontSize: "9px",
              fontWeight: 700,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
            }}
          >
            Market Overview
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            {comparables.length} comparable sale{comparables.length !== 1 ? "s" : ""}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
          <div>
            <div
              style={{
                fontSize: "9px",
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--text-muted)",
                marginBottom: "4px",
              }}
            >
              Avg comparable
            </div>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "15px",
                fontWeight: 700,
                color: "var(--navy)",
              }}
            >
              {fmt(avgPrice)}
            </div>
          </div>

          {pctAboveCurrent != null && (
            <div>
              <div
                style={{
                  fontSize: "9px",
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                  marginBottom: "4px",
                }}
              >
                Gap vs current
              </div>
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "15px",
                  fontWeight: 700,
                  color: pctAboveCurrent > 0 ? SUCCESS : DANGER,
                }}
              >
                {pctAboveCurrent > 0 ? "+" : ""}
                {Math.round(pctAboveCurrent)}%
              </div>
            </div>
          )}

          <div>
            <div
              style={{
                fontSize: "9px",
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--text-muted)",
                marginBottom: "4px",
              }}
            >
              Sample size
            </div>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "15px",
                fontWeight: 700,
                color: "var(--navy)",
              }}
            >
              {comparables.length}
            </div>
          </div>
        </div>
      </div>

      {/* Comparables table */}
      <div
        style={{
          background: "var(--white)",
          border: "1px solid var(--border)",
          borderRadius: "6px",
          overflow: "hidden",
        }}
      >
        {/* Table header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 140px 90px 110px 70px",
            gap: "0",
            padding: "10px 16px",
            background: "#FAFAFA",
            borderBottom: "1px solid var(--border)",
          }}
        >
          {["Artwork", "Auction House", "Date", "Price", "vs Lot"].map((h) => (
            <div
              key={h}
              style={{
                fontSize: "9px",
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--text-muted)",
                textAlign: h === "Price" || h === "vs Lot" ? "right" : "left",
              }}
            >
              {h}
            </div>
          ))}
        </div>

        {/* Table rows */}
        {comparables.map((comp, i) => {
          const priceDiff =
            currentPrice != null && currentPrice > 0 && comp.current_price != null
              ? ((comp.current_price - currentPrice) / currentPrice) * 100
              : null;

          return (
            <Link
              key={comp.id}
              href={`/lot/${comp.id}`}
              style={{ textDecoration: "none", display: "block" }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 140px 90px 110px 70px",
                  alignItems: "center",
                  gap: "0",
                  padding: "12px 16px",
                  borderTop: i > 0 ? "1px solid var(--border)" : "none",
                  transition: "background 0.12s ease",
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLElement).style.background = "#F9FAFB")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLElement).style.background = "transparent")
                }
              >
                <div style={{ minWidth: 0, paddingRight: "12px" }}>
                  {comp.artist_name_raw && (
                    <div
                      style={{
                        fontSize: "9px",
                        fontWeight: 700,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: "rgba(198,168,90,0.8)",
                        marginBottom: "1px",
                      }}
                    >
                      {comp.artist_name_raw}
                    </div>
                  )}
                  <div
                    style={{
                      fontSize: "12px",
                      color: "var(--navy)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {comp.title}
                  </div>
                </div>

                <div style={{ fontSize: "11px", color: "var(--text-muted)", paddingRight: "12px" }}>
                  {comp.auction_house_name?.split("—")[0].trim() || "—"}
                </div>

                <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                  {formatDate(comp.auction_date)}
                </div>

                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "var(--navy)",
                    textAlign: "right",
                    paddingRight: "8px",
                  }}
                >
                  {fmt(comp.current_price)}
                </div>

                <div
                  style={{
                    fontFamily: "monospace",
                    fontSize: "11px",
                    fontWeight: 600,
                    color:
                      priceDiff != null
                        ? priceDiff > 0
                          ? SUCCESS
                          : DANGER
                        : "var(--text-muted)",
                    textAlign: "right",
                  }}
                >
                  {priceDiff != null
                    ? `${priceDiff > 0 ? "+" : ""}${Math.round(priceDiff)}%`
                    : "—"}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
