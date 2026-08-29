"use client";

import { FlowerIcon } from "@phosphor-icons/react";
import { useQuery } from "convex/react";
import { api } from "@puma-brain/backend/convex/_generated/api";

export const Streak = () => {
  const streakStats = useQuery(api.streak.getStreakStats);

  const currentStreak = streakStats?.currentStreak ?? 0;
  const longestStreak = streakStats?.longestStreak ?? 0;
  const totalPosts = streakStats?.totalPosts ?? 0;

  return (
    <section className="paper-card mb-8 flex items-center gap-4 rounded-3xl border border-primary/10 bg-card/75 px-5 py-4">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground"><FlowerIcon weight="fill" className="size-5" /></div>
      <div>
        <p className="font-display text-xl tracking-[-0.02em]">{currentStreak > 0 ? `${currentStreak}-day gentle rhythm` : "Begin your gentle rhythm"}</p>
        <p className="text-sm text-muted-foreground">{totalPosts} {totalPosts === 1 ? "flower" : "flowers"} planted{longestStreak > 1 ? ` · your longest rhythm was ${longestStreak} days` : ""}</p>
      </div>
    </section>
  );
};
