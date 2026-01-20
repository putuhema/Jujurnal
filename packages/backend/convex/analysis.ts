import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import type { MoodGrade } from "./types";

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
