import { v } from "convex/values";

import { query, mutation, action, internalMutation } from "./_generated/server";
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
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("posts", {
      body: args.text,
      userId: args.userId,
      mood: args.mood,
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

    // Analyze mood using AI
    const mood = await analyzeMood(args.text);

    // Insert post using internal mutation
    await ctx.runMutation(internal.post.createInternal, {
      text: args.text,
      userId: currentUser._id,
      mood,
    });
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
