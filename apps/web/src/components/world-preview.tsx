"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { createRandom, type MoodGrade } from "@/lib/garden-procedural";
import type { IslandPost } from "./island-garden";
import type { Arrangement } from "@/lib/garden-arrangement";
import type { GiftView } from "./garden-gifts";
import type { MyGarden, WorldGardenEntry } from "./world-garden-scene";

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
  const [extra, setExtra] = useState(0);
  const [watered, setWatered] = useState(() => new Set<string>());
  const others = useMemo(() => {
    const now = Date.now();
    return Array.from({ length: 40 }, (_, index) =>
      sampleGarden(`preview-${index}`, `${names[index % names.length]} ${index + 1}`, 3 + ((index * 7) % 22), now)
    );
  }, []);
  const me = useMemo(() => {
    const garden = sampleGarden("preview-me", "You", 14, Date.now());
    // A few steady days, so the cat shows up.
    for (const index of [2, 5, 9]) garden.posts[index].mood = "C";
    // "Plant a journal" adds today's entries one at a time, as if written just now.
    for (let index = 0; index < extra; index++) {
      garden.posts.push({ ...garden.posts[0], _id: `preview-me-new-${index}` as IslandPost["_id"], _creationTime: Date.now(), body: "A brand new journal", mood: "A+" });
    }
    return garden;
  }, [extra]);

  // A sample of your garden's extras, kept in memory: everything unlocked, two gifts.
  const [arrangement, setArrangement] = useState<Arrangement>({ moves: [], decorations: [] });
  const [gifts, setGifts] = useState<GiftView[]>(() => [
    { _id: "gift-1", _creationTime: Date.now() - 3_600_000, kind: "fireflies", note: "Your garden made my evening. Thank you for sharing it.", read: false, from: "Citra" },
    { _id: "gift-2", _creationTime: Date.now() - 86_400_000, kind: "pebble", read: true, from: "Bima" },
  ]);
  const garden: MyGarden = {
    arrangement,
    longestStreak: 30,
    recentMoods: me.posts.slice(-7).reverse().map((post) => post.mood),
    gifts,
    onSaveArrangement: setArrangement,
    onSendGift: async () => {},
    onMarkGiftsRead: () => setGifts((list) => list.map((gift) => ({ ...gift, read: true }))),
    onRemoveGift: (id) => setGifts((list) => list.filter((gift) => gift._id !== id)),
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setExtra((count) => count + 1)}
        className="rounded-full border border-border px-4 py-1.5 text-sm hover:bg-muted"
      >
        Plant a journal (test the planting moment)
      </button>
      <WorldGardenScene
        demo
        garden={garden}
        me={me}
        others={others}
        onWater={async (postId) => {
          if (watered.has(postId)) return "already";
          setWatered((set) => new Set(set).add(postId));
          return "watered";
        }}
      />
    </div>
  );
};
