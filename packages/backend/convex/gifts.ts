import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";
import { GIFT_NOTE_MAX, giftKinds } from "./gardenItems";
import { getUsersById } from "./users";

const GIFT_COOLDOWN_MS = 20 * 60 * 60 * 1000;

// Leave a small gift (and maybe a kind note) in someone's garden. One per
// person per garden per day, so it stays special and can't be used to flood.
// Expected outcomes are returned, not thrown, so the app can just say so.
export const send = mutation({
  args: {
    toUserId: v.string(),
    kind: v.union(...giftKinds.map((kind) => v.literal(kind))),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return { status: "signedOut" as const };
    if (args.toUserId === user._id) return { status: "unavailable" as const };
    const recipient = await authComponent.getAnyUserById(ctx, args.toUserId);
    if (!recipient) return { status: "unavailable" as const };
    const note = args.note?.trim().slice(0, GIFT_NOTE_MAX) || undefined;

    const last = await ctx.db
      .query("gifts")
      .withIndex("by_from_to", (q) => q.eq("fromUserId", user._id).eq("toUserId", args.toUserId))
      .order("desc")
      .first();
    if (last && Date.now() - last._creationTime < GIFT_COOLDOWN_MS) return { status: "already" as const };
    await ctx.db.insert("gifts", { toUserId: args.toUserId, fromUserId: user._id, kind: args.kind, note, read: false });
    return { status: "sent" as const };
  },
});

// Gardens you've left a gift in recently (so the app can say so up front).
export const giftedRecently = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return [];
    const since = Date.now() - GIFT_COOLDOWN_MS;
    // This sender's gifts (by_from_to's prefix), keeping only the last day's.
    const recent = await ctx.db
      .query("gifts")
      .withIndex("by_from_to", (q) => q.eq("fromUserId", user._id))
      .filter((q) => q.gt(q.field("_creationTime"), since))
      .take(100);
    return [...new Set(recent.map((gift) => gift.toUserId))];
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
