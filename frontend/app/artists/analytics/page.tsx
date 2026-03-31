"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { BarChart3 } from "lucide-react";

export default function ArtistAnalyticsPage() {
  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#0a0a0b" }}>
      <Sidebar />
      <div style={{ flex: 1, minWidth: 0, marginLeft: "52px", backgroundColor: "#0a0a0b" }}>
        <TopBar title="Artist Analytics" subtitle="Trends, projections & market data" />
        <div style={{ padding: "80px 24px", textAlign: "center" }}>
          <BarChart3 size={48} style={{ color: "#27272a", margin: "0 auto 16px" }} />
          <div style={{ color: "#52525b", fontSize: "16px", marginBottom: "8px" }}>Artist Analytics</div>
          <div style={{ color: "#3f3f46", fontSize: "13px" }}>
            Market trends, price history and projections coming soon.
          </div>
        </div>
      </div>
    </div>
  );
}
