"use client";

import { GalleryCard } from "./GalleryCard";
import type { Lot } from "@/lib/api";

interface MasonryGalleryProps {
  lots: Lot[];
  columns?: 2 | 3 | 4;
}

export function MasonryGallery({ lots, columns = 3 }: MasonryGalleryProps) {
  const colClass = {
    2: "columns-2",
    3: "columns-2 md:columns-3",
    4: "columns-2 md:columns-3 xl:columns-4",
  }[columns];

  return (
    <div className={`${colClass} gap-4`}>
      {lots.map((lot, i) => (
        <div key={lot.id} className="break-inside-avoid mb-4">
          <GalleryCard lot={lot} index={i} />
        </div>
      ))}
    </div>
  );
}
