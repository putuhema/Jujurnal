"use client";

import {
  FireIcon,
  MedalIcon,
  TargetIcon,
  HeartIcon,
} from "@phosphor-icons/react";
import { useQuery } from "convex/react";
import { api } from "@puma-brain/backend/convex/_generated/api";

export const Streak = () => {
  const monthlyMood = useQuery(api.post.getMonthlyMood);

  return (
    <div className="p-4 flex items-center justify-between flex-wrap gap-4">
      <div className="flex items-center gap-2">
        <FireIcon size={32} />
        <div className="col-span-2">
          <p className="text-xs text-muted-foreground">CURRENT STREAK</p>
          <p className="text-xl">0 days</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <MedalIcon size={32} />
        <div>
          <p className="text-xs text-muted-foreground">LONGEST STREAK</p>
          <p className="text-xl">0 days</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <TargetIcon size={32} />
        <div>
          <p className="text-xs text-muted-foreground">TOTAL POSTS</p>
          <p className="text-xl">0/365</p>
        </div>
      </div>
      {monthlyMood && (
        <div className="flex items-center gap-2">
          <HeartIcon size={32} />
          <div>
            <p className="text-xs text-muted-foreground">THIS MONTH'S MOOD</p>
            <p className="text-xl font-semibold">{monthlyMood.moodWord}</p>
          </div>
        </div>
      )}
    </div>
  );
};
