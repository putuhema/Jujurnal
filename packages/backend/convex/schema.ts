import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
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
    imageStorageId: v.optional(v.id("_storage")),
  }).index("by_authorId", ["userId"]),
});
