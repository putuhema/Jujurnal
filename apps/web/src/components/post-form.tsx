"use client";

import { useForm } from "@tanstack/react-form";
import z from "zod";
import { useState, useEffect } from "react";
import { Field, FieldGroup } from "@/components/ui/field";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { Spinner } from "./ui/spinner";
import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useAction,
  useQuery,
} from "convex/react";
import { api } from "@puma-brain/backend/convex/_generated/api";
import { SparkleIcon } from "@phosphor-icons/react";

export const PostForm = () => {
  const user = useQuery(api.auth.getCurrentUser);
  const createPost = useAction(api.post.create);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");

  useEffect(() => {
    if (!isLoading) return;

    const messages = [
      "Analyzing your mood...",
      "Checking grammar...",
      "Learning from your words...",
      "Almost there...",
    ];

    let messageIndex = 0;
    setLoadingMessage(messages[0]);

    const interval = setInterval(() => {
      messageIndex = (messageIndex + 1) % messages.length;
      setLoadingMessage(messages[messageIndex]);
    }, 1500);

    return () => clearInterval(interval);
  }, [isLoading]);

  const form = useForm({
    defaultValues: {
      post: "",
    },
    validators: {
      onSubmit: z.object({
        post: z.string().min(12).max(140),
      }),
    },
    onSubmit: async ({ value }) => {
      setIsLoading(true);
      try {
        await createPost({
          text: value.post,
        });
        form.reset();
      } catch (error) {
        console.error("Failed to create post:", error);
      } finally {
        setIsLoading(false);
      }
    },
  });

  return (
    <>
      <Authenticated>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
        >
          <FieldGroup>
            <form.Field
              name="post"
              children={(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid;
                const charCount = field.state.value.length;
                const maxLength = 140;
                return (
                  <Field data-invalid={isInvalid}>
                    <Textarea
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                      placeholder={`${user?.name}, anything on your mind?`}
                      autoComplete="off"
                      maxLength={maxLength}
                      disabled={isLoading}
                      className={isLoading ? "opacity-60" : ""}
                    />
                    <div className="flex items-center justify-between gap-2">
                      {isLoading && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse">
                          <Spinner className="size-4" />
                          <span>{loadingMessage}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 ml-auto">
                        <div className="text-muted-foreground text-right text-xs mt-1">
                          {charCount}/{maxLength}
                        </div>
                        <Button
                          type="submit"
                          disabled={isLoading}
                          className="min-w-[100px]"
                        >
                          {isLoading ? (
                            <>
                              <Spinner className="size-4 mr-2" />
                              <span>Posting...</span>
                            </>
                          ) : (
                            <>
                              <SparkleIcon className="size-4 mr-2" />
                              <span>Post</span>
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
      </Authenticated>
      <Unauthenticated>
        <div></div>
      </Unauthenticated>
    </>
  );
};
