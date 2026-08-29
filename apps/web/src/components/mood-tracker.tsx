"use client";

import { api } from "@puma-brain/backend/convex/_generated/api";
import { useQuery } from "convex/react";
import { useState, useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Skeleton } from "./ui/skeleton";

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

const moodColors: Record<MoodGrade, string> = {
  "A+": "bg-emerald-700/75",
  A: "bg-emerald-600/65",
  "A-": "bg-emerald-500/55",
  "B+": "bg-lime-500/45",
  B: "bg-lime-500/45",
  "B-": "bg-lime-500/45",
  "C+": "bg-amber-300/60",
  C: "bg-amber-300/60",
  "C-": "bg-amber-300/60",
  "D+": "bg-orange-300/60",
  D: "bg-orange-300/60",
  "D-": "bg-orange-300/60",
  F: "bg-rose-400/55",
};

const moodLabels: Record<MoodGrade, string> = {
  "A+": "Sunlit",
  A: "Bright",
  "A-": "Bright",
  "B+": "Growing",
  B: "Growing",
  "B-": "Growing",
  "C+": "Steady",
  C: "Steady",
  "C-": "Steady",
  "D+": "Low tide",
  D: "Low tide",
  "D-": "Low tide",
  F: "Heavy",
};

const months = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const daysInMonth = (month: number, year: number): number => {
  return new Date(year, month + 1, 0).getDate();
};

const gradeToNumber = (grade: MoodGrade): number => {
  const gradeMap: Record<MoodGrade, number> = {
    "A+": 13,
    A: 12,
    "A-": 11,
    "B+": 10,
    B: 9,
    "B-": 8,
    "C+": 7,
    C: 6,
    "C-": 5,
    "D+": 4,
    D: 3,
    "D-": 2,
    F: 1,
  };
  return gradeMap[grade];
};

const numberToGrade = (num: number): MoodGrade => {
  if (num >= 12.5) return "A+";
  if (num >= 11.5) return "A";
  if (num >= 10.5) return "A-";
  if (num >= 9.5) return "B+";
  if (num >= 8.5) return "B";
  if (num >= 7.5) return "B-";
  if (num >= 6.5) return "C+";
  if (num >= 5.5) return "C";
  if (num >= 4.5) return "C-";
  if (num >= 3.5) return "D+";
  if (num >= 2.5) return "D";
  if (num >= 1.5) return "D-";
  return "F";
};

export const MoodTracker = () => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const moodData = useQuery(api.mood.getYearMoodData, {
    year: selectedYear,
  });

  const moodMap = useMemo(() => {
    if (!moodData) return new Map<string, MoodGrade>();
    const map = new Map<string, MoodGrade>();
    for (const item of moodData) {
      map.set(item.date, item.mood);
    }
    return map;
  }, [moodData]);

  const stats = useMemo(() => {
    if (!moodData) return null;

    const counts: Record<MoodGrade, number> = {
      "A+": 0,
      A: 0,
      "A-": 0,
      "B+": 0,
      B: 0,
      "B-": 0,
      "C+": 0,
      C: 0,
      "C-": 0,
      "D+": 0,
      D: 0,
      "D-": 0,
      F: 0,
    };

    for (const item of moodData) {
      counts[item.mood]++;
    }

    const total = moodData.length;
    const displayGrades: MoodGrade[] = ["A+", "A", "B", "C", "D", "F"];

    return {
      counts,
      total,
      displayGrades: displayGrades.map((grade) => {
        let count = 0;
        if (grade === "A+") count = counts["A+"];
        else if (grade === "A") count = counts["A"] + counts["A-"];
        else if (grade === "B")
          count = counts["B+"] + counts["B"] + counts["B-"];
        else if (grade === "C")
          count = counts["C+"] + counts["C"] + counts["C-"];
        else if (grade === "D")
          count = counts["D+"] + counts["D"] + counts["D-"];
        else if (grade === "F") count = counts["F"];

        return {
          grade,
          count,
          percentage: total > 0 ? (count / total) * 100 : 0,
        };
      }),
    };
  }, [moodData]);

  const monthlyAverages = useMemo(() => {
    if (!moodData) return null;

    const monthData: Record<number, MoodGrade[]> = {};

    for (const item of moodData) {
      const [year, month, day] = item.date.split("-").map(Number);
      if (month) {
        if (!monthData[month - 1]) {
          monthData[month - 1] = [];
        }
        monthData[month - 1].push(item.mood);
      }
    }

    const averages: (MoodGrade | null)[] = [];
    for (let month = 0; month < 12; month++) {
      const moods = monthData[month] || [];
      if (moods.length === 0) {
        averages.push(null);
      } else {
        const avg =
          moods.reduce((sum, mood) => sum + gradeToNumber(mood), 0) /
          moods.length;
        averages.push(numberToGrade(avg));
      }
    }

    return averages;
  }, [moodData]);

  const yearOptions = useMemo(() => {
    const years = [];
    for (let year = currentYear; year >= 2020; year--) {
      years.push(year);
    }
    return years;
  }, [currentYear]);

  if (!moodData) {
    return (
      <div className='space-y-4'>
        <Skeleton className="w-[120px] h-10 ml-auto" />

        <div className="overflow-x-auto w-full">
          <div className="inline-block min-w-full">
            <div className="flex gap-1 md:gap-2">
              <div className="flex flex-col gap-1">
                <div className="h-4 md:h-8"></div>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                  <div
                    key={day}
                    className="h-4 md:h-8 text-xs md:text-base text-muted-foreground text-right leading-4 md:leading-8"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {months.map((month, monthIndex) => (
                <div key={month} className="flex flex-col gap-1 w-full">
                  <Skeleton className="h-4 md:h-8 w-full" />

                  {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                    <Skeleton
                      key={day}
                      className="w-full h-4 md:h-8 rounded-sm"
                    />
                  ))}

                </div>
              ))}
            </div>

            <div className="flex gap-8 mt-6 flex-wrap">
              <div className="flex-1 min-w-[300px]">
                <Skeleton className="h-5 w-20 mb-3" />
                <div className="space-y-2">
                  {["A+", "A", "B", "C", "D", "F"].map((grade) => (
                    <div key={grade} className="flex items-center gap-3">
                      <Skeleton className="w-12 h-4" />
                      <div className="flex-1 flex items-center gap-2">
                        <Skeleton className="flex-1 h-2 rounded-full" />
                        <Skeleton className="w-20 h-4" />
                        <Skeleton className="w-16 h-4" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="min-w-[250px]">
                <Skeleton className="h-5 w-20 mb-3" />
                <div className="space-y-2">
                  {["A+", "A", "B", "C", "D", "F"].map((grade) => (
                    <div key={grade} className="flex items-center gap-2">
                      <Skeleton className="w-4 h-4 rounded-sm" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className='paper-card rounded-3xl border border-primary/10 bg-card/75 p-5 sm:p-7'>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">A year in feelings</p><h2 className="mt-1 font-display text-3xl tracking-[-0.035em]">Your weather, softly seen.</h2></div>
      <Select
        value={selectedYear.toString()}
        onValueChange={(value) => setSelectedYear(Number(value))}
      >
        <SelectTrigger className="w-[120px] ml-auto">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {yearOptions.map((year) => (
            <SelectItem key={year} value={year.toString()}>
              {year}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      </div>

      <div>

        <div className="overflow-x-auto w-full">
          <div className="inline-block min-w-full">
            <div className="flex gap-1 md:gap-2">
              <div className="flex flex-col gap-1">
                <div className="h-4 md:h-8"></div>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                  <div
                    key={day}
                    className="h-4 md:h-8 text-xs md:text-base text-muted-foreground text-right leading-4 md:leading-8"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {months.map((month, monthIndex) => {
                const daysInThisMonth = daysInMonth(monthIndex, selectedYear);
                return (
                  <div key={month} className="flex flex-col gap-1 w-full">
                    <div className="h-4 md:h-8 text-xs md:text-base text-muted-foreground text-center leading-4 md:leading-8">
                      {month}
                    </div>

                    {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
                      if (day > daysInThisMonth) {
                        return (
                          <div
                            key={day}
                            className="w-full h-4 md:h-8 rounded-sm bg-muted"
                          />
                        );
                      }

                      const dateStr = `${selectedYear}-${String(
                        monthIndex + 1
                      ).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                      const mood = moodMap.get(dateStr);

                      if (!mood) {
                        return (
                          <div
                            key={day}
                            className="w-full h-4 md:h-8 rounded-sm bg-muted border border-border"
                            title={`${month} ${day} - No data`}
                          />
                        );
                      }

                      return (
                        <div
                          key={day}
                          className={`h-4 w-full rounded-sm ${moodColors[mood]} cursor-pointer transition-shadow hover:ring-2 hover:ring-ring/40 hover:ring-offset-1`}
                          title={`${month} ${day} · ${moodLabels[mood]}`}
                        />
                      );
                    })}

                    <div className="flex h-8 items-center justify-center pt-1">
                      {monthlyAverages?.[monthIndex] && <span className={`size-2.5 rounded-full ${moodColors[monthlyAverages[monthIndex]!]}`} title={`${month} felt ${moodLabels[monthlyAverages[monthIndex]!]}`} />}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-8 mt-6 flex-wrap">
              {stats && (
                <div className="flex-1 min-w-[300px]">
                  <h3 className="text-sm font-semibold mb-3">The shape of your year</h3>
                  <div className="space-y-2">
                    {stats.displayGrades.map(({ grade, count, percentage }) => (
                      <div key={grade} className="flex items-center gap-3">
                        <div className="w-16 text-xs text-muted-foreground">
                          {moodLabels[grade]}
                        </div>
                        <div className="flex-1 flex items-center gap-2">
                          <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full ${moodColors[grade]}`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <div className="w-20 text-xs text-right">
                            {String(count).padStart(3, "0")} Days
                          </div>
                          <div className="w-16 text-xs text-muted-foreground text-right">
                            {percentage.toFixed(2)}%
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="min-w-[250px]">
                <h3 className="text-sm font-semibold mb-3">Color key</h3>
                <div className="space-y-2">
                  {(["A+", "A", "B", "C", "D", "F"] as MoodGrade[]).map(
                    (grade) => (
                      <div key={grade} className="flex items-center gap-2">
                        <div
                          className={`size-4 rounded-full ${moodColors[grade]}`}
                        />
                        <div className="text-xs text-muted-foreground">
                          {moodLabels[grade]}
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};
