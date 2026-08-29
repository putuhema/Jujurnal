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
}: {
  size?: "sm" | "lg";
  floating?: boolean;
}) => {
  const hasPostedToday = useQuery(api.posts.hasPostedToday);
  const floatingClass = floating && "fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-40 h-11 -translate-x-1/2 px-5 shadow-[0_12px_28px_oklch(0.24_0.04_70/25%)] sm:static sm:h-8 sm:translate-x-0 sm:px-3 sm:shadow-none";
  if (hasPostedToday) {
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
        className={buttonVariants({ variant: "default", size, className: cn("rounded-full shadow-sm", floatingClass) })}
      >
        {size === "lg" ? <SparkleIcon weight="fill" /> : <PlantIcon />}
        Write today
      </DialogTrigger>
      <DialogContent>
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="font-display text-3xl tracking-[-0.035em]">A page for today</DialogTitle>
          <DialogDescription>There’s no right way to begin. Just be honest.</DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-6">
          <PostForm />
        </div>
      </DialogContent>
    </Dialog>
  );
};
