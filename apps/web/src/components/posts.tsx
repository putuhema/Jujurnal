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
  "A+": "bg-[#216e39] text-white",
  A: "bg-[#30a14e] text-white",
  "A-": "bg-[#40c463] text-white",
  "B+": "bg-[#9be9a8] text-[#216e39]",
  B: "bg-[#9be9a8] text-[#216e39]",
  "B-": "bg-[#9be9a8] text-[#216e39]",
  "C+": "bg-[#ffec44] text-[#8b6914]",
  C: "bg-[#ffec44] text-[#8b6914]",
  "C-": "bg-[#ffec44] text-[#8b6914]",
  "D+": "bg-[#fd7e14] text-white",
  D: "bg-[#fd7e14] text-white",
  "D-": "bg-[#fd7e14] text-white",
  F: "bg-[#d73a4a] text-white",
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
          const PostItem = ({ post }: { post: any }) => {
            const displayText = post.body;

            return (
              <Item variant="outline" className="border-none">
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
                          "text-xs font-semibold px-2 py-0.5 rounded",
                          moodColors[post.mood as MoodGrade]
                        )}
                      >
                        {post.mood}
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
