"use client"

import Link from "next/link";

import { buttonVariants } from "./ui/button";
import { LogginUser } from "./loggin-user";
import { cn } from "@/lib/utils";
import { PostDialog } from "@/components/post-dialog";
import { Authenticated } from "convex/react";

export default function Header() {
  return (
    <div>
      <div className="flex flex-row items-center justify-between py-1">
        <nav className="flex gap-4 text-lg">
          <Link
            href="/"
            className={buttonVariants({
              variant: "ghost",
              className: cn("px-0 pl-0 uppercase"),
            })}
          >
            Terriary
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <Authenticated>
            <PostDialog />
          </Authenticated>
          <LogginUser />
        </div>
      </div>
    </div>
  );
}
