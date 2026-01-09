"use client";

import { api } from "@puma-brain/backend/convex/_generated/api";
import { useQuery } from "convex/react";
import { useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

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
  "A+": "bg-[#216e39] text-white",
  A: "bg-[#30a14e] text-white",
  "A-": "bg-[#40c463] text-white",
  "B+": "bg-[#9be9a8] text-[#216e39]",
  B: "bg-[#9be9a8] text-[#216e39]",
  "B-": "bg-[#9be9a8] text-[#216e39]",
  "C+": "bg-[#ffec44] text-[#8b6914]",
  C: "bg-[#ffec44] text-[#8b6914]",
  "C-": "bg-[#ffec44] text-[#8b6914]",
  "D+": "bg-[#fd7e14] text-white",
  D: "bg-[#fd7e14] text-white",
  "D-": "bg-[#fd7e14] text-white",
  F: "bg-[#d73a4a] text-white",
};

const moodLabels: Record<MoodGrade, string> = {
  "A+": "Positive core memory",
  A: "Very positive",
  "A-": "Very positive",
  "B+": "Positive",
  B: "Positive",
  "B-": "Positive",
  "C+": "Neutral (or the positive offset the negative)",
  C: "Neutral (or the positive offset the negative)",
  "C-": "Neutral (or the positive offset the negative)",
  "D+": "Negative",
  D: "Negative",
  "D-": "Negative",
  F: "Very negative",
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
      <Card>
        <CardHeader>
          <CardTitle>Mood Tracker</CardTitle>
          <CardDescription>Loading mood data...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{selectedYear} Mood Tracker</CardTitle>
            <CardDescription>Your daily mood visualization</CardDescription>
          </div>
          <Select
            value={selectedYear.toString()}
            onValueChange={(value) => setSelectedYear(Number(value))}
          >
            <SelectTrigger className="w-[120px]">
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
      </CardHeader>
      <CardContent>
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
                          className={`w-full h-4 md:h-8 rounded-sm text-xs md:text-base font-semibold md:font-bold ${moodColors[mood]} flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-ring hover:ring-offset-1`}
                          title={`${month} ${day} - ${mood}: ${moodLabels[mood]}`}
                        >
                          {mood}
                        </div>
                      );
                    })}

                    <div className="h-8 text-center leading-8 pt-1 font-semibold">
                      {monthlyAverages?.[monthIndex] || ""}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-8 mt-6 flex-wrap">
              {stats && (
                <div className="flex-1 min-w-[300px]">
                  <h3 className="text-sm font-semibold mb-3">Summary</h3>
                  <div className="space-y-2">
                    {stats.displayGrades.map(({ grade, count, percentage }) => (
                      <div key={grade} className="flex items-center gap-3">
                        <div className="w-12 text-xs text-muted-foreground">
                          {grade}:
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
                <h3 className="text-sm font-semibold mb-3">Legend</h3>
                <div className="space-y-2">
                  {(["A+", "A", "B", "C", "D", "F"] as MoodGrade[]).map(
                    (grade) => (
                      <div key={grade} className="flex items-center gap-2">
                        <div
                          className={`w-4 h-4 rounded-sm ${moodColors[grade]} text-[8px] flex items-center justify-center font-semibold`}
                        >
                          {grade}
                        </div>
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
      </CardContent>
    </Card>
  );
};
