"use client";

import { api } from "@puma-brain/backend/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
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

export default function UserPost() {
  const params = useParams();
  const userId = params.id as string;
  const { data: session } = authClient.useSession();
  const posts = useQuery(api.posts.getByUserId, { userId });
  const deletePost = useMutation(api.posts.deletePost);

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
    return <div>No posts found</div>;
  }

  return (
    <div className="space-y-2">
      {posts.map((post: any) => {
        const PostItem = ({ post }: { post: any }) => {
          const displayText = post.body;

          if (!post.user) return null;

          return (
            <Item variant="outline" className="border-none">
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
    </div>
  );
}