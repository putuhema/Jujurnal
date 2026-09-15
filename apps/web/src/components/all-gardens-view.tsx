"use client";

import { usePaginatedQuery } from "convex/react";
import { api } from "@puma-brain/backend/convex/_generated/api";
import { IslandGarden } from "./island-garden";
import { PlantIcon } from "@phosphor-icons/react";
import { Badge } from "./ui/badge";
import { getCalendarDate } from "@/lib/calendar-date";
import { Skeleton } from "./ui/skeleton";
import { IslandGardenSkeleton } from "./island-garden-skeleton";
import type { CSSProperties } from "react";
import {
  gardenThemeColors,
  type GardenTheme,
} from "@/lib/garden-theme";

const GardenLoadingCard = () => (
  <div className="paper-card overflow-hidden rounded-3xl border border-border/70 bg-card/70 p-5">
    <div className="mb-4 flex items-center justify-between border-b border-dashed border-primary/15 pb-4">
      <Skeleton className="h-6 w-36 rounded-full bg-primary/10" />
      <Skeleton className="h-7 w-14 rounded-full bg-primary/10" />
    </div>

    <IslandGardenSkeleton />
  </div>
);

const GardensLoading = () => (
  <div
    className="py-8 sm:py-12"
    role="status"
    aria-live="polite"
    aria-label="Loading gardens"
  >
    <div className="grid gap-4 md:grid-cols-2">
      <GardenLoadingCard />
      <GardenLoadingCard />
    </div>
    <p className="sr-only">Growing the gardens…</p>
  </div>
);

export const AllGardensView = () => {
  const { results, status, loadMore } = usePaginatedQuery(
    api.posts.getAll,
    {},
    {
      initialNumItems: 100,
    }
  );

  if (status === "LoadingFirstPage") {
    return <GardensLoading />;
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const monthlyResults = results.filter((post) => {
    const date = getCalendarDate(post._creationTime, post.entryDate);
    return date.year === currentYear && date.month === currentMonth;
  });

  const gardensByUser = (() => {
    const gardens: Record<
      string,
      {
        user: any;
        posts: typeof results;
        gardenTheme: GardenTheme;
      }
    > = {};

    for (const post of monthlyResults) {
      if (!post.user) continue;
      const userId = post.user._id;
      if (!gardens[userId]) {
        gardens[userId] = {
          user: post.user,
          posts: [],
          gardenTheme: post.gardenTheme,
        };
      }
      gardens[userId].posts.push(post);
    }

    Object.values(gardens).forEach((garden) => {
      garden.posts.sort((a, b) => a._creationTime - b._creationTime);
    });

    return gardens;
  })();

  const totalFlowers = monthlyResults.length;

  return (
  <div className="py-8 sm:py-12">
      {totalFlowers === 0 ? (
        <div className="paper-card rounded-3xl border border-dashed border-primary/25 bg-card/70 px-6 py-14 text-center text-muted-foreground">
          <div className="mb-3 text-4xl">🌱</div>
          <p className="font-display text-2xl text-foreground">No flowers this month yet.</p>
          <p className="mt-2">A few sentences are enough to plant one.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {Object.entries(gardensByUser)
            .sort(([, a], [, b]) => b.posts.length - a.posts.length)
            .map(([userId, garden]) => {
              return (
                <div
                  key={userId}
                  className="board-tint paper-card overflow-hidden rounded-3xl border border-border/80 bg-card/80 p-5"
                  style={{
                    "--board-color": gardenThemeColors[garden.gardenTheme],
                  } as CSSProperties}
                >
                  <div className="mb-4 flex items-center justify-between border-b border-dashed border-primary/20 pb-4">
                    <div>
                      <h3 className="board-title font-display text-xl tracking-[-0.03em]">
                        {garden.user.name}'s garden
                      </h3>
                    </div>
                    <Badge variant="outline" className="rounded-full bg-background/50">
                      <PlantIcon />
                      {garden.posts.length}
                    </Badge>
                  </div>
                  <IslandGarden posts={garden.posts} size="xs" />
                </div>
              );
            })}
        </div>
      )}

      {status === "CanLoadMore" && (
        <div className="mt-6 text-center">
          <button
            onClick={() => loadMore(100)}
            className="text-sm text-primary hover:underline"
          >
            Load More Gardens
          </button>
        </div>
      )}

    </div>
  );
};
