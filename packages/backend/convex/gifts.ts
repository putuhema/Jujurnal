import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";
import { GIFT_NOTE_MAX, giftKinds } from "./gardenItems";
import { getUsersById } from "./users";

const GIFT_COOLDOWN_MS = 20 * 60 * 60 * 1000;

// Leave a small gift (and maybe a kind note) in someone's garden. One per
// person per garden per day, so it stays special and can't be used to flood.
export const send = mutation({
  args: {
    toUserId: v.string(),
    kind: v.union(...giftKinds.map((kind) => v.literal(kind))),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (args.toUserId === user._id) throw new ConvexError("You can't leave a gift in your own garden");
    const recipient = await authComponent.getAnyUserById(ctx, args.toUserId);
    if (!recipient) throw new ConvexError("That garden doesn't exist");
    const note = args.note?.trim().slice(0, GIFT_NOTE_MAX) || undefined;

    const last = await ctx.db
      .query("gifts")
      .withIndex("by_from_to", (q) => q.eq("fromUserId", user._id).eq("toUserId", args.toUserId))
      .order("desc")
      .first();
    if (last && Date.now() - last._creationTime < GIFT_COOLDOWN_MS) {
      throw new ConvexError("You've already left a gift here today");
    }
    await ctx.db.insert("gifts", { toUserId: args.toUserId, fromUserId: user._id, kind: args.kind, note, read: false });
  },
});

// Gifts left in your garden, newest first. Only you ever see the notes.
export const getMine = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return null;
    const gifts = await ctx.db.query("gifts").withIndex("by_to", (q) => q.eq("toUserId", user._id)).order("desc").take(30);
    const senders = await getUsersById(ctx, gifts.map((gift) => gift.fromUserId));
    return gifts.map((gift) => ({
      _id: gift._id,
      _creationTime: gift._creationTime,
      kind: gift.kind,
      note: gift.note,
      read: gift.read,
      from: senders.get(gift.fromUserId)?.name ?? "A gardener",
    }));
  },
});

export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    const unread = await ctx.db
      .query("gifts")
      .withIndex("by_to", (q) => q.eq("toUserId", user._id))
      .filter((q) => q.eq(q.field("read"), false))
      .take(100);
    await Promise.all(unread.map((gift) => ctx.db.patch(gift._id, { read: true })));
  },
});

export const remove = mutation({
  args: { id: v.id("gifts") },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const gift = await ctx.db.get(args.id);
    if (!gift || gift.toUserId !== user._id) throw new ConvexError("Gift not found");
    await ctx.db.delete(args.id);
  },
});
