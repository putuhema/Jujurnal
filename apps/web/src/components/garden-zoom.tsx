"use client";

import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "./ui/button";

const mobileQuery = "(max-width: 639px)";
const subscribeToMobile = (onChange: () => void) => {
  const query = window.matchMedia(mobileQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};
const getMobileSnapshot = () => window.matchMedia(mobileQuery).matches;
const getServerMobileSnapshot = () => false;

const GardenZoomContext = createContext<{
  isZoomed: boolean;
  zoomMode: "auto" | "on" | "off";
  toggle: () => void;
} | null>(null);

export const GardenZoomProvider = ({ children }: { children: ReactNode }) => {
  const isMobile = useSyncExternalStore(subscribeToMobile, getMobileSnapshot, getServerMobileSnapshot);
  const [override, setOverride] = useState<boolean | null>(null);
  const isZoomed = override ?? isMobile;
  return (
    <GardenZoomContext.Provider value={{
      isZoomed,
      zoomMode: override === null ? "auto" : isZoomed ? "on" : "off",
      toggle: () => setOverride((current) => !(current ?? isMobile)),
    }}>
      {children}
    </GardenZoomContext.Provider>
  );
};

export const useGardenZoom = () => {
  const context = useContext(GardenZoomContext);
  if (!context) throw new Error("Garden zoom requires GardenZoomProvider");
  return context;
};

export const GardenZoomToggle = () => {
  const { isZoomed, toggle } = useGardenZoom();
  const label = isZoomed ? "Show whole island" : "Zoom in on plants";
  return (
    <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0 rounded-full"
      aria-label={label} title={label} aria-pressed={isZoomed} onClick={toggle}>
      {isZoomed ? <ZoomOut className="size-4" aria-hidden="true" /> : <ZoomIn className="size-4" aria-hidden="true" />}
    </Button>
  );
};
