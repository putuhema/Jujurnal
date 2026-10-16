import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import {
  buildIsland,
  createPlant,
  createRandom,
  getPlantGrowth,
  islandStyles,
  type Cell,
  type GardenLayout,
  type MoodGrade,
} from "./garden-procedural";

// The world is an endless jigsaw: every garden is a square piece of
// PIECE_SIZE × PIECE_SIZE cells with tabs and blanks on its edges.
//
// Each shared edge decides, from a hash of its own coordinates, which side
// gets the tab and where it sits. A cell's owner is therefore a pure function
// of its position, so neighbouring pieces always interlock exactly — no gaps,
// no overlaps — and any piece can be built on its own, in any order, as the
// camera reaches it. (That's the guarantee wave function collapse would give
// for these local edge constraints, without global solving or backtracking.)

export const PIECE_SIZE = 9;
const HALF = (PIECE_SIZE - 1) / 2;

type Edge = { tabIntoSecond: boolean; offset: number; path: boolean };

const edges = new Map<string, Edge>();

// "x" edges join (gx, gz) and (gx + 1, gz); "z" edges join (gx, gz) and (gx, gz + 1).
const getEdge = (axis: "x" | "z", gx: number, gz: number) => {
  const key = `${axis}:${gx}:${gz}`;
  let edge = edges.get(key);
  if (!edge) {
    const random = createRandom(`edge:${key}`);
    edge = { tabIntoSecond: random.chance(0.5), offset: random.int(-1, 1), path: random.chance(0.4) };
    edges.set(key, edge);
  }
  return edge;
};

// A tab is a one-cell neck that opens into a wider head, like a puzzle knob.
// `depth` counts cells into the piece that receives the tab. Heads never reach
// more than one cell from the edge's middle: two tabs meeting near a corner
// would otherwise wall off the corner cells and split the receiving piece.
const inTab = (depth: number, along: number, offset: number) =>
  (depth === 0 && along === offset) || (depth === 1 && Math.abs(along - offset) <= 1 && Math.abs(along) <= 1);

export const pieceOfCell = (cx: number, cz: number): [number, number] => {
  const gx = Math.floor((cx + HALF) / PIECE_SIZE);
  const gz = Math.floor((cz + HALF) / PIECE_SIZE);
  const lx = cx - gx * PIECE_SIZE;
  const lz = cz - gz * PIECE_SIZE;

  // Only tabs reaching *into* this square can steal its cells.
  let edge = getEdge("x", gx - 1, gz);
  if (edge.tabIntoSecond && inTab(lx + HALF, lz, edge.offset)) return [gx - 1, gz];
  edge = getEdge("x", gx, gz);
  if (!edge.tabIntoSecond && inTab(HALF - lx, lz, edge.offset)) return [gx + 1, gz];
  edge = getEdge("z", gx, gz - 1);
  if (edge.tabIntoSecond && inTab(lz + HALF, lx, edge.offset)) return [gx, gz - 1];
  edge = getEdge("z", gx, gz);
  if (!edge.tabIntoSecond && inTab(HALF - lz, lx, edge.offset)) return [gx, gz + 1];
  return [gx, gz];
};

// Paths run straight through a tab's neck and three cells into both pieces,
// so a trail visibly crosses from one garden into the next.
const onPath = (cx: number, cz: number, gx: number, gz: number) => {
  const seamX = (gx + 0.5) * PIECE_SIZE - 0.5;
  const seamZ = (gz + 0.5) * PIECE_SIZE - 0.5;
  const lx = cx - gx * PIECE_SIZE;
  const lz = cz - gz * PIECE_SIZE;
  const checks: [Edge, number, number][] = [
    [getEdge("x", gx, gz), lz, cx - seamX],
    [getEdge("x", gx - 1, gz), lz, cx - (seamX - PIECE_SIZE)],
    [getEdge("z", gx, gz), lx, cz - seamZ],
    [getEdge("z", gx, gz - 1), lx, cz - (seamZ - PIECE_SIZE)],
  ];
  return checks.some(([edge, along, distance]) => edge.path && along === edge.offset && Math.abs(distance) <= 3.5);
};

export const pieceCenter = (gx: number, gz: number) => new THREE.Vector3(gx * PIECE_SIZE, 0, gz * PIECE_SIZE);

export const createPieceLayout = (ownerSeed: string, gx: number, gz: number, plantCount: number): GardenLayout => {
  const random = createRandom(`piece:${ownerSeed}`);
  const style = random.pick(islandStyles);
  const grassHue = random.range(style.grass[0], style.grass[1]);
  // A small height step per piece makes every puzzle outline readable.
  const top = random.range(-0.06, 0.08);
  const centerX = gx * PIECE_SIZE;
  const centerZ = gz * PIECE_SIZE;

  const cells: Cell[] = [];
  for (let cx = centerX - HALF - 2; cx <= centerX + HALF + 2; cx++) {
    for (let cz = centerZ - HALF - 2; cz <= centerZ + HALF + 2; cz++) {
      const [ox, oz] = pieceOfCell(cx, cz);
      if (ox !== gx || oz !== gz) continue;
      cells.push({ x: cx, z: cz, top, kind: onPath(cx, cz, gx, gz) ? "path" : "grass", used: false });
    }
  }

  // An optional pond, kept away from the seams.
  if (random.chance(0.45)) {
    const interior = cells.filter((cell) => cell.kind === "grass" && Math.abs(cell.x - centerX) <= 2 && Math.abs(cell.z - centerZ) <= 2 && Math.hypot(cell.x - centerX, cell.z - centerZ) > 1.2);
    let current = interior.length ? random.pick(interior) : null;
    for (let size = random.int(2, 4); current && size > 0; size--) {
      current.kind = "water";
      const from = current;
      const next = interior.filter((cell) => cell.kind === "grass" && Math.abs(cell.x - from.x) + Math.abs(cell.z - from.z) === 1);
      current = next.length ? random.pick(next) : null;
    }
  }

  const room = cells.filter((cell) => cell.kind === "grass").length;
  return buildIsland(random, cells, Math.min(plantCount, room), {
    radius: HALF + 2,
    grassHue,
    sandHue: style.sand,
    centerX,
    centerZ,
  });
};

// Ring-by-ring spiral around the origin: (0,0), (1,0), (1,1), (0,1), (-1,1), …
export const spiralCoordinates = (count: number) => {
  const coordinates: [number, number][] = [];
  let x = 0, z = 0, dx = 1, dz = 0, segment = 1, walked = 0, turns = 0;
  while (coordinates.length < count) {
    coordinates.push([x, z]);
    x += dx;
    z += dz;
    if (++walked === segment) {
      walked = 0;
      [dx, dz] = [-dz, dx];
      if (++turns % 2 === 0) segment++;
    }
  }
  return coordinates;
};

export type WorldPost = { _id: string; _creationTime: number; mood: MoodGrade; reactionCount?: number };

// Other gardens are scenery: their plants are generated at low detail and merged
// into one static mesh per piece. Yields between plants so the caller can spread
// the work across frames.
export function* growPiecePlants(posts: WorldPost[], layout: GardenLayout, now: number): Generator<undefined, THREE.BufferGeometry | null> {
  const parts: THREE.BufferGeometry[] = [];
  const matrix = new THREE.Matrix4();
  const count = Math.min(posts.length, layout.plots.length);
  for (let index = 0; index < count; index++) {
    const post = posts[index];
    const plot = layout.plots[index];
    const { geometry } = createPlant(post._id, { mood: post.mood, waterings: post.reactionCount, detail: 0.35 });
    const growth = getPlantGrowth(post._creationTime, now);
    geometry.applyMatrix4(matrix.makeScale(growth, growth, growth).setPosition(plot.x, plot.y, plot.z));
    parts.push(geometry);
    yield undefined;
  }
  if (!parts.length) return null;
  const merged = mergeGeometries(parts)!;
  for (const part of parts) part.dispose();
  merged.computeBoundingSphere();
  return merged;
}

// ---------------------------------------------------------------------------
// Camera

export type WorldView = { x: number; z: number; angle: number; width: number };

const ELEVATION = Math.atan2(0.95, Math.SQRT2);
const TARGET_HEIGHT = -0.2;

export const applyWorldView = (camera: THREE.OrthographicCamera, view: WorldView, aspect: number) => {
  const azimuth = Math.PI / 4 + view.angle;
  const distance = 80;
  camera.position.set(
    view.x + Math.sin(azimuth) * Math.cos(ELEVATION) * distance,
    TARGET_HEIGHT + Math.sin(ELEVATION) * distance,
    view.z + Math.cos(azimuth) * Math.cos(ELEVATION) * distance
  );
  camera.lookAt(view.x, TARGET_HEIGHT, view.z);
  const height = view.width / aspect;
  camera.left = -view.width / 2;
  camera.right = view.width / 2;
  camera.top = height / 2;
  camera.bottom = -height / 2;
  camera.near = 1;
  camera.far = distance * 2;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
};

// View width that frames one piece at any rotation, plant tops to island base.
export const pieceFrameWidth = (layout: GardenLayout, center: THREE.Vector3, aspect: number) => {
  const { min, max } = layout.bounds;
  const radius = Math.hypot(Math.max(max.x - center.x, center.x - min.x), Math.max(max.z - center.z, center.z - min.z));
  const vertical = 2 * radius * Math.sin(ELEVATION) + 3.4 * Math.cos(ELEVATION);
  return Math.max(2 * radius, vertical * aspect) * 1.06;
};

// Ground distance from the view centre to the corner of the frame; anything
// further can't be on screen.
export const viewReach = (width: number, aspect: number) =>
  Math.hypot(width / 2, width / aspect / 2 / Math.sin(ELEVATION));

// Screen drag in pixels → ground movement, so the world follows the pointer.
export const panByScreen = (view: WorldView, dx: number, dy: number, pixelWidth: number) => {
  const azimuth = Math.PI / 4 + view.angle;
  const unitsPerPixel = view.width / pixelWidth;
  const right = { x: Math.cos(azimuth), z: -Math.sin(azimuth) };
  const away = { x: -Math.sin(azimuth), z: -Math.cos(azimuth) };
  const forward = (dy * unitsPerPixel) / Math.sin(ELEVATION);
  return {
    x: view.x - right.x * dx * unitsPerPixel + away.x * forward,
    z: view.z - right.z * dx * unitsPerPixel + away.z * forward,
  };
};
