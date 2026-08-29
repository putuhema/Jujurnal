"use client";

import { useForm } from "@tanstack/react-form";
import z from "zod";
import { Field, FieldGroup } from "@/components/ui/field";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";

import {
  useAction,
  useQuery,
} from "convex/react";
import { api } from "@puma-brain/backend/convex/_generated/api";
import { ArrowUpRightIcon } from "@phosphor-icons/react";
import { Alert, AlertDescription } from "./ui/alert";
import { useState } from "react";
import { Spinner } from "./ui/spinner";

export const PostForm = () => {
  const hasPostedToday = useQuery(api.posts.hasPostedToday);
  const createPost = useAction(api.posts.create);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      setError(null);
      setIsSubmitting(true);
      try {
        await createPost({
          text: value.post,
        });
        form.reset();
      } catch (err: any) {
        setError(err.message || "Failed to create post");
      } finally {
        setIsSubmitting(false);
      }
    },
  });

  const isDisabled = hasPostedToday === true || isSubmitting;
  const prompts = [
    "Something small that felt good today…",
    "Right now, I’m learning…",
    "If I could pause this moment, I’d remember…",
  ];

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
          <form.Field
            name="post"
            children={(field) => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid;
              const charCount = field.state.value.length;
              const maxLength = 280;
              return (
                <Field data-invalid={isInvalid}>
                  {!isDisabled && (
                    <div className="mb-3 flex flex-wrap gap-2">
                      {prompts.map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          onClick={() => field.handleChange(field.state.value ? `${field.state.value}\n\n${prompt}` : prompt)}
                          className="rounded-full border border-primary/15 bg-secondary/45 px-3 py-1.5 text-left text-xs text-secondary-foreground transition-colors hover:border-primary/35 hover:bg-secondary"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  )}
                  <Textarea
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    aria-invalid={isInvalid}
                    placeholder={
                      isDisabled
                        ? "You've already posted today"
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
                            <ArrowUpRightIcon className="size-4 mr-2" />
                            <span>Grow entry</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </Field>
              );
            }}
          />
        </FieldGroup>
      </form>
    </>
  );
};
