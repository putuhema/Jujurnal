import { v } from "convex/values";
import { query, action, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { authComponent } from "./auth";
import { google } from "@ai-sdk/google";
import { generateText } from "ai";

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

// Convert numeric grade to MoodGrade (same as in post.ts)
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

// Convert number back to MoodGrade
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

// Helper to get start and end of week (Monday to Sunday)
const getWeekBounds = (date: Date): { start: Date; end: Date } => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  const start = new Date(d.setDate(diff));
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

// Helper to get start and end of month
const getMonthBounds = (date: Date): { start: Date; end: Date } => {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

// Generate AI summary from posts
const generateSummary = async (
  posts: Array<{ body: string; mood: MoodGrade; _creationTime: number }>,
  periodType: "weekly" | "monthly"
): Promise<string> => {
  if (posts.length === 0) {
    return "No posts found for this period.";
  }

  const model = google("gemini-2.5-flash");

  // Format posts with dates and moods
  const postsText = posts
    .map((post, idx) => {
      const date = new Date(post._creationTime);
      const dateStr = date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      return `${idx + 1}. [${dateStr}] Mood: ${post.mood}\n   "${post.body}"`;
    })
    .join("\n\n");

  const periodLabel = periodType === "weekly" ? "week" : "month";

  const { text: summary } = await generateText({
    model,
    prompt: `You are a thoughtful journaling assistant helping someone reflect on their ${periodLabel}. 

Analyze the following journal entries from this ${periodLabel} and create a comprehensive, insightful summary. The entries include mood ratings (A+ being most positive, F being most negative).

Journal entries:
${postsText}

Create a summary that:
1. Identifies key themes, patterns, and emotions throughout the period
2. Highlights notable moments, achievements, or challenges
3. Notes any mood trends or shifts
4. Provides gentle, supportive insights about their journey
5. Is written in a warm, encouraging, and reflective tone
6. Is 2-4 paragraphs long

Focus on being empathetic, insightful, and helpful. Don't just list facts - help them understand their own patterns and growth.`,
  });

  return summary.trim();
};

// Internal mutation to save summary
export const createSummaryInternal = internalMutation({
  args: {
    userId: v.string(),
    periodType: v.union(v.literal("weekly"), v.literal("monthly")),
    startDate: v.number(),
    endDate: v.number(),
    summary: v.string(),
    postCount: v.number(),
    averageMood: v.union(
      v.literal("A+"),
      v.literal("A"),
      v.literal("A-"),
      v.literal("B+"),
      v.literal("B"),
      v.literal("B-"),
      v.literal("C+"),
      v.literal("C"),
      v.literal("C-"),
      v.literal("D+"),
      v.literal("D"),
      v.literal("D-"),
      v.literal("F")
    ),
  },
  handler: async (ctx, args) => {
    // Check if summary already exists for this period
    const existing = await ctx.db
      .query("summaries")
      .withIndex("by_userId_period", (q) =>
        q
          .eq("userId", args.userId)
          .eq("periodType", args.periodType)
          .eq("startDate", args.startDate)
      )
      .first();

    if (existing) {
      // Update existing summary
      await ctx.db.patch(existing._id, {
        summary: args.summary,
        postCount: args.postCount,
        averageMood: args.averageMood,
        endDate: args.endDate,
      });
      return existing._id;
    } else {
      // Create new summary
      return await ctx.db.insert("summaries", {
        userId: args.userId,
        periodType: args.periodType,
        startDate: args.startDate,
        endDate: args.endDate,
        summary: args.summary,
        postCount: args.postCount,
        averageMood: args.averageMood,
      });
    }
  },
});

// Generate weekly summary
export const generateWeeklySummary = action({
  args: {
    weekOffset: v.optional(v.number()), // 0 = current week, -1 = last week, etc.
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    summary: string;
    postCount: number;
    averageMood: MoodGrade;
    startDate: number;
    endDate: number;
  }> => {
    "use node";
    const currentUser = await authComponent.getAuthUser(ctx);
    if (!currentUser) {
      throw new Error("Not authenticated");
    }

    const weekOffset = args.weekOffset ?? 0;
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + weekOffset * 7);
    const { start, end } = getWeekBounds(targetDate);

    const startTimestamp = start.getTime();
    const endTimestamp = end.getTime();

    // Get all user posts
    const allPosts: Array<{
      body: string;
      mood: MoodGrade;
      _creationTime: number;
    }> = await ctx.runQuery(internal.post.getUserPostsInternal, {
      userId: currentUser._id,
    });

    // Filter posts for this week
    const weekPosts = allPosts.filter(
      (post: { body: string; mood: MoodGrade; _creationTime: number }) => {
        const postTime = post._creationTime;
        return postTime >= startTimestamp && postTime <= endTimestamp;
      }
    );

    if (weekPosts.length === 0) {
      throw new Error("No posts found for this week");
    }

    if (weekPosts.length < 7) {
      throw new Error("Weekly summary requires at least 7 posts");
    }

    // Calculate average mood
    const moodSum = weekPosts.reduce(
      (
        sum: number,
        post: { body: string; mood: MoodGrade; _creationTime: number }
      ) => {
        return sum + gradeToNumber(post.mood);
      },
      0
    );
    const averageMood = numberToGrade(moodSum / weekPosts.length);

    // Generate AI summary
    const summary = await generateSummary(weekPosts, "weekly");

    // Save summary
    await ctx.runMutation(internal.summary.createSummaryInternal, {
      userId: currentUser._id,
      periodType: "weekly",
      startDate: startTimestamp,
      endDate: endTimestamp,
      summary,
      postCount: weekPosts.length,
      averageMood,
    });

    // Check for summary badge
    await ctx.runMutation(internal.achievements.checkSummaryBadges, {
      userId: currentUser._id,
      periodType: "weekly",
    });

    return {
      success: true,
      summary,
      postCount: weekPosts.length,
      averageMood,
      startDate: startTimestamp,
      endDate: endTimestamp,
    };
  },
});

// Generate monthly summary
export const generateMonthlySummary = action({
  args: {
    monthOffset: v.optional(v.number()), // 0 = current month, -1 = last month, etc.
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    summary: string;
    postCount: number;
    averageMood: MoodGrade;
    startDate: number;
    endDate: number;
  }> => {
    "use node";
    const currentUser = await authComponent.getAuthUser(ctx);
    if (!currentUser) {
      throw new Error("Not authenticated");
    }

    const monthOffset = args.monthOffset ?? 0;
    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() + monthOffset);
    const { start, end } = getMonthBounds(targetDate);

    const startTimestamp = start.getTime();
    const endTimestamp = end.getTime();

    // Get all user posts
    const allPosts: Array<{
      body: string;
      mood: MoodGrade;
      _creationTime: number;
    }> = await ctx.runQuery(internal.post.getUserPostsInternal, {
      userId: currentUser._id,
    });

    // Filter posts for this month
    const monthPosts = allPosts.filter(
      (post: { body: string; mood: MoodGrade; _creationTime: number }) => {
        const postTime = post._creationTime;
        return postTime >= startTimestamp && postTime <= endTimestamp;
      }
    );

    if (monthPosts.length === 0) {
      throw new Error("No posts found for this month");
    }

    if (monthPosts.length < 30) {
      throw new Error("Monthly summary requires at least 30 posts");
    }

    // Calculate average mood
    const moodSum = monthPosts.reduce(
      (
        sum: number,
        post: { body: string; mood: MoodGrade; _creationTime: number }
      ) => {
        return sum + gradeToNumber(post.mood);
      },
      0
    );
    const averageMood = numberToGrade(moodSum / monthPosts.length);

    // Generate AI summary
    const summary = await generateSummary(monthPosts, "monthly");

    // Save summary
    await ctx.runMutation(internal.summary.createSummaryInternal, {
      userId: currentUser._id,
      periodType: "monthly",
      startDate: startTimestamp,
      endDate: endTimestamp,
      summary,
      postCount: monthPosts.length,
      averageMood,
    });

    // Check for summary badge
    await ctx.runMutation(internal.achievements.checkSummaryBadges, {
      userId: currentUser._id,
      periodType: "monthly",
    });

    return {
      success: true,
      summary,
      postCount: monthPosts.length,
      averageMood,
      startDate: startTimestamp,
      endDate: endTimestamp,
    };
  },
});

// Get weekly summary
export const getWeeklySummary = query({
  args: {
    weekOffset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const currentUser = await authComponent.safeGetAuthUser(ctx);
    if (!currentUser) {
      return null;
    }

    const weekOffset = args.weekOffset ?? 0;
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + weekOffset * 7);
    const { start } = getWeekBounds(targetDate);
    const startTimestamp = start.getTime();

    const summary = await ctx.db
      .query("summaries")
      .withIndex("by_userId_period", (q) =>
        q
          .eq("userId", currentUser._id)
          .eq("periodType", "weekly")
          .eq("startDate", startTimestamp)
      )
      .first();

    return summary;
  },
});

// Get monthly summary
export const getMonthlySummary = query({
  args: {
    monthOffset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const currentUser = await authComponent.safeGetAuthUser(ctx);
    if (!currentUser) {
      return null;
    }

    const monthOffset = args.monthOffset ?? 0;
    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() + monthOffset);
    const { start } = getMonthBounds(targetDate);
    const startTimestamp = start.getTime();

    const summary = await ctx.db
      .query("summaries")
      .withIndex("by_userId_period", (q) =>
        q
          .eq("userId", currentUser._id)
          .eq("periodType", "monthly")
          .eq("startDate", startTimestamp)
      )
      .first();

    return summary;
  },
});

// Get all summaries for a user
export const getAllSummaries = query({
  args: {
    periodType: v.optional(v.union(v.literal("weekly"), v.literal("monthly"))),
  },
  handler: async (ctx, args) => {
    const currentUser = await authComponent.safeGetAuthUser(ctx);
    if (!currentUser) {
      return [];
    }

    let query = ctx.db
      .query("summaries")
      .withIndex("by_userId", (q) => q.eq("userId", currentUser._id));

    const summaries = await query.collect();

    // Filter by period type if specified
    const filtered = args.periodType
      ? summaries.filter((s) => s.periodType === args.periodType)
      : summaries;

    // Sort by start date descending (most recent first)
    return filtered.sort((a, b) => b.startDate - a.startDate);
  },
});
