"use client";

import dynamic from "next/dynamic";
import type { Id } from "@puma-brain/backend/convex/_generated/dataModel";
import type { MoodGrade } from "@/lib/garden-procedural";
import type { Arrangement } from "@/lib/garden-arrangement";
import { IslandGardenSkeleton } from "./island-garden-skeleton";

export type IslandPost = {
  _id: Id<"posts">;
  _creationTime: number;
  body: string;
  userId?: string;
  entryDate?: string;
  mood: MoodGrade;
  // The AI's short note on the mood. Only sent to the journal's author.
  moodReason?: string;
  // True while the AI is still reading the mood.
  moodPending?: boolean;
  visibility?: "public" | "private";
  reactionCount?: number;
  // Times its author watered it (helps it grow).
  selfWaterings?: number;
  // The day its author last watered it.
  selfWateredOn?: string;
};

// three.js only loads once a garden is on screen.
const loadScene = () => import("./garden-island-scene");
const GardenIslandScene = dynamic(loadScene, {
  ssr: false,
  loading: () => <IslandGardenSkeleton />,
});

// Call as soon as a garden is about to load, so the 3D code downloads alongside its data.
export const preloadIslandGarden = () => void loadScene();

export const IslandGarden = ({ posts, seed, arrangement }: { posts: IslandPost[]; seed?: string; arrangement?: Arrangement }) => (
  // Each gardener's island is grown from their own seed, and each journal grows a plant from its id.
  <GardenIslandScene posts={posts} seed={seed ?? posts[0]?.userId ?? "garden"} arrangement={arrangement} />
);
