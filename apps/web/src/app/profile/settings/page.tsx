
"use client";

import * as React from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";

import { api } from "@puma-brain/backend/convex/_generated/api";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Page() {
    const { data: session } = authClient.useSession();
    const updateUsername = useMutation(api.auth.changeUsername);

    const [username, setUsername] = React.useState("");
    const [isSaving, setIsSaving] = React.useState(false);

    React.useEffect(() => {
        const initial = session?.user?.name ?? "";
        setUsername(String(initial ?? ""));
    }, [session?.user?.name]);

    return (
        <div className="max-w-xl space-y-6">
            <div className="space-y-1">
                <h1 className="text-xl font-semibold">Settings</h1>
                <p className="text-sm text-muted-foreground">
                    Update your public profile.
                </p>
            </div>

            <form
                className="space-y-2"
                onSubmit={async (e) => {
                    e.preventDefault();
                    if (!session?.user?.id) {
                        toast.error("You must be logged in");
                        return;
                    }

                    setIsSaving(true);
                    const t = toast.loading("Saving username...");
                    try {
                        await updateUsername({ username });
                        toast.success("Username updated", { id: t });
                        await authClient.getSession();
                    } catch (err: any) {
                        toast.error(err?.message ?? "Failed to update username", { id: t });
                    } finally {
                        setIsSaving(false);
                    }
                }}
            >
                <div className="space-y-1">
                    <label className="text-sm font-medium">Username</label>
                    <Input
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="e.g. putu_hendra"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        disabled={isSaving}
                    />
                    <p className="text-xs text-muted-foreground">
                        3–20 chars, start with a letter, only a-z, 0-9, underscore.
                    </p>
                </div>

                <Button type="submit" disabled={isSaving}>
                    {isSaving ? "Saving..." : "Save"}
                </Button>
            </form>
        </div>
    );
}
