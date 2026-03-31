"use client";

import Link from "next/link";
import { useState } from "react";
import { Heart, TrendingUp, Clock } from "lucide-react";
import { useLanguageStore, formatPriceInCurrency } from "@/lib/useLanguage";
import { useWishlist } from "@/lib/useWishlist";
import { useAuthStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import type { Lot } from "@/lib/api";

interface Props { lot: Lot; index?: number; }

function ScoreBadge({ score }: { score: number }) {
  const cfg =
    score >= 90 ? { label: "FIRE", cls: "badge-fire" } :
    score >= 80 ? { label: "HOT",  cls: "badge-hot"  } :
    score >= 70 ? { label: "DEAL", cls: "badge-deal" } :
                  { label: String(Math.round(score)), cls: "badge-watch" };
  return (
    <span className={cfg.cls} style={{
      padding: "3px 8px", borderRadius: "3px",
      fontSize: "10px", fontWeight: 800,
      letterSpacing: "0.08em", fontFamily: "'JetBrains Mono', monospace",
    }}>
      {cfg.label}
    </span>
  );
}

function getProjection(price: number, years: number) {
  return Math.round(price * Math.pow(1.08, years));
}

export function GalleryCard({ lot, index = 0 }: Props) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [hovered, setHovered] = useState(false);
  const { currency, locale } = useLanguageStore();
  const { isWishlisted, toggle } = useWishlist();
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();

  const inWishlist = isWishlisted(lot.id);
  const fmt = (v?: number | null) => v != null ? formatPriceInCurrency(v, currency, locale) : null;

  const price = lot.current_price || lot.estimate_low;
  const estimate = lot.estimate_low;
  const showEstimate = estimate && price && Math.abs(price - estimate) > 50;
  const pctBelow = lot.pct_below_low_estimate;
  const artist = lot.artist_name_raw?.trim() || "";

  const proj10y = price ? getProjection(price, 10) : null;
  const projMultiple = price && proj10y ? (proj10y / price).toFixed(1) : null;

  const timeLeft = lot.time_left_hours;
  const isUrgent = timeLeft != null && timeLeft < 24;

  const handleWishlist = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!isAuthenticated) { router.push("/auth/login"); return; }
    await toggle(lot.id);
  };

  return (
    <div
      className="artwork-card"
      style={{
        opacity: 0,
        animation: `fadeInUp 0.5s ease ${Math.min(index * 0.05, 0.8)}s forwards`,
      }}
    >
      <Link href={`/lot/${lot.id}`} style={{ textDecoration: "none", display: "block" }}>

        {/* IMAGE */}
        <div style={{ position: "relative", paddingTop: "75%", background: "var(--slate)", overflow: "hidden" }}>

          {!imgLoaded && !imgError && (
            <div style={{
              position: "absolute", inset: 0,
              background: "linear-gradient(90deg, var(--slate) 25%, var(--graphite) 50%, var(--slate) 75%)",
              backgroundSize: "200% 100%",
              animation: "gold-shimmer 1.5s infinite",
            }} />
          )}

          {lot.image_url && !imgError ? (
            <img
              src={lot.image_url}
              alt={lot.title || ""}
              className="artwork-image"
              style={{ position: "absolute", inset: 0, opacity: imgLoaded ? 1 : 0, transition: "opacity 0.4s ease" }}
              loading="lazy"
              decoding="async"
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
            />
          ) : (
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: "8px",
            }}>
              <span style={{ fontFamily: "serif", fontSize: "36px", color: "var(--border-light)", opacity: 0.5 }}>◇</span>
              {artist && <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{artist}</span>}
            </div>
          )}

          {/* Gradients */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "80px", background: "linear-gradient(to bottom, rgba(8,8,9,0.7) 0%, transparent 100%)", pointerEvents: "none", zIndex: 1 }} />
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "140px", background: "linear-gradient(to top, rgba(8,8,9,0.97) 0%, rgba(8,8,9,0.6) 50%, transparent 100%)", pointerEvents: "none", zIndex: 1 }} />

          {/* Top-left badges */}
          <div style={{ position: "absolute", top: "10px", left: "10px", zIndex: 2, display: "flex", flexDirection: "column", gap: "5px" }}>
            {lot.deal_score != null && lot.is_deal && <ScoreBadge score={lot.deal_score} />}
            {isUrgent && (
              <div style={{ display: "flex", alignItems: "center", gap: "4px", padding: "3px 7px", borderRadius: "3px", background: timeLeft != null && timeLeft < 2 ? "rgba(239,68,68,0.9)" : "rgba(0,0,0,0.7)", border: "1px solid rgba(239,68,68,0.5)" }}>
                <Clock size={9} style={{ color: "#ef4444" }} />
                <span style={{ fontSize: "10px", fontWeight: 700, color: timeLeft != null && timeLeft < 2 ? "white" : "#ef4444", fontFamily: "monospace" }}>
                  {timeLeft != null && timeLeft < 1 ? `${Math.round(timeLeft * 60)}min` : `${Math.round(timeLeft ?? 0)}h`}
                </span>
              </div>
            )}
          </div>

          {/* Top-right: wishlist */}
          <button
            onClick={handleWishlist}
            style={{
              position: "absolute", top: "10px", right: "10px", zIndex: 3,
              width: "32px", height: "32px", borderRadius: "50%",
              background: inWishlist ? "rgba(239,68,68,0.9)" : "rgba(0,0,0,0.55)",
              border: inWishlist ? "1px solid rgba(239,68,68,0.6)" : "1px solid rgba(255,255,255,0.15)",
              backdropFilter: "blur(6px)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", transition: "all 0.15s ease",
            }}
          >
            <Heart
              size={13}
              style={{ color: inWishlist ? "white" : "rgba(255,255,255,0.8)" }}
              fill={inWishlist ? "white" : "none"}
            />
          </button>

          {/* Hover overlay: projection */}
          <div className="artwork-overlay" style={{ position: "absolute", inset: 0, zIndex: 2, background: "rgba(8,8,9,0.6)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {projMultiple && (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "11px", color: "var(--gold)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "6px" }}>10-year projection</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "28px", fontWeight: 700, color: "white" }}>×{projMultiple}</div>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>{fmt(proj10y)} est.</div>
              </div>
            )}
          </div>

          {/* Bottom info */}
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "14px", zIndex: 3 }}>
            {artist && (
              <div style={{ fontSize: "10px", fontWeight: 800, color: "var(--gold)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "4px", textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>
                {artist}
              </div>
            )}
            <div style={{
              fontSize: "13px", fontWeight: 500, color: "white", lineHeight: 1.3, marginBottom: "10px",
              textShadow: "0 1px 6px rgba(0,0,0,0.9)",
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
              fontFamily: "'Playfair Display', serif",
            }}>
              {lot.title}
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
              <div>
                {price && price > 0 ? (
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "17px", fontWeight: 700, color: "white", textShadow: "0 1px 4px rgba(0,0,0,0.8)", lineHeight: 1 }}>
                    {fmt(price)}
                  </div>
                ) : (
                  <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>Prix sur demande</div>
                )}
                {showEstimate && (
                  <div style={{ fontFamily: "monospace", fontSize: "10px", color: "rgba(255,255,255,0.4)", marginTop: "2px" }}>
                    est. {fmt(estimate)}
                  </div>
                )}
              </div>
              {pctBelow != null && pctBelow > 5 && (
                <div style={{ display: "flex", alignItems: "center", gap: "3px", padding: "4px 8px", borderRadius: "3px", background: "rgba(34,197,94,0.18)", border: "1px solid rgba(34,197,94,0.35)" }}>
                  <TrendingUp size={9} style={{ color: "var(--green)" }} />
                  <span style={{ fontSize: "11px", fontWeight: 800, color: "var(--green)", fontFamily: "monospace" }}>-{pctBelow.toFixed(0)}%</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid var(--border)", background: "var(--carbon)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
            <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "var(--gold)", flexShrink: 0, opacity: 0.7 }} />
            <span style={{ fontSize: "11px", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "130px" }}>
              {lot.auction_house_name?.split("—")[0].trim() || String(lot.source || "")}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
            {lot.category && (
              <span style={{ fontSize: "10px", color: "var(--text-muted)", background: "var(--slate)", padding: "2px 7px", borderRadius: "3px", border: "1px solid var(--border)" }}>
                {lot.category}
              </span>
            )}
            {lot.auction_date && (
              <span style={{ fontFamily: "monospace", fontSize: "10px", color: "var(--text-muted)" }}>
                {new Date(lot.auction_date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
              </span>
            )}
          </div>
        </div>

      </Link>
    </div>
  );
}
