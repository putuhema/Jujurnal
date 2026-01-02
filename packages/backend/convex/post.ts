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

    // Analyze mood and grammar in parallel for better performance
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
