"use client";

import { api } from "@puma-brain/backend/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  TrashSimpleIcon,
  DotsThreeCircleIcon,
} from "@phosphor-icons/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { useParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { MagnifyingGlassIcon } from "@phosphor-icons/react";

type MoodGrade =
  | "A+"
  | "A"
  | "A-"
  | "B+"
  | "B"
  | "B-"
  | "C+"
  | "C"
  | "C-"
  | "D+"
  | "D"
  | "D-"
  | "F";

const moodColors: Record<MoodGrade, string> = {
  "A+": "bg-emerald-700/75", A: "bg-emerald-600/65", "A-": "bg-emerald-500/55",
  "B+": "bg-lime-500/45", B: "bg-lime-500/45", "B-": "bg-lime-500/45",
  "C+": "bg-amber-300/60", C: "bg-amber-300/60", "C-": "bg-amber-300/60",
  "D+": "bg-orange-300/60", D: "bg-orange-300/60", "D-": "bg-orange-300/60", F: "bg-rose-400/55",
};

const moodLabels: Record<MoodGrade, string> = {
  "A+": "Sunlit", A: "Bright", "A-": "Bright", "B+": "Growing", B: "Growing", "B-": "Growing",
  "C+": "Steady", C: "Steady", "C-": "Steady", "D+": "Low tide", D: "Low tide", "D-": "Low tide", F: "Heavy",
};

export default function UserPost() {
  const params = useParams();
  const userId = params.id as string;
  const { data: session } = authClient.useSession();
  const posts = useQuery(api.posts.getByUserId, { userId });
  const deletePost = useMutation(api.posts.deletePost);
  const [search, setSearch] = useState("");
  const filteredPosts = useMemo(() => {
    if (!posts) return [];
    const query = search.trim().toLowerCase();
    return query ? posts.filter((post) => post.body.toLowerCase().includes(query)) : posts;
  }, [posts, search]);

  if (!posts) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Item key={i} variant="outline" className="border-none">
            <ItemMedia>
              <Skeleton className="size-10 rounded-full" />
            </ItemMedia>
            <ItemContent>
              <div className="flex items-center gap-2 flex-wrap">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-4 w-16 rounded" />
              </div>
              <div className="space-y-2 mt-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-20" />
              </div>
            </ItemContent>
            <ItemActions>
              <Skeleton className="size-6 rounded-full" />
            </ItemActions>
          </Item>
        ))}
      </div>
    );
  }

  if (posts.length === 0) {
    return <div className="paper-card rounded-3xl border border-dashed border-primary/20 bg-card/70 px-6 py-14 text-center text-muted-foreground">Your first page is waiting when you are.</div>;
  }

  return (
    <section className="paper-card rounded-3xl border border-primary/10 bg-card/75 p-5 sm:p-7">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Your pages</p><h2 className="mt-1 font-display text-3xl tracking-[-0.035em]">Notes worth keeping.</h2></div>
        <div className="relative w-full sm:w-64"><MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search your words" className="rounded-full pl-9" aria-label="Search entries" /></div>
      </div>
      <div className="space-y-3">
      {filteredPosts.map((post: any) => {
        const PostItem = ({ post }: { post: any }) => {
          const displayText = post.body;

          if (!post.user) return null;

          return (
            <Item variant="outline" className="rounded-2xl border-border/60 bg-background/45 px-4 py-3">
              <ItemMedia>
                <Avatar className="size-10">
                  <AvatarImage src={post.user.image || undefined} />
                  <AvatarFallback>ER</AvatarFallback>
                </Avatar>
              </ItemMedia>
              <ItemContent>
                <div className="flex items-center gap-2 flex-wrap">
                  <ItemTitle>{post.user.name}</ItemTitle>
                  <ItemDescription className="text-xs"></ItemDescription>
                  {post.mood && (
                    <span
                      className={cn(
                        "text-xs font-medium px-2 py-0.5 rounded-full text-foreground",
                        moodColors[post.mood as MoodGrade]
                      )}
                    >
                      {moodLabels[post.mood as MoodGrade]}
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  <p>{displayText}</p>

                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(post._creationTime), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
              </ItemContent>
              <ItemActions>
                {session?.user.id === post.user._id && (
                  <DropdownMenu>
                    <DropdownMenuTrigger>
                      <DotsThreeCircleIcon />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => deletePost({ id: post._id })}
                      >
                        <TrashSimpleIcon /> Delete Post
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </ItemActions>
            </Item>
          );
        };

        return <PostItem key={post._id} post={post} />;
      })}
      {filteredPosts.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No pages match “{search}”.</p>}
      </div>
    </section>
  );
}
