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
  handler: async (ctx) => {
    const currentUser = await authComponent.safeGetAuthUser(ctx);
    if (!currentUser) {
      return null;
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    );

    const startTimestamp = startOfMonth.getTime();
    const endTimestamp = endOfMonth.getTime();

    const posts = await ctx.db
      .query("posts")
      .withIndex("by_authorId", (q) => q.eq("userId", currentUser._id))
      .collect();

    const monthlyPosts = posts.filter((post) => {
      const postTime = post._creationTime;
      return postTime >= startTimestamp && postTime <= endTimestamp;
    });

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

    const yearStart = new Date(`${args.year}-01-01T00:00:00Z`).getTime();
    const yearEnd = new Date(`${args.year}-12-31T23:59:59Z`).getTime();

    const yearPosts = posts.filter((post) => {
      return post._creationTime >= yearStart && post._creationTime <= yearEnd;
    });

    const postsByDate = new Map<
      string,
      { mood: MoodGrade; _creationTime: number }
    >();
    for (const post of yearPosts) {
      const dateStr = getDateString(post._creationTime);
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
