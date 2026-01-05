import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { authComponent } from "./auth";

export type BadgeId =
  | "first_post"
  | "posts_10"
  | "posts_25"
  | "posts_50"
  | "posts_100"
  | "posts_365"
  | "streak_7"
  | "streak_30"
  | "streak_100"
  | "perfect_grammar"
  | "positive_mood_week"
  | "weekly_summary"
  | "monthly_summary"
  | "consistent_writer";

export interface BadgeDefinition {
  id: BadgeId;
  name: string;
  description: string;
  icon: string;
  rarity: "common" | "rare" | "epic" | "legendary";
}

export const BADGE_DEFINITIONS: Record<BadgeId, BadgeDefinition> = {
  first_post: {
    id: "first_post",
    name: "First Steps",
    description: "Created your first journal entry",
    icon: "🌱",
    rarity: "common",
  },
  posts_10: {
    id: "posts_10",
    name: "Getting Started",
    description: "Created 10 journal entries",
    icon: "📝",
    rarity: "common",
  },
  posts_25: {
    id: "posts_25",
    name: "Dedicated Writer",
    description: "Created 25 journal entries",
    icon: "✍️",
    rarity: "rare",
  },
  posts_50: {
    id: "posts_50",
    name: "Journal Master",
    description: "Created 50 journal entries",
    icon: "📚",
    rarity: "rare",
  },
  posts_100: {
    id: "posts_100",
    name: "Century Club",
    description: "Created 100 journal entries",
    icon: "💯",
    rarity: "epic",
  },
  posts_365: {
    id: "posts_365",
    name: "Year of Reflection",
    description: "Created 365 journal entries",
    icon: "🌟",
    rarity: "legendary",
  },
  streak_7: {
    id: "streak_7",
    name: "Week Warrior",
    description: "Maintained a 7-day writing streak",
    icon: "🔥",
    rarity: "rare",
  },
  streak_30: {
    id: "streak_30",
    name: "Monthly Champion",
    description: "Maintained a 30-day writing streak",
    icon: "⚡",
    rarity: "epic",
  },
  streak_100: {
    id: "streak_100",
    name: "Century Streak",
    description: "Maintained a 100-day writing streak",
    icon: "🏆",
    rarity: "legendary",
  },
  perfect_grammar: {
    id: "perfect_grammar",
    name: "Grammar Guru",
    description: "Created a post with perfect grammar",
    icon: "✨",
    rarity: "rare",
  },
  positive_mood_week: {
    id: "positive_mood_week",
    name: "Sunshine Week",
    description: "Maintained positive mood (A+ to B+) for a week",
    icon: "☀️",
    rarity: "epic",
  },
  weekly_summary: {
    id: "weekly_summary",
    name: "Weekly Reflector",
    description: "Generated your first weekly summary",
    icon: "📊",
    rarity: "common",
  },
  monthly_summary: {
    id: "monthly_summary",
    name: "Monthly Analyst",
    description: "Generated your first monthly summary",
    icon: "📈",
    rarity: "rare",
  },
  consistent_writer: {
    id: "consistent_writer",
    name: "Consistent Writer",
    description: "Posted for 7 consecutive days",
    icon: "📅",
    rarity: "rare",
  },
};

export const getUserAchievements = query({
  handler: async (ctx) => {
    const currentUser = await authComponent.safeGetAuthUser(ctx);
    if (!currentUser) {
      return [];
    }

    const achievements = await ctx.db
      .query("achievements")
      .withIndex("by_userId", (q) => q.eq("userId", currentUser._id))
      .collect();

    return achievements.map((achievement) => ({
      ...achievement,
      badge: BADGE_DEFINITIONS[achievement.badgeId as BadgeId],
    }));
  },
});

export const hasBadge = query({
  args: {
    badgeId: v.string(),
  },
  handler: async (ctx, args) => {
    const currentUser = await authComponent.safeGetAuthUser(ctx);
    if (!currentUser) {
      return false;
    }

    const achievement = await ctx.db
      .query("achievements")
      .withIndex("by_userId_badgeId", (q) =>
        q.eq("userId", currentUser._id).eq("badgeId", args.badgeId)
      )
      .first();

    return !!achievement;
  },
});

export const unlockBadgeInternal = internalMutation({
  args: {
    userId: v.string(),
    badgeId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("achievements")
      .withIndex("by_userId_badgeId", (q) =>
        q.eq("userId", args.userId).eq("badgeId", args.badgeId)
      )
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("achievements", {
      userId: args.userId,
      badgeId: args.badgeId,
      unlockedAt: Date.now(),
    });
  },
});

export const checkPostCountBadges = internalMutation({
  args: {
    userId: v.string(),
    postCount: v.number(),
  },
  handler: async (ctx, args) => {
    const badgesToCheck: BadgeId[] = [];

    if (args.postCount >= 1) badgesToCheck.push("first_post");
    if (args.postCount >= 10) badgesToCheck.push("posts_10");
    if (args.postCount >= 25) badgesToCheck.push("posts_25");
    if (args.postCount >= 50) badgesToCheck.push("posts_50");
    if (args.postCount >= 100) badgesToCheck.push("posts_100");
    if (args.postCount >= 365) badgesToCheck.push("posts_365");

    const unlockedBadges: BadgeId[] = [];
    for (const badgeId of badgesToCheck) {
      const existing = await ctx.db
        .query("achievements")
        .withIndex("by_userId_badgeId", (q) =>
          q.eq("userId", args.userId).eq("badgeId", badgeId)
        )
        .first();

      if (!existing) {
        await ctx.db.insert("achievements", {
          userId: args.userId,
          badgeId,
          unlockedAt: Date.now(),
        });
        unlockedBadges.push(badgeId);
      }
    }

    return unlockedBadges;
  },
});

// Check and unlock badges based on streak
export const checkStreakBadges = internalMutation({
  args: {
    userId: v.string(),
    currentStreak: v.number(),
    longestStreak: v.number(),
  },
  handler: async (ctx, args) => {
    const badgesToCheck: BadgeId[] = [];

    const streakToCheck = Math.max(args.currentStreak, args.longestStreak);
    if (streakToCheck >= 7) badgesToCheck.push("streak_7");
    if (streakToCheck >= 30) badgesToCheck.push("streak_30");
    if (streakToCheck >= 100) badgesToCheck.push("streak_100");

    const unlockedBadges: BadgeId[] = [];
    for (const badgeId of badgesToCheck) {
      const existing = await ctx.db
        .query("achievements")
        .withIndex("by_userId_badgeId", (q) =>
          q.eq("userId", args.userId).eq("badgeId", badgeId)
        )
        .first();

      if (!existing) {
        await ctx.db.insert("achievements", {
          userId: args.userId,
          badgeId,
          unlockedAt: Date.now(),
        });
        unlockedBadges.push(badgeId);
      }
    }

    return unlockedBadges;
  },
});

export const checkPerfectGrammarBadge = internalMutation({
  args: {
    userId: v.string(),
    hasGrammarSuggestions: v.boolean(),
  },
  handler: async (ctx, args) => {
    if (args.hasGrammarSuggestions) {
      return [];
    }

    const badgeId: BadgeId = "perfect_grammar";
    const existing = await ctx.db
      .query("achievements")
      .withIndex("by_userId_badgeId", (q) =>
        q.eq("userId", args.userId).eq("badgeId", badgeId)
      )
      .first();

    if (!existing) {
      await ctx.db.insert("achievements", {
        userId: args.userId,
        badgeId,
        unlockedAt: Date.now(),
      });
      return [badgeId];
    }

    return [];
  },
});

export const checkSummaryBadges = internalMutation({
  args: {
    userId: v.string(),
    periodType: v.union(v.literal("weekly"), v.literal("monthly")),
  },
  handler: async (ctx, args) => {
    const badgeId: BadgeId =
      args.periodType === "weekly" ? "weekly_summary" : "monthly_summary";

    const existing = await ctx.db
      .query("achievements")
      .withIndex("by_userId_badgeId", (q) =>
        q.eq("userId", args.userId).eq("badgeId", badgeId)
      )
      .first();

    if (!existing) {
      await ctx.db.insert("achievements", {
        userId: args.userId,
        badgeId,
        unlockedAt: Date.now(),
      });
      return [badgeId];
    }

    return [];
  },
});

export const getAllBadges = query({
  handler: async () => {
    return Object.values(BADGE_DEFINITIONS);
  },
});
