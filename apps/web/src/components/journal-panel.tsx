"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ChevronLeft, ChevronRight, Eye, LockKeyhole, X } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useMutation, useQuery } from "convex/react";
import { api } from "@puma-brain/backend/convex/_generated/api";
import type { Id } from "@puma-brain/backend/convex/_generated/dataModel";
import { getCalendarDate } from "@/lib/calendar-date";
import { PlantReaction, moodLabels } from "./garden-flower";
import { Badge } from "./ui/badge";
import { Skeleton } from "./ui/skeleton";
import type { WorldPost } from "./world-garden-scene";

// A long drag or a quick flick (px per ms) both count.
const SWIPE = { close: 70, page: 60, flick: 0.45 };
const DRAWER_EASE = "cubic-bezier(0.32, 0.72, 0, 1)";

// The journal you're reading, beside the plant the camera has zoomed in on.
// A side panel on wide screens; on phones a bottom sheet you can swipe down to
// close, or sideways to read the previous or next journal.
export const JournalPanel = ({
  post,
  index,
  total,
  owner,
  canWater,
  live = true,
  onPrevious,
  onNext,
  onClose,
}: {
  // Posts from the world arrive without their words; they're fetched here.
  post: WorldPost;
  index: number;
  total: number;
  // Shown when reading someone else's garden.
  owner?: string;
  canWater: boolean;
  // Sample gardens don't talk to the server.
  live?: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onClose: () => void;
}) => {
  const isPrivate = post.visibility === "private";
  const fetched = useQuery(api.posts.getById, post.body === undefined ? { id: post._id as Id<"posts"> } : "skip");
  const body = post.body ?? fetched?.body;
  const date = getCalendarDate(post._creationTime, post.entryDate).date;
  const swipe = useRef<{ pointerId: number; x: number; y: number; at: number } | null>(null);
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const markRead = useMutation(api.reads.markRead);
  // Only you see how many people read your journals.
  const readCount = useQuery(api.reads.readCount, live && !owner && !isPrivate ? { postId: post._id as Id<"posts"> } : "skip");

  // Someone else's journal counts as read once it's been open for a moment.
  useEffect(() => {
    if (!live || !owner || isPrivate) return;
    const timer = window.setTimeout(() => void markRead({ postId: post._id as Id<"posts"> }).catch(() => {}), 2500);
    return () => window.clearTimeout(timer);
  }, [live, owner, isPrivate, post._id, markRead]);

  // Swipes start on the sheet's header (the handle), so the text stays scrollable.
  const handlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse" || (event.target as HTMLElement).closest("button")) return;
    swipe.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, at: performance.now() };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const handlePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const start = swipe.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    setDrag(Math.abs(dx) > Math.abs(dy) ? { x: dx, y: 0 } : { x: 0, y: Math.max(0, dy) });
  };
  const handlePointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    const start = swipe.current;
    if (!start || start.pointerId !== event.pointerId) return;
    swipe.current = null;
    const elapsed = Math.max(1, performance.now() - start.at);
    const flickY = drag.y / elapsed > SWIPE.flick && drag.y > 12;
    const flickX = Math.abs(drag.x) / elapsed > SWIPE.flick && Math.abs(drag.x) > 12;
    if (drag.y > SWIPE.close || flickY) onClose();
    else if ((drag.x < -SWIPE.page || (flickX && drag.x < 0)) && index < total - 1) onNext();
    else if ((drag.x > SWIPE.page || (flickX && drag.x > 0)) && index > 0) onPrevious();
    setDrag({ x: 0, y: 0 });
  };

  return (
    <section
      data-world-control
      aria-label="Journal"
      className="absolute inset-x-3 bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+5.75rem)] z-[2500] flex max-h-[52%] flex-col rounded-[1.75rem] border border-border/70 bg-card shadow-[0_12px_40px_oklch(0.2_0.03_70/22%)] motion-safe:animate-in motion-safe:slide-in-from-bottom-[60%] motion-safe:fade-in-0 motion-safe:duration-[380ms] motion-safe:ease-[cubic-bezier(0.32,0.72,0,1)] sm:inset-x-auto sm:top-24 sm:right-4 sm:bottom-4 sm:max-h-none sm:w-[22rem] sm:rounded-3xl sm:shadow-xl sm:motion-safe:slide-in-from-bottom-0 sm:motion-safe:slide-in-from-right-8"
      style={drag.x || drag.y ? { transform: `translate(${drag.x * 0.35}px, ${drag.y}px)`, transition: "none" } : { transition: `transform 320ms ${DRAWER_EASE}` }}
    >
      <header
        className="touch-none border-b border-border/60 px-5 pt-2 pb-4 sm:touch-auto sm:p-5"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <span aria-hidden="true" className="mx-auto mb-3 block h-1.5 w-10 rounded-full bg-muted-foreground/25 sm:hidden" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
              {owner ? `${owner}'s journal` : "Your journal"} · {format(new Date(`${date}T12:00:00`), "EEE, MMM d")}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="outline" className="rounded-full">{moodLabels[post.mood]}</Badge>
              {isPrivate ? (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <LockKeyhole className="size-3" aria-hidden="true" /> Private
                </span>
              ) : null}
              {typeof readCount === "number" && readCount > 0 ? (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Eye className="size-3" aria-hidden="true" /> Read by {readCount} {readCount === 1 ? "gardener" : "gardeners"}
                </span>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close journal (Esc)"
            className="-mt-1 -mr-2 flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring sm:size-8"
          >
            <X className="size-5 sm:size-4" aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:p-5">
        {body !== undefined ? (
          <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed [overflow-wrap:anywhere]">{body}</p>
        ) : fetched === null ? (
          <p className="text-sm text-muted-foreground">This journal is no longer here.</p>
        ) : (
          <div role="status" aria-label="Loading journal" className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        )}
      </div>

      <footer className="flex items-center justify-between gap-2 border-t border-border/60 px-3 py-2 sm:px-4 sm:py-3">
        <span className="pl-2 text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(post._creationTime), { addSuffix: true })}
        </span>
        <div className="flex items-center gap-1">
          {canWater ? <PlantReaction postId={post._id as Id<"posts">} isOpen /> : null}
          <button
            type="button"
            onClick={onPrevious}
            disabled={index === 0}
            aria-label="Previous journal (←)"
            className="flex size-11 cursor-pointer items-center justify-center rounded-full hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-default disabled:opacity-35 sm:size-8"
          >
            <ChevronLeft className="size-5 sm:size-4" aria-hidden="true" />
          </button>
          <span className="min-w-12 text-center text-xs font-medium tabular-nums text-muted-foreground">
            {index + 1} / {total}
          </span>
          <button
            type="button"
            onClick={onNext}
            disabled={index === total - 1}
            aria-label="Next journal (→)"
            className="flex size-11 cursor-pointer items-center justify-center rounded-full hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-default disabled:opacity-35 sm:size-8"
          >
            <ChevronRight className="size-5 sm:size-4" aria-hidden="true" />
          </button>
        </div>
      </footer>
    </section>
  );
};
