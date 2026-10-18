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
    // Kept in step with plantReactions by reactions.toggle, so lists don't
    // have to count reactions per post. Missing on posts from before it existed.
    reactionCount: v.optional(v.number()),
  })
    .index("by_authorId", ["userId"])
    .index("by_authorId_entryDate", ["userId", "entryDate"])
    .index("by_entryDate", ["entryDate"])
    .index("by_year", ["year"])
    .searchIndex("search_body", { searchField: "body", filterFields: ["userId"] }),
  // How someone has arranged their own garden: plants they've moved and the
  // decorations they've placed, in cells relative to the island's centre.
  gardenLayouts: defineTable({
    userId: v.string(),
    moves: v.array(v.object({ postId: v.id("posts"), x: v.number(), z: v.number() })),
    decorations: v.array(
      v.object({
        id: v.string(),
        kind: v.union(v.literal("stones"), v.literal("bench"), v.literal("lantern"), v.literal("birdbath"), v.literal("arch")),
        x: v.number(),
        z: v.number(),
        turn: v.number(),
      })
    ),
  }).index("by_userId", ["userId"]),
  // Small gifts left in someone's garden. Notes are only ever shown to the recipient.
  gifts: defineTable({
    toUserId: v.string(),
    fromUserId: v.string(),
    kind: v.union(v.literal("pebble"), v.literal("fireflies"), v.literal("blossom")),
    note: v.optional(v.string()),
    read: v.boolean(),
  })
    .index("by_to", ["toUserId"])
    .index("by_from_to", ["fromUserId", "toUserId"]),
  // Who has read a journal. Authors only ever see the count.
  postReads: defineTable({
    postId: v.id("posts"),
    readerId: v.string(),
  })
    .index("by_postId", ["postId"])
    .index("by_reader_post", ["readerId", "postId"]),
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
