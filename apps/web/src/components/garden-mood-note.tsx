"use client";

import { Sparkles } from "lucide-react";
import { cn, glassSurface } from "@/lib/utils";

// The moment the garden has read a new journal: its weather, and the AI's
// short note to the writer. Tap to put it away.
export const GardenMoodNote = ({
  label,
  reason,
  onDismiss,
}: {
  label: string;
  reason?: string;
  onDismiss: () => void;
}) => (
  <button
    type="button"
    data-world-control
    onClick={onDismiss}
    aria-label={`The garden read your words: ${label}. ${reason ?? ""} Tap to close.`}
    className={cn(
      "absolute top-[calc(max(0.5rem,env(safe-area-inset-top))+5.5rem)] left-1/2 z-[2000] flex w-max max-w-[min(22rem,calc(100%-2rem))] -translate-x-1/2 cursor-pointer items-start gap-2.5 rounded-3xl px-4 py-3 text-left",
      "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:slide-in-from-top-2 motion-safe:duration-500",
      glassSurface,
    )}
  >
    <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
    <span className="grid gap-0.5">
      <span className="text-sm font-semibold">{label}</span>
      {reason ? <span className="text-[13px] leading-snug text-foreground/75">{reason}</span> : null}
    </span>
  </button>
);
