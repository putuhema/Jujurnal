import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";
import { decorationKinds, decorationUnlocks, longestStreak, MAX_DECORATIONS } from "./gardenItems";
import { getDateString } from "./helpers";

const kindValidator = v.union(...decorationKinds.map((kind) => v.literal(kind)));

// Everything your own garden needs beyond its journals: how you've arranged it,
// what you've unlocked, and your last week of moods (for the weather).
export const getMine = query({
  args: { timeZone: v.string() },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return null;
    const [layout, posts] = await Promise.all([
      ctx.db.query("gardenLayouts").withIndex("by_userId", (q) => q.eq("userId", user._id)).unique(),
      ctx.db.query("posts").withIndex("by_authorId", (q) => q.eq("userId", user._id)).order("desc").collect(),
    ]);
    return {
      moves: layout?.moves ?? [],
      decorations: layout?.decorations ?? [],
      longestStreak: longestStreak(posts.map((post) => post.entryDate ?? getDateString(post._creationTime, args.timeZone))),
      // Newest first.
      recentMoods: posts.slice(0, 7).map((post) => post.mood),
    };
  },
});

export const saveArrangement = mutation({
  args: {
    timeZone: v.string(),
    moves: v.array(v.object({ postId: v.id("posts"), x: v.number(), z: v.number() })),
    decorations: v.array(v.object({ id: v.string(), kind: kindValidator, x: v.number(), z: v.number(), turn: v.number() })),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (args.decorations.length > MAX_DECORATIONS) throw new ConvexError(`A garden holds up to ${MAX_DECORATIONS} decorations`);
    const posts = await ctx.db.query("posts").withIndex("by_authorId", (q) => q.eq("userId", user._id)).collect();
    const streak = longestStreak(posts.map((post) => post.entryDate ?? getDateString(post._creationTime, args.timeZone)));
    for (const decoration of args.decorations) {
      if (decorationUnlocks[decoration.kind] > streak) throw new ConvexError("That decoration isn't unlocked yet");
    }
    // Only your own journals can be moved, and only to whole cells near the island.
    const mine = new Set(posts.map((post) => post._id));
    const inside = (value: number) => Number.isInteger(value) && Math.abs(value) <= 8;
    const moves = args.moves.filter((move) => mine.has(move.postId) && inside(move.x) && inside(move.z));
    const decorations = args.decorations.filter((decoration) => inside(decoration.x) && inside(decoration.z));

    const existing = await ctx.db.query("gardenLayouts").withIndex("by_userId", (q) => q.eq("userId", user._id)).unique();
    if (existing) await ctx.db.patch(existing._id, { moves, decorations });
    else await ctx.db.insert("gardenLayouts", { userId: user._id, moves, decorations });
  },
});
