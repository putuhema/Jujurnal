// Shared by the backend (validation) and the web app (the decoration tray).

// Decorations you can place in your garden, unlocked by your longest streak.
export const decorationKinds = ["stones", "bench", "lantern", "birdbath", "arch"] as const;
export type DecorationKind = (typeof decorationKinds)[number];

export const decorationUnlocks: Record<DecorationKind, number> = {
  stones: 0,
  bench: 3,
  lantern: 7,
  birdbath: 14,
  arch: 30,
};

// Gifts a visitor can leave in someone's garden.
export const giftKinds = ["pebble", "fireflies", "blossom"] as const;
export type GiftKind = (typeof giftKinds)[number];

export const GIFT_NOTE_MAX = 140;
export const MAX_DECORATIONS = 24;

// Longest run of consecutive days with a journal.
export const longestStreak = (dates: Iterable<string>) => {
  const days = [...new Set(dates)].sort().map((date) => Date.parse(`${date}T00:00:00Z`) / 86_400_000);
  let longest = 0;
  let run = 0;
  for (let index = 0; index < days.length; index++) {
    run = index > 0 && days[index] - days[index - 1] === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }
  return longest;
};

// Weeds: one creeps into your garden every so often while you're away, up to
// a handful. Pulling them all starts the clock again.
export const WEEDS = { everyMs: 10 * 60 * 60 * 1000, max: 5 };
export const weedCount = (since: number, now: number) => Math.max(0, Math.min(WEEDS.max, Math.floor((now - since) / WEEDS.everyMs)));
