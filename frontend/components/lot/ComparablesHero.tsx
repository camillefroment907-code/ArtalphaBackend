"use client";

import useSWR from "swr";
import { TrendingUp, TrendingDown } from "lucide-react";
import { lotsApi } from "@/lib/api";
import { formatPriceInCurrency } from "@/lib/useLanguage";

// ── Design tokens ─────────────────────────────────────────────────────────────
const NAVY    = "#1A2A44";
const GOLD    = "#C6A85A";
const SUCCESS = "#16A34A";
const DANGER  = "#DC2626";
const BORDER  = "#E5E7EB";
const CREAM   = "var(--cream)";

// ── Types ─────────────────────────────────────────────────────────────────────
interface ComparableItem {
  id?: string;
  title?: string;
  artwork_title?: string;
  image_url?: string;
  current_price?: number;
  hammer_price?: number;
  auction_house_name?: string;
  auction_house?: string;
  auction_date?: string;
  days_since_sale?: number;
  premium_ratio?: number;   // realized / estimate — from backend
  is_historical?: boolean;
  url?: string;
  artist_name_raw?: string;
}

interface ComparablesHeroProps {
  lotId: string;
  currentLotPrice?: number | null;
  currency?: string;
  locale?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDaysAgo(days: number | undefined | null): string | null {
  if (days == null) return null;
  if (days === 0) return "Today";
  if (days === 1) return "1d ago";
  if (days < 60)  return `${days}d ago`;
  if (days < 365) return `${Math.round(days / 30)}mo ago`;
  const y = Math.round(days / 365 * 10) / 10;
  return `${y}yr ago`;
}

function extractComparables(rawData: unknown): ComparableItem[] {
  if (!rawData) return [];
  if (Array.isArray(rawData)) return rawData as ComparableItem[];
  const obj = rawData as Record<string, unknown>;
  if (Array.isArray(obj.comparables)) return obj.comparables as ComparableItem[];
  return [];
}

// ── Main component ────────────────────────────────────────────────────────────
export function ComparablesHero({
  lotId,
  currentLotPrice,
  currency = "EUR",
  locale = "en-GB",
}: ComparablesHeroProps) {
  const fmt = (v?: number | null) =>
    v != null ? formatPriceInCurrency(v, currency, locale) : "—";

  const { data: rawData, isLoading } = useSWR(
    `comparables-${lotId}`,
    () => lotsApi.comparables(lotId).then(r => r.data),
    { revalidateOnFocus: false }
  );

  const all = extractComparables(rawData);

  // Take up to 3, prefer records with images
  const withImages    = all.filter(c => c.image_url);
  const withoutImages = all.filter(c => !c.image_url);
  const cards = [...withImages, ...withoutImages].slice(0, 3);

  if (isLoading) return <HeroSkeleton />;
  if (cards.length === 0) return null;

  const colStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns:
      cards.length === 1 ? "minmax(0,360px)"
      : cards.length === 2 ? "repeat(2, 1fr)"
      : "repeat(3, 1fr)",
    gap: "16px",
  };

  return (
    <div style={{ padding: "16px 32px 0", background: "var(--white)", borderBottom: `1px solid ${BORDER}` }}>
      {/* Section header */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "14px" }}>
        <div style={{
          fontSize: "9px", fontWeight: 700, letterSpacing: "0.18em",
          textTransform: "uppercase", color: "var(--text-muted)",
        }}>
          Recent comparable sales
        </div>
        <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
          {cards.length} similar work{cards.length !== 1 ? "s" : ""} sold
        </div>
      </div>

      {/* Cards grid */}
      <div style={colStyle}>
        {cards.map((comp, i) => (
          <CompCard
            key={comp.id || i}
            comp={comp}
            currentLotPrice={currentLotPrice}
            fmt={fmt}
          />
        ))}
      </div>

      {/* Bottom padding row */}
      <div style={{ height: "16px" }} />
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────
function CompCard({
  comp,
  currentLotPrice,
  fmt,
}: {
  comp: ComparableItem;
  currentLotPrice?: number | null;
  fmt: (v?: number | null) => string;
}) {
  const title   = comp.title || comp.artwork_title || "Untitled";
  const price   = comp.current_price ?? comp.hammer_price;
  const house   = comp.auction_house_name || comp.auction_house || "";
  const daysAgo = formatDaysAgo(comp.days_since_sale);

  // vs-current delta (how much more/less this comp sold vs the active lot)
  const delta =
    price != null && currentLotPrice != null && currentLotPrice > 0
      ? ((price - currentLotPrice) / currentLotPrice) * 100
      : null;

  // premium_ratio from backend: realized / estimate. > 1 = sold above est.
  const premStr =
    comp.premium_ratio != null && comp.premium_ratio > 0
      ? `${Math.round(comp.premium_ratio * 100)}% of est.`
      : null;

  const card = (
    <div
      style={{
        background: "var(--white)",
        border: `1px solid ${BORDER}`,
        borderRadius: "8px",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        transition: "box-shadow 0.15s ease",
        cursor: comp.url ? "pointer" : "default",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.boxShadow = "none";
      }}
    >
      {/* Image */}
      <div style={{
        position: "relative",
        width: "100%",
        paddingTop: "75%", // 4:3 aspect ratio
        background: CREAM,
        overflow: "hidden",
        flexShrink: 0,
      }}>
        {comp.image_url ? (
          <img
            src={comp.image_url}
            alt={title}
            style={{
              position: "absolute", inset: 0,
              width: "100%", height: "100%",
              objectFit: "cover",
            }}
            loading="lazy"
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>No image</div>
          </div>
        )}

        {/* Days-ago badge — top left */}
        {daysAgo && (
          <div style={{
            position: "absolute", top: "8px", left: "8px",
            background: "rgba(255,255,255,0.94)",
            backdropFilter: "blur(6px)",
            padding: "3px 7px", borderRadius: "4px",
            fontSize: "10px", fontWeight: 600,
            color: "var(--text-muted)",
          }}>
            {daysAgo}
          </div>
        )}

        {/* Delta vs current lot — top right */}
        {delta != null && Math.abs(delta) >= 5 && (
          <div style={{
            position: "absolute", top: "8px", right: "8px",
            background: delta > 0 ? "rgba(22,163,74,0.92)" : "rgba(220,38,38,0.92)",
            padding: "3px 7px", borderRadius: "4px",
            fontSize: "10px", fontWeight: 700,
            color: "white",
            display: "flex", alignItems: "center", gap: "3px",
          }}>
            {delta > 0 ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
            {delta > 0 ? "+" : ""}{Math.round(delta)}%
          </div>
        )}
      </div>

      {/* Card body */}
      <div style={{ padding: "12px 14px 14px", display: "flex", flexDirection: "column", gap: "6px" }}>
        {/* Artist (small gold cap) */}
        {comp.artist_name_raw && (
          <div style={{
            fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em",
            textTransform: "uppercase", color: GOLD,
          }}>
            {comp.artist_name_raw}
          </div>
        )}

        {/* Title */}
        <div style={{
          fontSize: "12px", fontWeight: 600, color: NAVY,
          lineHeight: 1.35,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical" as const,
          overflow: "hidden",
        }}>
          {title}
        </div>

        {/* Price row */}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "8px" }}>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "14px", fontWeight: 700, color: NAVY,
          }}>
            {fmt(price)}
          </div>
          {premStr && (
            <div style={{
              fontSize: "10px", fontWeight: 600,
              color: comp.premium_ratio && comp.premium_ratio > 1 ? SUCCESS : "var(--text-muted)",
            }}>
              {premStr}
            </div>
          )}
        </div>

        {/* Auction house + date */}
        {(house || comp.auction_date) && (
          <div style={{
            fontSize: "10px", color: "var(--text-muted)",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {house}
            {house && comp.auction_date && " · "}
            {comp.auction_date && new Date(comp.auction_date).toLocaleDateString("en-GB", {
              month: "short", year: "numeric",
            })}
          </div>
        )}
      </div>
    </div>
  );

  if (comp.url) {
    return (
      <a
        href={comp.url}
        target="_blank"
        rel="noopener noreferrer"
        style={{ textDecoration: "none", display: "block" }}
      >
        {card}
      </a>
    );
  }

  return card;
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function HeroSkeleton() {
  return (
    <div style={{ padding: "16px 32px 0", background: "var(--white)", borderBottom: `1px solid ${BORDER}` }}>
      <div style={{
        height: "12px", width: "160px", borderRadius: "4px",
        background: "var(--cream)", marginBottom: "14px",
      }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
        {[0, 1, 2].map(i => (
          <div
            key={i}
            style={{ borderRadius: "8px", overflow: "hidden", border: `1px solid ${BORDER}` }}
          >
            <div style={{
              width: "100%", paddingTop: "75%",
              background: "var(--cream)",
              animation: "pulse 1.5s ease-in-out infinite",
            }} />
            <div style={{ padding: "12px 14px 14px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ height: "11px", width: "80%", borderRadius: "3px", background: "var(--cream)" }} />
              <div style={{ height: "11px", width: "60%", borderRadius: "3px", background: "var(--cream)" }} />
              <div style={{ height: "16px", width: "40%", borderRadius: "3px", background: "var(--cream)" }} />
            </div>
          </div>
        ))}
      </div>
      <div style={{ height: "16px" }} />
    </div>
  );
}
