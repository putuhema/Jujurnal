import { v } from "convex/values";

import { authComponent } from "./auth";
import { mutation, query } from "./_generated/server";

const gardenThemeValidator = v.union(
  v.literal("ivory"),
  v.literal("sage"),
  v.literal("dawn"),
  v.literal("sky"),
  v.literal("lilac")
);

export const getMyGardenTheme = query({
  args: {},
  handler: async (ctx) => {
    const currentUser = await authComponent.safeGetAuthUser(ctx);
    if (!currentUser) return null;

    const preference = await ctx.db
      .query("gardenPreferences")
      .withIndex("by_userId", (q) => q.eq("userId", currentUser._id))
      .unique();
    return preference?.theme ?? null;
  },
});

export const getGardenTheme = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const preference = await ctx.db
      .query("gardenPreferences")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
    return preference?.theme ?? "ivory";
  },
});

export const setGardenTheme = mutation({
  args: { theme: gardenThemeValidator },
  handler: async (ctx, args) => {
    const currentUser = await authComponent.getAuthUser(ctx);
    const preference = await ctx.db
      .query("gardenPreferences")
      .withIndex("by_userId", (q) => q.eq("userId", currentUser._id))
      .unique();

    if (preference) {
      await ctx.db.patch(preference._id, { theme: args.theme });
      return;
    }

    await ctx.db.insert("gardenPreferences", {
      userId: currentUser._id,
      theme: args.theme,
    });
  },
});
