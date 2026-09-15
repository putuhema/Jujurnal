"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { X } from "lucide-react";
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
  const { column, row, anchorX, anchorY } = getPlantSpriteFrame(flowerId);
  const spriteRef = useRef<HTMLSpanElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const origin = `${anchorX}% ${anchorY}%`;

  useEffect(() => {
    const element = spriteRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => {
      setIsVisible(entry.isIntersecting);
    }, { threshold: 0.1 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <span ref={spriteRef} aria-hidden="true" className="plant-sprite block size-full" data-visible={isVisible && isLoaded}>
      <span className="plant-growth block size-full" style={{ transformOrigin: origin }}>
        <span
          className="plant-sway relative block size-full overflow-hidden"
          style={{
            transformOrigin: origin,
            animationDuration: `${3.2 + (flowerId % 7) * 0.2}s`,
            animationDelay: `${-(flowerId % 11) * 0.4}s`,
            filter: `grayscale(${moodGrayscale[mood]})`,
          }}
        >
          <img
            src="/plants-sprite.webp"
            alt=""
            draggable={false}
            onLoad={() => setIsLoaded(true)}
            className="pointer-events-none absolute max-w-none select-none"
            style={{
              width: "1400%",
              height: "700%",
              left: `${-column * 100}%`,
              top: `${-row * 100}%`,
              imageRendering: "pixelated",
            }}
          />
        </span>
      </span>
    </span>
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

const JournalTypewriter = ({ text }: { text: string }) => {
  const characters = Array.from(text);
  const [visibleCount, setVisibleCount] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const finished = showAll || visibleCount >= characters.length;

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const revealForReducedMotion = () => {
      if (preference.matches) setShowAll(true);
    };
    revealForReducedMotion();
    preference.addEventListener("change", revealForReducedMotion);
    return () => preference.removeEventListener("change", revealForReducedMotion);
  }, []);

  useEffect(() => {
    if (finished) return;
    const timer = window.setInterval(() => {
      setVisibleCount((count) => Math.min(count + 1, characters.length));
    }, 18);
    return () => window.clearInterval(timer);
  }, [characters.length, finished]);

  return (
    <div>
      <p className="sr-only">{text}</p>
      <div aria-hidden="true" className="grid whitespace-pre-wrap break-words leading-relaxed [overflow-wrap:anywhere]">
        <span className="invisible col-start-1 row-start-1">{text}</span>
        <span className="col-start-1 row-start-1">
          {finished ? text : characters.slice(0, visibleCount).join("")}
        </span>
      </div>
      {!finished ? (
        <button type="button" onClick={() => setShowAll(true)} className="mt-2 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">
          Show all
        </button>
      ) : null}
    </div>
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
  const { anchorX, anchorY } = getPlantSpriteFrame(safeFlowerId);
  const isPrivate = visibility === "private";

  const [isOpen, setIsOpen] = useState(false);

  const flower = (
    <div
      className={cn(
        "garden-plant island-flower relative z-10 flex items-center justify-center transition-transform duration-300 hover:scale-110",
        "cursor-pointer",
        fitPlot ? "aspect-square w-full" : sizeClasses[size]
      )}
      style={{ transformOrigin: `${anchorX}% ${anchorY}%` }}
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
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger
        onClick={() => playGardenSound("click")}
        className={fitPlot ? "block w-full" : undefined}
        aria-label={getJournalAriaLabel(isNewest, mood)}
      >
        {flower}
      </PopoverTrigger>
      <PopoverContent
        side="top"
        sideOffset={12}
        className="relative w-72 max-w-[calc(100vw-2rem)] gap-3 rounded-2xl border border-primary/20 bg-card p-4 text-card-foreground shadow-xl motion-reduce:animate-none"
      >
        <PopoverPrimitive.Arrow className="absolute h-3 w-6 text-card data-[side=top]:-bottom-[10px] data-[side=bottom]:-top-[10px] data-[side=bottom]:rotate-180">
          <svg viewBox="0 0 24 12" className="size-full" aria-hidden="true">
            <path d="M0 0 12 11 24 0" fill="currentColor" />
            <path d="m0 0 12 11 12-11" fill="none" className="stroke-primary/20" />
          </svg>
        </PopoverPrimitive.Arrow>
        <div className="flex items-center justify-between gap-3">
          <PopoverTitle className="sr-only">Journal plant</PopoverTitle>
          <Badge variant="outline" className="rounded-full">{moodLabels[mood]}</Badge>
          <PopoverPrimitive.Close aria-label="Close journal bubble" className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">
            <X className="size-4" aria-hidden="true" />
          </PopoverPrimitive.Close>
        </div>
        <div className="max-h-[min(45vh,20rem)] overflow-y-auto">
          {isOpen ? <JournalTypewriter key={text} text={text} /> : null}
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-2">
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(createdAt), { addSuffix: true })}
          </span>
          <PlantReaction postId={postId} isOpen={isOpen} />
        </div>
      </PopoverContent>
    </Popover>
  );
};
