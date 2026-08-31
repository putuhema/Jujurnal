import { v } from "convex/values";
import { query } from "./_generated/server";
import { authComponent } from "./auth";
import {
  gradeToNumber,
  numberToGrade,
  getMoodWord,
  getDateString,
} from "./helpers";
import type { MoodGrade } from "./types";

export const getMonthlyMood = query({
  args: {
    timeZone: v.string(),
  },
  handler: async (ctx, args) => {
    const currentUser = await authComponent.safeGetAuthUser(ctx);
    if (!currentUser) {
      return null;
    }

    const currentMonth = getDateString(Date.now(), args.timeZone).slice(0, 7);

    const posts = await ctx.db
      .query("posts")
      .withIndex("by_authorId", (q) => q.eq("userId", currentUser._id))
      .collect();

    const monthlyPosts = posts.filter((post) =>
      (post.entryDate ?? getDateString(post._creationTime, args.timeZone)).startsWith(
        currentMonth
      )
    );

    if (monthlyPosts.length === 0) {
      return null;
    }

    const moodSum = monthlyPosts.reduce((sum, post) => {
      return sum + gradeToNumber(post.mood);
    }, 0);

    const averageMood = moodSum / monthlyPosts.length;
    const overallGrade = numberToGrade(averageMood);
    const moodWord = getMoodWord(overallGrade);

    return {
      mood: overallGrade,
      moodWord: moodWord,
      postCount: monthlyPosts.length,
    };
  },
});

export const getYearMoodData = query({
  args: {
    year: v.number(),
    timeZone: v.string(),
  },
  handler: async (ctx, args) => {
    const currentUser = await authComponent.safeGetAuthUser(ctx);
    if (!currentUser) {
      return null;
    }

    const posts = await ctx.db
      .query("posts")
      .withIndex("by_authorId", (q) => q.eq("userId", currentUser._id))
      .collect();

    const yearPrefix = `${args.year}-`;
    const yearPosts = posts.filter((post) =>
      (post.entryDate ?? getDateString(post._creationTime, args.timeZone)).startsWith(
        yearPrefix
      )
    );

    const postsByDate = new Map<
      string,
      { mood: MoodGrade; _creationTime: number }
    >();
    for (const post of yearPosts) {
      const dateStr =
        post.entryDate ?? getDateString(post._creationTime, args.timeZone);
      const existing = postsByDate.get(dateStr);
      if (!existing || post._creationTime > existing._creationTime) {
        postsByDate.set(dateStr, {
          mood: post.mood,
          _creationTime: post._creationTime,
        });
      }
    }

    return Array.from(postsByDate.entries()).map(([date, data]) => ({
      date,
      mood: data.mood,
    }));
  },
});
