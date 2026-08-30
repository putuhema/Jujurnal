"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flower2Icon, LayoutGridIcon, NotebookPenIcon } from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const tabs = [
  { key: "overview", label: "Overview", icon: LayoutGridIcon },
  { key: "posts", label: "My Posts", icon: NotebookPenIcon },
  { key: "plants", label: "My Plants", icon: Flower2Icon },
] as const;

export function ProfileTabs() {
  const pathname = usePathname();
  const { data } = authClient.useSession();
  const userId = data?.user.id;

  const activeTab = pathname.startsWith("/profile/post/")
    ? "posts"
    : pathname.startsWith("/profile/plants/")
      ? "plants"
      : "overview";

  const tabHref = (key: (typeof tabs)[number]["key"]): Route => {
    if (key === "posts" && userId) return `/profile/post/${userId}` as Route;
    if (key === "plants" && userId) return `/profile/plants/${userId}` as Route;
    return "/profile";
  };

  return (
    <nav
      aria-label="Profile sections"
      className="mb-6 grid grid-cols-3 border-b border-border/80"
    >
      {tabs.map(({ key, label, icon: Icon }) => {
        const active = activeTab === key;

        return (
          <Link
            key={key}
            href={tabHref(key)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex h-12 items-center justify-center gap-2 px-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50 sm:text-sm",
              active && "text-primary",
            )}
          >
            <Icon className="size-[18px]" strokeWidth={active ? 2.4 : 1.9} />
            <span>{label}</span>
            {active ? (
              <span
                aria-hidden="true"
                className="absolute inset-x-3 bottom-[-1px] h-0.5 rounded-full bg-primary"
              />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
