"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const storageKey = "jujurnal-board-color";
const themes = [
  { name: "Ivory", value: "oklch(0.97 0.018 86)" },
  { name: "Sage", value: "oklch(0.93 0.035 145)" },
  { name: "Dawn", value: "oklch(0.95 0.035 65)" },
  { name: "Sky", value: "oklch(0.93 0.03 230)" },
  { name: "Lilac", value: "oklch(0.93 0.03 310)" },
];

const restoreSavedBoardTheme = () => {
  const saved = window.localStorage.getItem(storageKey);
  if (saved && themes.some((theme) => theme.value === saved)) {
    document.documentElement.style.setProperty("--board-color", saved);
    return saved;
  }
  return themes[0].value;
};

export const BoardThemeInitializer = () => {
  useEffect(() => {
    restoreSavedBoardTheme();
  }, []);

  return null;
};

export const BoardThemePicker = () => {
  const [selected, setSelected] = useState(themes[0].value);

  useEffect(() => {
    setSelected(restoreSavedBoardTheme());
  }, []);

  const selectTheme = (value: string) => {
    setSelected(value);
    document.documentElement.style.setProperty("--board-color", value);
    window.localStorage.setItem(storageKey, value);
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">Garden board palette</p>
        <p className="text-xs text-muted-foreground">Choose the color of your garden’s large card. Saved on this device.</p>
      </div>
      <div className="flex flex-wrap gap-3">
        {themes.map((theme) => (
          <button
            key={theme.name}
            type="button"
            aria-label={`${theme.name} board color`}
            aria-pressed={selected === theme.value}
            onClick={() => selectTheme(theme.value)}
            className={cn("flex size-10 items-center justify-center rounded-full border-2 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", selected === theme.value ? "scale-110 border-foreground" : "border-transparent")}
            style={{ backgroundColor: theme.value }}
          >
            {selected === theme.value && <span className="size-2 rounded-full bg-white/90" />}
          </button>
        ))}
      </div>
    </div>
  );
};
