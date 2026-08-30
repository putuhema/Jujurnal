"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import {
  HouseIcon,
  UserRoundIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { PostDialog } from "@/components/post-dialog";

const navItemClass =
  "flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl py-1.5 text-[10px] font-medium tracking-[-0.01em] text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

function NavItem({
  href,
  label,
  active,
  icon: Icon,
}: {
  href: Route;
  label: string;
  active: boolean;
  icon: typeof HouseIcon;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(navItemClass, active && "text-primary")}
    >
      <Icon className="size-[21px]" strokeWidth={active ? 2.4 : 1.9} />
      <span className="truncate">{label}</span>
    </Link>
  );
}

export function MobileNavigation() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 mx-auto grid max-w-sm grid-cols-3 items-end rounded-[1.65rem] border border-white/70 bg-card/80 px-3 pb-2 pt-2 shadow-[0_12px_40px_oklch(0.2_0.03_70/18%),inset_0_1px_0_oklch(1_0_0/70%)] backdrop-blur-2xl supports-[backdrop-filter]:bg-card/70 dark:border-white/10 dark:shadow-[0_12px_40px_oklch(0_0_0/45%),inset_0_1px_0_oklch(1_0_0/8%)] sm:hidden"
    >
      <NavItem
        href="/"
        label="Home"
        active={pathname === "/"}
        icon={HouseIcon}
      />

      <PostDialog mobileNav />

      <NavItem
        href="/profile"
        label="Profile"
        active={pathname.startsWith("/profile")}
        icon={UserRoundIcon}
      />
    </nav>
  );
}
