"use client";

import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FilterState {
  is_deal?: boolean;
  source?: string;
  category?: string;
  min_score?: number;
  max_price?: number;
  sort_by: string;
  sort_dir: string;
}

interface FilterBarProps {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  totalCount: number;
}

const SOURCES = [
  { value: "", label: "All Sources" },
  { value: "drouot", label: "Drouot" },
  { value: "interencheres", label: "Interenchères" },
  { value: "invaluable", label: "Invaluable" },
];

const CATEGORIES = [
  { value: "", label: "All Categories" },
  { value: "Paintings", label: "Paintings" },
  { value: "Prints", label: "Prints" },
  { value: "Sculptures", label: "Sculptures" },
  { value: "Drawings", label: "Drawings" },
  { value: "Bijoux", label: "Jewelry" },
  { value: "Mobilier", label: "Furniture" },
  { value: "Arts d'Asie", label: "Asian Art" },
];

const SORT_OPTIONS = [
  { value: "deal_score|desc", label: "Best Score" },
  { value: "auction_date|asc", label: "Soonest" },
  { value: "current_price|asc", label: "Lowest Price" },
  { value: "created_at|desc", label: "Newest" },
];

function SelectPill({
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  const isActive = !!value;

  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "appearance-none pl-3 pr-7 py-1.5 rounded-sm text-xs font-medium border cursor-pointer",
          "bg-white transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-amber-200",
          isActive
            ? "border-amber-300 text-amber-800 bg-amber-50"
            : "border-stone-200 text-stone-600 hover:border-stone-300"
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-stone-400 pointer-events-none" />
    </div>
  );
}

export function FilterBar({ filters, onChange, totalCount }: FilterBarProps) {
  const activeCount = [
    filters.is_deal,
    filters.source,
    filters.category,
    filters.min_score && filters.min_score > 0,
    filters.max_price,
  ].filter(Boolean).length;

  const reset = () =>
    onChange({
      sort_by: "deal_score",
      sort_dir: "desc",
    });

  const sortValue = `${filters.sort_by}|${filters.sort_dir}`;

  return (
    <div className="border-b border-stone-100 bg-white">
      <div className="flex items-center gap-3 px-8 py-3 flex-wrap">
        {/* Results count */}
        <div className="text-xs text-stone-400 font-mono mr-2">
          {totalCount.toLocaleString()} lots
        </div>

        {/* Deals only toggle */}
        <button
          onClick={() => onChange({ ...filters, is_deal: filters.is_deal ? undefined : true })}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-medium border transition-all duration-150",
            filters.is_deal
              ? "bg-emerald-50 border-emerald-300 text-emerald-700"
              : "border-stone-200 text-stone-600 hover:border-stone-300 hover:text-stone-800"
          )}
        >
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full",
              filters.is_deal ? "bg-emerald-500" : "bg-stone-300"
            )}
          />
          Deals Only
        </button>

        {/* Score filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-2xs text-stone-400">Min score</span>
          {[60, 70, 75, 80, 85].map((s) => (
            <button
              key={s}
              onClick={() => onChange({ ...filters, min_score: filters.min_score === s ? undefined : s })}
              className={cn(
                "px-2.5 py-1 rounded-sm text-xs font-mono font-medium border transition-all duration-150",
                filters.min_score === s
                  ? s >= 80
                    ? "bg-red-50 border-red-300 text-red-700"
                    : "bg-emerald-50 border-emerald-300 text-emerald-700"
                  : "border-stone-200 text-stone-500 hover:border-stone-300 hover:text-stone-700"
              )}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <SelectPill
            label="Source"
            value={filters.source || ""}
            options={SOURCES}
            onChange={(v) => onChange({ ...filters, source: v || undefined })}
          />
          <SelectPill
            label="Category"
            value={filters.category || ""}
            options={CATEGORIES}
            onChange={(v) => onChange({ ...filters, category: v || undefined })}
          />
          <SelectPill
            label="Sort"
            value={sortValue}
            options={SORT_OPTIONS}
            onChange={(v) => {
              const [by, dir] = v.split("|");
              onChange({ ...filters, sort_by: by, sort_dir: dir });
            }}
          />

          {activeCount > 0 && (
            <button
              onClick={reset}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-stone-500 hover:text-stone-800 border border-stone-200 hover:border-stone-300 rounded-sm transition-all"
            >
              <X className="w-3 h-3" />
              Clear ({activeCount})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
