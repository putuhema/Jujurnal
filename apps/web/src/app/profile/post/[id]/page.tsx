"use client";

import { api } from "@puma-brain/backend/convex/_generated/api";
import { useAction, useMutation, useQuery } from "convex/react";
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
  DotsThreeCircleIcon,
  PencilSimpleIcon,
} from "@phosphor-icons/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { useParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

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
  "A+": "bg-emerald-700/75", A: "bg-emerald-600/65", "A-": "bg-emerald-500/55",
  "B+": "bg-lime-500/45", B: "bg-lime-500/45", "B-": "bg-lime-500/45",
  "C+": "bg-amber-300/60", C: "bg-amber-300/60", "C-": "bg-amber-300/60",
  "D+": "bg-orange-300/60", D: "bg-orange-300/60", "D-": "bg-orange-300/60", F: "bg-rose-400/55",
};

const moodLabels: Record<MoodGrade, string> = {
  "A+": "Sunlit", A: "Bright", "A-": "Bright", "B+": "Growing", B: "Growing", "B-": "Growing",
  "C+": "Steady", C: "Steady", "C-": "Steady", "D+": "Low tide", D: "Low tide", "D-": "Low tide", F: "Heavy",
};

export default function UserPost() {
  const params = useParams();
  const userId = params.id as string;
  const { data: session } = authClient.useSession();
  const posts = useQuery(api.posts.getByUserId, { userId });
  const deletePost = useMutation(api.posts.deletePost);
  const updatePost = useAction(api.posts.updatePost);
  const [search, setSearch] = useState("");
  const [editingPost, setEditingPost] = useState<any>(null);
  const [editedBody, setEditedBody] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const filteredPosts = (() => {
    if (!posts) return [];
    const query = search.trim().toLowerCase();
    return query ? posts.filter((post) => post.body.toLowerCase().includes(query)) : posts;
  })();

  const beginEditing = (post: any) => {
    setEditingPost(post);
    setEditedBody(post.body);
  };

  const saveEdit = async () => {
    if (!editingPost) return;
    setIsSaving(true);
    try {
      await updatePost({ id: editingPost._id, body: editedBody });
      setEditingPost(null);
      toast.success("Entry updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn’t update this entry");
    }
    setIsSaving(false);
  };

  if (!posts) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Item key={i} variant="outline" className="border-none">
            <ItemMedia>
              <Skeleton className="size-10 rounded-full" />
            </ItemMedia>
            <ItemContent>
              <div className="flex items-center gap-2 flex-wrap">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-4 w-16 rounded" />
              </div>
              <div className="space-y-2 mt-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-20" />
              </div>
            </ItemContent>
            <ItemActions>
              <Skeleton className="size-6 rounded-full" />
            </ItemActions>
          </Item>
        ))}
      </div>
    );
  }

  if (posts.length === 0) {
    return <div className="paper-card rounded-3xl border border-dashed border-primary/20 bg-card/70 px-6 py-14 text-center text-muted-foreground">Your first page is waiting when you are.</div>;
  }

  return (
    <section className="paper-card rounded-3xl border border-primary/10 bg-card/75 p-5 sm:p-7">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="relative w-full sm:w-64"><MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search your words" className="rounded-full pl-9" aria-label="Search entries" /></div>
      </div>
      <div className="space-y-3">
      {filteredPosts.map((post: any) => {
        if (!post.user) return null;

        return (
          <Item key={post._id} variant="outline" className="rounded-2xl border-border/60 bg-background/45 px-4 py-3">
            <ItemMedia>
              <Avatar className="size-10">
                <AvatarImage src={post.user.image || undefined} />
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
                      "text-xs font-medium px-2 py-0.5 rounded-full text-foreground",
                      moodColors[post.mood as MoodGrade]
                    )}
                  >
                    {moodLabels[post.mood as MoodGrade]}
                  </span>
                )}
              </div>
              <div className="space-y-2">
                <p>{post.body}</p>

                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(post._creationTime), {
                    addSuffix: true,
                  })}
                </p>
              </div>
            </ItemContent>
            <ItemActions>
              {session?.user.id === post.user._id && (
                <DropdownMenu>
                  <DropdownMenuTrigger>
                    <DotsThreeCircleIcon />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => beginEditing(post)}>
                      <PencilSimpleIcon /> Edit entry
                    </DropdownMenuItem>
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
      })}
      {filteredPosts.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No pages match “{search}”.</p>}
      </div>
      <Dialog open={Boolean(editingPost)} onOpenChange={(open) => !open && setEditingPost(null)}>
        <DialogContent>
          <DialogHeader className="px-6 pt-6">
            <DialogTitle className="font-display text-3xl tracking-[-0.035em]">Refine your words</DialogTitle>
            <DialogDescription>Your day and flower will stay exactly as they are. Your feeling will refresh from your words.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3 px-6 pb-6"
            onSubmit={(event) => {
              event.preventDefault();
              void saveEdit();
            }}
          >
            <Textarea value={editedBody} onChange={(event) => setEditedBody(event.target.value)} maxLength={280} className="min-h-36" aria-label="Edit entry" />
            <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">{editedBody.length}/280</span><Button type="submit" disabled={isSaving || editedBody.trim().length < 12}>{isSaving ? "Saving…" : "Save words"}</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
