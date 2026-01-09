"use client";

import { useForm } from "@tanstack/react-form";
import z from "zod";
import { Field, FieldGroup } from "@/components/ui/field";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";

import {
  Authenticated,
  Unauthenticated,
  useAction,
  useQuery,
} from "convex/react";
import { api } from "@puma-brain/backend/convex/_generated/api";
import { SparkleIcon } from "@phosphor-icons/react";
import { useLanguage } from "./language-provider";
import { Globe } from "lucide-react";
import { Alert, AlertDescription } from "./ui/alert";
import { useState } from "react";

export const PostForm = () => {
  const { language } = useLanguage();
  const user = useQuery(api.auth.getCurrentUser);
  const hasPostedToday = useQuery(api.posts.hasPostedToday);
  const createPost = useAction(api.posts.create);
  const [error, setError] = useState<string | null>(null);

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
      setError(null);
      try {
        await createPost({
          text: value.post,
          lang: language,
        });
        form.reset();
      } catch (err: any) {
        setError(err.message || "Failed to create post");
      }
    },
  });

  const isDisabled = hasPostedToday === true;

  return (
    <>
      <Authenticated>
        {hasPostedToday && (
          <Alert className="mb-4">
            <AlertDescription>
              {language === "en"
                ? "You've already posted today. Come back tomorrow!"
                : "Anda sudah memposting hari ini. Kembali besok!"}
            </AlertDescription>
          </Alert>
        )}
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
                      placeholder={
                        isDisabled
                          ? language === "en"
                            ? "You've already posted today"
                            : "Anda sudah memposting hari ini"
                          : `${user?.name}, anything on your mind?`
                      }
                      autoComplete="off"
                      maxLength={maxLength}
                      disabled={isDisabled}
                    />
                    <div className="flex items-center justify-between gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        disabled={isDisabled}
                      >
                        <Globe />
                        {language === "en" ? "English" : "Bahasa Indonesia"}
                      </Button>
                      <div className="flex items-center gap-2 ml-auto">
                        <div className="text-muted-foreground text-right text-xs mt-1">
                          {charCount}/{maxLength}
                        </div>
                        <Button
                          type="submit"
                          className="min-w-[100px]"
                          disabled={isDisabled}
                        >
                          <SparkleIcon className="size-4 mr-2" />
                          <span>Post</span>
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
