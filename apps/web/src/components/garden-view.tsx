"use client";

import { useState, type CSSProperties } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";

import { api } from "@puma-brain/backend/convex/_generated/api";
import { IslandGardenSkeleton } from "./island-garden-skeleton";
import { IslandGarden } from "./island-garden";
import { PeriodToggle, type PeriodView } from "./period-toggle";
import { Skeleton } from "./ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { getCalendarDate } from "@/lib/calendar-date";
import { gardenThemeColors } from "@/lib/garden-theme";

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const GardenView = () => {
  const params = useParams();
  const userId = params.id as string;
  const today = new Date();
  const currentYear = today.getFullYear();
  const [view, setView] = useState<PeriodView>("month");
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const userPosts = useQuery(api.posts.getByUserId, userId ? { userId } : "skip");
  const gardenTheme = useQuery(
    api.preferences.getGardenTheme,
    userId ? { userId } : "skip"
  );

  const sortedPosts = [...(userPosts ?? [])].sort((a, b) => a._creationTime - b._creationTime);
  const years = new Set(
    sortedPosts.map(
      (post) => getCalendarDate(post._creationTime, post.entryDate).year
    )
  );
  years.add(currentYear);
  const yearOptions = [...years].sort((a, b) => b - a);
  const visiblePosts = sortedPosts.filter((post) => {
    const date = getCalendarDate(post._creationTime, post.entryDate);
    return date.year === selectedYear && (view === "year" || date.month === selectedMonth);
  });

  if (!userId) return null;

  if (userPosts === undefined || gardenTheme === undefined) {
    return (
      <div
        className="paper-card rounded-3xl border border-primary/10 bg-card/75 p-5 sm:p-7"
        role="status"
        aria-label="Loading garden"
      >
        <div aria-hidden="true" className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <Skeleton className="h-4 w-48 max-w-full motion-reduce:animate-none" />
          <Skeleton className="h-9 w-40 motion-reduce:animate-none" />
        </div>
        <div aria-hidden="true" className="mb-5 flex flex-wrap items-center gap-2">
          <Skeleton className="h-9 w-36 motion-reduce:animate-none" />
          <Skeleton className="h-9 w-28 motion-reduce:animate-none" />
          <Skeleton className="ml-auto h-4 w-16 motion-reduce:animate-none" />
        </div>
        <IslandGardenSkeleton />
        <span className="sr-only">Growing your garden…</span>
      </div>
    );
  }

  const periodLabel = view === "month" ? `${monthNames[selectedMonth]} ${selectedYear}` : selectedYear.toString();

  return (
    <section
      className="board-tint paper-card rounded-3xl border border-primary/10 bg-card/75 p-5 sm:p-7"
      style={{ "--board-color": gardenThemeColors[gardenTheme] } as CSSProperties}
    >
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="board-eyebrow text-xs font-bold uppercase tracking-[0.16em]">Your garden · {periodLabel}</p>
        </div>
        <PeriodToggle value={view} onChange={setView} />
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {view === "month" ? (
          <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(Number(value))}>
            <SelectTrigger className="min-w-36"><SelectValue>{() => monthNames[selectedMonth]}</SelectValue></SelectTrigger>
            <SelectContent>{monthNames.map((month, index) => <SelectItem key={month} value={index.toString()} label={month}>{month}</SelectItem>)}</SelectContent>
          </Select>
        ) : null}
        <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(Number(value))}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>{yearOptions.map((year) => <SelectItem key={year} value={year.toString()}>{year}</SelectItem>)}</SelectContent>
        </Select>
        <span className="board-copy ml-auto text-xs font-medium">{visiblePosts.length} {visiblePosts.length === 1 ? "flower" : "flowers"}</span>
      </div>

      {visiblePosts.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-primary/20 bg-background/40 py-12 text-center text-muted-foreground">
          <div className="mb-2 text-3xl">🌱</div>
          <p>Nothing planted in {periodLabel} yet.</p>
        </div>
      ) : (
        <IslandGarden posts={visiblePosts} />
      )}
    </section>
  );
};
