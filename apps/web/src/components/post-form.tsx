"use client";

import { useForm } from "@tanstack/react-form";
import z from "zod";
import { Field, FieldGroup } from "@/components/ui/field";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";

import { useAction } from "convex/react";
import { api } from "@puma-brain/backend/convex/_generated/api";
import { Alert, AlertDescription } from "./ui/alert";
import { useState } from "react";
import { Spinner } from "./ui/spinner";
import { GlobeHemisphereWestIcon, LockKeyIcon } from "@phosphor-icons/react";
import { Sprout } from "lucide-react";
import { getBrowserTimeZone } from "@/lib/calendar-date";
import { playGardenSound, prepareGardenAudio } from "@/lib/garden-sounds";
import type { MoodGrade } from "@/lib/garden-procedural";
import { MoodRow } from "./mood-picker";
import { cn } from "@/lib/utils";

const MAX_LENGTH = 280;

type EntryAvailability = {
  today: string;
  yesterday: string;
  canPostToday: boolean;
  canPostYesterday: boolean;
};

export const PostForm = ({
  availability,
  onPlanted,
}: {
  availability: EntryAvailability;
  // Called once the journal is saved, e.g. to close the sheet and reveal the garden.
  onPlanted?: () => void;
}) => {
  const timeZone = getBrowserTimeZone();
  const createPost = useAction(api.posts.create);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [mood, setMood] = useState<MoodGrade | null>(null);
  const [entryDate, setEntryDate] = useState<string | null>(() =>
    availability.canPostToday
      ? availability.today
      : availability.canPostYesterday
        ? availability.yesterday
        : null
  );

  const form = useForm({
    defaultValues: {
      post: "",
    },
    validators: {
      onSubmit: z.object({
        post: z.string().min(12).max(MAX_LENGTH),
      }),
    },
    onSubmit: async ({ value }) => {
      if (!entryDate) {
        setError("Choose an available journal date");
        return;
      }
      setError(null);
      setIsSubmitting(true);
      try {
        await createPost({
          text: value.post,
          timeZone,
          entryDate,
          visibility,
          // Skipping the mood plants a calm, steady plant.
          mood: mood ?? "C",
        });
        playGardenSound("plant");
        form.reset();
        setMood(null);
        onPlanted?.();
      } catch (err: any) {
        setError(err.message || "Failed to create post");
      }
      setIsSubmitting(false);
    },
  });

  const isDisabled = !entryDate || isSubmitting;

  return (
    <>
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!isDisabled) {
            prepareGardenAudio();
            form.handleSubmit();
          }
        }}
      >
        <FieldGroup>
          {/* Writing comes first; everything else is optional or already chosen. */}
          <form.Field name="post">
            {(field) => {
              const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={isInvalid}>
                  <Textarea
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    aria-invalid={isInvalid}
                    aria-label="Your journal"
                    placeholder={!entryDate ? "There is already a journal for both days" : "Anything on your mind?"}
                    autoComplete="off"
                    autoFocus
                    maxLength={MAX_LENGTH}
                    disabled={isDisabled}
                    className="min-h-36 text-base"
                  />
                  <p className="mt-1 text-right text-xs text-muted-foreground tabular-nums">
                    {field.state.value.length}/{MAX_LENGTH}
                  </p>
                </Field>
              );
            }}
          </form.Field>

          <MoodRow
            value={mood}
            onChange={(grade) => {
              setMood(grade);
              setError(null);
            }}
            disabled={isDisabled}
          />

          <div className="flex flex-wrap items-center gap-2">
            {/* Which day: only a choice when yesterday is still open. */}
            {availability.canPostToday && availability.canPostYesterday ? (
              <div role="radiogroup" aria-label="Journal date" className="flex rounded-full border border-border/70 bg-background/50 p-0.5">
                {[
                  { label: "Today", date: availability.today },
                  { label: "Yesterday", date: availability.yesterday },
                ].map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    role="radio"
                    aria-checked={entryDate === option.date}
                    disabled={isSubmitting}
                    onClick={() => setEntryDate(option.date)}
                    className={cn(
                      "h-9 cursor-pointer rounded-full px-3 text-sm font-medium transition-colors duration-150",
                      entryDate === option.date ? "bg-primary text-primary-foreground" : "text-foreground/70 hover:text-foreground"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : entryDate ? (
              <span className="px-1 text-sm text-muted-foreground">{entryDate === availability.today ? "Today" : "Yesterday"}</span>
            ) : null}
            <button
              type="button"
              onClick={() => setVisibility(visibility === "public" ? "private" : "public")}
              disabled={isSubmitting}
              aria-pressed={visibility === "private"}
              aria-label={visibility === "private" ? "Private: only you can read it. Tap to make it public." : "Public: visitors can read it. Tap to make it private."}
              title={visibility === "private" ? "Only you can read it" : "Visitors to your garden can read it"}
              className="flex h-10 cursor-pointer items-center gap-1.5 rounded-full border border-border/70 bg-background/50 px-3 text-sm font-medium text-foreground/80 transition-colors duration-150 hover:bg-muted"
            >
              {visibility === "private" ? <LockKeyIcon weight="bold" /> : <GlobeHemisphereWestIcon weight="bold" />}
              {visibility === "private" ? "Private" : "Public"}
            </button>
            <Button type="submit" className="ml-auto h-10 min-w-[110px] rounded-full" disabled={isDisabled || isSubmitting}>
              {isSubmitting ? (
                <>
                  <Spinner className="size-4 mr-2" />
                  <span>Planting...</span>
                </>
              ) : (
                <>
                  <Sprout className="size-4 mr-2" />
                  <span>Grow entry</span>
                </>
              )}
            </Button>
          </div>
        </FieldGroup>
      </form>
    </>
  );
};
