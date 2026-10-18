"use client";

import { Cloud, CloudDrizzle, CloudRain, CloudSun, Sun, SunMedium, type LucideIcon } from "lucide-react";
import type { MoodGrade } from "@/lib/garden-procedural";
import { cn } from "@/lib/utils";
import { moodLabels } from "./garden-flower";

// The writer names their own weather. Each choice maps to a grade, which sets
// how colourful the flower grows.
export const moodChoices: { grade: MoodGrade; icon: LucideIcon }[] = [
  { grade: "A+", icon: Sun },
  { grade: "A", icon: SunMedium },
  { grade: "B", icon: CloudSun },
  { grade: "C", icon: Cloud },
  { grade: "D", icon: CloudDrizzle },
  { grade: "F", icon: CloudRain },
];

// Older entries may hold in-between grades (B-, C+…); match them to the choice with the same label.
export const toMoodChoice = (grade: MoodGrade) =>
  moodChoices.find((choice) => moodLabels[choice.grade] === moodLabels[grade])?.grade ?? grade;

export const MoodPicker = ({
  value,
  onChange,
  disabled,
}: {
  value: MoodGrade | null;
  onChange: (grade: MoodGrade) => void;
  disabled?: boolean;
}) => (
  <div role="radiogroup" aria-label="How does today feel?" className="grid grid-cols-3 gap-2">
    {moodChoices.map(({ grade, icon: Icon }) => {
      const isSelected = value !== null && toMoodChoice(value) === grade;
      return (
        <button
          key={grade}
          type="button"
          role="radio"
          aria-checked={isSelected}
          disabled={disabled}
          onClick={() => onChange(grade)}
          className={cn(
            "flex min-h-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-default disabled:opacity-50",
            isSelected
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background/60 text-foreground/80 hover:bg-muted"
          )}
        >
          <Icon className="size-5" aria-hidden="true" />
          {moodLabels[grade]}
        </button>
      );
    })}
  </div>
);

// A lighter version for writing: one row of weather, and choosing is optional.
// Tap the chosen one again to clear it.
export const MoodRow = ({
  value,
  onChange,
  disabled,
}: {
  value: MoodGrade | null;
  onChange: (grade: MoodGrade | null) => void;
  disabled?: boolean;
}) => (
  <div>
    <div className="flex items-baseline justify-between gap-2 px-1">
      <p className="text-sm font-medium" id="mood-row-label">
        How does it feel? <span className="font-normal text-muted-foreground">Optional</span>
      </p>
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {value ? moodLabels[value] : null}
      </p>
    </div>
    <div role="radiogroup" aria-labelledby="mood-row-label" className="mt-2 grid grid-cols-6 gap-1.5">
      {moodChoices.map(({ grade, icon: Icon }) => {
        const isSelected = value !== null && toMoodChoice(value) === grade;
        return (
          <button
            key={grade}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={moodLabels[grade]}
            title={moodLabels[grade]}
            disabled={disabled}
            onClick={() => onChange(isSelected ? null : grade)}
            className={cn(
              "flex h-11 cursor-pointer items-center justify-center rounded-full border transition-[background-color,color,border-color,transform] duration-150 ease-out active:scale-[0.94] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-default disabled:opacity-50",
              isSelected ? "border-primary bg-primary text-primary-foreground" : "border-border/70 bg-background/50 text-foreground/70 hover:bg-muted"
            )}
          >
            <Icon className="size-5" aria-hidden="true" />
          </button>
        );
      })}
    </div>
    {!value ? <p className="mt-1.5 px-1 text-xs text-muted-foreground">Not sure? Skip it, and it grows as a calm, steady plant.</p> : null}
  </div>
);
