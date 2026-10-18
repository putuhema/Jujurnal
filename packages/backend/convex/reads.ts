import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";
import { getDateString } from "./helpers";

// Being read: who has read a journal (authors only see the count), and which
// fresh journals in the world are still waiting for you to read them.

// "Fresh" means written in the last day or so.
const FRESH_DAYS = 1;
const FRESH_LIMIT = 150;

// Called once a journal has actually been read (open for a moment).
export const markRead = mutation({
  args: { postId: v.id("posts") },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return;
    const post = await ctx.db.get(args.postId);
    if (!post || post.visibility === "private" || post.userId === user._id) return;
    const existing = await ctx.db.query("postReads").withIndex("by_reader_post", (q) => q.eq("readerId", user._id).eq("postId", args.postId)).unique();
    if (!existing) await ctx.db.insert("postReads", { postId: args.postId, readerId: user._id });
  },
});

// How many people read your journal. Only the author gets an answer.
export const readCount = query({
  args: { postId: v.id("posts") },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    const post = await ctx.db.get(args.postId);
    if (!user || !post || post.userId !== user._id) return null;
    return (await ctx.db.query("postReads").withIndex("by_postId", (q) => q.eq("postId", args.postId)).collect()).length;
  },
});

// Other people's public journals from the last day that you haven't read yet,
// newest first. These glow in the world so they find a reader.
export const freshUnread = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    // Days are compared in UTC; a day either side is close enough for "fresh".
    const since = getDateString(Date.now() - (FRESH_DAYS + 1) * 86_400_000, "UTC");
    const cutoff = Date.now() - FRESH_DAYS * 86_400_000;
    const posts = await ctx.db
      .query("posts")
      .withIndex("by_entryDate", (q) => q.gte("entryDate", since))
      .order("desc")
      .take(FRESH_LIMIT);
    const fresh = posts.filter((post) => post.visibility !== "private" && post._creationTime >= cutoff && post.userId !== user?._id);
    if (!user) return fresh.map((post) => ({ postId: post._id, userId: post.userId }));
    const reads = await Promise.all(
      fresh.map((post) => ctx.db.query("postReads").withIndex("by_reader_post", (q) => q.eq("readerId", user._id).eq("postId", post._id)).unique())
    );
    return fresh.flatMap((post, index) => (reads[index] ? [] : [{ postId: post._id, userId: post.userId }]));
  },
});
