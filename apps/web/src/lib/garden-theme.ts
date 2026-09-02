export const gardenThemes = [
  {
    name: "Ivory", id: "ivory", value: "oklch(0.97 0.018 86)",
    profile: ["oklch(0.89 0.07 118)", "oklch(0.96 0.055 78)", "oklch(0.86 0.075 148)"],
    profileDark: ["oklch(0.27 0.055 142)", "oklch(0.23 0.04 72)", "oklch(0.24 0.055 125)"],
  },
  {
    name: "Sage", id: "sage", value: "oklch(0.93 0.035 145)",
    profile: ["oklch(0.82 0.09 143)", "oklch(0.93 0.055 112)", "oklch(0.79 0.095 162)"],
    profileDark: ["oklch(0.26 0.065 148)", "oklch(0.22 0.045 112)", "oklch(0.23 0.065 166)"],
  },
  {
    name: "Dawn", id: "dawn", value: "oklch(0.95 0.035 65)",
    profile: ["oklch(0.9 0.095 38)", "oklch(0.97 0.065 83)", "oklch(0.87 0.09 17)"],
    profileDark: ["oklch(0.29 0.075 35)", "oklch(0.25 0.055 77)", "oklch(0.27 0.07 18)"],
  },
  {
    name: "Sky", id: "sky", value: "oklch(0.93 0.03 230)",
    profile: ["oklch(0.84 0.09 237)", "oklch(0.94 0.055 196)", "oklch(0.82 0.09 272)"],
    profileDark: ["oklch(0.25 0.07 239)", "oklch(0.23 0.05 198)", "oklch(0.24 0.07 275)"],
  },
  {
    name: "Lilac", id: "lilac", value: "oklch(0.93 0.03 310)",
    profile: ["oklch(0.86 0.085 305)", "oklch(0.95 0.055 345)", "oklch(0.83 0.09 274)"],
    profileDark: ["oklch(0.26 0.07 306)", "oklch(0.23 0.05 344)", "oklch(0.25 0.07 276)"],
  },
] as const;

export type GardenTheme = (typeof gardenThemes)[number]["id"];

export const gardenThemeColors = Object.fromEntries(
  gardenThemes.map((theme) => [theme.id, theme.value])
) as Record<GardenTheme, string>;

export const gardenThemeProfileColors = Object.fromEntries(
  gardenThemes.map((theme) => [
    theme.id,
    { light: theme.profile, dark: theme.profileDark },
  ])
) as Record<
  GardenTheme,
  { light: readonly [string, string, string]; dark: readonly [string, string, string] }
>;
