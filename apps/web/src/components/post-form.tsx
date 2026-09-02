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
import { Sprout } from "lucide-react";
import { getBrowserTimeZone } from "@/lib/calendar-date";

type EntryAvailability = {
  today: string;
  yesterday: string;
  canPostToday: boolean;
  canPostYesterday: boolean;
};

export const PostForm = ({
  availability,
}: {
  availability: EntryAvailability;
}) => {
  const timeZone = getBrowserTimeZone();
  const createPost = useAction(api.posts.create);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
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
        post: z.string().min(12).max(280),
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
        });
        form.reset();
      } catch (err: any) {
        setError(err.message || "Failed to create post");
      } finally {
        setIsSubmitting(false);
      }
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
            form.handleSubmit();
          }
        }}
      >
        <FieldGroup>
          <div className="grid grid-cols-2 gap-2" aria-label="Journal date">
            <Button
              type="button"
              variant={entryDate === availability?.today ? "default" : "outline"}
              disabled={!availability?.canPostToday || isSubmitting}
              onClick={() => setEntryDate(availability?.today ?? null)}
              className="rounded-full"
            >
              Today
            </Button>
            <Button
              type="button"
              variant={entryDate === availability?.yesterday ? "default" : "outline"}
              disabled={!availability?.canPostYesterday || isSubmitting}
              onClick={() => setEntryDate(availability?.yesterday ?? null)}
              className="rounded-full"
            >
              Yesterday
            </Button>
          </div>
          <form.Field name="post">
            {(field) => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid;
              const charCount = field.state.value.length;
              const maxLength = 280;
              return (
                <Field data-invalid={isInvalid}>
                  <Textarea
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    aria-invalid={isInvalid}
                    placeholder={
                      !entryDate
                        ? "There is already a journal for both days"
                        : `Anything on your mind?`
                    }
                    autoComplete="off"
                    maxLength={maxLength}
                    disabled={isDisabled}
                  />
                  <div className="flex items-center justify-between gap-2 mt-2">
                    <div className="flex items-center gap-2 ml-auto">
                      <div className="text-muted-foreground text-right text-xs mt-1">
                        {charCount}/{maxLength}
                      </div>
                      <Button
                        type="submit"
                        className="min-w-[110px] rounded-full"
                        disabled={isDisabled || isSubmitting}
                      >
                        {isSubmitting ? (
                          <>
                            <Spinner className="size-4 mr-2" />
                            <span>
                              Planting...
                            </span>
                          </>
                        ) : (
                          <>
                            <Sprout className="size-4 mr-2" />
                            <span>Grow entry</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </Field>
              );
            }}
          </form.Field>
        </FieldGroup>
      </form>
    </>
  );
};
