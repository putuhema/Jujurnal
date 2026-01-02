"use client";

import { api } from "@puma-brain/backend/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";

import { format } from "date-fns";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SparkleIcon, TrashSimpleIcon } from "@phosphor-icons/react";
import { Button } from "./ui/button";

export const Posts = () => {
  const posts = useQuery(api.post.getAll);
  const deletePost = useMutation(api.post.deletePost);
  return (
    <div className="space-y-2">
      {posts &&
        posts.map((post: any) => (
          <Item variant="outline">
            <ItemMedia>
              <Avatar className="size-10">
                <AvatarImage src={post.user.image} />
                <AvatarFallback>ER</AvatarFallback>
              </Avatar>
            </ItemMedia>
            <ItemContent>
              <div className="flex items-center gap-2">
                <ItemTitle>{post.user.name}</ItemTitle>
                <ItemDescription className="text-xs">
                  {format(new Date(post._creationTime), "dd/MM/yyy HH:mm aaa")}
                </ItemDescription>
                {post.mood && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-muted">
                    Mood: {post.mood}
                  </span>
                )}
              </div>
              <p>{post.body}</p>
            </ItemContent>
            <ItemFooter>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon-sm">
                  <SparkleIcon />
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    deletePost({
                      id: post._id,
                    });
                  }}
                >
                  <TrashSimpleIcon /> Delete Post
                </Button>
              </div>
            </ItemFooter>
          </Item>
        ))}
    </div>
  );
};
