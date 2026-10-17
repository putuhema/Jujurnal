"use client";

import { Armchair, Check, Footprints, Lamp, Lock, RotateCw, Trash2, Bird, Flower, type LucideIcon } from "lucide-react";
import { decorationKinds, decorationUnlocks, type DecorationKind } from "@puma-brain/backend/convex/gardenItems";
import { cn, glassSurface } from "@/lib/utils";

export const decorationInfo: Record<DecorationKind, { label: string; icon: LucideIcon }> = {
  stones: { label: "Stepping stones", icon: Footprints },
  bench: { label: "Bench", icon: Armchair },
  lantern: { label: "Lantern", icon: Lamp },
  birdbath: { label: "Birdbath", icon: Bird },
  arch: { label: "Rose arch", icon: Flower },
};

export type EditorHeld =
  | { type: "plant"; postId: string }
  | { type: "new"; kind: DecorationKind }
  | { type: "decoration"; id: string }
  | null;

// What you're doing right now, in a sentence.
const hint = (held: EditorHeld) =>
  !held
    ? "Tap a flower or decoration to pick it up, or choose something to place."
    : held.type === "plant"
      ? "Tap an empty spot to move this flower there."
      : held.type === "new"
        ? `Tap an empty spot to place the ${decorationInfo[held.kind].label.toLowerCase()}.`
        : "Tap an empty spot to move it, or turn or remove it.";

export const GardenEditor = ({
  held,
  longestStreak,
  onPick,
  onTurn,
  onRemove,
  onDone,
}: {
  held: EditorHeld;
  longestStreak: number;
  onPick: (kind: DecorationKind) => void;
  onTurn: () => void;
  onRemove: () => void;
  onDone: () => void;
}) => (
  <section
    data-world-control
    aria-label="Arrange your garden"
    className={cn(
      "absolute inset-x-3 bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+5.75rem)] z-[2100] rounded-3xl p-3 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-4 sm:inset-x-auto sm:bottom-6 sm:left-1/2 sm:w-[30rem] sm:-translate-x-1/2",
      glassSurface,
    )}
  >
    <div className="mb-2 flex items-center justify-between gap-3 px-1">
      <p className="text-xs text-muted-foreground" aria-live="polite">{hint(held)}</p>
      <button type="button" onClick={onDone} className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1 rounded-full bg-primary px-3.5 text-sm font-medium text-primary-foreground">
        <Check className="size-4" aria-hidden="true" /> Done
      </button>
    </div>
    {held?.type === "decoration" ? (
      <div className="flex gap-2">
        <button type="button" onClick={onTurn} className="inline-flex h-10 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-2xl bg-background/70 text-sm font-medium hover:bg-muted">
          <RotateCw className="size-4" aria-hidden="true" /> Turn
        </button>
        <button type="button" onClick={onRemove} className="inline-flex h-10 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-2xl bg-background/70 text-sm font-medium text-destructive hover:bg-muted">
          <Trash2 className="size-4" aria-hidden="true" /> Remove
        </button>
      </div>
    ) : (
      <div role="listbox" aria-label="Decorations" className="flex gap-2 overflow-x-auto pb-0.5">
        {decorationKinds.map((kind) => {
          const { label, icon: Icon } = decorationInfo[kind];
          const needed = decorationUnlocks[kind];
          const locked = longestStreak < needed;
          const active = held?.type === "new" && held.kind === kind;
          return (
            <button
              key={kind}
              type="button"
              role="option"
              aria-selected={active}
              aria-disabled={locked}
              disabled={locked}
              onClick={() => onPick(kind)}
              title={locked ? `Unlocks with a ${needed}-day streak` : label}
              className={cn(
                "flex min-w-20 shrink-0 cursor-pointer flex-col items-center gap-1 rounded-2xl border px-2 py-2 text-[11px] font-medium leading-tight transition-colors disabled:cursor-not-allowed",
                active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background/60 hover:bg-muted",
                locked && "opacity-55",
              )}
            >
              {locked ? <Lock className="size-5" aria-hidden="true" /> : <Icon className="size-5" aria-hidden="true" />}
              <span>{label}</span>
              {locked ? <span className="text-[10px] text-muted-foreground">{needed}-day streak</span> : null}
            </button>
          );
        })}
      </div>
    )}
  </section>
);
