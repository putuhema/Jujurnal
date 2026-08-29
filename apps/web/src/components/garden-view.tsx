"use client";

import { useQuery } from "convex/react";
import { api } from "@puma-brain/backend/convex/_generated/api";
import { IslandGarden } from "./island-garden";

import { useParams } from "next/navigation";
import { Skeleton } from "./ui/skeleton";

export const GardenView = () => {
  const params = useParams();
  const userId = params.id as string;

  const userPosts = useQuery(
    api.posts.getByUserId,
    userId ? { userId } : "skip"
  );

  if (!userId) {
    return null;
  }

  if (userPosts === undefined) {
    return (
      <div className="space-y-2">
        <Skeleton className="w-full h-12" />
        <Skeleton className="w-full h-12 opacity-75" />
        <Skeleton className="w-full h-12 opacity-30" />
      </div>
    );
  }

  const sortedPosts =
    userPosts?.sort((a, b) => a._creationTime - b._creationTime) || [];

  const postsByYear = sortedPosts.reduce(
    (acc, post) => {
      const year = new Date(post._creationTime).getFullYear();
      if (!acc[year]) acc[year] = [];
      acc[year].push(post);
      return acc;
    },
    {} as Record<number, typeof sortedPosts>
  );

  return (
    <section className="board-tint paper-card rounded-3xl border border-primary/10 bg-card/75 p-5 sm:p-7">
      <div className="mb-6"><p className="board-eyebrow text-xs font-bold uppercase tracking-[0.16em]">Your garden</p><h2 className="board-title mt-1 font-display text-3xl tracking-[-0.035em]">A living record of your days.</h2><p className="board-copy mt-2 text-sm">Each flower holds a note you chose to keep.</p></div>
      {sortedPosts.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-primary/20 bg-background/40 py-12 text-center text-muted-foreground">
          <p>Your first flower is waiting.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(postsByYear)
            .sort(([a], [b]) => Number(b) - Number(a))
            .map(([year, posts]) => (
              <div key={year}>
                <p className="board-copy mb-2 text-center text-xs font-bold uppercase tracking-[0.16em]">{year}</p>
                <IslandGarden posts={posts} />
              </div>
            ))}
        </div>
      )}
    </section>
  );
};
