"use client";

import { useState } from "react";
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
import { getPlantSpriteFrame } from "@/lib/garden-sprites";
import { cn } from "@/lib/utils";
import { playGardenSound } from "@/lib/garden-sounds";
import { DropIcon, LockKeyIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { api } from "@puma-brain/backend/convex/_generated/api";
import type { Id } from "@puma-brain/backend/convex/_generated/dataModel";

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

const moodGrayscale: Record<MoodGrade, number> = {
  "A+": 0, A: 0, "A-": 0.05,
  "B+": 0.1, B: 0.2, "B-": 0.3,
  "C+": 0.4, C: 0.5, "C-": 0.6,
  "D+": 0.7, D: 0.8, "D-": 0.9,
  F: 1,
};

const PlantSprite = ({ flowerId, mood }: { flowerId: number; mood: MoodGrade }) => {
  const { column, row } = getPlantSpriteFrame(flowerId);
  return (
    <span
      aria-hidden="true"
      className="block size-full"
      style={{
        backgroundImage: 'url("/plants-atlas.webp")',
        backgroundRepeat: "no-repeat",
        backgroundSize: "1000% 1000%",
        backgroundPosition: `${(column / 9) * 100}% ${(row / 9) * 100}%`,
        imageRendering: "pixelated",
        filter: `grayscale(${moodGrayscale[mood]})`,
      }}
    />
  );
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
  size?: "xs" | "sm" | "md" | "lg";
  createdAt: Date;
  isNewest?: boolean;
  fitPlot?: boolean;
}

const sizeClasses = {
  xs: "size-14",
  sm: "size-16",
  md: "size-20",
  lg: "size-24",
};

const getPlantTitle = (
  isPrivate: boolean,
  isMostRecent: boolean,
  mood: MoodGrade
) => {
  const recency = isMostRecent ? "Most recently planted · " : "";
  return isPrivate
    ? `${recency}Private journal`
    : `${recency}Feeling: ${moodLabels[mood]}`;
};

const getJournalAriaLabel = (isMostRecent: boolean, mood: MoodGrade) =>
  `Open ${isMostRecent ? "most recently planted " : ""}${moodLabels[mood]} journal`;

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
  size = "md",
  createdAt,
  isNewest = false,
  fitPlot = false,
}: GardenFlowerProps) => {
  const safeFlowerId = flowerId && Number.isFinite(flowerId) && flowerId > 0 ? Math.floor(flowerId) : 1;
  const isPrivate = visibility === "private";

  const [isOpen, setIsOpen] = useState(false);

  const flower = (
    <div
      className={cn(
        "garden-plant island-flower relative z-10 flex items-center justify-center transition-transform duration-300 hover:scale-110",
        "cursor-pointer",
        fitPlot ? "aspect-square w-full" : sizeClasses[size]
      )}
      title={getPlantTitle(isPrivate, isNewest, mood)}
    >
      <PlantSprite flowerId={safeFlowerId} mood={mood} />
      {isPrivate ? (
        <span
          className="absolute -right-1 -top-1 z-20 inline-flex size-5 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm"
          role="img"
          aria-label="Private journal"
        >
          <LockKeyIcon className="size-3" weight="fill" />
        </span>
      ) : null}
    </div>
  );

  if (isPrivate) return (
    <button
      type="button"
      className={fitPlot ? "block w-full" : undefined}
      aria-label={isNewest ? "Most recently planted private journal plant" : "Private journal plant"}
      onClick={() => playGardenSound("click")}
    >
      {flower}
    </button>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger
        onClick={() => playGardenSound("click")}
        className={fitPlot ? "block w-full" : undefined}
        aria-label={getJournalAriaLabel(isNewest, mood)}
      >
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
              <PlantSprite flowerId={safeFlowerId} mood={mood} />
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
