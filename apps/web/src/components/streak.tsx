"use client";

import { FireIcon, MedalIcon, TargetIcon } from "@phosphor-icons/react";

export const Streak = () => {
  return (
    <div className="p-4 flex items-center justify-between">
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
    </div>
  );
};
