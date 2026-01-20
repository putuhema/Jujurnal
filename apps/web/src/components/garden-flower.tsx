"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTrigger,
} from "@/components/ui/dialog"
import { formatDistanceToNow } from "date-fns";
import { Badge } from "./ui/badge";

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
  "A+": "#216e39", // dark green
  A: "#30a14e", // green
  "A-": "#40c463", // light green
  "B+": "#9be9a8", // very light green
  B: "#9be9a8",
  "B-": "#9be9a8",
  "C+": "#ffec44", // yellow
  C: "#ffec44",
  "C-": "#ffec44",
  "D+": "#fd7e14", // orange
  D: "#fd7e14",
  "D-": "#fd7e14",
  F: "#d73a4a", // red
};

interface GardenFlowerProps {
  flowerId?: number; // 1-12 (falls back to 1)
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
    xs: "w-6 h-6",
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
  };

  const [flowerSvg, setFlowerSvg] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/flower/${safeFlowerId}.svg`)
      .then((res) => {
        if (!res.ok) throw new Error(`Missing flower ${safeFlowerId}`);
        return res.text();
      })
      .then((svg) => {
        let coloredSvg = svg.replace(/#0012D4/g, color);
        coloredSvg = coloredSvg.replace(/width="[^"]*"/g, '');
        coloredSvg = coloredSvg.replace(/height="[^"]*"/g, '');
        coloredSvg = coloredSvg.replace('<svg', '<svg class="w-full h-full"');
        setFlowerSvg(coloredSvg);
      })
      .catch(() => {
        fetch(`/flower/1.svg`)
          .then((res) => {
            if (!res.ok) throw new Error("Missing flower 1");
            return res.text();
          })
          .then((svg) => {
            let coloredSvg = svg.replace(/#0012D4/g, color);
            coloredSvg = coloredSvg.replace(/width="[^"]*"/g, '');
            coloredSvg = coloredSvg.replace(/height="[^"]*"/g, '');
            coloredSvg = coloredSvg.replace('<svg', '<svg class="w-full h-full"');
            setFlowerSvg(coloredSvg);
          });
      });
  }, [safeFlowerId, color]);

  if (!flowerSvg) {
    return (
      <div
        className={`${sizeClasses[size]} flex items-center justify-center border border-dashed rounded`}
      >
        <div className="w-4 h-4 border-2 border-muted-foreground rounded-full animate-pulse" />
      </div>
    );
  }

  return (
    <Dialog>
      <DialogTrigger>
        <div
          className={`${sizeClasses[size]} relative cursor-pointer transition-transform hover:scale-110 flex items-center justify-center`}
          title={`Mood: ${mood}`}
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
              className="w-20 h-20 relative cursor-pointer transition-transform hover:scale-110 flex items-center justify-center"
              title={`Mood: ${mood}`}
            >
              <div
                className="w-full h-full"
                dangerouslySetInnerHTML={{ __html: flowerSvg }}
              />
            </div>
            <div className="absolute bottom-0 right-0">
              <Badge variant="outline">{mood}</Badge>
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
