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
        <FireIcon className="h-6 w-6" />
        <div className="col-span-2">
          <p className="text-xs text-muted-foreground hidden sm:block">
            CURRENT STREAK
          </p>
          <p className="text-lg sm:text-xl">
            {currentStreak} {currentStreak === 1 ? "day" : "days"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <MedalIcon className="h-6 w-6" />
        <div>
          <p className="text-xs text-muted-foreground hidden sm:block">
            LONGEST STREAK
          </p>
          <p className="text-lg sm:text-xl">
            {longestStreak} {longestStreak === 1 ? "day" : "days"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <TargetIcon className="h-6 w-6" />
        <div>
          <p className="text-xs text-muted-foreground hidden sm:block">
            TOTAL POSTS
          </p>
          <p className="text-lg sm:text-xl">{totalPosts}/365</p>
        </div>
      </div>
    </div>
  );
};
