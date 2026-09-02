"use node";

import webpush, { type WebPushError } from "web-push";

import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

export const sendDueReminders = internalAction({
  args: {},
  handler: async (ctx) => {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT ?? process.env.SITE_URL;
    if (!publicKey || !privateKey || !subject) {
      console.error("Web Push is missing VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, or VAPID_SUBJECT/SITE_URL");
      return;
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);
    const deliveries = await ctx.runQuery(internal.reminders.getDueDeliveries, {
      now: Date.now(),
    });
    const payload = JSON.stringify({
      title: "Your journal is waiting 🌱",
      body: "Take a quiet moment to write today’s journal.",
      url: "/",
    });

    for (const delivery of deliveries) {
      const expiredEndpoints: string[] = [];
      let delivered = false;
      await Promise.all(
        delivery.subscriptions.map(async (subscription) => {
          try {
            await webpush.sendNotification(subscription, payload, { TTL: 60 * 60 * 6 });
            delivered = true;
          } catch (error) {
            const statusCode = (error as WebPushError).statusCode;
            if (statusCode === 404 || statusCode === 410) {
              expiredEndpoints.push(subscription.endpoint);
            } else {
              console.error("Could not deliver journal reminder", error);
            }
          }
        })
      );
      await ctx.runMutation(internal.reminders.finishDelivery, {
        settingId: delivery.settingId,
        localDate: delivery.localDate,
        expiredEndpoints,
        delivered,
      });
    }
  },
});
