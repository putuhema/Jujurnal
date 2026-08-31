import type { MoodGrade } from "./types";

export const getMoodWord = (grade: MoodGrade): string => {
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

export const gradeToNumber = (grade: MoodGrade): number => {
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

export const numberToGrade = (num: number): MoodGrade => {
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

const dateFormatters = new Map<string, Intl.DateTimeFormat>();
const normalizedTimeZones = new Map<string, string>();

export const normalizeTimeZone = (timeZone: string): string => {
  const cachedTimeZone = normalizedTimeZones.get(timeZone);
  if (cachedTimeZone) return cachedTimeZone;

  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    normalizedTimeZones.set(timeZone, timeZone);
    return timeZone;
  } catch {
    normalizedTimeZones.set(timeZone, "UTC");
    return "UTC";
  }
};

export const getDateString = (timestamp: number, timeZone: string): string => {
  const safeTimeZone = normalizeTimeZone(timeZone);
  let formatter = dateFormatters.get(safeTimeZone);

  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: safeTimeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    dateFormatters.set(safeTimeZone, formatter);
  }

  const parts = formatter.formatToParts(new Date(timestamp));
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Unable to create a calendar date");
  }

  return `${year}-${month}-${day}`;
};

export const getDateStringForDay = (
  timestamp: number,
  daysAgo: number,
  timeZone: string
): string => {
  const [year, month, day] = getDateString(timestamp, timeZone)
    .split("-")
    .map(Number);
  const calendarDate = new Date(Date.UTC(year, month - 1, day - daysAgo));
  return calendarDate.toISOString().slice(0, 10);
};
