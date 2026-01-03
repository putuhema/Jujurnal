import { v } from "convex/values";

import {
  query,
  mutation,
  action,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { authComponent } from "./auth";
import { google } from "@ai-sdk/google";
import { generateText } from "ai";

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

type MoodGrade =
  | "A+"
  | "A"
  | "A-"
  | "B+"
  | "B"
  | "B-"
  | "C+"
  | "C"
  | "C-"
  | "D+"
  | "D"
  | "D-"
  | "F";

type GrammarSuggestion = {
  original: string;
  corrected: string;
  explanation: string;
  issueType: string;
};

const analyzeGrammar = async (text: string): Promise<GrammarSuggestion[]> => {
  const model = google("gemini-2.5-flash");

  const { text: grammarAnalysis } = await generateText({
    model,
    prompt: `You are an English grammar teacher helping a student improve their writing. Analyze the following text for grammar, spelling, punctuation, and style errors.

Text to analyze: "${text}"

For each error or improvement you find, provide:
1. The original incorrect text (exact phrase or word)
2. The corrected version
3. A clear explanation of what changed and why (educational, helpful tone)
4. The type of issue (e.g., "Grammar", "Spelling", "Punctuation", "Style", "Word Choice", "Tense", etc.)

If the text is perfect or has no significant errors, respond with: "NO_ERRORS"

Otherwise, respond with a JSON array in this exact format:
[
  {
    "original": "the exact incorrect text",
    "corrected": "the corrected version",
    "explanation": "Clear explanation of what changed and why this is better",
    "issueType": "Grammar"
  }
]

Be thorough but focus on actual errors and meaningful improvements. Don't suggest changes just for style preferences unless there's a clear issue.`,
  });

  if (grammarAnalysis.trim() === "NO_ERRORS") {
    return [];
  }

  try {
    // Try to parse JSON from the response
    const jsonMatch = grammarAnalysis.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const suggestions = JSON.parse(jsonMatch[0]) as GrammarSuggestion[];
      return suggestions.filter(
        (s) => s.original && s.corrected && s.explanation && s.issueType
      );
    }
  } catch (error) {
    console.error("Error parsing grammar suggestions:", error);
  }

  return [];
};

const applyCorrectionsToText = (
  text: string,
  suggestions: GrammarSuggestion[]
): string => {
  let correctedText = text;

  // Apply corrections in reverse order to maintain correct indices
  // Sort by position in text (from end to start) to avoid index shifting issues
  const sortedSuggestions = [...suggestions].sort((a, b) => {
    const indexA = correctedText.lastIndexOf(a.original);
    const indexB = correctedText.lastIndexOf(b.original);
    return indexB - indexA; // Sort descending
  });

  for (const suggestion of sortedSuggestions) {
    // Replace all occurrences of the original text with corrected text
    correctedText = correctedText.replace(
      new RegExp(
        suggestion.original.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "g"
      ),
      suggestion.corrected
    );
  }

  return correctedText;
};

const analyzeMood = async (text: string): Promise<MoodGrade> => {
  const model = google("gemini-2.5-flash");

  const { text: moodText } = await generateText({
    model,
    prompt: `Analyze the mood or tone of the following text and assign it a grade from A+ (very positive) to F (very negative). 

The grading scale is:
- A+: Extremely positive, joyful, enthusiastic
- A: Very positive, happy, optimistic
- A-: Positive, content, satisfied
- B+: Somewhat positive, mildly optimistic
- B: Neutral-positive, slightly upbeat
- B-: Neutral with slight positive lean
- C+: Neutral with slight negative lean
- C: Neutral, balanced
- C-: Neutral-negative, slightly down
- D+: Somewhat negative, mildly pessimistic
- D: Negative, sad, disappointed
- D-: Very negative, upset, frustrated
- F: Extremely negative, angry, despairing

Text to analyze: "${text}"

Respond with ONLY the grade letter (e.g., "A+", "B-", "F") and nothing else.`,
  });

  const grade = moodText.trim() as MoodGrade;
  const validGrades: MoodGrade[] = [
    "A+",
    "A",
    "A-",
    "B+",
    "B",
    "B-",
    "C+",
    "C",
    "C-",
    "D+",
    "D",
    "D-",
    "F",
  ];

  if (validGrades.includes(grade)) {
    return grade;
  }

  return "C";
};

// Convert mood grade to a fun, engaging word
const getMoodWord = (grade: MoodGrade): string => {
  const moodWords: Record<MoodGrade, string> = {
    "A+": "Radiant ✨",
    A: "Sunny 🌞",
    "A-": "Content 😊",
    "B+": "Upbeat 🎵",
    B: "Steady ⚖️",
    "B-": "Chill 😌",
    "C+": "Reflective 🤔",
    C: "Balanced ⚖️",
    "C-": "Subdued 🌫️",
    "D+": "Cloudy ☁️",
    D: "Heavy 💭",
    "D-": "Stormy ⛈️",
    F: "Grim 🌑",
  };
  return moodWords[grade] || "Unknown";
};

// Convert numeric grade to MoodGrade
const gradeToNumber = (grade: MoodGrade): number => {
  const gradeMap: Record<MoodGrade, number> = {
    "A+": 13,
    A: 12,
    "A-": 11,
    "B+": 10,
    B: 9,
    "B-": 8,
    "C+": 7,
    C: 6,
    "C-": 5,
    "D+": 4,
    D: 3,
    "D-": 2,
    F: 1,
  };
  return gradeMap[grade];
};

// Convert number back to MoodGrade
const numberToGrade = (num: number): MoodGrade => {
  if (num >= 12.5) return "A+";
  if (num >= 11.5) return "A";
  if (num >= 10.5) return "A-";
  if (num >= 9.5) return "B+";
  if (num >= 8.5) return "B";
  if (num >= 7.5) return "B-";
  if (num >= 6.5) return "C+";
  if (num >= 5.5) return "C";
  if (num >= 4.5) return "C-";
  if (num >= 3.5) return "D+";
  if (num >= 2.5) return "D";
  if (num >= 1.5) return "D-";
  return "F";
};

// Helper function to get date string (YYYY-MM-DD) from timestamp
const getDateString = (timestamp: number): string => {
  const date = new Date(timestamp);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Helper function to get date string for a specific day offset
const getDateStringForDay = (daysAgo: number): string => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return getDateString(date.getTime());
};

export const getUserPostsInternal = internalQuery({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const posts = await ctx.db
      .query("posts")
      .withIndex("by_authorId", (q) => q.eq("userId", args.userId))
      .collect();
    return posts.map((post) => ({
      body: post.body,
      mood: post.mood,
      _creationTime: post._creationTime,
    }));
  },
});

export const createInternal = internalMutation({
  args: {
    text: v.string(),
    userId: v.string(),
    mood: v.union(
      v.literal("A+"),
      v.literal("A"),
      v.literal("A-"),
      v.literal("B+"),
      v.literal("B"),
      v.literal("B-"),
      v.literal("C+"),
      v.literal("C"),
      v.literal("C-"),
      v.literal("D+"),
      v.literal("D"),
      v.literal("D-"),
      v.literal("F")
    ),
    grammarSuggestions: v.optional(
      v.array(
        v.object({
          original: v.string(),
          corrected: v.string(),
          explanation: v.string(),
          issueType: v.string(),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("posts", {
      body: args.text,
      userId: args.userId,
      mood: args.mood,
      grammarSuggestions: args.grammarSuggestions,
    });

    // Check for badges after creating post
    const posts = await ctx.db
      .query("posts")
      .withIndex("by_authorId", (q) => q.eq("userId", args.userId))
      .collect();

    const postCount = posts.length;

    // Check post count badges
    await ctx.runMutation(internal.achievements.checkPostCountBadges, {
      userId: args.userId,
      postCount,
    });

    // Check perfect grammar badge
    await ctx.runMutation(internal.achievements.checkPerfectGrammarBadge, {
      userId: args.userId,
      hasGrammarSuggestions: !!(
        args.grammarSuggestions && args.grammarSuggestions.length > 0
      ),
    });

    // Check streak badges
    const postsByDate = new Set<string>();
    for (const post of posts) {
      const dateStr = getDateString(post._creationTime);
      postsByDate.add(dateStr);
    }

    // Calculate current streak
    let currentStreak = 0;
    const today = getDateString(Date.now());
    if (postsByDate.has(today)) {
      currentStreak = 1;
      let daysAgo = 1;
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
    let longestStreak = 1;
    if (postsByDate.size > 0) {
      const sortedDates = Array.from(postsByDate).sort();
      let currentLongestStreak = 1;
      for (let i = 1; i < sortedDates.length; i++) {
        const prevDate = new Date(sortedDates[i - 1] + "T00:00:00Z");
        const currDate = new Date(sortedDates[i] + "T00:00:00Z");
        const daysDiff = Math.floor(
          (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysDiff === 1) {
          currentLongestStreak++;
          longestStreak = Math.max(longestStreak, currentLongestStreak);
        } else {
          currentLongestStreak = 1;
        }
      }
    }

    await ctx.runMutation(internal.achievements.checkStreakBadges, {
      userId: args.userId,
      currentStreak,
      longestStreak,
    });
  },
});

export const create = action({
  args: {
    text: v.string(),
  },
  handler: async (ctx, args) => {
    "use node";
    const currentUser = await authComponent.getAuthUser(ctx);

    if (!currentUser) {
      throw new Error("Not authenticated");
    }

    const [mood, grammarSuggestions] = await Promise.all([
      analyzeMood(args.text),
      analyzeGrammar(args.text),
    ]);

    await ctx.runMutation(internal.post.createInternal, {
      text: args.text,
      userId: currentUser._id,
      mood,
      grammarSuggestions:
        grammarSuggestions.length > 0 ? grammarSuggestions : undefined,
    });
  },
});

export const applyGrammarCorrections = mutation({
  args: {
    id: v.id("posts"),
  },
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.id);

    if (!post) {
      throw new Error("Post not found");
    }

    const currentUser = await authComponent.safeGetAuthUser(ctx);
    if (!currentUser || post.userId !== currentUser._id) {
      throw new Error("Not authorized");
    }

    if (!post.grammarSuggestions || post.grammarSuggestions.length === 0) {
      throw new Error("No grammar suggestions available");
    }

    const baseText = post.originalBody || post.body;
    const correctedText = applyCorrectionsToText(
      baseText,
      post.grammarSuggestions
    );

    const originalBody = post.originalBody || post.body;

    await ctx.db.patch(args.id, {
      body: correctedText,
      originalBody: originalBody,
      isEdited: true,
      editedAt: Date.now(),
    });

    return { success: true, correctedText };
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

export const getMonthlyMood = query({
  handler: async (ctx) => {
    const currentUser = await authComponent.safeGetAuthUser(ctx);
    if (!currentUser) {
      return null;
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    );

    const startTimestamp = startOfMonth.getTime();
    const endTimestamp = endOfMonth.getTime();

    const posts = await ctx.db
      .query("posts")
      .withIndex("by_authorId", (q) => q.eq("userId", currentUser._id))
      .collect();

    const monthlyPosts = posts.filter((post) => {
      const postTime = post._creationTime;
      return postTime >= startTimestamp && postTime <= endTimestamp;
    });

    if (monthlyPosts.length === 0) {
      return null;
    }

    const moodSum = monthlyPosts.reduce((sum, post) => {
      return sum + gradeToNumber(post.mood);
    }, 0);

    const averageMood = moodSum / monthlyPosts.length;
    const overallGrade = numberToGrade(averageMood);
    const moodWord = getMoodWord(overallGrade);

    return {
      mood: overallGrade,
      moodWord: moodWord,
      postCount: monthlyPosts.length,
    };
  },
});

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
