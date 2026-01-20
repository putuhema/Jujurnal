"use client";

import { authClient } from "@/lib/auth-client";
import Link from "next/link";
import { buttonVariants } from "./ui/button";
import { NoteIcon, PlantIcon, SmileyIcon } from "@phosphor-icons/react";

export const ProfileHeader = () => {
    const { data } = authClient.useSession()
    return (

        <header className="grid grid-cols-3 gap-2 py-2 pb-6">
            <Link href="/profile" className={buttonVariants({ variant: "outline" })}>
                <SmileyIcon />
                Board</Link>
            <Link href={`/profile/plants/${data?.user.id}`} className={buttonVariants({ variant: "outline" })}>
                <PlantIcon />
                Plants</Link>
            <Link href={`/profile/post/${data?.user.id}`} className={buttonVariants({ variant: "outline" })}>
                <NoteIcon />
                Posts</Link>
        </header>
    )
}