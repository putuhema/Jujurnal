"use client";

import dynamic from "next/dynamic";
import type { Id } from "@puma-brain/backend/convex/_generated/dataModel";
import type { MoodGrade } from "@/lib/garden-procedural";
import { IslandGardenSkeleton } from "./island-garden-skeleton";

export type IslandPost = {
  _id: Id<"posts">;
  _creationTime: number;
  body: string;
  userId?: string;
  mood: MoodGrade;
  visibility?: "public" | "private";
  reactionCount?: number;
};

// three.js only loads once a garden is on screen.
const GardenIslandScene = dynamic(() => import("./garden-island-scene"), {
  ssr: false,
  loading: () => <IslandGardenSkeleton />,
});

export const IslandGarden = ({ posts, seed }: { posts: IslandPost[]; seed?: string }) => (
  // Each gardener's island is grown from their own seed, and each journal grows a plant from its id.
  <GardenIslandScene posts={posts} seed={seed ?? posts[0]?.userId ?? "garden"} />
);
