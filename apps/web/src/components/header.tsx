"use client"

import Link from "next/link";

import { buttonVariants } from "./ui/button";
import { LogginUser } from "./loggin-user";
import { PostDialog } from "@/components/post-dialog";
import { Authenticated } from "convex/react";
import { ModeToggle } from "./mode-toggle";
import { MobileNavigation } from "./mobile-navigation";

export default function Header() {
  return (
    <div>
      <div className="flex flex-row items-center justify-between border-b border-border/70 py-3">
        <nav className="flex gap-4 text-lg">
          <Link
            href="/"
            className={buttonVariants({
              variant: "ghost",
              className: "h-auto px-0 text-xl font-semibold tracking-[-0.05em] hover:bg-transparent",
            })}
          >
            <span className="mr-1 inline-block text-lg">✿</span> juju<span className="font-display italic">rnal</span>
          </Link>
        </nav>
        <div className="flex items-center gap-1.5">
          <Authenticated>
            <div className="hidden sm:block">
              <PostDialog />
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
