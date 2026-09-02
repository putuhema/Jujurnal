"use client";

import { useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";

import { api } from "@puma-brain/backend/convex/_generated/api";
import { gardenThemes, type GardenTheme } from "@/lib/garden-theme";
import { cn } from "@/lib/utils";

export const BoardThemePicker = () => {
  const selected = useQuery(api.preferences.getMyGardenTheme);
  const setGardenTheme = useMutation(api.preferences.setGardenTheme)
    .withOptimisticUpdate((store, args) => {
      store.setQuery(api.preferences.getMyGardenTheme, {}, args.theme);
    });
  const selectedTheme = selected ?? "ivory";

  useEffect(() => {
    if (selected !== null) return;
    const legacyColor = window.localStorage.getItem("jujurnal-board-color");
    const legacyTheme = gardenThemes.find(
      (theme) => theme.value === legacyColor
    );
    if (!legacyTheme) return;

    void setGardenTheme({ theme: legacyTheme.id }).then(
      () => window.localStorage.removeItem("jujurnal-board-color"),
      () => undefined
    );
  }, [selected, setGardenTheme]);

  const selectTheme = async (theme: GardenTheme) => {
    try {
      await setGardenTheme({ theme });
    } catch {
      toast.error("Could not save your garden color");
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">Garden board palette</p>
        <p className="text-xs text-muted-foreground">Choose the color visitors see on your garden.</p>
      </div>
      <div className="flex flex-wrap gap-3">
        {gardenThemes.map((theme) => (
          <button
            key={theme.name}
            type="button"
            aria-label={`${theme.name} board color`}
            aria-pressed={selectedTheme === theme.id}
            onClick={() => void selectTheme(theme.id)}
            className={cn("flex size-10 items-center justify-center rounded-full border-2 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", selectedTheme === theme.id ? "scale-110 border-foreground" : "border-transparent")}
            style={{ backgroundColor: theme.value }}
          >
            {selectedTheme === theme.id ? <span className="size-2 rounded-full bg-white/90" /> : null}
          </button>
        ))}
      </div>
    </div>
  );
};
