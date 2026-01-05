"use client";

import { api } from "@puma-brain/backend/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";

import { format } from "date-fns";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  TrashSimpleIcon,
  BookOpenIcon,
  CheckCircleIcon,
  ArrowCounterClockwiseIcon,
  DotsThreeCircleIcon,
} from "@phosphor-icons/react";
import { Button } from "./ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "./ui/badge";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";

export const Posts = () => {
  const posts = useQuery(api.post.getAll);
  const deletePost = useMutation(api.post.deletePost);
  const applyCorrections = useMutation(api.post.applyGrammarCorrections);
  return (
    <div className="space-y-2">
      {posts &&
        posts.map((post: any) => {
          const PostItem = ({ post }: { post: any }) => {
            const [showOriginal, setShowOriginal] = useState(false);
            const [isApplying, setIsApplying] = useState(false);
            const displayText =
              showOriginal && post.originalBody ? post.originalBody : post.body;
            const isEdited = post.isEdited || false;

            const handleApplyCorrections = async () => {
              if (
                !post.grammarSuggestions ||
                post.grammarSuggestions.length === 0
              ) {
                return;
              }
              setIsApplying(true);
              try {
                await applyCorrections({ id: post._id });
              } catch (error) {
                console.error("Failed to apply corrections:", error);
              } finally {
                setIsApplying(false);
              }
            };

            return (
              <Item variant="outline">
                <ItemMedia>
                  <Avatar className="size-10">
                    <AvatarImage src={post.user.image} />
                    <AvatarFallback>ER</AvatarFallback>
                  </Avatar>
                </ItemMedia>
                <ItemContent>
                  <div className="flex items-center gap-2 flex-wrap">
                    <ItemTitle>{post.user.name}</ItemTitle>
                    <ItemDescription className="text-xs">
                      {format(
                        new Date(post._creationTime),
                        "dd/MM/yyy HH:mm aaa"
                      )}
                    </ItemDescription>
                    {post.mood && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-muted">
                        Mood: {post.mood}
                      </span>
                    )}
                    {isEdited && (
                      <Badge variant="secondary" className="text-xs">
                        Edited
                      </Badge>
                    )}
                  </div>
                  {post.tags && post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2 mb-2">
                      {post.tags.map((tag: any) => (
                        <Badge
                          key={tag._id}
                          variant="outline"
                          className="text-xs font-normal"
                        >
                          {tag.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="space-y-2">
                    <p
                      className={
                        showOriginal ? "line-through text-muted-foreground" : ""
                      }
                    >
                      {displayText}
                    </p>
                    {isEdited && post.originalBody && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-auto py-1"
                        onClick={() => setShowOriginal(!showOriginal)}
                      >
                        <ArrowCounterClockwiseIcon className="size-3 mr-1" />
                        {showOriginal ? "Show edited" : "Show original"}
                      </Button>
                    )}
                  </div>
                  {post.grammarSuggestions &&
                    post.grammarSuggestions.length > 0 && (
                      <div className="mt-4">
                        <Accordion className="w-full">
                          <AccordionItem
                            value={`grammar-suggestions-${post._id}`}
                          >
                            <AccordionTrigger className="text-sm">
                              <div className="flex items-center gap-2">
                                <BookOpenIcon className="size-4" />
                                <span>
                                  Grammar Feedback (
                                  {post.grammarSuggestions.length}{" "}
                                  {post.grammarSuggestions.length === 1
                                    ? "suggestion"
                                    : "suggestions"}
                                  )
                                </span>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="space-y-3 mt-2">
                                {post.grammarSuggestions.map(
                                  (suggestion: any, index: number) => (
                                    <Alert key={index} variant="default">
                                      <AlertTitle className="flex items-center gap-2 mb-2">
                                        <Badge variant="outline">
                                          {suggestion.issueType}
                                        </Badge>
                                      </AlertTitle>
                                      <AlertDescription className="space-y-2">
                                        <div>
                                          <span className="text-xs text-muted-foreground">
                                            Original:{" "}
                                          </span>
                                          <span className="line-through text-muted-foreground">
                                            {suggestion.original}
                                          </span>
                                        </div>
                                        <div>
                                          <span className="text-xs text-muted-foreground">
                                            Corrected:{" "}
                                          </span>
                                          <span className="font-medium">
                                            {suggestion.corrected}
                                          </span>
                                        </div>
                                        <div className="pt-2 border-t">
                                          <span className="text-xs font-medium">
                                            Why:{" "}
                                          </span>
                                          <span className="text-sm">
                                            {suggestion.explanation}
                                          </span>
                                        </div>
                                      </AlertDescription>
                                    </Alert>
                                  )
                                )}
                                <div className="pt-2">
                                  <Button
                                    onClick={handleApplyCorrections}
                                    disabled={isApplying}
                                    size="sm"
                                    className="w-full"
                                  >
                                    <CheckCircleIcon className="size-4 mr-2" />
                                    {isApplying
                                      ? "Applying..."
                                      : "Apply All Corrections"}
                                  </Button>
                                </div>
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      </div>
                    )}
                </ItemContent>
                <ItemActions>
                  <DropdownMenu>
                    <DropdownMenuTrigger>
                      <DotsThreeCircleIcon />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => deletePost({ id: post._id })}
                      >
                        <TrashSimpleIcon /> Delete Post
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </ItemActions>
              </Item>
            );
          };

          return <PostItem key={post._id} post={post} />;
        })}
    </div>
  );
};
