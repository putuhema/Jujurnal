"use client";

import { authClient } from "@/lib/auth-client";

export const ProfileHeader = () => {
    const { data } = authClient.useSession()
    return (
        <header className="pb-8 pt-9">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Your private space</p>
            <h1 className="mt-2 font-display text-4xl tracking-[-0.04em]">Hello, {data?.user.name?.split(" ")[0] ?? "friend"}.</h1>
            <p className="mt-2 text-sm text-muted-foreground">A quieter place to notice how your days are unfolding.</p>
        </header>
    )
}
