import { describe, expect, test } from "bun:test";

import { getReminderOccurrence } from "../convex/reminderSchedule";

describe("getReminderOccurrence", () => {
  const mondayAt2030InMakassar = Date.UTC(2026, 8, 7, 12, 30);

  test("becomes due after the configured local time", () => {
    expect(
      getReminderOccurrence({
        now: mondayAt2030InMakassar,
        timeZone: "Asia/Makassar",
        days: [1],
        time: "20:00",
      })
    ).toEqual({ due: true, localDate: "2026-09-07" });
  });

  test("does not become due before the configured time or on another day", () => {
    expect(
      getReminderOccurrence({
        now: mondayAt2030InMakassar,
        timeZone: "Asia/Makassar",
        days: [1],
        time: "21:00",
      }).due
    ).toBe(false);
    expect(
      getReminderOccurrence({
        now: mondayAt2030InMakassar,
        timeZone: "Asia/Makassar",
        days: [2],
        time: "20:00",
      }).due
    ).toBe(false);
  });

  test("does not send twice on the same local date", () => {
    expect(
      getReminderOccurrence({
        now: mondayAt2030InMakassar,
        timeZone: "Asia/Makassar",
        days: [1],
        time: "20:00",
        lastSentDate: "2026-09-07",
      }).due
    ).toBe(false);
  });

  test("uses the configured timezone across a UTC date boundary", () => {
    const mondayAt2030InNewYork = Date.UTC(2026, 8, 8, 0, 30);
    expect(
      getReminderOccurrence({
        now: mondayAt2030InNewYork,
        timeZone: "America/New_York",
        days: [1],
        time: "20:00",
      })
    ).toEqual({ due: true, localDate: "2026-09-07" });
  });
});
