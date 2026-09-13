"use client";

import { useQuery } from "convex/react";
import { LeafIcon, PlantIcon } from "@phosphor-icons/react";

import { api } from "@puma-brain/backend/convex/_generated/api";
import { getBrowserTimeZone } from "@/lib/calendar-date";
import { Skeleton } from "./ui/skeleton";

type MoodGrade =
  | "A+" | "A" | "A-"
  | "B+" | "B" | "B-"
  | "C+" | "C" | "C-"
  | "D+" | "D" | "D-"
  | "F";

type WeeklyRecapData = {
  today: string;
  weekStart: string;
  weekEnd: string;
  postCount: number;
  previousPostCount: number;
  averageMood: MoodGrade | null;
  moodTrend: "lighter" | "heavier" | "steady" | null;
  days: Array<{ date: string; mood: MoodGrade | null }>;
};

const dayLabels = ["M", "T", "W", "T", "F", "S", "S"];
const monthNames = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const moodLabels: Record<MoodGrade, string> = {
  "A+": "Sunlit", A: "Bright", "A-": "Bright",
  "B+": "Growing", B: "Growing", "B-": "Growing",
  "C+": "Steady", C: "Steady", "C-": "Steady",
  "D+": "Low tide", D: "Low tide", "D-": "Low tide", F: "Heavy",
};
const moodColors: Record<MoodGrade, string> = {
  "A+": "bg-emerald-700/75 text-white", A: "bg-emerald-600/65 text-white", "A-": "bg-emerald-500/55 text-emerald-950",
  "B+": "bg-lime-500/50 text-lime-950", B: "bg-lime-500/50 text-lime-950", "B-": "bg-lime-500/50 text-lime-950",
  "C+": "bg-amber-300/70 text-amber-950", C: "bg-amber-300/70 text-amber-950", "C-": "bg-amber-300/70 text-amber-950",
  "D+": "bg-orange-300/70 text-orange-950", D: "bg-orange-300/70 text-orange-950", "D-": "bg-orange-300/70 text-orange-950", F: "bg-rose-400/60 text-rose-950",
};

const formatDate = (date: string) => {
  const [, month, day] = date.split("-").map(Number);
  return `${monthNames[month - 1]} ${day}`;
};

const getReflectionPrompt = (
  postCount: number,
  moodTrend: "lighter" | "heavier" | "steady" | null
) => {
  if (postCount === 0) return "What has been taking up space in your mind?";
  if (postCount < 3) return "What felt different on the days you made room to write?";
  if (moodTrend === "lighter") return "What helped this week feel a little lighter?";
  if (moodTrend === "heavier") return "What asked more of you this week?";
  return "What kept you grounded this week?";
};

const getRhythmLabel = (postCount: number, previousPostCount: number) => {
  const difference = postCount - previousPostCount;
  if (previousPostCount === 0 && postCount > 0) return "A fresh week in bloom";
  if (difference > 0) return `${difference} more than last week`;
  if (difference < 0) return `${Math.abs(difference)} fewer than last week`;
  return postCount === 0 ? "A quiet week so far" : "Same rhythm as last week";
};

const WeeklyRecapLoading = () => (
  <section className="paper-card mb-4 rounded-3xl border border-primary/10 bg-card/75 p-5 sm:p-7">
    <div className="mb-6 flex items-center justify-between gap-4">
      <Skeleton className="h-4 w-36" />
      <Skeleton className="h-4 w-24" />
    </div>
    <Skeleton className="mb-5 h-8 w-64" />
    <div className="grid grid-cols-7 gap-2">
      {dayLabels.map((day, index) => (
        <Skeleton key={`${day}-${index}`} className="mx-auto size-10 rounded-full" />
      ))}
    </div>
  </section>
);

export const WeeklyRecapCard = ({ recap }: { recap: WeeklyRecapData }) => {
  const feeling = recap.averageMood
    ? moodLabels[recap.averageMood]
    : "Waiting to grow";
  const headline = recap.postCount === 0
    ? "A quiet patch, ready when you are."
    : recap.postCount === 1
      ? "One thoughtful moment took root."
      : `${recap.postCount} moments took root this week.`;

  return (
    <section className="paper-card relative mb-4 overflow-hidden rounded-3xl border border-primary/10 bg-card/75 p-5 sm:p-7">
      <span aria-hidden="true" className="absolute -right-5 -top-8 rotate-12 text-[7rem] leading-none text-primary/[0.055]">❧</span>

      <div className="relative">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.16em] text-primary">
            <LeafIcon weight="fill" />
            This week in your garden
          </p>
          <p className="text-xs font-medium text-muted-foreground">
            {formatDate(recap.weekStart)}–{formatDate(recap.weekEnd)}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-[1.35fr_0.65fr] md:items-end">
          <div>
            <h2 className="font-display text-2xl tracking-[-0.035em] sm:text-3xl">
              {headline}
            </h2>

            <div className="mt-5 grid grid-cols-7 gap-1.5 sm:gap-2">
              {recap.days.map((day, index) => {
                const mood = day.mood;
                const isFuture = day.date > recap.today;
                return (
                  <div key={day.date} className="text-center">
                    <span className="mb-1.5 block text-[10px] font-bold text-muted-foreground">
                      {dayLabels[index]}
                    </span>
                    <div
                      title={mood ? `${formatDate(day.date)} · ${moodLabels[mood]}` : formatDate(day.date)}
                      className={`mx-auto flex size-9 items-center justify-center rounded-full border sm:size-10 ${
                        mood
                          ? `${moodColors[mood]} border-transparent shadow-sm`
                          : isFuture
                            ? "border-dashed border-border/50 bg-transparent text-muted-foreground/30"
                            : "border-border/70 bg-background/45 text-muted-foreground/45"
                      }`}
                    >
                      {mood ? <PlantIcon className="size-4" weight="fill" /> : <span className="size-1 rounded-full bg-current" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-dashed border-primary/20 bg-background/35 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">A question to carry</p>
            <p className="mt-2 font-display text-lg leading-snug">
              {getReflectionPrompt(recap.postCount, recap.moodTrend)}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t border-dashed border-primary/15 pt-4 text-xs">
          <p><span className="font-bold text-foreground">{feeling}</span> <span className="text-muted-foreground">overall feeling</span></p>
          <p><span className="font-bold text-foreground">{recap.postCount}/7</span> <span className="text-muted-foreground">days planted</span></p>
          <p className="text-muted-foreground">{getRhythmLabel(recap.postCount, recap.previousPostCount)}</p>
        </div>
      </div>
    </section>
  );
};

export const WeeklyRecap = () => {
  const recap = useQuery(api.mood.getWeeklyRecap, {
    timeZone: getBrowserTimeZone(),
  });

  if (recap === undefined) return <WeeklyRecapLoading />;
  if (recap === null) return null;

  return <WeeklyRecapCard recap={recap} />;
};
