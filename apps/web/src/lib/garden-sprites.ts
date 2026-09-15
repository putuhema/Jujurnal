// The first three rows use 100px cells, starting 5px into the atlas.
// Keep the original palette: pink, gold, white, purple, and blue by mood.
const moodFrames = {
  A: [[3, 0], [7, 0], [11, 0], [12, 0], [2, 1], [8, 1], [14, 1]],
  B: [[0, 0], [10, 0], [1, 1], [7, 1], [9, 1], [4, 2]],
  C: [[1, 0], [6, 0], [9, 0], [13, 0], [3, 1], [10, 1]],
  D: [[4, 0], [8, 0], [5, 1], [6, 1], [12, 1], [5, 2]],
  F: [[5, 0], [0, 1], [4, 1], [11, 1], [1, 2]],
} as const;

// Stem/leaf base anchors measured from pixels with alpha > 128 in each frame.
const frameAnchors = [
  [[51, 95], [49, 95], [44, 97], [38, 96], [38, 96], [36, 96], [32, 95], [38, 94], [39, 97], [36, 96], [44, 93], [46, 95], [55, 97], [59, 96], [64, 97]],
  [[47, 94], [47, 94], [41, 93], [40, 93], [38, 94], [39, 93], [39, 94], [39, 94], [39, 94], [41, 94], [46, 94], [53, 93], [58, 94], [71, 94], [64, 94]],
  [[50, 96], [43, 94], [39, 95], [38, 93], [34, 97], [40, 95], [32, 97], [34, 97], [41, 97], [43, 94], [44, 94], [52, 97], [56, 95], [61, 96], [61, 95]],
] as const;

export const getPlantSpriteFrame = (mood: string, flowerId = 1) => {
  const palette = moodFrames[mood[0] as keyof typeof moodFrames] ?? moodFrames.C;
  const id = Number.isFinite(flowerId) && flowerId > 0 ? Math.floor(flowerId) : 1;
  const [column, row] = palette[(id - 1) % palette.length];
  const [anchorX, anchorY] = frameAnchors[row][column];
  return { column, row, anchorX, anchorY };
};
