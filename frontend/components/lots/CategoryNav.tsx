"use client";

import { cn } from "@/lib/utils";

const BALTHUS_CATEGORIES = [
  { label: "Tout", value: undefined, icon: "◈" },
  { label: "Peintures", value: "Peintures", icon: "🖼" },
  { label: "Sculptures", value: "Sculptures", icon: "🗿" },
  { label: "Art Contemporain", value: "Art Contemporain", icon: "✦" },
  { label: "Photographie", value: "Photographie", icon: "📷" },
  { label: "Estampes & Multiples", value: "Estampes & Multiples", icon: "◻" },
  { label: "Dessins", value: "Dessins", icon: "✏" },
  { label: "Art Asiatique", value: "Art Asiatique", icon: "☯" },
  { label: "Bijoux & Montres", value: "Bijoux & Montres", icon: "◆" },
  { label: "Mobilier", value: "Mobilier", icon: "🪑" },
  { label: "Livres & Manuscrits", value: "Livres & Manuscrits", icon: "📜" },
  { label: "Céramiques & Porcelaines", value: "Céramiques & Porcelaines", icon: "🏺" },
  { label: "Art Ancien", value: "Art Ancien", icon: "⌛" },
];

export function CategoryNav({
  selected,
  onSelect,
}: {
  selected?: string;
  onSelect: (c?: string) => void;
}) {
  return (
    <div className="flex gap-1.5 px-8 py-3 overflow-x-auto border-b border-stone-100 bg-white [&::-webkit-scrollbar]:hidden">
      {BALTHUS_CATEGORIES.map((cat) => {
        const isActive = cat.value === undefined ? !selected : selected === cat.value;
        return (
          <button
            key={cat.label}
            onClick={() => onSelect(cat.value)}
            className={cn(
              "flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150",
              isActive
                ? "bg-stone-900 text-white"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            )}
          >
            <span className="text-sm leading-none">{cat.icon}</span>
            {cat.label}
          </button>
        );
      })}
    </div>
  );
}
