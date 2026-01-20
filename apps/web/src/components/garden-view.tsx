"use client";

import { useQuery } from "convex/react";
import { api } from "@puma-brain/backend/convex/_generated/api";
import { GardenFlower } from "./garden-flower";

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
    <>
      {sortedPosts.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>No flowers yet. Start journaling to grow your garden!</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(postsByYear)
            .sort(([a], [b]) => Number(b) - Number(a))
            .map(([year, posts]) => (
              <div key={year}>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(3rem,1fr))]">
                  {posts.map((post) => (
                    <GardenFlower
                      key={post._id}
                      text={post.body}
                      flowerId={post.flowerId || 1}
                      mood={post.mood}
                      postId={post._id}
                      size="md"
                      createdAt={new Date(post._creationTime)}
                    />
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </>
  );
};
