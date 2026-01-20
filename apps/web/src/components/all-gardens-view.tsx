"use client";

import { usePaginatedQuery } from "convex/react";
import { api } from "@puma-brain/backend/convex/_generated/api";
import { GardenFlower } from "./garden-flower";
import { useMemo } from "react";

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
                <div key={userId}>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">
                      {garden.user.name}'s Garden
                    </h3>
                    <span className="text-sm text-muted-foreground">
                      ({garden.posts.length}{" "}
                      {garden.posts.length === 1 ? "plant" : "plants"})
                    </span>
                  </div>
                  {Object.entries(postsByYear)
                    .sort(([a], [b]) => Number(b) - Number(a))
                    .map(([year, posts]) => (
                      <div key={year}>
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
