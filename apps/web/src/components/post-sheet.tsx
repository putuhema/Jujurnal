"use client";

import dynamic from "next/dynamic";
import { useState, useSyncExternalStore } from "react";
import { PlantIcon, SparkleIcon } from "@phosphor-icons/react";
import { useQuery } from "convex/react";
import { api } from "@puma-brain/backend/convex/_generated/api";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { getBrowserTimeZone } from "@/lib/calendar-date";
import { cn } from "@/lib/utils";
import { buttonVariants } from "./ui/button";
import { Skeleton } from "./ui/skeleton";

// The form (and its validation libraries) loads when the sheet is first
// reached for, not with every page.
const loadForm = () => import("./post-form");
const PostForm = dynamic(() => loadForm().then((module) => module.PostForm), {
  loading: () => (
    <div aria-hidden="true" className="space-y-3 pt-1">
      <Skeleton className="h-9 w-full rounded-full" />
      <Skeleton className="h-36 w-full rounded-2xl" />
      <Skeleton className="h-9 w-full rounded-full" />
      <Skeleton className="h-24 w-full rounded-xl" />
    </div>
  ),
});

const wideQuery = "(min-width: 640px)";
const subscribeToWidth = (onChange: () => void) => {
  const query = window.matchMedia(wideQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

// Writing a journal happens in a sheet: from the bottom on phones (where the
// app is mostly used), from the side on wider screens. It closes once the
// journal is planted, so you watch the seed land in your garden.
export const PostSheet = ({
  size = "sm",
  floating = false,
  mobileNav = false,
}: {
  size?: "sm" | "lg";
  floating?: boolean;
  mobileNav?: boolean;
}) => {
  const timeZone = getBrowserTimeZone();
  const availability = useQuery(api.posts.getEntryAvailability, { timeZone });
  const [open, setOpen] = useState(false);
  const isWide = useSyncExternalStore(subscribeToWidth, () => window.matchMedia(wideQuery).matches, () => false);
  const floatingClass = floating && "fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-40 h-11 -translate-x-1/2 px-5 shadow-[0_12px_28px_oklch(0.24_0.04_70/25%)] sm:static sm:h-8 sm:translate-x-0 sm:px-3 sm:shadow-none";
  const hasNoAvailableDate =
    availability !== undefined &&
    !availability.canPostToday &&
    !availability.canPostYesterday;

  if (hasNoAvailableDate) {
    if (mobileNav) {
      return (
        <div
          className="-mt-7 flex min-w-0 flex-col items-center gap-1 text-[10px] font-medium text-primary"
          title="Today and yesterday are already planted"
        >
          <span className="flex size-13 items-center justify-center rounded-full border-[3px] border-card bg-secondary text-primary shadow-[0_7px_20px_oklch(0.2_0.03_70/18%)]">
            <PlantIcon weight="fill" className="size-5" />
          </span>
          <span>Planted</span>
        </div>
      );
    }

    return (
      <div className={cn("flex h-8 items-center gap-1.5 rounded-full border border-primary/15 bg-secondary/50 px-3 text-xs font-medium text-secondary-foreground", floatingClass)} title="Today and yesterday are already planted">
        <PlantIcon weight="fill" className="text-primary" />
        <span className="hidden sm:inline">Journals are planted</span>
        <span className="sm:hidden">Planted</span>
      </div>
    );
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        onPointerDown={() => void loadForm()}
        onFocus={() => void loadForm()}
        aria-label={mobileNav ? "Create journal" : undefined}
        className={mobileNav
          ? "group -mt-7 flex min-w-0 flex-col items-center gap-1 text-[10px] font-semibold text-primary focus-visible:outline-none"
          : buttonVariants({ variant: "default", size, className: cn("rounded-full shadow-sm", floatingClass) })}
      >
        {mobileNav ? (
          <>
            <span className="flex size-13 items-center justify-center rounded-full border-[3px] border-card bg-primary text-primary-foreground shadow-[0_8px_22px_oklch(0.3_0.07_150/32%)] transition-transform group-active:scale-95 group-focus-visible:ring-4 group-focus-visible:ring-ring/35">
              <PlantIcon weight="fill" className="size-5" />
            </span>
            <span>Create</span>
          </>
        ) : (
          <>
            {size === "lg" ? <SparkleIcon weight="fill" /> : <PlantIcon />}
            Write journal
          </>
        )}
      </SheetTrigger>
      <SheetContent
        side={isWide ? "right" : "bottom"}
        className={cn(
          "bg-card",
          isWide
            ? "w-full sm:max-w-md"
            : "max-h-[92svh] rounded-t-[1.75rem] pb-[env(safe-area-inset-bottom)]"
        )}
      >
        {!isWide ? <span aria-hidden="true" className="mx-auto mt-2.5 block h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/25" /> : null}
        <SheetHeader className={cn("pr-14", isWide ? "pt-8" : "pt-3")}>
          <SheetTitle className="font-display text-2xl tracking-[-0.035em]">Plant a journal</SheetTitle>
          <SheetDescription>There’s no right way to begin. Just be honest.</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6">
          {availability ? (
            <PostForm
              key={`${availability.today}-${availability.canPostToday}-${availability.canPostYesterday}`}
              availability={availability}
              onPlanted={() => setOpen(false)}
            />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
};
