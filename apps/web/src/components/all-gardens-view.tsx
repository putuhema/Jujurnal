"use client";

import { usePaginatedQuery } from "convex/react";
import { api } from "@puma-brain/backend/convex/_generated/api";
import { GardenFlower } from "./garden-flower";
import { useMemo } from "react";
import { Button } from "./ui/button";
import { PlantIcon } from "@phosphor-icons/react";
import { Badge } from "./ui/badge";

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

  return (

    <div>
      {totalFlowers === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>No gardens yet. Start journaling to grow your garden!</p>
        </div>
      ) : (
        <div className="space-y-4">
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
                <div
                  key={userId}
                  className="relative"
                  style={{
                    imageRendering: "pixelated",
                  }}
                >
                  {/* Pixel border frame */}
                  <div
                    className="bg-stone-100 dark:bg-stone-800 border-[3px] border-stone-400 dark:border-stone-500"
                    style={{
                      boxShadow: `
                        3px 3px 0 0 rgba(0,0,0,0.15),
                        inset 2px 2px 0 0 rgba(255,255,255,0.5),
                        inset -2px -2px 0 0 rgba(0,0,0,0.1)
                      `,
                    }}
                  >
                    {/* Title bar */}
                    <div className="bg-gradient-to-r from-rose-200 to-pink-200 dark:from-rose-900/60 dark:to-pink-900/60 px-3 py-2 flex items-center justify-between border-b-2 border-stone-300 dark:border-stone-600">
                      <h3 className="font-bold text-rose-700 dark:text-rose-200 uppercase tracking-wide text-sm flex items-center gap-2">
                        <span>✿</span>
                        {garden.user.name}'s Garden
                      </h3>
                      <div
                        className="bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 font-bold px-2 py-0.5 text-xs border-2 border-emerald-300 dark:border-emerald-700 rounded-sm"
                      >
                        <PlantIcon className="inline-block mr-1" weight="bold" />
                        ×{garden.posts.length}
                      </div>
                    </div>

                    {/* Garden content */}
                    <div className="p-3 space-y-2 bg-gradient-to-b from-stone-50 to-stone-100 dark:from-stone-800 dark:to-stone-850">
                      {Object.entries(postsByYear)
                        .sort(([a], [b]) => Number(b) - Number(a))
                        .map(([year, posts]) => (
                          <div
                            key={year}
                            className="bg-gradient-to-b from-green-100 to-emerald-100 dark:from-green-900/40 dark:to-emerald-900/40 border-2 border-green-200 dark:border-green-800 rounded-sm p-2"
                            style={{
                              boxShadow: "inset 0 2px 4px rgba(255,255,255,0.5), inset 0 -2px 4px rgba(0,0,0,0.05)",
                            }}
                          >
                            <div className="grid grid-cols-[repeat(auto-fill,minmax(1.2rem,1fr))]">
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
                  </div>
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
