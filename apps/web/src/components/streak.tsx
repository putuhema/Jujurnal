"use client";

import { FireIcon, MedalIcon, TargetIcon } from "@phosphor-icons/react";
import { useQuery } from "convex/react";
import { api } from "@puma-brain/backend/convex/_generated/api";

export const Streak = () => {
  const streakStats = useQuery(api.post.getStreakStats);

  const currentStreak = streakStats?.currentStreak ?? 0;
  const longestStreak = streakStats?.longestStreak ?? 0;
  const totalPosts = streakStats?.totalPosts ?? 0;

  return (
    <div className="p-4 flex items-center justify-between flex-wrap gap-4">
      <div className="flex items-center gap-2">
        <FireIcon size={32} />
        <div className="col-span-2">
          <p className="text-xs text-muted-foreground">CURRENT STREAK</p>
          <p className="text-xl">
            {currentStreak} {currentStreak === 1 ? "day" : "days"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <MedalIcon size={32} />
        <div>
          <p className="text-xs text-muted-foreground">LONGEST STREAK</p>
          <p className="text-xl">
            {longestStreak} {longestStreak === 1 ? "day" : "days"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <TargetIcon size={32} />
        <div>
          <p className="text-xs text-muted-foreground">TOTAL POSTS</p>
          <p className="text-xl">{totalPosts}/365</p>
        </div>
      </div>
    </div>
  );
};
