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
  entryDate?: string;
  mood: MoodGrade;
  visibility?: "public" | "private";
  reactionCount?: number;
};

// three.js only loads once a garden is on screen.
const loadScene = () => import("./garden-island-scene");
const GardenIslandScene = dynamic(loadScene, {
  ssr: false,
  loading: () => <IslandGardenSkeleton />,
});

// Call as soon as a garden is about to load, so the 3D code downloads alongside its data.
export const preloadIslandGarden = () => void loadScene();

export const IslandGarden = ({ posts, seed }: { posts: IslandPost[]; seed?: string }) => (
  // Each gardener's island is grown from their own seed, and each journal grows a plant from its id.
  <GardenIslandScene posts={posts} seed={seed ?? posts[0]?.userId ?? "garden"} />
);
