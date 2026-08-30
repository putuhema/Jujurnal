"use client";

import { authClient } from "@/lib/auth-client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const ProfileHeader = () => {
  const { data } = authClient.useSession();
  const name = data?.user.name ?? "Your journal";
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const handle = data?.user.email?.split("@")[0];

  return (
    <header className="pb-7 pt-6 sm:pt-9">
      <div className="relative h-28 overflow-hidden rounded-[1.75rem] bg-[linear-gradient(135deg,oklch(0.9_0.07_116),oklch(0.94_0.045_75)_55%,oklch(0.88_0.06_145))] shadow-[inset_0_1px_0_oklch(1_0_0/55%)] dark:bg-[linear-gradient(135deg,oklch(0.27_0.055_145),oklch(0.23_0.035_70),oklch(0.22_0.045_120))]">
        <span aria-hidden="true" className="absolute -right-4 -top-7 text-[7rem] leading-none text-white/25">✿</span>
        <span aria-hidden="true" className="absolute bottom-2 left-6 text-3xl text-white/35">✦</span>
      </div>

      <div className="relative -mt-11 flex items-end gap-4 px-4 sm:px-6">
        <Avatar className="size-24 border-4 border-background bg-secondary shadow-[0_8px_24px_oklch(0.25_0.04_70/16%)]">
          <AvatarImage src={data?.user.image ?? ""} alt={name} />
          <AvatarFallback className="font-display text-2xl text-primary">
            {initials || "JJ"}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 pb-1.5">
          <h1 className="truncate font-display text-3xl tracking-[-0.04em] sm:text-4xl">
            {name}
          </h1>
          {handle ? (
            <p className="truncate text-sm text-muted-foreground">@{handle}</p>
          ) : null}
        </div>
      </div>

      <p className="mt-5 max-w-xl px-4 text-sm leading-6 text-muted-foreground sm:px-6">
        A living collection of your thoughts, moods, and every small thing you’ve grown.
      </p>
    </header>
  );
};
