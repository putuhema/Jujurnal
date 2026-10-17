import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Frosted pill shared by the top island, the garden controls and the bottom navigation.
export const glassSurface =
  "border border-white/70 bg-card/80 shadow-[0_12px_40px_oklch(0.2_0.03_70/18%),inset_0_1px_0_oklch(1_0_0/70%)] backdrop-blur-2xl supports-[backdrop-filter]:bg-card/70 dark:bg-card/90 dark:supports-[backdrop-filter]:bg-card/85 dark:border-white/10 dark:shadow-[0_12px_40px_oklch(0_0_0/45%),inset_0_1px_0_oklch(1_0_0/8%)]";
