"use client";

import { useForm } from "@tanstack/react-form";
import z from "zod";
import { Field, FieldGroup } from "@/components/ui/field";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { useAction, useQuery } from "convex/react";
import { api } from "@puma-brain/backend/convex/_generated/api";

export const PostForm = () => {
  const user = useQuery(api.auth.getCurrentUser);
  const createPost = useAction(api.post.create);
  const form = useForm({
    defaultValues: {
      post: "",
    },
    validators: {
      onSubmit: z.object({
        post: z.string().min(12).max(140),
      }),
    },
    onSubmit: ({ value }) => {
      createPost({
        text: value.post,
      });
      form.reset();
    },
  });

  if (!user) return null;

  return (
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
                  placeholder={`${user.name}, anything on your mind?`}
                  autoComplete="off"
                  maxLength={maxLength}
                />
                <div className="flex items-center justify-end gap-2">
                  <div className="text-muted-foreground text-right text-xs mt-1">
                    {charCount}/{maxLength}
                  </div>
                  <Button type="submit">Post</Button>
                </div>
              </Field>
            );
          }}
        />
      </FieldGroup>
    </form>
  );
};
