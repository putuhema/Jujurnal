import { v } from "convex/values";

import { query, mutation } from "./_generated/server";
import { authComponent } from "./auth";

export const getAll = query({
  handler: async (ctx) => {
    const posts = await ctx.db.query("posts").order("desc").collect();
    return Promise.all(
      (posts ?? []).map(async (post) => {
        const user = await authComponent.getAnyUserById(ctx, post.userId);
        return { ...post, user };
      })
    );
  },
});

export const create = mutation({
  args: {
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const currentUser = await authComponent.getAuthUser(ctx);

    if (!currentUser) {
      throw new Error("Not authenticated");
    }

    await ctx.db.insert("posts", {
      body: args.text,
      userId: currentUser._id,
    });
  },
});

export const deletePost = mutation({
  args: {
    id: v.id("posts"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete("posts", args.id);
    return { success: true };
  },
});
