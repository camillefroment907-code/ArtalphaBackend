"use client";

import { ReactNode } from "react";
import { Radio } from "lucide-react";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";

interface TopBarProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function TopBar({ title, subtitle, actions }: TopBarProps) {
  return (
    <div style={{
      height: "52px",
      borderBottom: "1px solid #27272a",
      backgroundColor: "#0a0a0b",
      display: "flex",
      alignItems: "center",
      paddingLeft: "20px",
      paddingRight: "16px",
      gap: "16px",
      position: "sticky",
      top: 0,
      zIndex: 30,
    }}>
      {/* Title */}
      <div style={{ flex: "0 0 auto" }}>
        <div style={{ fontSize: "14px", fontWeight: 600, color: "#fafafa", fontFamily: "'Playfair Display', serif" }}>
          {title}
        </div>
        {subtitle && (
          <div style={{ fontSize: "11px", color: "#52525b", marginTop: "1px" }}>{subtitle}</div>
        )}
      </div>

      {/* Live status */}
      <div style={{ display: "flex", alignItems: "center", gap: "5px", padding: "3px 8px", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: "3px" }}>
        <Radio size={10} style={{ color: "#22c55e" }} />
        <span style={{ fontSize: "10px", color: "#22c55e", fontWeight: 600, letterSpacing: "0.08em" }}>LIVE</span>
      </div>

      <div style={{ flex: 1 }} />

      {actions && <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>{actions}</div>}

      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <LanguageSwitcher />
      </div>
    </div>
  );
}
