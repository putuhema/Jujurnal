"use client";
import Link from "next/link";

import { QuotesIcon } from "@phosphor-icons/react";
import { buttonVariants } from "./ui/button";
import { LogginUser } from "./loggin-user";

export default function Header() {
  return (
    <div>
      <div className="flex flex-row items-center justify-between px-2 py-1">
        <nav className="flex gap-4 text-lg">
          <Link
            href="/home"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            <QuotesIcon /> pumathought
          </Link>
        </nav>
        <LogginUser />
      </div>
    </div>
  );
}
