"use client";

import { usePaginatedQuery } from "convex/react";
import { api } from "@puma-brain/backend/convex/_generated/api";
import { GardenFlower } from "./garden-flower";
import { useMemo } from "react";
import { ArrowRightIcon, BookOpenTextIcon, PlantIcon, SparkleIcon } from "@phosphor-icons/react";
import { Badge } from "./ui/badge";
import { buttonVariants } from "./ui/button";
import { PostDialog } from "./post-dialog";
import { Authenticated, Unauthenticated } from "convex/react";
import Link from "next/link";

export const AllGardensView = () => {
  const { results, status, loadMore } = usePaginatedQuery(
    api.posts.getAll,
    {},
    {
      initialNumItems: 100,
    }
  );

  const gardensByUser = useMemo(() => {
    if (!results) return {};

    const gardens: Record<
      string,
      {
        user: any;
        posts: typeof results;
      }
    > = {};

    for (const post of results) {
      if (!post.user) continue;
      const userId = post.user._id;
      if (!gardens[userId]) {
        gardens[userId] = {
          user: post.user,
          posts: [],
        };
      }
      gardens[userId].posts.push(post);
    }

    Object.values(gardens).forEach((garden) => {
      garden.posts.sort((a, b) => a._creationTime - b._creationTime);
    });

    return gardens;
  }, [results]);

  if (results === undefined) {
    return (
      <div>loading...</div>
    );
  }

  const totalFlowers = results.length;

  const gardenCount = Object.keys(gardensByUser).length;

  return (
  <div className="py-8 sm:py-12">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex gap-2">
          <Badge variant="secondary" className="rounded-full px-3 py-1.5"><PlantIcon weight="fill" /> {totalFlowers} {totalFlowers === 1 ? "flower" : "flowers"}</Badge>
          <Badge variant="secondary" className="rounded-full px-3 py-1.5"><BookOpenTextIcon weight="fill" /> {gardenCount} {gardenCount === 1 ? "journal" : "journals"}</Badge>
        </div>
      </div>
      {totalFlowers === 0 ? (
        <div className="paper-card rounded-3xl border border-dashed border-primary/25 bg-card/70 px-6 py-14 text-center text-muted-foreground">
          <div className="mb-3 text-4xl">🌱</div>
          <p className="font-display text-2xl text-foreground">The first flower is waiting.</p>
          <p className="mt-2">A few sentences are enough to begin.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {Object.entries(gardensByUser)
            .sort(([, a], [, b]) => b.posts.length - a.posts.length)
            .map(([userId, garden]) => {
              const postsByYear = garden.posts.reduce(
                (acc, post) => {
                  const year = new Date(post._creationTime).getFullYear();
                  if (!acc[year]) acc[year] = [];
                  acc[year].push(post);
                  return acc;
                },
                {} as Record<number, typeof garden.posts>
              );

              return (
                <div key={userId} className="paper-card group overflow-hidden rounded-3xl border border-border/80 bg-card/80 p-5 transition-transform duration-300 hover:-translate-y-1">
                  <div className="mb-4 flex items-center justify-between border-b border-dashed border-primary/20 pb-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">A growing journal</p>
                      <h3 className="font-display text-2xl tracking-[-0.03em]">
                        {garden.user.name}'s garden
                      </h3>
                    </div>
                    <Badge variant="outline" className="rounded-full bg-background/50">
                      <PlantIcon />
                      {garden.posts.length}
                    </Badge>
                  </div>
                  {Object.entries(postsByYear)
                    .sort(([a], [b]) => Number(b) - Number(a))
                    .map(([year, posts]) => (
                      <div key={year} className="garden-grid rounded-2xl p-3">
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(1.75rem,1fr))] gap-1.5">
                          {posts.map((post) => (
                            <GardenFlower
                              key={post._id}
                              flowerId={post.flowerId || 1}
                              mood={post.mood}
                              text={post.body}
                              postId={post._id}
                              size="xs"
                              createdAt={new Date(post._creationTime)}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
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
