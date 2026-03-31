"use client";

import { Clock, AlertTriangle, Flame, Timer } from "lucide-react";
import { cn } from "@/lib/utils";

interface FomoIndicatorProps {
  timeLeftHours?: number;
  fomoLevel?: "critical" | "high" | "medium" | "low";
  compact?: boolean;
}

function formatTimeLeft(hours: number): string {
  if (hours <= 0) return "Terminé";
  if (hours < 1) return `${Math.round(hours * 60)}min`;
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = Math.floor(hours / 24);
  const rem = Math.round(hours % 24);
  return rem > 0 ? `${days}j ${rem}h` : `${days}j`;
}

export function FomoIndicator({ timeLeftHours, fomoLevel, compact = false }: FomoIndicatorProps) {
  if (timeLeftHours == null || !fomoLevel) return null;
  if (timeLeftHours <= 0) return null;

  const config = {
    critical: {
      icon: Flame,
      label: compact ? formatTimeLeft(timeLeftHours) : `Termine dans ${formatTimeLeft(timeLeftHours)}`,
      className: "bg-red-50 border-red-200 text-red-700",
      iconClass: "text-red-500 animate-pulse",
    },
    high: {
      icon: AlertTriangle,
      label: compact ? formatTimeLeft(timeLeftHours) : `${formatTimeLeft(timeLeftHours)} restants`,
      className: "bg-orange-50 border-orange-200 text-orange-700",
      iconClass: "text-orange-500",
    },
    medium: {
      icon: Timer,
      label: compact ? formatTimeLeft(timeLeftHours) : `${formatTimeLeft(timeLeftHours)} restants`,
      className: "bg-amber-50 border-amber-200 text-amber-700",
      iconClass: "text-amber-500",
    },
    low: {
      icon: Clock,
      label: compact ? formatTimeLeft(timeLeftHours) : `${formatTimeLeft(timeLeftHours)} restants`,
      className: "bg-stone-50 border-stone-200 text-stone-500",
      iconClass: "text-stone-400",
    },
  }[fomoLevel];

  const Icon = config.icon;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 border rounded-sm font-medium",
        compact ? "px-1.5 py-0.5 text-2xs" : "px-2 py-1 text-xs",
        config.className
      )}
    >
      <Icon className={cn(compact ? "w-2.5 h-2.5" : "w-3 h-3", config.iconClass)} />
      <span>{config.label}</span>
    </div>
  );
}
