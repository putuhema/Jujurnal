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
  }).index("by_authorId", ["userId"]),
});
