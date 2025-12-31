"use client";

import { api } from "@puma-brain/backend/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";

import { format } from "date-fns";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DotsThreeIcon, TrashSimpleIcon } from "@phosphor-icons/react";

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
              </div>
              <p>{post.body}</p>
            </ItemContent>
            <ItemActions>
              <DropdownMenu>
                <DropdownMenuTrigger>
                  <DotsThreeIcon />
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => {
                      deletePost({
                        id: post._id,
                      });
                    }}
                  >
                    <TrashSimpleIcon /> Remove
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </ItemActions>
          </Item>
        ))}
    </div>
  );
};
