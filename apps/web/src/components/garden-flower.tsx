"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { formatDistanceToNow } from "date-fns";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { DropIcon, LockKeyIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { api } from "@puma-brain/backend/convex/_generated/api";
import type { Id } from "@puma-brain/backend/convex/_generated/dataModel";

const flowerSvgCache = new Map<string, Promise<string>>();

const getColoredFlower = (flowerId: number, color: string): Promise<string> => {
  const cacheKey = `${flowerId}:${color}`;
  const cached = flowerSvgCache.get(cacheKey);
  if (cached) return cached;

  const load = async () => {
    const response = await fetch(`/flower/${flowerId}.svg`);
    if (!response.ok) {
      if (flowerId !== 1) return getColoredFlower(1, color);
      throw new Error("Missing default flower");
    }
    const svg = await response.text();
    return svg
      .replace(/#0012D4/g, color)
      .replace(/width="[^"]*"/g, "")
      .replace(/height="[^"]*"/g, "")
      .replace("<svg", '<svg class="w-full h-full"');
  };

  const promise = load();
  flowerSvgCache.set(cacheKey, promise);
  return promise;
};

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

const moodToColor: Record<MoodGrade, string> = {
  "A+": "#c84f67", A: "#d86373", "A-": "#e17b85",
  "B+": "#d99d42", B: "#d99d42", "B-": "#d99d42",
  "C+": "#5f9290", C: "#5f9290", "C-": "#5f9290",
  "D+": "#8b638d", D: "#8b638d", "D-": "#8b638d", F: "#4d6685",
};

const moodLabels: Record<MoodGrade, string> = {
  "A+": "Sunlit", A: "Bright", "A-": "Bright", "B+": "Growing", B: "Growing", "B-": "Growing",
  "C+": "Steady", C: "Steady", "C-": "Steady", "D+": "Low tide", D: "Low tide", "D-": "Low tide", F: "Heavy",
};

interface GardenFlowerProps {
  flowerId?: number;
  mood: MoodGrade;
  postId: Id<"posts">;
  text: string;
  visibility: "public" | "private";
  reactionCount: number;
  size?: "xs" | "sm" | "md" | "lg";
  createdAt: Date
}

const sizeClasses = {
  xs: "size-10",
  sm: "size-11",
  md: "size-16",
  lg: "size-20",
};

const PlantReaction = ({
  postId,
  isOpen,
}: {
  postId: Id<"posts">;
  isOpen: boolean;
}) => {
  const [isToggling, setIsToggling] = useState(false);
  const reaction = useQuery(
    api.reactions.getForPost,
    isOpen ? { postId } : "skip"
  );
  const toggleReaction = useMutation(api.reactions.toggle).withOptimisticUpdate(
    (store) => {
      const current = store.getQuery(api.reactions.getForPost, { postId });
      if (!current?.canReact) return;

      store.setQuery(api.reactions.getForPost, { postId }, {
        ...current,
        count: Math.max(0, current.count + (current.viewerReacted ? -1 : 1)),
        viewerReacted: !current.viewerReacted,
      });
    }
  );

  const handleWaterPlant = async () => {
    setIsToggling(true);
    try {
      await toggleReaction({ postId });
    } catch {
      toast.error("Could not water this plant");
    }
    setIsToggling(false);
  };

  if (!reaction?.canReact) return null;

  return (
    <Button
      type="button"
      variant="ghost"
      disabled={isToggling}
      aria-pressed={reaction.viewerReacted}
      onClick={() => void handleWaterPlant()}
      size="xs"
      aria-label={reaction.viewerReacted ? "Remove water from plant" : "Water this plant"}
      title={reaction.viewerReacted ? "Plant watered" : "Water this plant"}
      className={cn(
        "h-7 rounded-full px-2 text-sky-700 transition-transform active:scale-95 dark:text-sky-300",
        reaction.viewerReacted
          ? "bg-sky-100 hover:bg-sky-100 dark:bg-sky-950 dark:hover:bg-sky-950"
          : "hover:bg-sky-50 dark:hover:bg-sky-950/60"
      )}
    >
      <DropIcon weight={reaction.viewerReacted ? "fill" : "bold"} />
      <span className="min-w-2.5 text-xs tabular-nums">{reaction.count}</span>
    </Button>
  );
};

export const GardenFlower = ({
  flowerId,
  mood,
  postId,
  text,
  visibility,
  reactionCount,
  size = "md",
  createdAt,
}: GardenFlowerProps) => {
  const color = moodToColor[mood];
  const safeFlowerId = flowerId && flowerId > 0 ? flowerId : 1;
  const isPrivate = visibility === "private";

  const [flowerSvg, setFlowerSvg] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    let isActive = true;
    setFlowerSvg(null);
    getColoredFlower(safeFlowerId, color)
      .then((svg) => {
        if (isActive) setFlowerSvg(svg);
      })
      .catch(() => {
        if (isActive) setFlowerSvg(null);
      });

    return () => {
      isActive = false;
    };
  }, [safeFlowerId, color]);

  if (!flowerSvg) {
    return (
      <div
        className={cn("flex items-center justify-center border border-dashed rounded", sizeClasses[size])}
      >
        <div className="w-4 h-4 border-2 border-muted-foreground rounded-full animate-pulse" />
      </div>
    );
  }

  const flower = (
    <div
      className={cn(
        "garden-plant island-flower relative z-10 flex items-center justify-center",
        isPrivate ? "cursor-default" : "cursor-pointer",
        sizeClasses[size]
      )}
      title={isPrivate ? "Private journal" : `Feeling: ${moodLabels[mood]}`}
    >
      <div
        className="size-full"
        dangerouslySetInnerHTML={{ __html: flowerSvg }}
      />
      {isPrivate ? (
        <span
          className="absolute -right-1 -top-1 z-20 inline-flex size-5 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm"
          role="img"
          aria-label="Private journal"
        >
          <LockKeyIcon className="size-3" weight="fill" />
        </span>
      ) : reactionCount > 0 ? (
        <span
          className="absolute -right-1 -top-1 z-20 inline-flex h-5 min-w-5 items-center justify-center gap-0.5 rounded-full border border-sky-300 bg-sky-100 px-1 text-[10px] font-bold tabular-nums text-sky-800 shadow-sm dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200"
          role="img"
          aria-label={`${reactionCount} ${reactionCount === 1 ? "watering" : "waterings"}`}
        >
          <DropIcon className="size-2.5" weight="fill" />
          {reactionCount}
        </span>
      ) : null}
    </div>
  );

  if (isPrivate) return flower;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger aria-label={`Open ${moodLabels[mood]} journal`}>
        {flower}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader className="sr-only">
          <DialogTitle>Journal plant</DialogTitle>
          <DialogDescription>
            Read this journal entry and send a little encouragement.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-4 px-4">
          <div className="place-self-center relative">
            <div
              className="relative flex h-20 w-20 cursor-pointer items-center justify-center"
              title={`Feeling: ${moodLabels[mood]}`}
            >
              <div
                className="w-full h-full"
                dangerouslySetInnerHTML={{ __html: flowerSvg }}
              />
            </div>
            <div className="absolute bottom-0 right-0">
              <Badge variant="outline" className="rounded-full">{moodLabels[mood]}</Badge>
            </div>
          </div>
          <div className="col-span-2 flex min-w-0 flex-col justify-center">
            <p className="leading-relaxed">{text}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(createdAt), {
                addSuffix: true,
              })}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end px-4">
          <PlantReaction postId={postId} isOpen={isOpen} />
        </div>
      </DialogContent>
    </Dialog>
  );
};
