"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { createRandom, type MoodGrade } from "@/lib/garden-procedural";
import type { IslandPost } from "./island-garden";
import type { WorldGardenEntry } from "./world-garden-scene";

const WorldGardenScene = dynamic(() => import("./world-garden-scene"), { ssr: false });

const moods: MoodGrade[] = ["A+", "A", "B+", "B", "C", "D", "F"];
const names = ["Ayu", "Bima", "Citra", "Dewa", "Eka", "Fajar", "Gita", "Hana", "Indra", "Jaya", "Kirana", "Lestari"];

const sampleGarden = (userId: string, name: string, count: number, now: number): WorldGardenEntry => {
  const random = createRandom(userId);
  return {
    userId,
    name,
    posts: Array.from({ length: count }, (_, index) => ({
      _id: `${userId}-post-${index}` as IslandPost["_id"],
      _creationTime: now - (count - index) * 86_400_000 * 0.8,
      body: `Sample journal ${index + 1} from ${name}`,
      mood: random.pick(moods),
      reactionCount: random.int(0, 3),
      visibility: "public",
    })),
  };
};

export const WorldPreview = () => {
  const { me, others } = useMemo(() => {
    const now = Date.now();
    return {
      me: sampleGarden("preview-me", "You", 14, now),
      others: Array.from({ length: 40 }, (_, index) =>
        sampleGarden(`preview-${index}`, `${names[index % names.length]} ${index + 1}`, 3 + ((index * 7) % 22), now)
      ),
    };
  }, []);
  return <WorldGardenScene me={me} others={others} />;
};
