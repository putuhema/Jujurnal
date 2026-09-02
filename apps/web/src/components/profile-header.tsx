"use client";

import type { CSSProperties } from "react";
import { useQuery } from "convex/react";

import { api } from "@puma-brain/backend/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { gardenThemeProfileColors } from "@/lib/garden-theme";

export const ProfileHeader = () => {
  const { data } = authClient.useSession();
  const gardenTheme = useQuery(api.preferences.getMyGardenTheme) ?? "ivory";
  const profileColors = gardenThemeProfileColors[gardenTheme];
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
      <div
        className="profile-banner relative h-28 overflow-hidden rounded-[1.75rem] shadow-[inset_0_1px_0_oklch(1_0_0/55%)]"
        style={{
          "--profile-start": profileColors.light[0],
          "--profile-middle": profileColors.light[1],
          "--profile-end": profileColors.light[2],
          "--profile-dark-start": profileColors.dark[0],
          "--profile-dark-middle": profileColors.dark[1],
          "--profile-dark-end": profileColors.dark[2],
        } as CSSProperties}
      >
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
    </header>
  );
};
