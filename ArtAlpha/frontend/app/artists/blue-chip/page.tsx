"use client";

import useSWR from "swr";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { GalleryCard } from "@/components/lots/GalleryCard";
import { lotsApi, type Lot } from "@/lib/api";
import { Star } from "lucide-react";

const BLUE_CHIP = [
  "pablo picasso", "andy warhol", "jean-michel basquiat", "marc chagall",
  "joan miró", "fernand léger", "bernard buffet", "yves klein",
  "pierre soulages", "zao wou-ki", "alexander calder", "niki de saint phalle",
  "damien hirst", "david hockney", "gerhard richter", "jeff koons",
];

export default function BlueChipPage() {
  const { data, isLoading } = useSWR(
    "bluechip-lots",
    () => lotsApi.list({ page: 1, page_size: 100, sort_by: "deal_score", sort_dir: "desc" }).then(r => r.data)
  );

  const lots = (data?.items || []).filter((l: Lot) =>
    BLUE_CHIP.some(a => (l.artist_name_raw || "").toLowerCase().includes(a))
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#0a0a0b" }}>
      <Sidebar />
      <div style={{ flex: 1, minWidth: 0, marginLeft: "52px", backgroundColor: "#0a0a0b" }}>
        <TopBar title="Blue Chip" subtitle="Established artists — proven market value" />
        <main style={{ padding: "20px" }}>
          {isLoading ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "16px" }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} style={{ height: "320px", background: "#111113", borderRadius: "4px", border: "1px solid #27272a", animation: "pulse 1.5s ease-in-out infinite" }} />
              ))}
            </div>
          ) : lots.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px" }}>
              <Star size={40} style={{ color: "#27272a", margin: "0 auto 16px" }} />
              <div style={{ color: "#52525b", fontSize: "14px" }}>No blue chip lots currently available</div>
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
