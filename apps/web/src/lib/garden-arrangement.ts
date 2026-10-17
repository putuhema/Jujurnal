import type { DecorationKind } from "@puma-brain/backend/convex/gardenItems";
import type { Cell, GardenLayout, GardenPlot } from "./garden-procedural";

// How a gardener has arranged their island. Positions are whole cells relative
// to the island's centre, so they apply wherever the island sits in the world.
export type PlacedDecoration = { id: string; kind: DecorationKind; x: number; z: number; turn: number };
export type Arrangement = { moves: { postId: string; x: number; z: number }[]; decorations: PlacedDecoration[] };

export const emptyArrangement: Arrangement = { moves: [], decorations: [] };

const key = (x: number, z: number) => `${x},${z}`;

// The island with the gardener's choices applied: moved plants take their chosen
// cells (when that cell exists here and is free grass), the rest keep their
// generated spots. Returns new plots in the same order as `postIds`.
export const arrangePlots = (
  layout: GardenLayout,
  postIds: string[],
  arrangement: Arrangement | undefined,
  center: { x: number; z: number }
): GardenPlot[] => {
  if (!arrangement || (!arrangement.moves.length && !arrangement.decorations.length)) return layout.plots;
  const grass = new Map(layout.cells.filter((cell) => cell.kind === "grass").map((cell) => [key(cell.x, cell.z), cell]));
  const blocked = new Set(arrangement.decorations.map((decoration) => key(center.x + decoration.x, center.z + decoration.z)));
  const moves = new Map(arrangement.moves.map((move) => [move.postId, move]));
  const taken = new Set<string>(blocked);
  const plots: (GardenPlot | undefined)[] = postIds.map(() => undefined);

  // Moved plants first, so they win the cells they were moved to.
  postIds.forEach((postId, index) => {
    const move = moves.get(postId);
    if (!move || !layout.plots[index]) return;
    const cell = grass.get(key(center.x + move.x, center.z + move.z));
    if (!cell || taken.has(key(cell.x, cell.z))) return;
    taken.add(key(cell.x, cell.z));
    plots[index] = { x: cell.x, y: cell.top, z: cell.z };
  });
  // Everyone else keeps their spot, or the nearest free grass if it was taken.
  postIds.forEach((_, index) => {
    const original = layout.plots[index];
    if (plots[index] || !original) return;
    const cellKey = key(Math.round(original.x), Math.round(original.z));
    if (!taken.has(cellKey)) {
      taken.add(cellKey);
      plots[index] = original;
      return;
    }
    const free = [...grass.values()]
      .filter((cell) => !taken.has(key(cell.x, cell.z)))
      .sort((a, b) => Math.hypot(a.x - original.x, a.z - original.z) - Math.hypot(b.x - original.x, b.z - original.z))[0];
    if (free) {
      taken.add(key(free.x, free.z));
      plots[index] = { x: free.x, y: free.top, z: free.z };
    } else plots[index] = original;
  });
  return plots as GardenPlot[];
};

// Cells holding nothing yet: room for a moved plant, a decoration, a gift or a critter.
export const freeCells = (layout: GardenLayout, plots: GardenPlot[], decorations: PlacedDecoration[], center: { x: number; z: number }) => {
  const taken = new Set([
    ...plots.map((plot) => key(Math.round(plot.x), Math.round(plot.z))),
    ...decorations.map((decoration) => key(center.x + decoration.x, center.z + decoration.z)),
  ]);
  return layout.cells.filter((cell) => cell.kind === "grass" && !taken.has(key(cell.x, cell.z)));
};

export const cellAt = (layout: GardenLayout, x: number, z: number): Cell | undefined =>
  layout.cells.find((cell) => cell.x === Math.round(x) && cell.z === Math.round(z));
