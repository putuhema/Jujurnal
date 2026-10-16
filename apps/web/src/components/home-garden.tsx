"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@puma-brain/backend/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { getCalendarDate } from "@/lib/calendar-date";
import type { WorldGardenEntry } from "./world-garden-scene";

const HomeGardenSkeleton = () => (
  <div
    role="status"
    aria-label="Growing your garden"
    className="grid h-[clamp(26rem,calc(100svh-9rem),56rem)] w-full place-items-center"
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
  return <WorldGardenScene me={me} others={others} />;
};
