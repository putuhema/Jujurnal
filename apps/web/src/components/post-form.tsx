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
  useMutation,
  useQuery,
} from "convex/react";
import { api } from "@puma-brain/backend/convex/_generated/api";
import type { Id } from "@puma-brain/backend/convex/_generated/dataModel";
import { SparkleIcon, ImageIcon, XIcon } from "@phosphor-icons/react";
import { useLanguage } from "./language-provider";
import { Globe } from "lucide-react";
import { Alert, AlertDescription } from "./ui/alert";
import { useState, useRef } from "react";
import Image from "next/image";
import { Spinner } from "./ui/spinner";

export const PostForm = () => {
  const { language } = useLanguage();
  const user = useQuery(api.auth.getCurrentUser);
  const hasPostedToday = useQuery(api.posts.hasPostedToday);
  const createPost = useAction(api.posts.create);
  const generateUploadUrl = useMutation(api.posts.generateUploadUrl);
  const [error, setError] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageStorageId, setImageStorageId] = useState<Id<"_storage"> | null>(
    null
  );
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Image size must be less than 5MB");
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const uploadUrl = await generateUploadUrl();
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!result.ok) {
        throw new Error(`Upload failed: ${result.statusText}`);
      }

      const data = await result.json();
      const storageId = data.storageId || data;

      if (!storageId || typeof storageId !== "string") {
        throw new Error("Invalid storage ID received from upload");
      }

      setImageStorageId(storageId as Id<"_storage">);
      setImagePreview(URL.createObjectURL(file));
    } catch (err: any) {
      setError(err.message || "Failed to upload image");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = () => {
    setImagePreview(null);
    setImageStorageId(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

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
          lang: language,
          imageStorageId: imageStorageId || undefined,
        });
        form.reset();
        handleRemoveImage();
      } catch (err: any) {
        setError(err.message || "Failed to create post");
      } finally {
        setIsSubmitting(false);
      }
    },
  });

  const isDisabled = hasPostedToday === true || isSubmitting;

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
                    {imagePreview && (
                      <div className="relative mt-2 rounded-lg overflow-hidden border">
                        <Image
                          src={imagePreview}
                          alt="Preview"
                          width={400}
                          height={300}
                          className="w-full h-auto max-h-64 object-cover"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="absolute top-2 right-2"
                          onClick={handleRemoveImage}
                        >
                          <XIcon className="size-4" />
                        </Button>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2 mt-2">
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          disabled={isDisabled || isUploading}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <ImageIcon className="size-4 mr-1" />
                          {isUploading ? "Uploading..." : "Image"}
                        </Button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleImageSelect}
                          className="hidden"
                          disabled={isDisabled || isUploading}
                        />
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
                      </div>
                      <div className="flex items-center gap-2 ml-auto">
                        <div className="text-muted-foreground text-right text-xs mt-1">
                          {charCount}/{maxLength}
                        </div>
                        <Button
                          type="submit"
                          className="min-w-[100px]"
                          disabled={isDisabled || isUploading || isSubmitting}
                        >
                          {isSubmitting ? (
                            <>
                              <Spinner className="size-4 mr-2" />
                              <span>
                                {language === "en"
                                  ? "Posting..."
                                  : "Memposting..."}
                              </span>
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
