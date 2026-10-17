"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Flower2, Gem, Sparkles, Trash2, X, type LucideIcon } from "lucide-react";
import { GIFT_NOTE_MAX, giftKinds, type GiftKind } from "@puma-brain/backend/convex/gardenItems";
import { cn, glassSurface } from "@/lib/utils";
import { Textarea } from "./ui/textarea";

export type GiftView = { _id: string; _creationTime: number; kind: GiftKind; note?: string; read: boolean; from: string };

export const giftInfo: Record<GiftKind, { label: string; phrase: string; icon: LucideIcon }> = {
  pebble: { label: "Painted pebble", phrase: "a painted pebble", icon: Gem },
  fireflies: { label: "Jar of fireflies", phrase: "a jar of fireflies", icon: Sparkles },
  blossom: { label: "Pressed blossoms", phrase: "some pressed blossoms", icon: Flower2 },
};

// The garden frame turns off text selection and touch gestures; panels with
// text and inputs turn them back on (iOS won't focus a textarea otherwise).
const panelClass =
  "touch-auto select-text absolute inset-x-3 bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+5.75rem)] z-[2100] max-h-[60%] overflow-y-auto overscroll-contain rounded-3xl p-4 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-4 sm:inset-x-auto sm:right-24 sm:bottom-6 sm:w-80";

// Leave a gift, and maybe a short kind note, in the garden you're visiting.
export const GiftComposer = ({ name, onSend, onClose }: { name: string; onSend: (kind: GiftKind, note: string) => Promise<void>; onClose: () => void }) => {
  const [kind, setKind] = useState<GiftKind>("pebble");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

  return (
    <section data-world-control aria-label={`Leave a gift for ${name}`} className={cn(panelClass, glassSurface)}>
      <header className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="font-display text-lg leading-tight">Leave a gift</p>
          <p className="text-xs text-muted-foreground">In {name}'s garden. Only they see your note.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
          <X className="size-4" aria-hidden="true" />
        </button>
      </header>
      <div role="radiogroup" aria-label="Gift" className="grid grid-cols-3 gap-2">
        {giftKinds.map((option) => {
          const { label, icon: Icon } = giftInfo[option];
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={kind === option}
              onClick={() => setKind(option)}
              className={cn(
                "flex min-h-18 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border px-1 text-center text-[11px] font-medium leading-tight transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                kind === option ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background/60 hover:bg-muted",
              )}
            >
              <Icon className="size-5" aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </div>
      <Textarea
        value={note}
        onChange={(event) => setNote(event.target.value.slice(0, GIFT_NOTE_MAX))}
        placeholder="Add a kind note (optional)"
        aria-label="Note"
        className="mt-3 min-h-20 resize-none rounded-2xl bg-background/70 text-sm"
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-xs tabular-nums text-muted-foreground">{note.length}/{GIFT_NOTE_MAX}</span>
        <button
          type="button"
          disabled={sending}
          onClick={async () => {
            setSending(true);
            try {
              await onSend(kind, note);
            } finally {
              setSending(false);
            }
          }}
          className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {sending ? "Leaving…" : "Leave gift"}
        </button>
      </div>
    </section>
  );
};

// Gifts people have left in your garden, with their notes.
export const GiftInbox = ({ gifts, onRemove, onClose }: { gifts: GiftView[]; onRemove: (id: string) => void; onClose: () => void }) => (
  <section data-world-control aria-label="Gifts in your garden" className={cn(panelClass, glassSurface)}>
    <header className="mb-2 flex items-start justify-between gap-2">
      <div>
        <p className="font-display text-lg leading-tight">Gifts</p>
        <p className="text-xs text-muted-foreground">Left in your garden by visitors.</p>
      </div>
      <button type="button" onClick={onClose} aria-label="Close" className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
        <X className="size-4" aria-hidden="true" />
      </button>
    </header>
    {gifts.length === 0 ? (
      <p className="py-6 text-center text-sm text-muted-foreground">No gifts yet. Visit and water other gardens, and some may come back to you.</p>
    ) : (
      <ul className="space-y-2">
        {gifts.map((gift) => {
          const { phrase, icon: Icon } = giftInfo[gift.kind];
          return (
            <li key={gift._id} className="flex items-start gap-3 rounded-2xl bg-background/60 p-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-semibold">{gift.from}</span> left {phrase}
                  {!gift.read ? <span className="ml-1.5 inline-block size-2 rounded-full bg-primary align-middle" aria-label="New" /> : null}
                </p>
                {gift.note ? <p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground/80 [overflow-wrap:anywhere]">“{gift.note}”</p> : null}
                <p className="mt-1 text-xs text-muted-foreground">{formatDistanceToNow(new Date(gift._creationTime), { addSuffix: true })}</p>
              </div>
              <button type="button" onClick={() => onRemove(gift._id)} aria-label="Remove gift" className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
    )}
  </section>
);
