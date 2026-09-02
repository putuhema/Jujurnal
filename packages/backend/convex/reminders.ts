import { v } from "convex/values";

import { authComponent } from "./auth";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { getDateString } from "./helpers";
import { getReminderOccurrence } from "./reminderSchedule";

const DEFAULT_DAYS = [0, 1, 2, 3, 4, 5, 6];
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const validateTimeZone = (timeZone: string) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format();
  } catch {
    throw new Error("Choose a valid timezone");
  }
};

export const getMySettings = query({
  args: { timeZone: v.string() },
  handler: async (ctx, args) => {
    const currentUser = await authComponent.safeGetAuthUser(ctx);
    if (!currentUser) return null;

    const settings = await ctx.db
      .query("reminderSettings")
      .withIndex("by_userId", (q) => q.eq("userId", currentUser._id))
      .unique();

    return settings
      ? {
          enabled: settings.enabled,
          days: settings.days,
          time: settings.time,
          timeZone: settings.timeZone,
        }
      : {
          enabled: false,
          days: DEFAULT_DAYS,
          time: "20:00",
          timeZone: args.timeZone,
        };
  },
});

export const getPublicVapidKey = query({
  args: {},
  handler: async () => process.env.VAPID_PUBLIC_KEY ?? null,
});

export const saveSettings = mutation({
  args: {
    enabled: v.boolean(),
    days: v.array(v.number()),
    time: v.string(),
    timeZone: v.string(),
  },
  handler: async (ctx, args) => {
    const currentUser = await authComponent.getAuthUser(ctx);
    if (!TIME_PATTERN.test(args.time)) throw new Error("Choose a valid reminder time");

    const days = [...new Set(args.days)].sort((a, b) => a - b);
    if (days.length === 0 || days.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) {
      throw new Error("Choose at least one reminder day");
    }
    validateTimeZone(args.timeZone);

    if (args.enabled) {
      const subscription = await ctx.db
        .query("pushSubscriptions")
        .withIndex("by_userId", (q) => q.eq("userId", currentUser._id))
        .first();
      if (!subscription) throw new Error("Enable notifications on this device first");
    }

    const existing = await ctx.db
      .query("reminderSettings")
      .withIndex("by_userId", (q) => q.eq("userId", currentUser._id))
      .unique();
    const values = {
      enabled: args.enabled,
      days,
      time: args.time,
      timeZone: args.timeZone,
    };

    if (existing) await ctx.db.patch(existing._id, values);
    else await ctx.db.insert("reminderSettings", { userId: currentUser._id, ...values });
  },
});

export const registerSubscription = mutation({
  args: {
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
  },
  handler: async (ctx, args) => {
    const currentUser = await authComponent.getAuthUser(ctx);
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .unique();
    const values = {
      userId: currentUser._id,
      p256dh: args.p256dh,
      auth: args.auth,
      updatedAt: Date.now(),
    };

    if (existing) await ctx.db.patch(existing._id, values);
    else await ctx.db.insert("pushSubscriptions", { endpoint: args.endpoint, ...values });
  },
});

export const getDueDeliveries = internalQuery({
  args: { now: v.number() },
  handler: async (ctx, args) => {
    const settings = await ctx.db
      .query("reminderSettings")
      .withIndex("by_enabled", (q) => q.eq("enabled", true))
      .collect();
    const due = [];

    for (const setting of settings) {
      const occurrence = getReminderOccurrence({
        now: args.now,
        timeZone: setting.timeZone,
        days: setting.days,
        time: setting.time,
        lastSentDate: setting.lastSentDate,
      });
      if (!occurrence.due) continue;

      const posts = await ctx.db
        .query("posts")
        .withIndex("by_authorId", (q) => q.eq("userId", setting.userId))
        .collect();
      const hasWritten = posts.some(
        (post) =>
          (post.entryDate ?? getDateString(post._creationTime, setting.timeZone)) ===
          occurrence.localDate
      );
      if (hasWritten) continue;

      const subscriptions = await ctx.db
        .query("pushSubscriptions")
        .withIndex("by_userId", (q) => q.eq("userId", setting.userId))
        .collect();
      if (subscriptions.length > 0) {
        due.push({
          settingId: setting._id,
          localDate: occurrence.localDate,
          subscriptions: subscriptions.map(({ endpoint, p256dh, auth }) => ({
            endpoint,
            keys: { p256dh, auth },
          })),
        });
      }
    }

    return due;
  },
});

export const finishDelivery = internalMutation({
  args: {
    settingId: v.id("reminderSettings"),
    localDate: v.string(),
    expiredEndpoints: v.array(v.string()),
    delivered: v.boolean(),
  },
  handler: async (ctx, args) => {
    for (const endpoint of args.expiredEndpoints) {
      const subscription = await ctx.db
        .query("pushSubscriptions")
        .withIndex("by_endpoint", (q) => q.eq("endpoint", endpoint))
        .unique();
      if (subscription) await ctx.db.delete(subscription._id);
    }
    if (args.delivered) {
      await ctx.db.patch(args.settingId, { lastSentDate: args.localDate });
    }
  },
});
