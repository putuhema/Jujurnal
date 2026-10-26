import { describe, expect, test } from "bun:test";
import { parseMoodReply } from "../convex/moodAi";

describe("parseMoodReply", () => {
  test("reads plain JSON", () => {
    expect(parseMoodReply('{"grade":"A","reason":"A warm day with friends."}')).toEqual({
      grade: "A",
      reason: "A warm day with friends.",
    });
  });

  test("reads JSON inside a code fence", () => {
    expect(parseMoodReply('```json\n{"grade": "d", "reason": "Tired."}\n```')).toEqual({
      grade: "D",
      reason: "Tired.",
    });
  });

  test("rejects grades the picker doesn't offer", () => {
    expect(parseMoodReply('{"grade":"B-"}')).toBeNull();
    expect(parseMoodReply('{"grade":"Z"}')).toBeNull();
  });

  test("reads a bare grade", () => {
    expect(parseMoodReply("F")).toEqual({ grade: "F" });
    expect(parseMoodReply("Grade: a+")).toEqual({ grade: "A+" });
  });

  test("returns null for nonsense or sentences", () => {
    expect(parseMoodReply("I cannot tell.")).toBeNull();
    expect(parseMoodReply("A neutral day overall.")).toBeNull();
  });
});
