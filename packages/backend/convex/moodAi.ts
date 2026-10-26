import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import type { MoodGrade } from "./types";

// Reads a journal entry with a GLM model (Zhipu AI) and picks its weather.
// Only the six grades the mood picker offers are used, so AI moods match hand-picked ones.
const AI_GRADES = ["A+", "A", "B", "C", "D", "F"] as const satisfies readonly MoodGrade[];

// Used when the AI is unavailable or unsure: a calm, steady plant.
export const FALLBACK_MOOD: MoodGrade = "C";

const SYSTEM_PROMPT = `You read short personal journal entries and judge the writer's overall mood.
Answer with JSON only, like {"grade":"B","reason":"..."}.
"grade" must be one of:
- "A+" radiant: joyful, elated, deeply grateful
- "A" sunny: happy, warm, satisfied
- "B" partly sunny: okay to good, mild positives
- "C" cloudy: neutral, flat, mixed, or matter-of-fact
- "D" drizzle: low, tired, worried, frustrated, sad
- "F" rain: very distressed, hopeless, grieving, overwhelmed
"reason" is one short, kind sentence (under 15 words) in the entry's language.
The entry may be in any language.`;

export type MoodReading = { grade: MoodGrade; reason?: string };

// Pulls the grade and reason out of the model's reply, tolerating code fences or extra text.
export const parseMoodReply = (reply: string): MoodReading | null => {
  const json = reply.match(/\{[\s\S]*\}/)?.[0];
  if (json) {
    try {
      const parsed = JSON.parse(json) as { grade?: unknown; reason?: unknown };
      const grade = typeof parsed.grade === "string" ? parsed.grade.trim().toUpperCase() : "";
      if ((AI_GRADES as readonly string[]).includes(grade)) {
        const reason =
          typeof parsed.reason === "string" && parsed.reason.trim()
            ? parsed.reason.trim().slice(0, 200)
            : undefined;
        return { grade: grade as MoodGrade, reason };
      }
    } catch {
      // Fall through to the plain-text match below.
    }
  }
  // A reply that is just a grade, e.g. "B" or "Grade: B".
  const bare = reply.trim().match(/^(?:grade:?\s*)?"?(A\+|A|B|C|D|F)"?\.?$/i)?.[1];
  return bare ? { grade: bare.toUpperCase() as MoodGrade } : null;
};

// Returns null when no key is set, the request fails, or the reply can't be read.
export const readMoodWithGlm = async (text: string, modelOverride?: string): Promise<MoodReading | null> => {
  const apiKey = process.env.GLM_API_KEY;
  if (!apiKey) return null;

  const baseUrl = (process.env.GLM_BASE_URL ?? "https://open.bigmodel.cn/api/paas/v4").replace(/\/$/, "");
  const model = modelOverride ?? process.env.GLM_MODEL ?? "glm-5";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        max_tokens: 300,
        // GLM-4.5 and later think before answering by default, which would use up
        // the token budget and leave the reply empty. A mood label doesn't need it.
        thinking: { type: "disabled" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: text },
        ],
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      console.warn(`GLM mood request failed: ${response.status} ${await response.text()}`);
      return null;
    }
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const reply = data.choices?.[0]?.message?.content ?? "";
    const reading = parseMoodReply(reply);
    if (!reading) console.warn(`GLM mood reply not understood: ${reply}`);
    return reading;
  } catch (error) {
    console.warn("GLM mood request errored", error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

// For checking the GLM setup by hand, e.g.:
// npx convex run moodAi:tryMood '{"text":"Long day, but dinner with friends was lovely."}'
export const tryMood = internalAction({
  args: { text: v.string(), model: v.optional(v.string()) },
  handler: async (_ctx, args) => readMoodWithGlm(args.text, args.model),
});
