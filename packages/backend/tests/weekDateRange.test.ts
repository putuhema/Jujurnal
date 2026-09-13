import { describe, expect, test } from "bun:test";

import { getWeekDateRange } from "../convex/helpers";

describe("getWeekDateRange", () => {
  test("returns a Monday through Sunday range", () => {
    const sundayInMakassar = Date.UTC(2026, 8, 13, 4, 0);

    expect(getWeekDateRange(sundayInMakassar, "Asia/Makassar")).toEqual({
      today: "2026-09-13",
      weekStart: "2026-09-07",
      weekEnd: "2026-09-13",
      previousWeekStart: "2026-08-31",
      previousWeekEnd: "2026-09-06",
    });
  });

  test("uses the local date near a UTC date boundary", () => {
    const sundayEveningInNewYork = Date.UTC(2026, 8, 14, 1, 30);

    expect(getWeekDateRange(sundayEveningInNewYork, "America/New_York")).toEqual({
      today: "2026-09-13",
      weekStart: "2026-09-07",
      weekEnd: "2026-09-13",
      previousWeekStart: "2026-08-31",
      previousWeekEnd: "2026-09-06",
    });
  });
});
