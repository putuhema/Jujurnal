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

export const getDateString = (timestamp: number): string => {
  const date = new Date(timestamp);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const getDateStringForDay = (daysAgo: number): string => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return getDateString(date.getTime());
};
