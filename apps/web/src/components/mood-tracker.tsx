"use client";

import { useState } from "react";
import { useQuery } from "convex/react";

import { api } from "@puma-brain/backend/convex/_generated/api";
import { PeriodToggle, type PeriodView } from "./period-toggle";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Skeleton } from "./ui/skeleton";
import { getBrowserTimeZone } from "@/lib/calendar-date";

type MoodGrade =
  | "A+" | "A" | "A-"
  | "B+" | "B" | "B-"
  | "C+" | "C" | "C-"
  | "D+" | "D" | "D-"
  | "F";

const moodColors: Record<MoodGrade, string> = {
  "A+": "bg-emerald-700/75", A: "bg-emerald-600/65", "A-": "bg-emerald-500/55",
  "B+": "bg-lime-500/45", B: "bg-lime-500/45", "B-": "bg-lime-500/45",
  "C+": "bg-amber-300/60", C: "bg-amber-300/60", "C-": "bg-amber-300/60",
  "D+": "bg-orange-300/60", D: "bg-orange-300/60", "D-": "bg-orange-300/60", F: "bg-rose-400/55",
};

const moodLabels: Record<MoodGrade, string> = {
  "A+": "Sunlit", A: "Bright", "A-": "Bright", "B+": "Growing", B: "Growing", "B-": "Growing",
  "C+": "Steady", C: "Steady", "C-": "Steady", "D+": "Low tide", D: "Low tide", "D-": "Low tide", F: "Heavy",
};

const gradeScale: MoodGrade[] = ["F", "D-", "D", "D+", "C-", "C", "C+", "B-", "B", "B+", "A-", "A", "A+"];
const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const shortMonths = monthNames.map((month) => month.slice(0, 3));
const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const moodStatRows = 6;

const gradeToNumber = (grade: MoodGrade) => gradeScale.indexOf(grade) + 1;
const numberToGrade = (value: number): MoodGrade =>
  gradeScale[Math.max(0, Math.min(gradeScale.length - 1, Math.round(value) - 1))];

const MoodTrackerLoading = ({
  selectedYear,
  selectedMonth,
}: {
  selectedYear: number;
  selectedMonth: number;
}) => {
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const leadingDays = new Date(selectedYear, selectedMonth, 1).getDay();

  return (
    <section
      className="paper-card rounded-3xl border border-primary/10 bg-card/75 p-5 sm:p-7"
      role="status"
      aria-live="polite"
      aria-label="Loading mood tracker"
    >
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <Skeleton className="h-3 w-36 rounded-full bg-primary/10" />
        <div className="flex h-9 w-36 items-center gap-1 rounded-full border border-border/60 bg-muted/45 p-1">
          <Skeleton className="h-7 flex-1 rounded-full bg-background/80" />
          <Skeleton className="h-7 flex-1 rounded-full bg-primary/8" />
        </div>
      </div>

      <div className="mb-6 flex gap-2">
        <Skeleton className="h-9 w-36 rounded-full bg-primary/10" />
        <Skeleton className="h-9 w-28 rounded-full bg-primary/10" />
      </div>

      <div className="rounded-3xl border border-border/70 bg-background/35 p-3 sm:p-5">
        <div className="mb-2 grid grid-cols-7 gap-1">
          {weekDays.map((day) => (
            <div key={day} className="flex justify-center py-1">
              <Skeleton className="h-3 w-7 rounded-full bg-muted/70" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {Array.from({ length: leadingDays }, (_, index) => (
            <div key={`loading-blank-${index}`} />
          ))}
          {Array.from({ length: daysInMonth }, (_, index) => (
            <Skeleton
              key={`loading-day-${index}`}
              className="aspect-square rounded-xl border border-border/35 bg-muted/45"
            />
          ))}
        </div>
      </div>

      <div className="mt-7">
        <Skeleton className="mb-3 h-5 w-40 rounded-full bg-primary/10" />
        <div className="space-y-2">
          {Array.from({ length: moodStatRows }, (_, index) => (
            <div key={`loading-stat-${index}`} className="flex items-center gap-3">
              <Skeleton className="h-3 w-16 shrink-0 rounded-full bg-muted/70" />
              <Skeleton className="h-2 flex-1 rounded-full bg-muted/70" />
              <Skeleton className="h-3 w-12 shrink-0 rounded-full bg-muted/70" />
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">Preparing your monthly mood garden…</span>
    </section>
  );
};

export const MoodTracker = () => {
  const today = new Date();
  const timeZone = getBrowserTimeZone();
  const currentYear = today.getFullYear();
  const [view, setView] = useState<PeriodView>("month");
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const moodData = useQuery(api.mood.getYearMoodData, {
    year: selectedYear,
    timeZone,
  });

  const yearOptions = Array.from({ length: currentYear - 2019 }, (_, index) => currentYear - index);
  const moodMap = new Map<string, MoodGrade>();
  for (const item of moodData ?? []) moodMap.set(item.date, item.mood);
  const monthPrefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-`;
  const visibleMoodData = view === "year"
    ? (moodData ?? [])
    : (moodData ?? []).filter((item) => item.date.startsWith(monthPrefix));
  const stats = (() => {
    const groups = ["A+", "A", "B", "C", "D", "F"] as const;
    const counts = Object.fromEntries(groups.map((grade) => [grade, 0])) as Record<(typeof groups)[number], number>;
    for (const item of visibleMoodData) {
      const group = item.mood === "A+" || item.mood === "F"
        ? item.mood
        : (item.mood[0] as "A" | "B" | "C" | "D");
      counts[group] += 1;
    }
    return groups.map((grade) => ({
      grade,
      count: counts[grade],
      percentage: visibleMoodData.length ? (counts[grade] / visibleMoodData.length) * 100 : 0,
    }));
  })();
  const monthlyAverages = monthNames.map((_, monthIndex) => {
    const prefix = `${selectedYear}-${String(monthIndex + 1).padStart(2, "0")}-`;
    const moods = (moodData ?? []).filter((item) => item.date.startsWith(prefix));
    if (!moods.length) return null;
    return numberToGrade(moods.reduce((sum, item) => sum + gradeToNumber(item.mood), 0) / moods.length);
  });

  if (moodData === undefined) {
    return (
      <MoodTrackerLoading
        selectedYear={selectedYear}
        selectedMonth={selectedMonth}
      />
    );
  }

  const daysInSelectedMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const leadingDays = new Date(selectedYear, selectedMonth, 1).getDay();
  const periodLabel = view === "month" ? monthNames[selectedMonth] : selectedYear.toString();

  return (
    <section className="paper-card rounded-3xl border border-primary/10 bg-card/75 p-5 sm:p-7">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">{periodLabel} in feelings</p>
        </div>
        <PeriodToggle value={view} onChange={setView} />
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
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
      </div>

      {view === "month" ? (
        <div className="rounded-3xl border border-border/70 bg-background/35 p-3 sm:p-5">
          <div className="mb-2 grid grid-cols-7 gap-1">
            {weekDays.map((day) => <div key={day} className="py-1 text-center text-[10px] font-bold uppercase tracking-wide text-muted-foreground sm:text-xs">{day}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {Array.from({ length: leadingDays }, (_, index) => <div key={`blank-${index}`} />)}
            {Array.from({ length: daysInSelectedMonth }, (_, index) => {
              const day = index + 1;
              const date = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const mood = moodMap.get(date);
              return (
                <div
                  key={date}
                  title={mood ? `${monthNames[selectedMonth]} ${day} · ${moodLabels[mood]}` : `${monthNames[selectedMonth]} ${day} · No entry`}
                  className={`flex aspect-square items-center justify-center rounded-xl border text-xs font-medium sm:text-sm ${mood ? `${moodColors[mood]} border-transparent` : "border-border/60 bg-muted/45 text-muted-foreground"}`}
                >
                  {day}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto pb-2">
          <div className="mx-auto grid w-max grid-cols-[repeat(12,1.75rem)] gap-1">
            {shortMonths.map((month, monthIndex) => (
              <div key={month} className="space-y-1">
                <p className="pb-1 text-center text-xs font-semibold text-muted-foreground">{month}</p>
                {Array.from({ length: 31 }, (_, index) => {
                  const day = index + 1;
                  const valid = day <= new Date(selectedYear, monthIndex + 1, 0).getDate();
                  const date = `${selectedYear}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const mood = moodMap.get(date);
                  return <div key={date} title={valid ? (mood ? `${month} ${day} · ${moodLabels[mood]}` : `${month} ${day} · No entry`) : undefined} className={`mx-auto size-6 rounded-full border ${!valid ? "border-transparent bg-muted/30" : mood ? `${moodColors[mood]} border-transparent` : "border-border/60 bg-muted/60"}`} />;
                })}
                <div className="flex h-6 items-center justify-center">{monthlyAverages[monthIndex] ? <span className={`size-2.5 rounded-full ${moodColors[monthlyAverages[monthIndex]!]}`} /> : null}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-7">
        <h3 className="mb-3 text-sm font-semibold">The shape of your {view}</h3>
        <div className="space-y-2">
          {stats.map(({ grade, count, percentage }) => (
            <div key={grade} className="flex items-center gap-3">
              <span className="w-16 text-xs text-muted-foreground">{moodLabels[grade]}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><div className={`h-full ${moodColors[grade]}`} style={{ width: `${percentage}%` }} /></div>
              <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">{count} days</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
