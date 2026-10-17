"use client";

import { Armchair, Bird, Check, Flower, Footprints, Lamp, Lock, RotateCw, Trash2, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
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

// One short line about what a tap will do next.
const hint = (held: EditorHeld) =>
  !held
    ? "Tap a flower to move it, or pick something to place"
    : held.type === "plant"
      ? "Now tap an empty spot"
      : held.type === "new"
        ? `Tap an empty spot for the ${decorationInfo[held.kind].label.toLowerCase()}`
        : "Tap an empty spot to move it";

const press = "transition-transform duration-150 ease-out active:scale-[0.95]";

const RoundButton = ({
  label,
  onClick,
  active,
  dim,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  dim?: boolean;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    aria-pressed={active}
    title={label}
    className={cn(
      "relative flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
      press,
      active ? "bg-primary text-primary-foreground" : "text-foreground/80 hover:bg-foreground/5",
      dim && "text-foreground/35",
    )}
  >
    {children}
  </button>
);

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
  <>
    <p
      role="status"
      className={cn(
        "pointer-events-none absolute top-[calc(max(0.5rem,env(safe-area-inset-top))+5.5rem)] left-1/2 z-[2100] -translate-x-1/2 rounded-full px-4 py-2 text-xs font-medium whitespace-nowrap text-foreground/80",
        glassSurface,
      )}
    >
      {hint(held)}
    </p>
    <section
      data-world-control
      aria-label="Arrange your garden"
      className={cn(
        "absolute bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+5.75rem)] left-1/2 z-[2100] flex -translate-x-1/2 items-center gap-1 rounded-full p-1.5 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-200 sm:bottom-6",
        glassSurface,
      )}
    >
      {held?.type === "decoration" ? (
        <>
          <RoundButton label="Turn" onClick={onTurn}>
            <RotateCw className="size-5" aria-hidden="true" />
          </RoundButton>
          <RoundButton label="Remove" onClick={onRemove}>
            <Trash2 className="size-5 text-destructive" aria-hidden="true" />
          </RoundButton>
        </>
      ) : (
        decorationKinds.map((kind) => {
          const { label, icon: Icon } = decorationInfo[kind];
          const needed = decorationUnlocks[kind];
          const locked = longestStreak < needed;
          return (
            <RoundButton
              key={kind}
              label={locked ? `${label} (unlocks with a ${needed}-day streak)` : label}
              active={held?.type === "new" && held.kind === kind}
              dim={locked}
              onClick={() => (locked ? toast(`${label} unlocks with a ${needed}-day streak`) : onPick(kind))}
            >
              <Icon className="size-5" aria-hidden="true" />
              {locked ? (
                <span className="absolute -right-0.5 -bottom-0.5 flex size-4 items-center justify-center rounded-full bg-card text-foreground/60 shadow-sm">
                  <Lock className="size-2.5" aria-hidden="true" />
                </span>
              ) : null}
            </RoundButton>
          );
        })
      )}
      <span aria-hidden="true" className="mx-1 h-6 w-px bg-border" />
      <button
        type="button"
        onClick={onDone}
        className={cn("flex h-11 shrink-0 cursor-pointer items-center gap-1 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground", press)}
      >
        <Check className="size-4" aria-hidden="true" /> Done
      </button>
    </section>
  </>
);
