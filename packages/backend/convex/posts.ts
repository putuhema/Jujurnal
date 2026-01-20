import { v } from "convex/values";
import {
  query,
  mutation,
  action,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { authComponent } from "./auth";
import { paginationOptsValidator } from "convex/server";
import { analyzeMood } from "./analysis";
import { getDateString, getDateStringForDay } from "./helpers";

const FLOWER_COUNT = 212;

export const getAll = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const posts = await ctx.db
      .query("posts")
      .order("desc")
      .paginate(args.paginationOpts);

    const page = await Promise.all(
      (posts.page ?? []).map(async (post) => {
        const user = await authComponent.getAnyUserById(ctx, post.userId);
        return { ...post, user };
      })
    );

    return {
      ...posts,
      page,
    };
  },
});

export const getById = query({
  args: { id: v.id("posts") },
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.id);
    if (!post) {
      return null;
    }
    const user = await authComponent.getAnyUserById(ctx, post.userId);
    return { ...post, user };
  },
});

export const getByUserId = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const posts = await ctx.db
      .query("posts")
      .withIndex("by_authorId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();

    const user = await authComponent.getAnyUserById(ctx, args.userId);
    return posts.map((post) => ({ ...post, user }));
  },
});

export const getUserPostsInternal = internalQuery({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const posts = await ctx.db
      .query("posts")
      .withIndex("by_authorId", (q) => q.eq("userId", args.userId))
      .collect();
    return posts.map((post) => ({
      body: post.body,
      mood: post.mood,
      _creationTime: post._creationTime,
    }));
  },
});

export const createInternal = internalMutation({
  args: {
    text: v.string(),
    userId: v.string(),
    nowMs: v.number(),
    year: v.number(),
    flowerId: v.number(),
    mood: v.union(
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
    moodReason: v.optional(v.string()),
    tagIds: v.optional(v.array(v.id("tags"))),
  },
  handler: async (ctx, args) => {
    const flowerId =
      Number.isFinite(args.flowerId) && args.flowerId > 0
        ? Math.floor(args.flowerId)
        : 1;

    await ctx.db.insert("posts", {
      body: args.text,
      userId: args.userId,
      mood: args.mood,
      moodReason: args.moodReason,
      flowerId: ((flowerId - 1) % FLOWER_COUNT) + 1,
      year: args.year,
    });

    const posts = await ctx.db
      .query("posts")
      .withIndex("by_authorId", (q) => q.eq("userId", args.userId))
      .collect();

    const postsByDate = new Set<string>();
    for (const post of posts) {
      const dateStr = getDateString(post._creationTime);
      postsByDate.add(dateStr);
    }

    let currentStreak = 0;
    const today = getDateString(args.nowMs);
    if (postsByDate.has(today)) {
      currentStreak = 1;
      let daysAgo = 1;
      while (true) {
        const dateStr = getDateStringForDay(daysAgo);
        if (postsByDate.has(dateStr)) {
          currentStreak++;
          daysAgo++;
        } else {
          break;
        }
      }
    }

    let longestStreak = 1;
    if (postsByDate.size > 0) {
      const sortedDates = Array.from(postsByDate).sort();
      let currentLongestStreak = 1;
      for (let i = 1; i < sortedDates.length; i++) {
        const prevDate = new Date(sortedDates[i - 1] + "T00:00:00Z");
        const currDate = new Date(sortedDates[i] + "T00:00:00Z");
        const daysDiff = Math.floor(
          (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysDiff === 1) {
          currentLongestStreak++;
          longestStreak = Math.max(longestStreak, currentLongestStreak);
        } else {
          currentLongestStreak = 1;
        }
      }
    }
  },
});

export const hasPostedToday = query({
  args: {},
  handler: async (ctx) => {
    const currentUser = await authComponent.safeGetAuthUser(ctx);
    if (!currentUser) {
      return false;
    }

    const today = getDateString(Date.now());
    const posts = await ctx.db
      .query("posts")
      .withIndex("by_authorId", (q) => q.eq("userId", currentUser._id))
      .collect();

    return posts.some((post) => getDateString(post._creationTime) === today);
  },
});

export const create = action({
  args: {
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const currentUser = await authComponent.getAuthUser(ctx);

    if (!currentUser) {
      throw new Error("Not authenticated");
    }

    const nowMs = Date.now();
    const year = new Date(nowMs).getFullYear();
    const today = getDateString(nowMs);
    const existingPosts = await ctx.runQuery(
      internal.posts.getUserPostsInternal,
      {
        userId: currentUser._id,
      }
    );

    const hasPostedToday = existingPosts.some(
      (post) => getDateString(post._creationTime) === today
    );

    if (hasPostedToday) {
      throw new Error("You can only post once per day");
    }
    const moodAnalysis = await analyzeMood(args.text);

    const flowerId = Math.floor(Math.random() * FLOWER_COUNT) + 1;

    await ctx.runMutation(internal.posts.createInternal, {
      text: args.text,
      userId: currentUser._id,
      nowMs,
      year,
      flowerId,
      mood: moodAnalysis.grade,
    });
  },
});

export const deletePost = mutation({
  args: {
    id: v.id("posts"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete("posts", args.id);
    return { success: true };
  },
});
