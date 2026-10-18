import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";

// Neighbours: gardens you've chosen to keep close. They sit next to yours in
// the world and their new journals come first. Only you see your list.

export const MAX_NEIGHBOURS = 12;

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return [];
    const rows = await ctx.db.query("neighbours").withIndex("by_userId", (q) => q.eq("userId", user._id)).take(MAX_NEIGHBOURS);
    return rows.map((row) => row.neighbourId);
  },
});

export const toggle = mutation({
  args: { neighbourId: v.string() },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return { status: "signedOut" as const };
    if (args.neighbourId === user._id) return { status: "unavailable" as const };
    const existing = await ctx.db
      .query("neighbours")
      .withIndex("by_user_neighbour", (q) => q.eq("userId", user._id).eq("neighbourId", args.neighbourId))
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
      return { status: "removed" as const };
    }
    const count = (await ctx.db.query("neighbours").withIndex("by_userId", (q) => q.eq("userId", user._id)).take(MAX_NEIGHBOURS)).length;
    if (count >= MAX_NEIGHBOURS) return { status: "full" as const };
    await ctx.db.insert("neighbours", { userId: user._id, neighbourId: args.neighbourId });
    return { status: "added" as const };
  },
});
