"use client";

import { api } from "@puma-brain/backend/convex/_generated/api";
import { useMutation, usePaginatedQuery } from "convex/react";
import { useState } from "react";

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
  GlobeHemisphereWestIcon,
  LockKeyIcon,
} from "@phosphor-icons/react";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import Link from "next/link";

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

export const Posts = () => {
  const { data: session } = authClient.useSession();
  const { results, status, loadMore } = usePaginatedQuery(
    api.posts.getAll,
    {},
    {
      initialNumItems: 17,
    }
  );

  const deletePost = useMutation(api.posts.deletePost);
  return (
    <div className="space-y-2">
      {results &&
        results.map((post: any) => {
          const displayText = post.body;

          return (
              <Item key={post._id} variant="outline" className="border-none">
                <ItemMedia>
                  <Avatar className="size-10">
                    <AvatarImage src={post.user.image} />
                    <AvatarFallback>ER</AvatarFallback>
                  </Avatar>
                </ItemMedia>
                <ItemContent>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link href={`/profile/post/${post.user._id}`}>
                    <ItemTitle>
                      {post.user.name}
                      </ItemTitle>
                    </Link>
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
                    <span
                      className="inline-flex size-6 items-center justify-center rounded-full border border-border/60 bg-background/65 text-muted-foreground"
                      role="img"
                      aria-label={post.visibility === "private" ? "Private journal" : "Public journal"}
                      title={post.visibility === "private" ? "Private journal" : "Public journal"}
                    >
                      {post.visibility === "private" ? (
                        <LockKeyIcon className="size-3.5" weight="fill" />
                      ) : (
                        <GlobeHemisphereWestIcon className="size-3.5" weight="bold" />
                      )}
                    </span>
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
        })}
      {status === "CanLoadMore" && (
        <Button
          onClick={() => loadMore(17)}
          variant="outline"
          className="w-full"
        >
          Load More
        </Button>
      )}
    </div>
  );
};
