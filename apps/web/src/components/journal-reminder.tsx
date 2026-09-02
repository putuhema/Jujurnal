"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@puma-brain/backend/convex/_generated/api";

import { getBrowserTimeZone } from "@/lib/calendar-date";
import {
  getLocalDateString,
  isJournalReminderEnabled,
  JOURNAL_REMINDER_CHANGED_EVENT,
  JOURNAL_REMINDER_LAST_SENT_KEY,
} from "@/lib/journal-reminder";

const EIGHT_PM = 20;

async function showReminder() {
  const registration = await navigator.serviceWorker.register("/journal-sw.js");
  await registration.showNotification("Your journal is waiting 🌱", {
    body: "Take a quiet moment to write today’s journal.",
    icon: "/web-app-manifest-192x192.png",
    badge: "/web-app-manifest-192x192.png",
    tag: "daily-journal-reminder",
  });
}
export function JournalReminder() {
  const [enabled, setEnabled] = useState(false);
  const timeZone = getBrowserTimeZone();
  const hasPostedToday = useQuery(api.posts.hasPostedToday, { timeZone });

  useEffect(() => {
    setEnabled(isJournalReminderEnabled());
    const handleChange = (event: Event) => {
      setEnabled((event as CustomEvent<boolean>).detail);
    };
    window.addEventListener(JOURNAL_REMINDER_CHANGED_EVENT, handleChange);
    return () =>
      window.removeEventListener(JOURNAL_REMINDER_CHANGED_EVENT, handleChange);
  }, []);

  useEffect(() => {
    if (
      !enabled ||
      hasPostedToday !== false ||
      !("Notification" in window) ||
      Notification.permission !== "granted" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    const notifyIfNeeded = async () => {
      const now = new Date();
      const today = getLocalDateString(now);
      if (
        now.getHours() < EIGHT_PM ||
        window.localStorage.getItem(JOURNAL_REMINDER_LAST_SENT_KEY) === today
      ) {
        return;
      }

      try {
        await showReminder();
        window.localStorage.setItem(JOURNAL_REMINDER_LAST_SENT_KEY, today);
      } catch {
        // The browser can decline background notifications even after permission.
      }
    };

    const now = new Date();
    const nextReminder = new Date(now);
    nextReminder.setHours(EIGHT_PM, 0, 0, 0);
    if (nextReminder.getTime() <= now.getTime()) {
      void notifyIfNeeded();
      nextReminder.setDate(nextReminder.getDate() + 1);
    }

    const timeout = window.setTimeout(
      () => void notifyIfNeeded(),
      nextReminder.getTime() - now.getTime()
    );
    return () => window.clearTimeout(timeout);
  }, [enabled, hasPostedToday]);

  return null;
}
