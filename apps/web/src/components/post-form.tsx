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

export const PostForm = () => {
  const { language } = useLanguage();
  const user = useQuery(api.auth.getCurrentUser);
  const createPost = useAction(api.posts.create);

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
      await createPost({
        text: value.post,
        lang: language,
      });
      form.reset();
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
                    />
                    <div className="flex items-center justify-between gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs"
                      >
                        <Globe />
                        {language === "en" ? "English" : "Bahasa Indonesia"}
                      </Button>
                      <div className="flex items-center gap-2 ml-auto">
                        <div className="text-muted-foreground text-right text-xs mt-1">
                          {charCount}/{maxLength}
                        </div>
                        <Button type="submit" className="min-w-[100px]">
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
