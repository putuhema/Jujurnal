"use client";

import { useQuery, useAction } from "convex/react";
import { api } from "@puma-brain/backend/convex/_generated/api";
import { useState } from "react";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CalendarIcon,
  SparkleIcon,
  SpinnerIcon,
  ClockIcon,
} from "@phosphor-icons/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";

const getMoodWord = (grade: string): string => {
  const moodWords: Record<string, string> = {
    "A+": "Radiant ✨",
    A: "Sunny 🌞",
    "A-": "Content 😊",
    "B+": "Upbeat 🎵",
    B: "Steady ⚖️",
    "B-": "Chill 😌",
    "C+": "Reflective 🤔",
    C: "Balanced ⚖️",
    "C-": "Subdued 🌫️",
    "D+": "Cloudy ☁️",
    D: "Heavy 💭",
    "D-": "Stormy ⛈️",
    F: "Grim 🌑",
  };
  return moodWords[grade] || grade;
};

const formatPeriodDate = (
  timestamp: number,
  periodType: "weekly" | "monthly"
): string => {
  const date = new Date(timestamp);
  if (periodType === "weekly") {
    const endDate = new Date(timestamp);
    endDate.setDate(endDate.getDate() + 6);
    return `${format(date, "MMM d")} - ${format(endDate, "MMM d, yyyy")}`;
  } else {
    return format(date, "MMMM yyyy");
  }
};

export const Summaries = () => {
  const [generatingWeekly, setGeneratingWeekly] = useState(false);
  const [generatingMonthly, setGeneratingMonthly] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const weeklySummary = useQuery(api.summary.getWeeklySummary, {
    weekOffset: 0,
  });
  const monthlySummary = useQuery(api.summary.getMonthlySummary, {
    monthOffset: 0,
  });
  const generateWeekly = useAction(api.summary.generateWeeklySummary);
  const generateMonthly = useAction(api.summary.generateMonthlySummary);

  const handleGenerateWeekly = async () => {
    setGeneratingWeekly(true);
    setError(null);
    try {
      await generateWeekly({ weekOffset: 0 });
    } catch (err: any) {
      setError(err.message || "Failed to generate weekly summary");
    } finally {
      setGeneratingWeekly(false);
    }
  };

  const handleGenerateMonthly = async () => {
    setGeneratingMonthly(true);
    setError(null);
    try {
      await generateMonthly({ monthOffset: 0 });
    } catch (err: any) {
      setError(err.message || "Failed to generate monthly summary");
    } finally {
      setGeneratingMonthly(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="weekly" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="weekly">Weekly Summary</TabsTrigger>
          <TabsTrigger value="monthly">Monthly Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="weekly" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarIcon className="size-5" />
                    This Week
                  </CardTitle>
                  <CardDescription>
                    {weeklySummary
                      ? formatPeriodDate(weeklySummary.startDate, "weekly")
                      : formatPeriodDate(Date.now(), "weekly")}
                  </CardDescription>
                </div>
                {!weeklySummary && (
                  <Button
                    onClick={handleGenerateWeekly}
                    disabled={generatingWeekly}
                    size="sm"
                  >
                    {generatingWeekly ? (
                      <>
                        <SpinnerIcon className="size-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <SparkleIcon className="size-4 mr-2" />
                        Generate Summary
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {weeklySummary ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 flex-wrap">
                    <Badge variant="secondary" className="text-sm">
                      {weeklySummary.postCount}{" "}
                      {weeklySummary.postCount === 1 ? "post" : "posts"}
                    </Badge>
                    <Badge variant="outline" className="text-sm">
                      Average Mood: {getMoodWord(weeklySummary.averageMood)}
                    </Badge>
                  </div>
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {weeklySummary.summary}
                    </p>
                  </div>
                  <div className="pt-2 border-t">
                    <Button
                      onClick={handleGenerateWeekly}
                      disabled={generatingWeekly}
                      variant="outline"
                      size="sm"
                    >
                      {generatingWeekly ? (
                        <>
                          <SpinnerIcon className="size-4 mr-2 animate-spin" />
                          Regenerating...
                        </>
                      ) : (
                        <>
                          <ClockIcon className="size-4 mr-2" />
                          Regenerate Summary
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <SparkleIcon className="size-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">
                    No summary generated yet. Click "Generate Summary" to create
                    an AI-powered reflection of your week.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monthly" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarIcon className="size-5" />
                    This Month
                  </CardTitle>
                  <CardDescription>
                    {monthlySummary
                      ? formatPeriodDate(monthlySummary.startDate, "monthly")
                      : formatPeriodDate(Date.now(), "monthly")}
                  </CardDescription>
                </div>
                {!monthlySummary && (
                  <Button
                    onClick={handleGenerateMonthly}
                    disabled={generatingMonthly}
                    size="sm"
                  >
                    {generatingMonthly ? (
                      <>
                        <SpinnerIcon className="size-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <SparkleIcon className="size-4 mr-2" />
                        Generate Summary
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {monthlySummary ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 flex-wrap">
                    <Badge variant="secondary" className="text-sm">
                      {monthlySummary.postCount}{" "}
                      {monthlySummary.postCount === 1 ? "post" : "posts"}
                    </Badge>
                    <Badge variant="outline" className="text-sm">
                      Average Mood: {getMoodWord(monthlySummary.averageMood)}
                    </Badge>
                  </div>
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {monthlySummary.summary}
                    </p>
                  </div>
                  <div className="pt-2 border-t">
                    <Button
                      onClick={handleGenerateMonthly}
                      disabled={generatingMonthly}
                      variant="outline"
                      size="sm"
                    >
                      {generatingMonthly ? (
                        <>
                          <SpinnerIcon className="size-4 mr-2 animate-spin" />
                          Regenerating...
                        </>
                      ) : (
                        <>
                          <ClockIcon className="size-4 mr-2" />
                          Regenerate Summary
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <SparkleIcon className="size-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">
                    No summary generated yet. Click "Generate Summary" to create
                    an AI-powered reflection of your month.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
