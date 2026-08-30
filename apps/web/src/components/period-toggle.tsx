"use client";

import { cn } from "@/lib/utils";

export type PeriodView = "month" | "year";

export function PeriodToggle({ value, onChange }: { value: PeriodView; onChange: (value: PeriodView) => void }) {
  return (
    <div role="group" aria-label="View period" className="inline-flex rounded-full border border-border/80 bg-muted/70 p-1">
      {(["month", "year"] as const).map((period) => {
        const active = value === period;
        return (
          <button
            key={period}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(period)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {period === "month" ? "Monthly" : "Yearly"}
          </button>
        );
      })}
    </div>
  );
}
