import { v } from "convex/values";

import { authComponent } from "./auth";
import { mutation, query } from "./_generated/server";

export const getForPost = query({
  args: { postId: v.id("posts") },
  handler: async (ctx, args) => {
    const [post, currentUser, reactions] = await Promise.all([
      ctx.db.get(args.postId),
      authComponent.safeGetAuthUser(ctx),
      ctx.db
        .query("plantReactions")
        .withIndex("by_postId", (q) => q.eq("postId", args.postId))
        .collect(),
    ]);

    if (!post) return null;

    const viewerReacted = currentUser
      ? reactions.some((reaction) => reaction.userId === currentUser._id)
      : false;
    const isOwner = currentUser?._id === post.userId;
    if (post.visibility === "private" && !isOwner) return null;

    return {
      count: reactions.length,
      viewerReacted,
      canReact: Boolean(currentUser) && !isOwner && post.visibility !== "private",
      unavailableReason: post.visibility === "private"
        ? ("private" as const)
        : !currentUser
          ? ("signedOut" as const)
          : isOwner
            ? ("owner" as const)
            : null,
    };
  },
});

export const toggle = mutation({
  args: { postId: v.id("posts") },
  handler: async (ctx, args) => {
    const currentUser = await authComponent.getAuthUser(ctx);
    const post = await ctx.db.get(args.postId);

    if (!post) throw new Error("Plant not found");
    if (post.userId === currentUser._id) {
      throw new Error("You cannot water your own plant");
    }
    if (post.visibility === "private") {
      throw new Error("Private plants cannot be watered");
    }

    const existing = await ctx.db
      .query("plantReactions")
      .withIndex("by_postId_userId", (q) =>
        q.eq("postId", args.postId).eq("userId", currentUser._id)
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { watered: false };
    }

    await ctx.db.insert("plantReactions", {
      postId: args.postId,
      userId: currentUser._id,
    });
    return { watered: true };
  },
});
