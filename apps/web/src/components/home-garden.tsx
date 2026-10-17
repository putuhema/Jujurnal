"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useConvex, useMutation, useQuery } from "convex/react";
import type { Id } from "@puma-brain/backend/convex/_generated/dataModel";
import { api } from "@puma-brain/backend/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { getBrowserTimeZone } from "@/lib/calendar-date";
import type { MyGarden, WaterResult, WorldGardenEntry } from "./world-garden-scene";

const HomeGardenSkeleton = () => (
  <div
    role="status"
    aria-label="Growing your garden"
    className="fixed inset-0 z-0 grid place-items-center"
  >
    <span
      aria-hidden="true"
      className="block aspect-[2/1] w-[min(60%,32rem)] animate-pulse bg-primary/15 motion-reduce:animate-none"
      style={{ clipPath: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)" }}
    />
  </div>
);

// three.js only loads in the browser, once the page is interactive.
const loadScene = () => import("./world-garden-scene");
const WorldGardenScene = dynamic(loadScene, {
  ssr: false,
  loading: () => <HomeGardenSkeleton />,
});

export const HomeGarden = () => {
  const { data: session, isPending } = authClient.useSession();
  const myId = session?.user.id;
  const myName = session?.user.name ?? "You";
  // This month, in the visitor's own calendar.
  const [month] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  });
  const myPosts = useQuery(api.posts.getUserMonth, myId ? { userId: myId, month } : "skip");
  const world = useQuery(api.posts.getWorld, { month });
  const [timeZone] = useState(getBrowserTimeZone);
  const mine = useQuery(api.garden.getMine, myId ? { timeZone } : "skip");
  const gifts = useQuery(api.gifts.getMine, myId ? {} : "skip");
  const giftedToday = useQuery(api.gifts.giftedRecently, myId ? {} : "skip");
  const saveArrangement = useMutation(api.garden.saveArrangement);
  const sendGift = useMutation(api.gifts.send);
  const markGiftsRead = useMutation(api.gifts.markAllRead);
  const removeGift = useMutation(api.gifts.remove);
  const convex = useConvex();
  const toggleWater = useMutation(api.reactions.toggle);
  // Fetch the 3D scene while the session and gardens load, not after.
  useEffect(() => {
    void loadScene();
  }, []);

  // Watering from the world only ever adds water; it never takes it away.
  const water = async (postId: string): Promise<WaterResult> => {
    if (!myId) return "signedOut";
    const id = postId as Id<"posts">;
    const status = await convex.query(api.reactions.getForPost, { postId: id });
    if (!status?.canReact) return status?.unavailableReason === "signedOut" ? "signedOut" : "unavailable";
    if (status.viewerReacted) return "already";
    await toggleWater({ postId: id });
    return "watered";
  };

  const me = useMemo<WorldGardenEntry | null>(
    () => (myId && myPosts ? { userId: myId, name: myName, posts: myPosts } : null),
    [myId, myName, myPosts]
  );

  // Your own garden's extras: arrangement, unlocks, weather and gifts.
  const garden = useMemo<MyGarden | undefined>(
    () =>
      myId && mine
        ? {
            arrangement: { moves: mine.moves, decorations: mine.decorations },
            longestStreak: mine.longestStreak,
            recentMoods: mine.recentMoods,
            gifts: gifts ?? [],
            onSaveArrangement: (arrangement) =>
              void saveArrangement({
                timeZone,
                moves: arrangement.moves.map((move) => ({ ...move, postId: move.postId as Id<"posts"> })),
                decorations: arrangement.decorations,
              }).catch((error: unknown) => {
                const data = (error as { data?: unknown }).data;
                toast.error(typeof data === "string" ? data : "Couldn't save your garden");
              }),
            giftedToday: giftedToday ?? [],
            onSendGift: async (toUserId, kind, note) => (await sendGift({ toUserId, kind, note: note.trim() || undefined })).status,
            onMarkGiftsRead: () => void markGiftsRead({}),
            onRemoveGift: (id) => void removeGift({ id: id as Id<"gifts"> }),
          }
        : undefined,
    [myId, mine, gifts, giftedToday, timeZone, saveArrangement, sendGift, markGiftsRead, removeGift]
  );

  // Everyone else who has planted this month, busiest gardens closest to yours.
  const others = useMemo<WorldGardenEntry[]>(
    () =>
      (world?.gardens ?? [])
        .filter((garden) => garden.userId !== myId && garden.posts.length > 0)
        .sort((a, b) => b.posts.length - a.posts.length || a.userId.localeCompare(b.userId)),
    [world, myId]
  );

  if (isPending || (myId && (myPosts === undefined || mine === undefined)) || world === undefined) return <HomeGardenSkeleton />;
  return <WorldGardenScene me={me} others={others} onWater={water} garden={garden} />;
};
