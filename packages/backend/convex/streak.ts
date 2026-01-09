import { query } from "./_generated/server";
import { authComponent } from "./auth";
import { getDateString, getDateStringForDay } from "./helpers";

export const getStreakStats = query({
  handler: async (ctx) => {
    const currentUser = await authComponent.safeGetAuthUser(ctx);
    if (!currentUser) {
      return {
        currentStreak: 0,
        longestStreak: 0,
        totalPosts: 0,
      };
    }

    // Get all posts for the current user
    const posts = await ctx.db
      .query("posts")
      .withIndex("by_authorId", (q) => q.eq("userId", currentUser._id))
      .collect();

    const totalPosts = posts.length;

    // Group posts by date (YYYY-MM-DD)
    const postsByDate = new Set<string>();
    for (const post of posts) {
      const dateStr = getDateString(post._creationTime);
      postsByDate.add(dateStr);
    }

    // Calculate current streak (consecutive days from today backwards)
    // Current streak only counts if there's a post today
    let currentStreak = 0;
    const today = getDateString(Date.now());

    // Check if there's a post today
    if (postsByDate.has(today)) {
      currentStreak = 1;
      let daysAgo = 1;

      // Count backwards until we find a day without a post
      while (true) {
        const dateStr = getDateStringForDay(daysAgo);
        if (postsByDate.has(dateStr)) {
          currentStreak++;
          daysAgo++;
        } else {
          break;
        }
      }
    }

    // Calculate longest streak
    if (postsByDate.size === 0) {
      return {
        currentStreak: 0,
        longestStreak: 0,
        totalPosts: 0,
      };
    }

    // Sort all dates
    const sortedDates = Array.from(postsByDate).sort();

    let longestStreak = 1;
    let currentLongestStreak = 1;

    for (let i = 1; i < sortedDates.length; i++) {
      const prevDate = new Date(sortedDates[i - 1] + "T00:00:00Z");
      const currDate = new Date(sortedDates[i] + "T00:00:00Z");

      // Calculate days difference
      const daysDiff = Math.floor(
        (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysDiff === 1) {
        // Consecutive day
        currentLongestStreak++;
        longestStreak = Math.max(longestStreak, currentLongestStreak);
      } else {
        // Streak broken
        currentLongestStreak = 1;
      }
    }

    return {
      currentStreak,
      longestStreak,
      totalPosts,
    };
  },
});
