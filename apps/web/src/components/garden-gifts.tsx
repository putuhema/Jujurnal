"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Flower2, Gem, Send, Sparkles, Trash2, X, type LucideIcon } from "lucide-react";
import { GIFT_NOTE_MAX, giftKinds, type GiftKind } from "@puma-brain/backend/convex/gardenItems";
import { cn, glassSurface } from "@/lib/utils";

export type GiftView = { _id: string; _creationTime: number; kind: GiftKind; note?: string; read: boolean; from: string };

export const giftInfo: Record<GiftKind, { label: string; phrase: string; icon: LucideIcon }> = {
  pebble: { label: "Painted pebble", phrase: "a painted pebble", icon: Gem },
  fireflies: { label: "Jar of fireflies", phrase: "a jar of fireflies", icon: Sparkles },
  blossom: { label: "Pressed blossoms", phrase: "some pressed blossoms", icon: Flower2 },
};

const press = "transition-transform duration-150 ease-out active:scale-[0.95]";

// The garden frame turns off text selection and touch gestures; panels with
// text and inputs turn them back on (iOS won't focus a textarea otherwise).
const panelClass =
  "touch-auto select-text absolute bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+5.75rem)] left-1/2 z-[2100] max-h-[60%] w-[min(24rem,calc(100%-1.5rem))] -translate-x-1/2 overflow-y-auto overscroll-contain rounded-[1.75rem] p-3 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-200 sm:bottom-6";

// Leave a gift, and maybe a short kind note, in the garden you're visiting.
// Same language as the arrange tray: round icon choices and one compact row.
export const GiftComposer = ({ name, onSend, onClose }: { name: string; onSend: (kind: GiftKind, note: string) => Promise<void>; onClose: () => void }) => {
  const [kind, setKind] = useState<GiftKind>("pebble");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const send = async () => {
    if (sending) return;
    setSending(true);
    try {
      await onSend(kind, note);
    } finally {
      setSending(false);
    }
  };

  return (
    <section
      data-world-control
      aria-label={`Leave a gift for ${name}`}
      className={cn(
        "touch-auto select-text absolute bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+5.75rem)] left-1/2 z-[2100] w-[min(24rem,calc(100%-1.5rem))] -translate-x-1/2 rounded-[1.75rem] p-3 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-200 sm:bottom-6",
        glassSurface,
      )}
    >
      <header className="flex items-center justify-between gap-2 pl-2">
        <p className="truncate text-sm font-semibold">A gift for {name}</p>
        <button type="button" onClick={onClose} aria-label="Close" className={cn("flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/5", press)}>
          <X className="size-4" aria-hidden="true" />
        </button>
      </header>

      <div className="mt-1 flex items-center gap-2 pl-1">
        <div role="radiogroup" aria-label="Gift" className="flex gap-1">
          {giftKinds.map((option) => {
            const { label, icon: Icon } = giftInfo[option];
            const active = kind === option;
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={label}
                title={label}
                onClick={() => setKind(option)}
                className={cn(
                  "flex size-11 cursor-pointer items-center justify-center rounded-full transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                  press,
                  active ? "bg-primary text-primary-foreground" : "text-foreground/75 hover:bg-foreground/5",
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
              </button>
            );
          })}
        </div>
        <p className="text-sm text-muted-foreground" aria-live="polite">{giftInfo[kind].label}</p>
      </div>

      <form
        className="mt-2 flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <input
          value={note}
          onChange={(event) => setNote(event.target.value.slice(0, GIFT_NOTE_MAX))}
          placeholder="Add a kind note (optional)"
          aria-label="Note"
          maxLength={GIFT_NOTE_MAX}
          className="h-11 min-w-0 flex-1 rounded-full border border-border/70 bg-background/60 px-4 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 sm:text-sm"
        />
        <button
          type="submit"
          disabled={sending}
          aria-label="Leave gift"
          className={cn("flex h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60", press)}
        >
          <Send className="size-4" aria-hidden="true" />
          {sending ? "Leaving…" : "Leave"}
        </button>
      </form>
      <p className="mt-1.5 px-3 text-[11px] text-muted-foreground">
        Only {name} sees your note{note.length > 100 ? ` · ${GIFT_NOTE_MAX - note.length} left` : ""}.
      </p>
    </section>
  );
};

// Gifts people have left in your garden, with their notes.
export const GiftInbox = ({ gifts, onRemove, onClose }: { gifts: GiftView[]; onRemove: (id: string) => void; onClose: () => void }) => (
  <section data-world-control aria-label="Gifts in your garden" className={cn(panelClass, glassSurface)}>
    <header className="mb-2 flex items-center justify-between gap-2 pl-2">
      <p className="text-sm font-semibold">Gifts in your garden</p>
      <button type="button" onClick={onClose} aria-label="Close" className={cn("flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/5", press)}>
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
