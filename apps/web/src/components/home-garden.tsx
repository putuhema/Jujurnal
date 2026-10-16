"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useConvex, useMutation, useQuery } from "convex/react";
import type { Id } from "@puma-brain/backend/convex/_generated/dataModel";
import { api } from "@puma-brain/backend/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import type { WaterResult, WorldGardenEntry } from "./world-garden-scene";

const HomeGardenSkeleton = () => (
  <div
    role="status"
    aria-label="Growing your garden"
    className="-mx-4 -mb-32 grid h-[calc(100svh-6rem)] w-[calc(100%+2rem)] place-items-center sm:mx-0 sm:mb-0 sm:h-[clamp(26rem,calc(100svh-9rem),56rem)] sm:w-full"
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

  // Everyone else who has planted this month, busiest gardens closest to yours.
  const others = useMemo<WorldGardenEntry[]>(
    () =>
      (world?.gardens ?? [])
        .filter((garden) => garden.userId !== myId && garden.posts.length > 0)
        .sort((a, b) => b.posts.length - a.posts.length || a.userId.localeCompare(b.userId)),
    [world, myId]
  );

  if (isPending || (myId && myPosts === undefined) || world === undefined) return <HomeGardenSkeleton />;
  return <WorldGardenScene me={me} others={others} onWater={water} />;
};
