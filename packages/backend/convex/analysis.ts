import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import type { MoodGrade, GrammarSuggestion } from "./types";

export const analyzeGrammar = async (
  text: string
): Promise<GrammarSuggestion[]> => {
  const model = google("gemini-2.5-flash");

  const { text: grammarAnalysis } = await generateText({
    model,
    system:
      "You are an English grammar teacher helping a student improve their writing. Analyze the following text for grammar, spelling, punctuation, and style errors.",
    prompt: `
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

export const applyCorrectionsToText = (
  text: string,
  suggestions: GrammarSuggestion[]
): string => {
  let correctedText = text;

  const sortedSuggestions = [...suggestions].sort((a, b) => {
    const indexA = correctedText.lastIndexOf(a.original);
    const indexB = correctedText.lastIndexOf(b.original);
    return indexB - indexA;
  });

  for (const suggestion of sortedSuggestions) {
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

export const analyzeMood = async (
  text: string
): Promise<{ grade: MoodGrade }> => {
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

  const finalGrade = validGrades.includes(grade) ? grade : "C";

  return { grade: finalGrade };
};
