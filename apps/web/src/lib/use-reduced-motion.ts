import { useSyncExternalStore } from "react";

const query = "(prefers-reduced-motion: reduce)";
const subscribe = (onChange: () => void) => {
  const list = window.matchMedia(query);
  list.addEventListener("change", onChange);
  return () => list.removeEventListener("change", onChange);
};

export const usePrefersReducedMotion = () =>
  useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
