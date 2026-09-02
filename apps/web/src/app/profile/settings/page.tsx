
"use client";

import * as React from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";

import { api } from "@puma-brain/backend/convex/_generated/api";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BoardThemePicker } from "@/components/board-theme-picker";
import { Switch } from "@/components/ui/switch";
import { getBrowserTimeZone } from "@/lib/calendar-date";
import { BellIcon, ClockIcon, MapPinIcon } from "@phosphor-icons/react";

const getNotificationSupportSnapshot = () =>
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window;

const subscribeToNotificationSupport = () => () => undefined;
const getNotificationSupportServerSnapshot = () => false;
const DAYS = [
    { value: 1, short: "M", label: "Monday" },
    { value: 2, short: "T", label: "Tuesday" },
    { value: 3, short: "W", label: "Wednesday" },
    { value: 4, short: "T", label: "Thursday" },
    { value: 5, short: "F", label: "Friday" },
    { value: 6, short: "S", label: "Saturday" },
    { value: 0, short: "S", label: "Sunday" },
] as const;

const urlBase64ToUint8Array = (value: string) => {
    const padding = "=".repeat((4 - (value.length % 4)) % 4);
    const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
    return Uint8Array.from(window.atob(base64), (character) => character.charCodeAt(0));
};

type ReminderDraft = {
    enabled: boolean;
    days: number[];
    time: string;
    timeZone: string;
};

export default function Page() {
    const { data: session } = authClient.useSession();
    const updateUsername = useMutation(api.auth.changeUsername);
    const saveReminder = useMutation(api.reminders.saveSettings);
    const registerSubscription = useMutation(api.reminders.registerSubscription);
    const deviceTimeZone = getBrowserTimeZone();
    const reminder = useQuery(api.reminders.getMySettings, { timeZone: deviceTimeZone });
    const vapidPublicKey = useQuery(api.reminders.getPublicVapidKey);

    const [username, setUsername] = React.useState("");
    const [isSaving, setIsSaving] = React.useState(false);
    const [reminderDraft, setReminderDraft] = React.useState<ReminderDraft | null>(null);
    const [isSavingReminder, setIsSavingReminder] = React.useState(false);
    const notificationSupported = React.useSyncExternalStore(
        subscribeToNotificationSupport,
        getNotificationSupportSnapshot,
        getNotificationSupportServerSnapshot
    );

    React.useEffect(() => {
        const initial = session?.user?.name ?? "";
        setUsername(String(initial ?? ""));
    }, [session?.user?.name]);

    const currentReminder = reminderDraft ?? reminder ?? {
        enabled: false,
        days: [],
        time: "20:00",
        timeZone: deviceTimeZone,
    };
    const updateReminderDraft = (changes: Partial<ReminderDraft>) => {
        setReminderDraft({ ...currentReminder, ...changes });
    };

    const enablePushOnThisDevice = async () => {
        if (!notificationSupported) {
            throw new Error("This browser does not support background notifications");
        }
        if (!vapidPublicKey) {
            throw new Error("Notifications have not been configured on the server");
        }
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
            throw new Error("Allow notifications in your browser to enable reminders");
        }

        const registration = await navigator.serviceWorker.register("/journal-sw.js");
        const existing = await registration.pushManager.getSubscription();
        const subscription = existing ?? await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
        const json = subscription.toJSON();
        if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
            throw new Error("The browser returned an incomplete notification subscription");
        }
        await registerSubscription({
            endpoint: json.endpoint,
            p256dh: json.keys.p256dh,
            auth: json.keys.auth,
        });
    };

    const saveReminderSchedule = async () => {
        if (currentReminder.days.length === 0) {
            toast.error("Choose at least one reminder day");
            return;
        }
        setIsSavingReminder(true);
        const loadingToast = toast.loading("Saving reminder…");
        try {
            if (currentReminder.enabled && !reminder?.enabled) await enablePushOnThisDevice();
            await saveReminder({
                enabled: currentReminder.enabled,
                days: currentReminder.days,
                time: currentReminder.time,
                timeZone: currentReminder.timeZone,
            });
            toast.success(
                currentReminder.enabled ? "Your journal reminder is scheduled" : "Journal reminder turned off",
                { id: loadingToast }
            );
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Couldn’t save your reminder", {
                id: loadingToast,
            });
        } finally {
            setIsSavingReminder(false);
        }
    };

    return (
        <div className="max-w-xl space-y-8">
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
                    <label htmlFor="username" className="text-sm font-medium">Username</label>
                    <Input
                        id="username"
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
            <div className="paper-card rounded-3xl border border-primary/10 bg-card/75 p-5">
                <BoardThemePicker />
            </div>
            <div className="paper-card overflow-hidden rounded-3xl border border-primary/10 bg-card/75">
                <div className="flex items-start justify-between gap-4 border-b border-dashed border-primary/15 p-5">
                    <div className="flex gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <BellIcon className="size-5" weight="fill" />
                        </span>
                        <div className="space-y-1">
                            <h2 className="font-medium">Journal reminder</h2>
                            <p className="text-xs text-muted-foreground">
                                A gentle nudge only when you haven’t written that day.
                            </p>
                        </div>
                    </div>
                    <Switch
                        aria-label="Enable journal reminder"
                        checked={currentReminder.enabled}
                        disabled={reminder == null || isSavingReminder}
                        onCheckedChange={(enabled) => updateReminderDraft({ enabled })}
                    />
                </div>

                <div className="space-y-6 p-5">
                    <fieldset className="space-y-3" disabled={!currentReminder.enabled || isSavingReminder}>
                        <legend className="text-sm font-medium">Remind me on</legend>
                        <div className="grid grid-cols-7 gap-1.5">
                            {DAYS.map((day) => {
                                const selected = currentReminder.days.includes(day.value);
                                return (
                                    <Button
                                        key={day.label}
                                        type="button"
                                        variant={selected ? "default" : "outline"}
                                        className="aspect-square h-auto rounded-full p-0"
                                        aria-label={day.label}
                                        aria-pressed={selected}
                                        onClick={() => updateReminderDraft({
                                            days: selected
                                                ? currentReminder.days.filter((value) => value !== day.value)
                                                : [...currentReminder.days, day.value],
                                        })}
                                    >
                                        {day.short}
                                    </Button>
                                );
                            })}
                        </div>
                    </fieldset>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="space-y-2 text-sm font-medium">
                            <span className="flex items-center gap-2"><ClockIcon /> Time</span>
                            <Input
                                type="time"
                                value={currentReminder.time}
                                disabled={!currentReminder.enabled || isSavingReminder}
                                onChange={(event) => updateReminderDraft({ time: event.target.value })}
                            />
                        </label>
                        <div className="space-y-2 text-sm font-medium">
                            <span className="flex items-center gap-2"><MapPinIcon /> Timezone</span>
                            <div className="rounded-2xl border border-border bg-input/30 px-3 py-2 text-xs font-normal text-muted-foreground">
                                {currentReminder.timeZone.replaceAll("_", " ")}
                            </div>
                        </div>
                    </div>

                    {currentReminder.timeZone !== deviceTimeZone ? (
                        <Button
                            type="button"
                            variant="ghost"
                            className="h-auto px-0 text-xs"
                            disabled={!currentReminder.enabled || isSavingReminder}
                            onClick={() => updateReminderDraft({ timeZone: deviceTimeZone })}
                        >
                            Update to this device’s timezone ({deviceTimeZone.replaceAll("_", " ")})
                        </Button>
                    ) : null}

                    <Button
                        type="button"
                        className="w-full rounded-full sm:w-auto"
                        disabled={reminder == null || isSavingReminder || currentReminder.days.length === 0}
                        onClick={() => void saveReminderSchedule()}
                    >
                        {isSavingReminder ? "Saving…" : "Save reminder"}
                    </Button>
                    {!notificationSupported ? (
                        <p className="text-xs text-destructive">
                            Background notifications aren’t supported by this browser.
                        </p>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
