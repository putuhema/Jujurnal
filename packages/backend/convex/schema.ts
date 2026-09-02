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
    year: v.number(),
  })
    .index("by_authorId", ["userId"])
    .index("by_year", ["year"]),
});
