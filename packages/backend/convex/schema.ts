import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  gardenPreferences: defineTable({
    userId: v.string(),
    theme: v.union(
      v.literal("ivory"),
      v.literal("sage"),
      v.literal("dawn"),
      v.literal("sky"),
      v.literal("lilac")
    ),
  }).index("by_userId", ["userId"]),
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
    moodReason: v.optional(v.string()),
    flowerId: v.optional(v.number()),
    entryDate: v.optional(v.string()),
    visibility: v.optional(
      v.union(v.literal("public"), v.literal("private"))
    ),
    year: v.number(),
  })
    .index("by_authorId", ["userId"])
    .index("by_year", ["year"]),
  plantReactions: defineTable({
    postId: v.id("posts"),
    userId: v.string(),
  })
    .index("by_postId", ["postId"])
    .index("by_postId_userId", ["postId", "userId"]),
  reminderSettings: defineTable({
    userId: v.string(),
    enabled: v.boolean(),
    days: v.array(v.number()),
    time: v.string(),
    timeZone: v.string(),
    lastSentDate: v.optional(v.string()),
  })
    .index("by_userId", ["userId"])
    .index("by_enabled", ["enabled"]),
  pushSubscriptions: defineTable({
    userId: v.string(),
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_endpoint", ["endpoint"]),
});
