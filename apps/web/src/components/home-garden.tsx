"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { useConvex, useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { Id } from "@puma-brain/backend/convex/_generated/dataModel";
import { api } from "@puma-brain/backend/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { getCalendarDate } from "@/lib/calendar-date";
import type { WaterResult, WorldGardenEntry } from "./world-garden-scene";

const HomeGardenSkeleton = () => (
  <div
    role="status"
    aria-label="Growing your garden"
    className="-mx-4 -mb-32 grid h-[calc(100svh-4.85rem)] w-[calc(100%+2rem)] place-items-center sm:mx-0 sm:mb-0 sm:h-[clamp(26rem,calc(100svh-9rem),56rem)] sm:w-full"
  >
    <span
      aria-hidden="true"
      className="block aspect-[2/1] w-[min(60%,32rem)] animate-pulse bg-primary/15 motion-reduce:animate-none"
      style={{ clipPath: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)" }}
    />
  </div>
);

// three.js only loads in the browser, once the page is interactive.
const WorldGardenScene = dynamic(() => import("./world-garden-scene"), {
  ssr: false,
  loading: () => <HomeGardenSkeleton />,
});

export const HomeGarden = () => {
  const { data: session, isPending } = authClient.useSession();
  const myId = session?.user.id;
  const myName = session?.user.name ?? "You";
  const myPosts = useQuery(api.posts.getByUserId, myId ? { userId: myId } : "skip");
  const { results, status } = usePaginatedQuery(api.posts.getAll, {}, { initialNumItems: 300 });
  const [today] = useState(() => new Date());
  const convex = useConvex();
  const toggleWater = useMutation(api.reactions.toggle);

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

  const me = useMemo<WorldGardenEntry | null>(() => {
    if (!myId || !myPosts) return null;
    const posts = myPosts.filter((post) => {
      const date = getCalendarDate(post._creationTime, post.entryDate);
      return date.year === today.getFullYear() && date.month === today.getMonth();
    });
    return { userId: myId, name: myName, posts };
  }, [myId, myName, myPosts, today]);

  // Everyone else who has planted this month, busiest gardens closest to yours.
  const others = useMemo<WorldGardenEntry[]>(() => {
    const gardens = new Map<string, WorldGardenEntry>();
    for (const post of results) {
      if (!post.user || post.userId === myId) continue;
      const date = getCalendarDate(post._creationTime, post.entryDate);
      if (date.year !== today.getFullYear() || date.month !== today.getMonth()) continue;
      const garden = gardens.get(post.userId) ?? { userId: post.userId, name: post.user.name, posts: [] };
      garden.posts.push(post);
      gardens.set(post.userId, garden);
    }
    return [...gardens.values()].sort((a, b) => b.posts.length - a.posts.length || a.userId.localeCompare(b.userId));
  }, [results, myId, today]);

  if (isPending || (myId && myPosts === undefined) || status === "LoadingFirstPage") return <HomeGardenSkeleton />;
  return <WorldGardenScene me={me} others={others} onWater={water} />;
};
