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
import {
  analyzeMood,
  analyzeGrammar,
  applyCorrectionsToText,
} from "./analysis";
import { getDateString, getDateStringForDay } from "./helpers";

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
    grammarSuggestions: v.optional(
      v.array(
        v.object({
          original: v.string(),
          corrected: v.string(),
          explanation: v.string(),
          issueType: v.string(),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("posts", {
      body: args.text,
      userId: args.userId,
      mood: args.mood,
      moodReason: args.moodReason,
      grammarSuggestions: args.grammarSuggestions,
    });

    const posts = await ctx.db
      .query("posts")
      .withIndex("by_authorId", (q) => q.eq("userId", args.userId))
      .collect();

    // Check streak badges
    const postsByDate = new Set<string>();
    for (const post of posts) {
      const dateStr = getDateString(post._creationTime);
      postsByDate.add(dateStr);
    }

    // Calculate current streak
    let currentStreak = 0;
    const today = getDateString(Date.now());
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

export const create = action({
  args: {
    text: v.string(),
    lang: v.string(),
  },
  handler: async (ctx, args) => {
    "use node";
    const currentUser = await authComponent.getAuthUser(ctx);

    if (!currentUser) {
      throw new Error("Not authenticated");
    }

    const shouldAnalyzeGrammar = args.lang === "en";
    const analysisTasks: Promise<any>[] = [analyzeMood(args.text)];

    if (shouldAnalyzeGrammar) {
      analysisTasks.push(analyzeGrammar(args.text));
    }

    const results = await Promise.all(analysisTasks);
    const moodAnalysis = results[0];
    const grammarSuggestions = shouldAnalyzeGrammar ? results[1] : [];

    await ctx.runMutation(internal.posts.createInternal, {
      text: args.text,
      userId: currentUser._id,
      mood: moodAnalysis.grade,
      grammarSuggestions:
        grammarSuggestions.length > 0 ? grammarSuggestions : undefined,
    });
  },
});

export const applyGrammarCorrections = mutation({
  args: {
    id: v.id("posts"),
  },
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.id);

    if (!post) {
      throw new Error("Post not found");
    }

    const currentUser = await authComponent.safeGetAuthUser(ctx);
    if (!currentUser || post.userId !== currentUser._id) {
      throw new Error("Not authorized");
    }

    if (!post.grammarSuggestions || post.grammarSuggestions.length === 0) {
      throw new Error("No grammar suggestions available");
    }

    const baseText = post.originalBody || post.body;
    const correctedText = applyCorrectionsToText(
      baseText,
      post.grammarSuggestions
    );

    const originalBody = post.originalBody || post.body;

    await ctx.db.patch(args.id, {
      body: correctedText,
      originalBody: originalBody,
      isEdited: true,
      editedAt: Date.now(),
      grammarSuggestions: undefined,
    });

    return { success: true, correctedText };
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
