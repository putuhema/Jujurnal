import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  todos: defineTable({
    text: v.string(),
    completed: v.boolean(),
  }),
  posts: defineTable({
    body: v.string(),
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
    originalBody: v.optional(v.string()),
    isEdited: v.optional(v.boolean()),
    editedAt: v.optional(v.number()),
  }).index("by_authorId", ["userId"]),
  summaries: defineTable({
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
  })
    .index("by_userId", ["userId"])
    .index("by_userId_period", ["userId", "periodType", "startDate"]),
  achievements: defineTable({
    userId: v.string(),
    badgeId: v.string(),
    unlockedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_badgeId", ["userId", "badgeId"]),
});
