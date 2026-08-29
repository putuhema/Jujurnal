"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PostForm } from "./post-form";
import { Button, buttonVariants } from "./ui/button";
import { PlantIcon, SparkleIcon } from "@phosphor-icons/react";
import { api } from "@puma-brain/backend/convex/_generated/api";
import { useQuery } from "convex/react";

export const PostDialog = ({ size = "sm" }: { size?: "sm" | "lg" }) => {
  const hasPostedToday = useQuery(api.posts.hasPostedToday);
  if (hasPostedToday) {
    return (
      <Button disabled size={size} className="rounded-full">
        <PlantIcon />
        Write
      </Button>
    );
  }

  return (
    <Dialog>
      <DialogTrigger
        className={buttonVariants({ variant: "default", size, className: "rounded-full shadow-sm" })}
      >
        {size === "lg" ? <SparkleIcon weight="fill" /> : <PlantIcon />}
        {size === "lg" ? "Write today’s note" : "Write"}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="font-display text-3xl tracking-[-0.035em]">A page for today</DialogTitle>
          <DialogDescription>There’s no right way to begin. Just be honest.</DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-6">
          <PostForm />
        </div>
      </DialogContent>
    </Dialog>
  );
};
