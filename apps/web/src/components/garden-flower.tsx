"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog"
import { formatDistanceToNow } from "date-fns";
import { Badge } from "./ui/badge";
import { cn } from "@/lib/utils";

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
  postId?: string;
  text: string;
  size?: "xs" | "sm" | "md" | "lg";
  createdAt: Date
}

export const GardenFlower = ({
  flowerId,
  mood,
  text,
  size = "md",
  createdAt,
}: GardenFlowerProps) => {
  const color = moodToColor[mood];
  const safeFlowerId = flowerId && flowerId > 0 ? flowerId : 1;

  const sizeClasses = {
    xs: "size-10",
    sm: "size-11",
    md: "size-16",
    lg: "size-20",
  };

  const [flowerSvg, setFlowerSvg] = useState<string | null>(null);

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

  return (
    <Dialog>
      <DialogTrigger>
        <div
          className={cn("garden-plant island-flower relative z-10 flex cursor-pointer items-center justify-center", sizeClasses[size])}
          title={`Feeling: ${moodLabels[mood]}`}
        >
          <div
            className="w-full h-full"
            dangerouslySetInnerHTML={{ __html: flowerSvg }}
          />
        </div>
      </DialogTrigger>
      <DialogContent>
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
          <div className="col-span-2">
            {text}
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(createdAt), {
                addSuffix: true,
              })}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
