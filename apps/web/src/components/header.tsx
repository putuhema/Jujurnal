"use client"

import type React from "react";
import Link from "next/link";

import { LogginUser } from "./loggin-user";
import { PostSheet } from "@/components/post-sheet";
import { Authenticated } from "convex/react";
import { ModeToggle } from "./mode-toggle";
import { MobileNavigation } from "./mobile-navigation";
import { cn, glassSurface } from "@/lib/utils";

export default function Header() {
  return (
    <div className="sticky top-[max(0.5rem,env(safe-area-inset-top))] z-50 -mx-1 flex justify-center py-2 sm:mx-0">
      <div className={cn("dynamic-island flex h-16 w-full max-w-sm items-center justify-between gap-3 rounded-[1.65rem] pr-3 pl-5", glassSurface, "shadow-[inset_0_1px_0_oklch(1_0_0/70%)] dark:shadow-[inset_0_1px_0_oklch(1_0_0/8%)]")}>
        <Link
          href="/"
          aria-label="Bloom home"
          className="group/logo flex items-center gap-2 rounded-full text-xl font-semibold tracking-[-0.05em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <BloomMark />
          <span className="bloom-word">
            blo<span className="font-display italic">om</span>
          </span>
        </Link>
        <div className="dynamic-island-actions flex items-center gap-2">
          <Authenticated>
            <div className="hidden sm:block">
              <PostSheet />
            </div>
          </Authenticated>
          <ModeToggle />
          <LogginUser />
        </div>
      </div>
      <Authenticated>
        <MobileNavigation />
      </Authenticated>
    </div>
  );
}

const PETALS = [0, 72, 144, 216, 288];

function BloomMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="bloom-mark size-7 shrink-0">
      {PETALS.map((angle, i) => (
        <ellipse
          key={angle}
          className="bloom-petal"
          style={{ "--r": `${angle}deg`, "--i": i } as React.CSSProperties}
          cx="12"
          cy="6.6"
          rx="3.6"
          ry="5.2"
        />
      ))}
      <circle className="bloom-center" cx="12" cy="12" r="2.7" />
    </svg>
  );
}
