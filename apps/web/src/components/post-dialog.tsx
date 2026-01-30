"use client";

import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { PostForm } from "./post-form";
import { Button, buttonVariants } from "./ui/button";
import { PlantIcon } from "@phosphor-icons/react";
import { api } from "@puma-brain/backend/convex/_generated/api";
import { useQuery } from "convex/react";

export const PostDialog = () => {
  const hasPostedToday = useQuery(api.posts.hasPostedToday);
  if (hasPostedToday) {
    return (
      <Button disabled size="sm">
        <PlantIcon />
        Write
      </Button>
    );
  }

  return (
    <Dialog>
      <DialogTrigger
        className={buttonVariants({ variant: "default", size: "sm" })}
      >
        <PlantIcon />
        Write
      </DialogTrigger>
      <DialogContent>
        <div className="p-6">
          <PostForm />
        </div>
      </DialogContent>
    </Dialog>
  );
};
