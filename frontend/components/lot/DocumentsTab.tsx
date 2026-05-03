"use client";

import { ExternalLink, FileText, Globe } from "lucide-react";
import type { Lot } from "@/lib/api";

interface DocumentsTabProps {
  lot: Lot;
}

export function DocumentsTab({ lot }: DocumentsTabProps) {
  const houseShort = lot.auction_house_name?.split("—")[0].trim() || "auction house";

  const links = [
    lot.url
      ? {
          icon: <ExternalLink size={16} />,
          title: `View on ${houseShort}`,
          description: "Full lot details, condition report, and bidding",
          href: lot.url,
        }
      : null,
    lot.url
      ? {
          icon: <FileText size={16} />,
          title: "Auction catalogue",
          description: `PDF catalogue available on ${houseShort} website`,
          href: lot.url,
        }
      : null,
    lot.artist?.wikipedia_url
      ? {
          icon: <Globe size={16} />,
          title: `${lot.artist_name_raw ?? "Artist"} — Wikipedia`,
          description: "Biography and career overview",
          href: lot.artist.wikipedia_url,
        }
      : null,
  ].filter((l): l is NonNullable<typeof l> => l !== null);

  if (links.length === 0) {
    return (
      <div
        style={{
          background: "var(--white)",
          border: "1px solid var(--border)",
          borderRadius: "6px",
          padding: "64px 40px",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <div
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "6px",
            background: "#F9FAFB",
            border: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <FileText size={20} style={{ color: "#D1D5DB" }} />
        </div>
        <div>
          <div
            style={{
              fontSize: "14px",
              fontFamily: "'Playfair Display', serif",
              color: "var(--navy)",
              opacity: 0.6,
              marginBottom: "4px",
            }}
          >
            No documents available
          </div>
          <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            No catalogue link is available for this lot.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {links.map((link, i) => (
        <a
          key={i}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: "none" }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLElement).style.borderColor = "rgba(198,168,90,0.4)")
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLElement).style.borderColor = "var(--border)")
          }
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              padding: "16px 20px",
              background: "var(--white)",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              transition: "border-color 0.15s ease",
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "4px",
                background: "rgba(198,168,90,0.08)",
                border: "1px solid rgba(198,168,90,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                color: "var(--gold)",
              }}
            >
              {link.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--navy)" }}>
                {link.title}
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                {link.description}
              </div>
            </div>
            <ExternalLink size={13} style={{ color: "#D1D5DB", flexShrink: 0 }} />
          </div>
        </a>
      ))}

      <p
        style={{
          fontSize: "11px",
          color: "var(--text-muted)",
          textAlign: "center",
          marginTop: "8px",
        }}
      >
        Documents are hosted on the auction house's secure website.
      </p>
    </div>
  );
}
