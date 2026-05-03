"use client";

import { AlertCircle, FileSearch } from "lucide-react";
import type { Lot } from "@/lib/api";

interface ProvenanceTabProps {
  lot: Lot;
}

export function ProvenanceTab({ lot }: ProvenanceTabProps) {
  // Lot type has no provenance field — graceful fallback
  const lotAny = lot as unknown as Record<string, unknown>;
  const provenance = lotAny.provenance as string | undefined;
  const condition = lotAny.condition as string | undefined;
  const hasProvenance = provenance && provenance.trim().length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Provenance section */}
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
          Provenance
        </div>

        {hasProvenance ? (
          <div
            style={{
              fontSize: "13px",
              color: "var(--navy)",
              lineHeight: 1.75,
              whiteSpace: "pre-line",
            }}
          >
            {provenance}
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "32px 24px",
              gap: "12px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "6px",
                background: "#FEF7ED",
                border: "1px solid rgba(198,168,90,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <FileSearch size={20} style={{ color: "var(--gold)" }} />
            </div>
            <div>
              <div
                style={{
                  fontSize: "14px",
                  fontFamily: "'Playfair Display', serif",
                  color: "var(--navy)",
                  marginBottom: "4px",
                }}
              >
                No provenance information
              </div>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", maxWidth: "320px" }}>
                Provenance details are not available for this lot in our database.
                Please consult the auction house catalogue directly.
              </p>
            </div>
            {lot.url && (
              <a
                href={lot.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: "12px",
                  color: "var(--gold)",
                  textDecoration: "none",
                  fontWeight: 600,
                  marginTop: "4px",
                }}
              >
                View catalogue →
              </a>
            )}
          </div>
        )}
      </div>

      {/* Condition section (if available) */}
      {condition && (
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
              marginBottom: "12px",
            }}
          >
            Condition Report
          </div>
          <div style={{ fontSize: "13px", color: "var(--navy)", lineHeight: 1.7 }}>
            {condition}
          </div>
        </div>
      )}

      {/* Risk notice */}
      <div
        style={{
          padding: "14px 16px",
          background: "rgba(234,88,12,0.04)",
          border: "1px solid rgba(234,88,12,0.15)",
          borderRadius: "6px",
          display: "flex",
          alignItems: "flex-start",
          gap: "10px",
        }}
      >
        <AlertCircle size={14} style={{ color: "#EA580C", flexShrink: 0, marginTop: "1px" }} />
        <div>
          <div style={{ fontSize: "11px", fontWeight: 600, color: "#EA580C", marginBottom: "2px" }}>
            Due Diligence Recommended
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: 1.5 }}>
            Always verify provenance independently before bidding. Consult the auction
            house directly for complete documentation.
          </div>
        </div>
      </div>
    </div>
  );
}
