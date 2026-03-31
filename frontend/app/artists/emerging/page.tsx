"use client";

import useSWR from "swr";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { GalleryCard } from "@/components/lots/GalleryCard";
import { lotsApi, type Lot } from "@/lib/api";
import { TrendingUp } from "lucide-react";

const BLUE_CHIP_NAMES = [
  "pablo picasso", "andy warhol", "jean-michel basquiat", "marc chagall",
  "joan miró", "fernand léger", "bernard buffet", "yves klein",
  "pierre soulages", "zao wou-ki", "alexander calder", "niki de saint phalle",
  "damien hirst", "david hockney", "gerhard richter", "jeff koons",
];

export default function EmergingPage() {
  const { data, isLoading } = useSWR(
    "emerging-lots",
    () => lotsApi.list({ page: 1, page_size: 100, sort_by: "deal_score", sort_dir: "desc" }).then(r => r.data)
  );

  const lots = (data?.items || []).filter((l: Lot) => {
    const name = (l.artist_name_raw || "").toLowerCase();
    return name.length > 0 && !BLUE_CHIP_NAMES.some(a => name.includes(a));
  });

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#0a0a0b" }}>
      <Sidebar />
      <div style={{ flex: 1, minWidth: 0, marginLeft: "52px", backgroundColor: "#0a0a0b" }}>
        <TopBar title="Emerging Artists" subtitle="Rising market — early opportunity" />
        <main style={{ padding: "20px" }}>
          {isLoading ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "16px" }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} style={{ height: "320px", background: "#111113", borderRadius: "4px", border: "1px solid #27272a", animation: "pulse 1.5s ease-in-out infinite" }} />
              ))}
            </div>
          ) : lots.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px" }}>
              <TrendingUp size={40} style={{ color: "#27272a", margin: "0 auto 16px" }} />
              <div style={{ color: "#52525b", fontSize: "14px" }}>No emerging artist lots found</div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "16px" }}>
              {lots.map((lot: Lot, i: number) => <GalleryCard key={lot.id} lot={lot} index={i} />)}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
