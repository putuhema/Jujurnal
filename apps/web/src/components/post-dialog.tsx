"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PostForm } from "./post-form";
import { buttonVariants } from "./ui/button";
import { PlantIcon, SparkleIcon } from "@phosphor-icons/react";
import { api } from "@puma-brain/backend/convex/_generated/api";
import { useQuery } from "convex/react";
import { cn } from "@/lib/utils";

export const PostDialog = ({
  size = "sm",
  floating = false,
  mobileNav = false,
}: {
  size?: "sm" | "lg";
  floating?: boolean;
  mobileNav?: boolean;
}) => {
  const hasPostedToday = useQuery(api.posts.hasPostedToday);
  const floatingClass = floating && "fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-40 h-11 -translate-x-1/2 px-5 shadow-[0_12px_28px_oklch(0.24_0.04_70/25%)] sm:static sm:h-8 sm:translate-x-0 sm:px-3 sm:shadow-none";
  if (hasPostedToday) {
    if (mobileNav) {
      return (
        <div
          className="-mt-7 flex min-w-0 flex-col items-center gap-1 text-[10px] font-medium text-primary"
          title="Today’s flower is already planted"
        >
          <span className="flex size-13 items-center justify-center rounded-full border-[3px] border-card bg-secondary text-primary shadow-[0_7px_20px_oklch(0.2_0.03_70/18%)]">
            <PlantIcon weight="fill" className="size-5" />
          </span>
          <span>Planted</span>
        </div>
      );
    }

    return (
      <div className={cn("flex h-8 items-center gap-1.5 rounded-full border border-primary/15 bg-secondary/50 px-3 text-xs font-medium text-secondary-foreground", floatingClass)} title="Today’s flower is already planted">
        <PlantIcon weight="fill" className="text-primary" />
        <span className="hidden sm:inline">Today’s flower is planted</span>
        <span className="sm:hidden">Planted</span>
      </div>
    );
  }

  return (
    <Dialog>
      <DialogTrigger
        aria-label={mobileNav ? "Create today’s post" : undefined}
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
            Write today
          </>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="font-display text-2xl tracking-[-0.035em]">A plan for today</DialogTitle>
          <DialogDescription>There’s no right way to begin. Just be honest.</DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-6">
          <PostForm />
        </div>
      </DialogContent>
    </Dialog>
  );
};
