"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { ArrowLeft, Gift, Globe, History, Inbox, Minus, MoreHorizontal, Plus, RotateCcw, RotateCw, Share2, Shovel, Sprout, Volume2, VolumeX } from "lucide-react";
import { cn, glassSurface } from "@/lib/utils";

// The garden's controls, made to be obvious: one labeled switch between your
// garden and the world, the one or two things you'd do next as visible
// buttons, and everything else in a labeled "More" menu.

const press = "transition-transform duration-150 ease-out active:scale-[0.97]";

// Garden | World, always visible.
export const ModeSwitch = ({ mode, onChange }: { mode: "garden" | "world"; onChange: (mode: "garden" | "world") => void }) => (
  <div role="tablist" aria-label="View" className={cn("relative grid grid-cols-2 rounded-full p-1", glassSurface)}>
    {/* The active pill slides between the two options. */}
    <span
      aria-hidden="true"
      className="absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-primary shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
      style={{ transform: mode === "world" ? "translateX(100%)" : "translateX(0)" }}
    />
    {(["garden", "world"] as const).map((option) => {
      const active = mode === option;
      const Icon = option === "garden" ? Sprout : Globe;
      return (
        <button
          key={option}
          type="button"
          role="tab"
          aria-selected={active}
          onClick={() => onChange(option)}
          className={cn(
            "relative z-10 flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            press,
            active ? "text-primary-foreground" : "text-foreground/75",
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
          {option === "garden" ? "Garden" : "World"}
        </button>
      );
    })}
  </div>
);

export const PillButton = ({ onClick, children, primary, label }: { onClick: () => void; children: ReactNode; primary?: boolean; label?: string }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    className={cn(
      "flex h-12 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-4 text-sm font-medium whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
      press,
      primary ? "bg-primary text-primary-foreground shadow-md" : glassSurface,
    )}
  >
    {children}
  </button>
);

type MenuItem = { label: string; icon: typeof Sprout; onClick: () => void; badge?: number; disabled?: boolean; keepOpen?: boolean };

// "More": a labeled menu that grows out of its button.
export const MoreMenu = ({
  open,
  onOpenChange,
  items,
  turn,
  zoom,
  badge,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: MenuItem[];
  turn: { left: () => void; right: () => void };
  zoom?: { in: () => void; out: () => void; canIn: boolean; canOut: boolean };
  badge: boolean;
}) => {
  const menu = useRef<HTMLDivElement>(null);
  // Close on a tap outside or Escape.
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!menu.current?.parentElement?.contains(event.target as Node)) onOpenChange(false);
    };
    const escape = (event: KeyboardEvent) => event.key === "Escape" && onOpenChange(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open, onOpenChange]);

  return (
    <div className="relative">
      <div
        ref={menu}
        id="garden-more"
        role="menu"
        aria-label="More options"
        aria-hidden={!open}
        // Hidden but still in the layout for its exit animation: keep it out of reach.
        inert={!open}
        data-open={open}
        className={cn(
          "absolute right-0 bottom-[calc(100%+0.5rem)] w-60 origin-bottom-right rounded-3xl p-1.5",
          // Enters with a strong ease-out; leaves faster than it came.
          "transition-[transform,opacity] duration-150 ease-out data-[open=true]:duration-200 data-[open=true]:ease-[cubic-bezier(0.23,1,0.32,1)]",
          "data-[open=false]:pointer-events-none data-[open=false]:scale-95 data-[open=false]:opacity-0 motion-reduce:transition-opacity",
          glassSurface,
        )}
      >
        {items.map(({ label, icon: Icon, onClick, badge: count, disabled, keepOpen }) => (
          <button
            key={label}
            type="button"
            role="menuitem"
            disabled={disabled}
            tabIndex={open ? 0 : -1}
            onClick={() => {
              onClick();
              if (!keepOpen) onOpenChange(false);
            }}
            className={cn(
              "flex h-11 w-full cursor-pointer items-center gap-3 rounded-2xl px-3 text-left text-sm font-medium hover:bg-foreground/5 focus-visible:bg-foreground/5 focus-visible:outline-none disabled:cursor-default disabled:opacity-50",
              press,
            )}
          >
            <Icon className="size-[18px] text-foreground/70" aria-hidden="true" />
            <span className="flex-1">{label}</span>
            {count ? <span className="rounded-full bg-rose-500 px-1.5 text-[11px] font-semibold leading-5 text-white">{count}</span> : null}
          </button>
        ))}
        <div className="mt-1 flex items-center justify-between gap-2 border-t border-border/60 px-2 pt-1.5 pb-0.5">
          <span className="pl-1 text-xs text-muted-foreground">{zoom ? "Turn · zoom" : "Turn"}</span>
          <div className="flex gap-1">
            <SmallButton label="Turn left (Q)" onClick={turn.left} tabIndex={open ? 0 : -1}><RotateCcw className="size-4" /></SmallButton>
            <SmallButton label="Turn right (E)" onClick={turn.right} tabIndex={open ? 0 : -1}><RotateCw className="size-4" /></SmallButton>
            {zoom ? (
              <>
                <SmallButton label="Zoom out (−)" onClick={zoom.out} disabled={!zoom.canOut} tabIndex={open ? 0 : -1}><Minus className="size-4" /></SmallButton>
                <SmallButton label="Zoom in (+)" onClick={zoom.in} disabled={!zoom.canIn} tabIndex={open ? 0 : -1}><Plus className="size-4" /></SmallButton>
              </>
            ) : null}
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-label="More"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="garden-more"
        className={cn(
          "relative flex size-12 cursor-pointer items-center justify-center rounded-full text-foreground/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          press,
          glassSurface,
        )}
      >
        <MoreHorizontal className="size-5" aria-hidden="true" />
        {badge && !open ? <span className="absolute top-1 right-1 size-3 rounded-full bg-rose-500 ring-2 ring-card" aria-label="New gifts" /> : null}
      </button>
    </div>
  );
};

const SmallButton = ({ label, onClick, disabled, tabIndex, children }: { label: string; onClick: () => void; disabled?: boolean; tabIndex: number; children: ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    title={label}
    tabIndex={tabIndex}
    className={cn("flex size-9 cursor-pointer items-center justify-center rounded-full text-foreground/75 hover:bg-foreground/5 disabled:cursor-default disabled:opacity-40", press)}
  >
    {children}
  </button>
);

export const menuIcons = { Shovel, Inbox, Share2, History, Volume2, VolumeX, Gift, ArrowLeft };
