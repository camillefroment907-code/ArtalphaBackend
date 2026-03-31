"use client";

import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWishlist } from "@/lib/useWishlist";

interface WishlistButtonProps {
  lotId: string;
  className?: string;
  size?: "sm" | "md";
}

export function WishlistButton({ lotId, className, size = "sm" }: WishlistButtonProps) {
  const { isWishlisted, toggle, loading } = useWishlist();
  const active = isWishlisted(lotId);

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(lotId);
      }}
      disabled={loading}
      title={active ? "Retirer de la liste" : "Ajouter à la liste"}
      className={cn(
        "flex items-center justify-center rounded-sm transition-all duration-150",
        size === "sm" ? "w-7 h-7" : "w-9 h-9",
        active
          ? "bg-red-50 border border-red-200 text-red-500 hover:bg-red-100"
          : "bg-white/90 border border-stone-200 text-stone-400 hover:text-red-400 hover:border-red-200",
        loading && "opacity-50 cursor-wait",
        className
      )}
    >
      <Heart
        className={cn(size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4", active && "fill-current")}
      />
    </button>
  );
}
