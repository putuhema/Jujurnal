"use client";

import { api } from "@puma-brain/backend/convex/_generated/api";
import { useMutation, usePaginatedQuery } from "convex/react";
import { useState } from "react";

import { formatDistanceToNow } from "date-fns";
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
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { useLanguage } from "./language-provider";

type MoodGrade =
  | "A+"
  | "A"
  | "A-"
  | "B+"
  | "B"
  | "B-"
  | "C+"
  | "C"
  | "C-"
  | "D+"
  | "D"
  | "D-"
  | "F";

const moodColors: Record<MoodGrade, string> = {
  "A+": "bg-[#216e39] text-white",
  A: "bg-[#30a14e] text-white",
  "A-": "bg-[#40c463] text-white",
  "B+": "bg-[#9be9a8] text-[#216e39]",
  B: "bg-[#9be9a8] text-[#216e39]",
  "B-": "bg-[#9be9a8] text-[#216e39]",
  "C+": "bg-[#ffec44] text-[#8b6914]",
  C: "bg-[#ffec44] text-[#8b6914]",
  "C-": "bg-[#ffec44] text-[#8b6914]",
  "D+": "bg-[#fd7e14] text-white",
  D: "bg-[#fd7e14] text-white",
  "D-": "bg-[#fd7e14] text-white",
  F: "bg-[#d73a4a] text-white",
};

export const Posts = () => {
  const { language } = useLanguage();
  const { data: session } = authClient.useSession();
  const { results, status, loadMore } = usePaginatedQuery(
    api.posts.getAll,
    {},
    {
      initialNumItems: 17,
    }
  );

  const deletePost = useMutation(api.posts.deletePost);
  const applyCorrections = useMutation(api.posts.applyGrammarCorrections);
  return (
    <div className="space-y-2">
      {results &&
        results.map((post: any) => {
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
              <Item variant="outline" className="border-none">
                <ItemMedia>
                  <Avatar className="size-10">
                    <AvatarImage src={post.user.image} />
                    <AvatarFallback>ER</AvatarFallback>
                  </Avatar>
                </ItemMedia>
                <ItemContent>
                  <div className="flex items-center gap-2 flex-wrap">
                    <ItemTitle>{post.user.name}</ItemTitle>
                    <ItemDescription className="text-xs"></ItemDescription>
                    {post.mood && (
                      <span
                        className={cn(
                          "text-xs font-semibold px-2 py-0.5 rounded",
                          moodColors[post.mood as MoodGrade]
                        )}
                      >
                        {post.mood}
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    <p
                      className={
                        showOriginal ? "line-through text-muted-foreground" : ""
                      }
                    >
                      {displayText}
                    </p>

                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(post._creationTime), {
                        addSuffix: true,
                      })}
                    </p>
                    {session?.user.id === post.user._id &&
                      language === "en" &&
                      isEdited &&
                      post.originalBody && (
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
                  {language === "en" &&
                    post.grammarSuggestions &&
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
                  {session?.user.id === post.user._id && (
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
                  )}
                </ItemActions>
              </Item>
            );
          };

          return <PostItem key={post._id} post={post} />;
        })}
      {status === "CanLoadMore" && (
        <Button
          onClick={() => loadMore(17)}
          variant="outline"
          className="w-full"
        >
          Load More
        </Button>
      )}
    </div>
  );
};
