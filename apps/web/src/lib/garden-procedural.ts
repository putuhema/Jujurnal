import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// Everything here is deterministic: the same seed always grows the same plant
// or island, so a journal keeps its look across visits and devices.

export type MoodGrade =
  | "A+" | "A" | "A-"
  | "B+" | "B" | "B-"
  | "C+" | "C" | "C-"
  | "D+" | "D" | "D-"
  | "F";

export const moodGrayscale: Record<MoodGrade, number> = {
  "A+": 0, A: 0, "A-": 0.05,
  "B+": 0.1, B: 0.2, "B-": 0.3,
  "C+": 0.4, C: 0.5, "C-": 0.6,
  "D+": 0.7, D: 0.8, "D-": 0.9,
  F: 1,
};

const hashString = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export type Random = ReturnType<typeof createRandom>;

export const createRandom = (seed: string) => {
  let state = hashString(seed);
  const next = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (min: number, max: number) => min + next() * (max - min),
    int: (min: number, max: number) => Math.floor(min + next() * (max - min + 1)),
    chance: (probability: number) => next() < probability,
    pick: <T,>(items: readonly T[]) => items[Math.floor(next() * items.length)],
  };
};

// ---------------------------------------------------------------------------
// Geometry helpers

type Transform = {
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number] | number;
};

const matrix = new THREE.Matrix4();
const quaternion = new THREE.Quaternion();
const euler = new THREE.Euler();
const vector = new THREE.Vector3();
const scaleVector = new THREE.Vector3();

// Displace by a function of the vertex position so duplicated vertices on a
// non-indexed mesh move together and the surface never cracks.
const wobble = (geometry: THREE.BufferGeometry, amount: number, seed: number) => {
  const position = geometry.attributes.position;
  for (let index = 0; index < position.count; index++) {
    vector.fromBufferAttribute(position, index);
    const offset = 1 + amount * Math.sin(vector.x * 4.1 + seed) * Math.sin(vector.y * 3.3 + seed * 1.7) * Math.sin(vector.z * 4.7 + seed * 0.6);
    position.setXYZ(index, vector.x * offset, vector.y * offset, vector.z * offset);
  }
};

type PartOptions = {
  shade?: number;
  roughen?: number;
  seed?: number;
  // Blend from `color` at the base of the part to `tint` at its top.
  tint?: THREE.Color;
  // Keep shared vertices' normals averaged for soft, curved surfaces.
  smooth?: boolean;
};

const part = (
  source: THREE.BufferGeometry,
  color: THREE.Color,
  transform: Transform = {},
  { shade = 0.2, roughen = 0, seed = 0, tint, smooth = false }: PartOptions = {}
) => {
  if (smooth) {
    if (roughen) wobble(source, roughen, seed);
    source.computeVertexNormals();
  }
  const geometry = source.index ? source.toNonIndexed() : source;
  if (geometry !== source) source.dispose();
  if (geometry.attributes.uv) geometry.deleteAttribute("uv");
  if (!smooth && roughen) wobble(geometry, roughen, seed);

  const scale = transform.scale ?? 1;
  euler.set(...(transform.rotation ?? [0, 0, 0]));
  quaternion.setFromEuler(euler);
  scaleVector.set(...(typeof scale === "number" ? ([scale, scale, scale] as const) : scale));
  vector.set(...(transform.position ?? [0, 0, 0]));

  // Fake ambient occlusion: darken the underside of each part.
  geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox!;
  const span = max.y - min.y || 1;
  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  const blended = new THREE.Color();
  for (let index = 0; index < position.count; index++) {
    const height = (position.getY(index) - min.y) / span;
    const light = 1 - shade + shade * height;
    blended.copy(color);
    if (tint) blended.lerp(tint, height);
    colors[index * 3] = blended.r * light;
    colors[index * 3 + 1] = blended.g * light;
    colors[index * 3 + 2] = blended.b * light;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.applyMatrix4(matrix.compose(vector, quaternion, scaleVector));
  if (!smooth) geometry.computeVertexNormals();
  return geometry;
};

const merge = (parts: THREE.BufferGeometry[]) => {
  const geometry = mergeGeometries(parts)!;
  for (const piece of parts) piece.dispose();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
};

const hsl = (hue: number, saturation: number, lightness: number) =>
  new THREE.Color().setHSL(((hue % 360) + 360) % 360 / 360, saturation, lightness, THREE.SRGBColorSpace);

const desaturate = (color: THREE.Color, amount: number) => {
  if (amount <= 0) return color;
  const gray = color.r * 0.3 + color.g * 0.59 + color.b * 0.11;
  return color.lerp(new THREE.Color(gray, gray, gray), amount * 0.85);
};

// ---------------------------------------------------------------------------
// Plants

type Palette = {
  petal: THREE.Color;
  petalTip: THREE.Color;
  petalBase: THREE.Color;
  center: THREE.Color;
  pollen: THREE.Color;
  leaf: THREE.Color;
  leafTip: THREE.Color;
  stem: THREE.Color;
};

const petalFamilies = [
  { name: "red", hue: [348, 358], saturation: [0.68, 0.8], lightness: [0.48, 0.56] },
  { name: "coral", hue: [6, 16], saturation: [0.75, 0.85], lightness: [0.62, 0.68] },
  { name: "pink", hue: [332, 346], saturation: [0.6, 0.75], lightness: [0.72, 0.8] },
  { name: "magenta", hue: [312, 325], saturation: [0.55, 0.68], lightness: [0.55, 0.62] },
  { name: "purple", hue: [268, 282], saturation: [0.45, 0.6], lightness: [0.5, 0.6] },
  { name: "lavender", hue: [250, 265], saturation: [0.45, 0.6], lightness: [0.72, 0.8] },
  { name: "blue", hue: [212, 226], saturation: [0.55, 0.7], lightness: [0.6, 0.68] },
  { name: "white", hue: [40, 60], saturation: [0.25, 0.4], lightness: [0.93, 0.96] },
  { name: "yellow", hue: [44, 52], saturation: [0.85, 0.95], lightness: [0.58, 0.64] },
  { name: "orange", hue: [24, 34], saturation: [0.85, 0.92], lightness: [0.56, 0.62] },
  { name: "peach", hue: [18, 28], saturation: [0.75, 0.85], lightness: [0.76, 0.82] },
] as const;

const blossomHues = [0, 12, 45, 52, 200, 285, 330, 345] as const;

const createPalette = (random: Random, desaturation: number, family = random.pick(petalFamilies)): Palette => {
  const hue = random.range(family.hue[0], family.hue[1]);
  const saturation = random.range(family.saturation[0], family.saturation[1]);
  const lightness = random.range(family.lightness[0], family.lightness[1]);
  const petal = hsl(hue, saturation, lightness);
  // Most flowers fade lighter toward the tips; some get a contrasting bicolour edge.
  const petalTip = random.chance(0.22)
    ? hsl(random.chance(0.5) ? 50 : hue + random.pick([-40, 40]), saturation, Math.min(0.92, lightness + 0.15))
    : hsl(hue + random.range(-6, 6), saturation * 0.9, Math.min(0.95, lightness + random.range(0.06, 0.14)));
  const petalBase = hsl(hue + random.range(-10, 10), Math.min(1, saturation * 1.1), lightness * random.range(0.7, 0.85));
  const leafHue = random.range(95, 135);
  const leafLightness = random.range(0.3, 0.38);
  const muted = (color: THREE.Color) => desaturate(color, desaturation);

  return {
    petal: muted(petal),
    petalTip: muted(petalTip),
    petalBase: muted(petalBase),
    center: muted(random.chance(0.6) ? hsl(random.range(44, 52), 0.9, 0.55) : hsl(random.range(20, 30), 0.55, 0.22)),
    pollen: muted(hsl(random.range(40, 50), 0.95, 0.6)),
    leaf: muted(hsl(leafHue, random.range(0.42, 0.55), leafLightness)),
    leafTip: muted(hsl(leafHue - random.range(0, 12), random.range(0.45, 0.6), leafLightness + random.range(0.1, 0.16))),
    stem: muted(hsl(leafHue - 8, 0.45, leafLightness + 0.06)),
  };
};

// Geometry resolution for the plant currently being grown: 1 for full detail,
// lower for distant gardens in the world view. Random draws never depend on it,
// so a plant keeps its shape and colours at every detail level.
let detail = 1;
const resolution = (value: number, min: number) => Math.max(min, Math.round(value * detail));

type SurfaceOptions = {
  length: number;
  width: number;
  // Position of the widest point along the length, 0–1.
  widest?: number;
  // Below 1 rounds the tip, above 1 sharpens it.
  pointy?: number;
  // Cross-section bowl, and lengthwise curl (positive curls inward, negative recurves).
  cup?: number;
  curl?: number;
  fold?: number;
  ruffle?: number;
  columns?: number;
  rows?: number;
  // Skip quads to cut slits, e.g. monstera fenestrations. u is -1…1, v is 0…1.
  cut?: (u: number, v: number) => boolean;
};

// A curved blade growing along +y with its inner face toward -z: petals,
// leaves and sepals are all this surface with different settings.
const bladeSurface = ({
  length, width, widest = 0.55, pointy = 1, cup = 0.3, curl = 0, fold = 0, ruffle = 0, columns = 6, rows = 9, cut,
}: SurfaceOptions) => {
  const exponent = Math.log(0.5) / Math.log(widest);
  columns = resolution(columns, 2);
  rows = resolution(rows, 3);
  const positions: number[] = [];
  for (let row = 0; row <= rows; row++) {
    const v = row / rows;
    const half = (width / 2) * Math.sin(Math.PI * v ** exponent) ** pointy;
    for (let column = 0; column <= columns; column++) {
      const u = (column / columns) * 2 - 1;
      const z = -(cup * u * u * half + fold * Math.abs(u) * half + curl * v * v * length)
        + ruffle * half * Math.sin(u * 7 + v * 5) * v;
      positions.push(u * half, v * length * (1 - Math.abs(curl) * v * 0.25), z);
    }
  }
  const indices: number[] = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      if (cut?.(((column + 0.5) / columns) * 2 - 1, (row + 0.5) / rows)) continue;
      const a = row * (columns + 1) + column;
      const c = a + columns + 1;
      indices.push(a, c, a + 1, a + 1, c, c + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  return geometry;
};

// Turn a blade so it points outward at `angle` around the y axis, raised by
// `elevation` radians above horizontal, starting `offset` from the center.
const placeBlade = (geometry: THREE.BufferGeometry, angle: number, elevation: number, offset = 0) =>
  geometry.rotateX(Math.PI / 2 - elevation).translate(0, 0, offset).rotateY(angle);

const blade = (options: SurfaceOptions, color: THREE.Color, tint: THREE.Color, angle: number, elevation: number, offset = 0) =>
  placeBlade(part(bladeSurface(options), color, {}, { smooth: true, shade: 0.12, tint }), angle, elevation, offset);

const up = new THREE.Vector3(0, 1, 0);

// Orient head parts (built facing +y) along a stem's tip direction.
const mountHead = (parts: THREE.BufferGeometry[], position: THREE.Vector3, direction: THREE.Vector3) => {
  matrix.compose(position, quaternion.setFromUnitVectors(up, direction.clone().normalize()), scaleVector.set(1, 1, 1));
  for (const piece of parts) piece.applyMatrix4(matrix);
  return parts;
};

const stem = (points: THREE.Vector3[], radius: number, color: THREE.Color) => {
  const curve = new THREE.CatmullRomCurve3(points);
  const geometry = part(new THREE.TubeGeometry(curve, resolution(12, 4), radius, detail < 1 ? 3 : 5), color, {}, { smooth: true, shade: 0.3 });
  return { geometry, tip: curve.getPoint(1), direction: curve.getTangent(1) };
};

const dome = (radius: number, flatten: number, color: THREE.Color, position: THREE.Vector3 | [number, number, number] = [0, 0, 0]) =>
  part(new THREE.SphereGeometry(radius, resolution(12, 5), resolution(6, 2), 0, Math.PI * 2, 0, Math.PI / 2), color, {
    position: Array.isArray(position) ? position : [position.x, position.y, position.z],
    scale: [1, flatten, 1],
  }, { smooth: true, shade: 0.35 });

const bead = (radius: number, color: THREE.Color, position: [number, number, number] | THREE.Vector3) =>
  part(new THREE.SphereGeometry(radius, resolution(7, 4), resolution(5, 3)), color, { position: Array.isArray(position) ? position : [position.x, position.y, position.z] }, { smooth: true, shade: 0.25 });

type Head = (random: Random, palette: Palette) => THREE.BufferGeometry[];

const ring = (count: number, random: Random, jitter = 0.12) =>
  Array.from({ length: count }, (_, index) => (index / count) * Math.PI * 2 + random.range(-jitter, jitter));

const heads = {
  daisy: (random, palette) => {
    const parts: THREE.BufferGeometry[] = [];
    const layers = random.chance(0.35) ? 2 : 1;
    const count = random.int(11, 16);
    const length = random.range(0.11, 0.15);
    const width = random.range(0.035, 0.05);
    for (let layer = 0; layer < layers; layer++) {
      for (const angle of ring(count, random, 0.08)) {
        parts.push(blade({ length: length * (1 - layer * 0.2), width, widest: 0.62, pointy: 0.6, cup: 0.35, curl: random.range(-0.05, 0.12), ruffle: 0.05 }, palette.petalBase, palette.petal, angle + layer * (Math.PI / count), random.range(0.08, 0.22) + layer * 0.3, 0.025));
      }
    }
    parts.push(dome(0.04, 0.7, palette.center));
    return parts;
  },
  sunflower: (random, palette) => {
    const parts: THREE.BufferGeometry[] = [];
    const count = random.int(16, 22);
    const gold = palette.petal.clone().lerp(hsl(46, 0.95, 0.56), 0.75);
    for (let layer = 0; layer < 2; layer++) {
      for (const angle of ring(count, random, 0.05)) {
        parts.push(blade({ length: random.range(0.1, 0.13), width: 0.045, widest: 0.45, pointy: 1.3, cup: 0.4, curl: random.range(-0.15, 0.05) }, gold.clone().multiplyScalar(0.8), gold, angle + layer * (Math.PI / count), 0.1 + layer * 0.25, 0.07));
      }
    }
    parts.push(part(new THREE.CylinderGeometry(0.085, 0.08, 0.025, 16), hsl(25, 0.5, 0.18), { position: [0, 0.005, 0] }, { smooth: true }));
    parts.push(dome(0.075, 0.35, hsl(28, 0.55, 0.24), [0, 0.015, 0]));
    return parts;
  },
  tulip: (random, palette) => {
    const parts: THREE.BufferGeometry[] = [];
    const length = random.range(0.15, 0.19);
    const width = random.range(0.1, 0.12);
    const open = random.range(1.05, 1.32);
    for (let layer = 0; layer < 2; layer++) {
      for (const angle of ring(3, random, 0.08)) {
        parts.push(blade({ length: length * (1 - layer * 0.06), width, widest: 0.6, pointy: 0.75, cup: 1, curl: random.range(0.08, 0.22) }, palette.petalBase, palette.petalTip, angle + layer * (Math.PI / 3), open + layer * 0.08, 0.012));
      }
    }
    return parts;
  },
  rose: (random, palette) => {
    const parts: THREE.BufferGeometry[] = [];
    const layers = [
      { count: 5, length: 0.1, width: 0.12, elevation: 0.45, cup: 0.7, curl: -0.08 },
      { count: 5, length: 0.09, width: 0.105, elevation: 0.95, cup: 0.9, curl: 0.12 },
      { count: 4, length: 0.075, width: 0.09, elevation: 1.3, cup: 1.1, curl: 0.3 },
    ];
    layers.forEach((layer, index) => {
      for (const angle of ring(layer.count, random, 0.15)) {
        parts.push(blade({ length: layer.length, width: layer.width, widest: 0.68, pointy: 0.4, cup: layer.cup, curl: layer.curl, ruffle: 0.06 }, palette.petalBase, index === 0 ? palette.petalTip : palette.petal, angle + index * 0.6, layer.elevation, 0.01 + (2 - index) * 0.006));
      }
    });
    parts.push(bead(0.03, palette.petalBase, [0, 0.045, 0]));
    for (const angle of ring(5, random)) parts.push(blade({ length: 0.05, width: 0.02, pointy: 1.4, cup: 0.2, curl: -0.3 }, palette.leaf, palette.leafTip, angle + 0.3, -0.3, 0.01));
    return parts;
  },
  poppy: (random, palette) => {
    const parts: THREE.BufferGeometry[] = [];
    const count = random.int(4, 5);
    for (const angle of ring(count, random)) {
      parts.push(blade({ length: random.range(0.12, 0.14), width: random.range(0.16, 0.19), widest: 0.65, pointy: 0.4, cup: 0.55, curl: 0.12, ruffle: 0.12, columns: 8 }, palette.petalBase, palette.petal, angle, random.range(0.45, 0.7), 0.006));
    }
    const ink = hsl(270, 0.3, 0.12);
    for (const angle of ring(12, random, 0.05)) parts.push(bead(0.009, ink, [Math.cos(angle) * 0.03, 0.03, Math.sin(angle) * 0.03]));
    parts.push(bead(0.024, hsl(95, 0.35, 0.45), [0, 0.035, 0]));
    return parts;
  },
  lily: (random, palette) => {
    const parts: THREE.BufferGeometry[] = [];
    const length = random.range(0.17, 0.21);
    for (let layer = 0; layer < 2; layer++) {
      for (const angle of ring(3, random, 0.1)) {
        parts.push(blade({ length: length * (1 - layer * 0.05), width: 0.07 - layer * 0.008, widest: 0.42, pointy: 1.5, cup: 0.35, curl: random.range(-0.3, -0.18), fold: 0.15 }, palette.petal, palette.petalTip, angle + layer * (Math.PI / 3), 0.75 + layer * 0.1, 0.01));
      }
    }
    for (const angle of ring(6, random, 0.2)) {
      const tip = new THREE.Vector3(Math.cos(angle) * 0.05, 0.12, Math.sin(angle) * 0.05);
      parts.push(stem([new THREE.Vector3(0, 0, 0), new THREE.Vector3(tip.x * 0.4, 0.07, tip.z * 0.4), tip], 0.0035, palette.petalTip).geometry);
      parts.push(part(new THREE.SphereGeometry(0.01, resolution(6, 3), resolution(4, 2)), hsl(22, 0.75, 0.42), { position: [tip.x, tip.y, tip.z], scale: [1, 0.6, 1.8], rotation: [0, -angle, 0] }, { smooth: true }));
    }
    return parts;
  },
  hydrangea: (random, palette) => {
    const parts: THREE.BufferGeometry[] = [];
    const radius = random.range(0.11, 0.14);
    const florets = random.int(20, 28);
    const normal = new THREE.Vector3();
    for (let index = 0; index < florets; index++) {
      // Fibonacci sphere, upper part only, for even floret spacing.
      const y = 1 - (index / (florets - 1)) * 1.3;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = index * 2.39996;
      normal.set(Math.cos(theta) * r, y, Math.sin(theta) * r).normalize();
      const color = palette.petal.clone().lerp(palette.petalTip, random.next());
      const floret = ring(4, random, 0.1).map((angle) => blade({ length: 0.04, width: 0.04, widest: 0.6, pointy: 0.45, cup: 0.3 }, color, color, angle, 0.15, 0.003));
      floret.push(bead(0.006, palette.pollen, [0, 0.004, 0]));
      // Low detail keeps every other floret; the rest are still generated so random draws stay in step.
      if (detail < 1 && index % 2) {
        for (const piece of floret) piece.dispose();
        continue;
      }
      parts.push(...mountHead(floret, normal.clone().multiplyScalar(radius).setY(normal.y * radius + radius * 0.8), normal));
    }
    return parts;
  },
  lavender: (random, palette) => {
    const parts: THREE.BufferGeometry[] = [];
    const whorls = random.int(7, 10);
    for (let index = 0; index < whorls; index++) {
      const y = index * 0.024;
      const size = 0.017 * (1 - (index / whorls) * 0.5);
      const color = palette.petalBase.clone().lerp(palette.petalTip, index / whorls);
      for (const angle of ring(index === whorls - 1 ? 1 : 4, random, 0.4)) {
        parts.push(part(new THREE.SphereGeometry(size, resolution(6, 4), resolution(4, 3)), color, { position: [Math.cos(angle) * size * 0.9, y, Math.sin(angle) * size * 0.9], scale: [1, 1.5, 1] }, { smooth: true, shade: 0.3 }));
      }
    }
    return parts;
  },
} satisfies Record<string, Head>;

type FlowerHeadName = keyof typeof heads;

type PetalFamily = (typeof petalFamilies)[number]["name"];

type FlowerForm = {
  head: FlowerHeadName;
  // Colours that look natural for this flower; omitted means any.
  families?: PetalFamily[];
  stems: [number, number];
  height: [number, number];
  spread: number;
  stemRadius: number;
  headScale: [number, number];
  // How far a head nods toward the camera-facing side (radians).
  nod: number;
  leaves: { count: [number, number]; length: [number, number]; width: number; elevation: [number, number]; widest: number; pointy: number; on: "base" | "stem" };
};

const flowerForms = {
  daisy: { head: "daisy", stems: [3, 5], height: [0.32, 0.5], spread: 0.16, stemRadius: 0.009, headScale: [0.9, 1.15], nod: 0.35, leaves: { count: [4, 6], length: [0.14, 0.2], width: 0.06, elevation: [0.25, 0.55], widest: 0.6, pointy: 0.9, on: "base" } },
  sunflower: { head: "sunflower", families: ["yellow", "orange"], stems: [1, 2], height: [0.7, 0.9], spread: 0.1, stemRadius: 0.018, headScale: [1.2, 1.45], nod: 0.75, leaves: { count: [3, 5], length: [0.15, 0.2], width: 0.13, elevation: [0, 0.35], widest: 0.4, pointy: 1.1, on: "stem" } },
  tulip: { head: "tulip", families: ["red", "coral", "pink", "magenta", "purple", "white", "yellow", "orange", "peach"], stems: [2, 4], height: [0.38, 0.55], spread: 0.12, stemRadius: 0.011, headScale: [0.95, 1.1], nod: 0.15, leaves: { count: [3, 5], length: [0.28, 0.36], width: 0.085, elevation: [0.85, 1.15], widest: 0.35, pointy: 1.3, on: "base" } },
  rose: { head: "rose", stems: [2, 3], height: [0.42, 0.6], spread: 0.13, stemRadius: 0.01, headScale: [1.05, 1.25], nod: 0.3, leaves: { count: [4, 7], length: [0.09, 0.12], width: 0.065, elevation: [0.1, 0.4], widest: 0.45, pointy: 1, on: "stem" } },
  poppy: { head: "poppy", stems: [2, 4], height: [0.4, 0.62], spread: 0.17, stemRadius: 0.0075, headScale: [1, 1.2], nod: 0.4, leaves: { count: [3, 5], length: [0.14, 0.2], width: 0.05, elevation: [0.3, 0.7], widest: 0.5, pointy: 1.4, on: "base" } },
  lily: { head: "lily", stems: [1, 3], height: [0.5, 0.68], spread: 0.12, stemRadius: 0.011, headScale: [1.05, 1.2], nod: 0.6, leaves: { count: [5, 8], length: [0.13, 0.18], width: 0.04, elevation: [0.3, 0.7], widest: 0.4, pointy: 1.3, on: "stem" } },
  hydrangea: { head: "hydrangea", families: ["blue", "lavender", "purple", "pink", "white", "magenta"], stems: [2, 3], height: [0.26, 0.36], spread: 0.15, stemRadius: 0.012, headScale: [1, 1.15], nod: 0.25, leaves: { count: [5, 7], length: [0.17, 0.22], width: 0.14, elevation: [0.15, 0.45], widest: 0.45, pointy: 0.95, on: "base" } },
  lavender: { head: "lavender", families: ["lavender", "purple", "blue", "pink", "white"], stems: [6, 9], height: [0.38, 0.55], spread: 0.18, stemRadius: 0.005, headScale: [1, 1.2], nod: 0.1, leaves: { count: [7, 10], length: [0.12, 0.18], width: 0.018, elevation: [0.7, 1.1], widest: 0.4, pointy: 1.2, on: "base" } },
} satisfies Record<string, FlowerForm>;

const growFlower = (form: FlowerForm, random: Random, palette: Palette, extraBlooms: number, wilt: number) => {
  const parts: THREE.BufferGeometry[] = [];
  const stems = Math.min(form.stems[1] + 4, random.int(form.stems[0], form.stems[1]) + extraBlooms);
  // Lean flower faces toward the viewer so heads read from the isometric camera.
  const towardCamera = new THREE.Vector3(1, 0, 1).normalize();

  for (let index = 0; index < stems; index++) {
    const angle = (index / stems) * Math.PI * 2 + random.range(-0.4, 0.4);
    const offset = index === 0 ? random.range(0, 0.03) : random.range(form.spread * 0.4, form.spread);
    const height = random.range(form.height[0], form.height[1]) * (index === 0 ? 1.08 : random.range(0.75, 1));
    const base = new THREE.Vector3(Math.cos(angle) * offset * 0.5, 0, Math.sin(angle) * offset * 0.5);
    const lean = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)).multiplyScalar(offset);
    const points = [
      base,
      base.clone().addScaledVector(lean, 0.3).setY(height * 0.4).add(new THREE.Vector3(random.range(-0.02, 0.02), 0, random.range(-0.02, 0.02))),
      base.clone().addScaledVector(lean, 0.75).setY(height * 0.78),
      base.clone().add(lean).addScaledVector(towardCamera, form.nod * 0.06).setY(height - wilt * height * 0.15),
    ];
    const body = stem(points, form.stemRadius, palette.stem);
    parts.push(body.geometry);

    const direction = body.direction.clone().addScaledVector(towardCamera, form.nod * 0.5).add(new THREE.Vector3(0, -wilt * 1.2, 0)).normalize();
    const head = heads[form.head](random, palette);
    const scale = random.range(form.headScale[0], form.headScale[1]);
    for (const piece of head) piece.scale(scale, scale, scale);
    // Small green sepal cup where the head meets the stem.
    if (form.head !== "lavender" && form.head !== "hydrangea") head.push(dome(form.stemRadius * 2.2, 0.8, palette.stem, [0, -form.stemRadius, 0]));
    parts.push(...mountHead(head, body.tip, direction));

    if (form.leaves.on === "stem") {
      const curve = new THREE.CatmullRomCurve3(points);
      const leafCount = Math.max(1, Math.round(random.range(form.leaves.count[0], form.leaves.count[1]) / stems));
      for (let leaf = 0; leaf < leafCount; leaf++) {
        const at = curve.getPoint(random.range(0.2, 0.7));
        parts.push(blade({ length: random.range(form.leaves.length[0], form.leaves.length[1]), width: form.leaves.width, widest: form.leaves.widest, pointy: form.leaves.pointy, cup: 0.25, fold: 0.2, curl: -0.15 - wilt * 0.3 }, palette.leaf, palette.leafTip, angle + random.range(-1.6, 1.6), random.range(form.leaves.elevation[0], form.leaves.elevation[1]) - wilt * 0.4).translate(at.x, at.y, at.z));
      }
    }
  }

  if (form.leaves.on === "base") {
    for (const angle of ring(random.int(form.leaves.count[0], form.leaves.count[1]), random, 0.35)) {
      parts.push(blade({ length: random.range(form.leaves.length[0], form.leaves.length[1]), width: form.leaves.width, widest: form.leaves.widest, pointy: form.leaves.pointy, cup: 0.2, fold: 0.3, curl: -0.2 - wilt * 0.3 }, palette.leaf, palette.leafTip, angle, random.range(form.leaves.elevation[0], form.leaves.elevation[1]) - wilt * 0.4, 0.01));
    }
  }
  return parts;
};

const growMonstera = (random: Random, palette: Palette, extraLeaves: number, wilt: number) => {
  const parts: THREE.BufferGeometry[] = [];
  const leaves = Math.min(9, random.int(4, 6) + extraLeaves);
  const leaf = desaturate(hsl(random.range(135, 150), random.range(0.4, 0.5), random.range(0.25, 0.3)), wilt);
  const leafTip = desaturate(hsl(random.range(120, 135), 0.45, random.range(0.38, 0.44)), wilt);
  const stalk = desaturate(hsl(105, 0.35, 0.4), wilt);

  for (let index = 0; index < leaves; index++) {
    const angle = (index / leaves) * Math.PI * 2 + random.range(-0.35, 0.35);
    const reach = random.range(0.1, 0.22);
    const height = random.range(0.2, 0.42) * (1 - wilt * 0.25);
    const outward = new THREE.Vector3(Math.cos(angle), 0, -Math.sin(angle));
    const tip = outward.clone().multiplyScalar(reach).setY(height);
    parts.push(stem([new THREE.Vector3(0, 0, 0), outward.clone().multiplyScalar(reach * 0.2).setY(height * 0.6), tip], 0.008, stalk).geometry);

    const young = index >= leaves - 2 && random.chance(0.5);
    const slits = random.int(4, 6);
    const surface = bladeSurface({
      length: random.range(0.26, 0.36) * (young ? 0.75 : 1),
      width: random.range(0.28, 0.36) * (young ? 0.75 : 1),
      widest: 0.38,
      pointy: 0.55,
      cup: 0.18,
      fold: 0.12,
      curl: -0.22 - wilt * 0.3,
      columns: 24,
      rows: 42,
      // Young leaves are whole; mature ones get slits running in from the edge.
      cut: young || detail < 1 ? undefined : (u, v) => Math.abs(u) > 0.18 && v > 0.12 && v < 0.86 && ((v * slits + 10) % 1) < 0.16,
    });
    const blade3d = placeBlade(part(surface, leaf, {}, { smooth: true, shade: 0.15, tint: leafTip }), Math.PI / 2 + angle, random.range(0.25, 0.65) - wilt * 0.35);
    parts.push(blade3d.translate(tip.x, tip.y, tip.z));
  }
  return parts;
};

export const plantArchetypes = [...Object.keys(flowerForms), "monstera"] as (keyof typeof flowerForms | "monstera")[];
export type PlantArchetype = (typeof plantArchetypes)[number];

const archetypeWeights: Record<PlantArchetype, number> = {
  daisy: 14, sunflower: 8, tulip: 13, rose: 11, poppy: 10, lily: 9, hydrangea: 9, lavender: 9, monstera: 10,
};

export type PlantModel = {
  archetype: PlantArchetype;
  geometry: THREE.BufferGeometry;
  height: number;
  swaySpeed: number;
  swayPhase: number;
  lean: number;
  // 1 for the brightest moods, 0 for the heaviest; drives the shader's glow.
  vitality: number;
};

export const createPlant = (
  seed: string,
  { mood, waterings = 0, archetype: forced, detail: level = 1 }: { mood: MoodGrade; waterings?: number; archetype?: PlantArchetype; detail?: number }
): PlantModel => {
  detail = level;
  try {
    return growPlant(seed, mood, waterings, forced);
  } finally {
    detail = 1;
  }
};

const growPlant = (seed: string, mood: MoodGrade, waterings: number, forced: PlantArchetype | undefined): PlantModel => {
  const random = createRandom(`plant:${seed}`);
  let roll = random.range(0, Object.values(archetypeWeights).reduce((total, weight) => total + weight, 0));
  let archetype: PlantArchetype = "daisy";
  for (const [name, weight] of Object.entries(archetypeWeights) as [PlantArchetype, number][]) {
    roll -= weight;
    if (roll <= 0) { archetype = name; break; }
  }
  archetype = forced ?? archetype;

  const desaturation = moodGrayscale[mood] ?? 0;
  const families = archetype === "monstera" ? undefined : (flowerForms[archetype] as FlowerForm).families;
  const palette = createPalette(random, desaturation, families ? petalFamilies.find((family) => family.name === random.pick(families)) : undefined);
  // Each watering from a friend opens another bloom (or unfurls a leaf), up to a limit.
  const extra = Math.min(waterings, 4);
  const wilt = desaturation * 0.5;
  const parts = archetype === "monstera"
    ? growMonstera(random, palette, extra, desaturation)
    : growFlower(flowerForms[archetype], random, palette, extra, wilt);

  const geometry = merge(parts);
  geometry.rotateY(random.range(0, Math.PI * 2));
  const variety = random.range(1.25, 1.5);
  geometry.scale(variety, variety, variety);
  geometry.computeBoundingBox();

  return {
    archetype,
    geometry,
    height: geometry.boundingBox!.max.y,
    swaySpeed: random.range(0.8, 1.3),
    swayPhase: random.range(0, Math.PI * 2),
    lean: wilt * random.pick([-1, 1]) * 0.15,
    vitality: 1 - desaturation,
  };
};

// A plant reaches full size over its first few days, so the newest journals
// still look like they're growing in.
export const getPlantGrowth = (createdAt: number, now = Date.now()) => {
  const days = Math.max(0, (now - createdAt) / 86_400_000);
  const progress = Math.min(1, days / 4);
  return 0.5 + 0.5 * (1 - (1 - progress) ** 2);
};

// ---------------------------------------------------------------------------
// Island

const blob = (detail = 1) => new THREE.IcosahedronGeometry(1, detail);

export type GardenPlot = { x: number; y: number; z: number };

export type GardenLayout = {
  island: THREE.BufferGeometry;
  decor: THREE.BufferGeometry | null;
  water: THREE.BufferGeometry | null;
  plots: GardenPlot[];
  bounds: THREE.Box3;
};

export type Cell = { x: number; z: number; top: number; kind: "grass" | "path" | "water"; used: boolean };

export const islandStyles = [
  { grass: [92, 110], sand: 44 }, // spring
  { grass: [100, 125], sand: 40 }, // lush summer
  { grass: [70, 85], sand: 38 }, // late summer
  { grass: [125, 145], sand: 46 }, // cool meadow
] as const;

export const createGardenLayout = (seed: string, plantCount: number): GardenLayout => {
  const random = createRandom(`island:${seed}`);
  const style = random.pick(islandStyles);
  const grassHue = random.range(style.grass[0], style.grass[1]);
  const squareness = random.range(0, 1);
  const harmonics = Array.from({ length: 3 }, (_, index) => ({ amplitude: random.range(0.04, 0.12) / (index + 1), phase: random.range(0, Math.PI * 2), frequency: index + 2 }));
  const hasPond = random.chance(0.6);
  const hasPath = random.chance(0.55);
  const terrace = random.chance(0.35) ? { angle: random.range(0, Math.PI * 2), height: 0.2 } : null;

  // Grow the island until there is room for every plant plus some breathing space.
  let radius = Math.max(2.4, Math.sqrt((plantCount * 1.45) / Math.PI) + 1.1);
  let cells: Cell[] = [];
  for (;;) {
    const extent = Math.ceil(radius) + 1;
    cells = [];
    for (let x = -extent; x <= extent; x++) {
      for (let z = -extent; z <= extent; z++) {
        const angle = Math.atan2(z, x);
        const round = Math.hypot(x, z);
        const square = Math.max(Math.abs(x), Math.abs(z)) * 1.08;
        const distance = round + (square - round) * squareness;
        const edge = radius * (1 + harmonics.reduce((sum, h) => sum + h.amplitude * Math.sin(angle * h.frequency + h.phase), 0));
        if (distance > edge) continue;
        const raised = terrace && x * Math.cos(terrace.angle) + z * Math.sin(terrace.angle) > radius * 0.25;
        cells.push({ x, z, top: raised ? terrace.height : 0, kind: "grass", used: false });
      }
    }

    const landCount = cells.length;
    if (hasPond && landCount > 24) {
      const edgeCells = cells.filter((cell) => Math.hypot(cell.x, cell.z) > radius * 0.45 && Math.hypot(cell.x, cell.z) < radius * 0.8 && !cell.top);
      let current = edgeCells.length ? random.pick(edgeCells) : null;
      for (let size = Math.min(random.int(2, 5), Math.floor(landCount / 12)); current && size > 0; size--) {
        current.kind = "water";
        const neighbours = cells.filter((cell) => cell.kind === "grass" && !cell.top && Math.abs(cell.x - current!.x) + Math.abs(cell.z - current!.z) === 1);
        current = neighbours.length ? random.pick(neighbours) : null;
      }
    }
    if (hasPath && landCount > 16) {
      const rim = cells.filter((cell) => cell.kind === "grass" && Math.hypot(cell.x, cell.z) > radius - 1.5);
      let current = rim.length ? random.pick(rim) : null;
      for (let steps = random.int(3, 6); current && steps > 0; steps--) {
        current.kind = "path";
        const towardCenter = cells.filter((cell) => cell.kind === "grass" && Math.abs(cell.x - current!.x) + Math.abs(cell.z - current!.z) === 1 && Math.hypot(cell.x, cell.z) < Math.hypot(current!.x, current!.z) + 0.6);
        current = towardCenter.length ? random.pick(towardCenter) : null;
      }
    }

    if (cells.filter((cell) => cell.kind === "grass").length >= plantCount + Math.ceil(plantCount * 0.15) + 3) break;
    radius += 0.6;
  }

  return buildIsland(random, cells, plantCount, { radius, grassHue, sandHue: style.sand });
};

export type IslandOptions = { radius: number; grassHue: number; sandHue: number; centerX?: number; centerZ?: number };

// Turns a set of cells into island geometry and plant plots. Shared by the
// standalone islands and the jigsaw pieces of the world view.
export const buildIsland = (
  random: Random,
  cells: Cell[],
  plantCount: number,
  { radius, grassHue, sandHue, centerX = 0, centerZ = 0 }: IslandOptions
): GardenLayout => {
  const distanceFromCenter = (cell: Cell) => Math.hypot(cell.x - centerX, cell.z - centerZ);
  // Oldest journals take the heart of the island; newer ones spread outward.
  const plotCells = cells
    .filter((cell) => cell.kind === "grass")
    .map((cell) => ({ cell, order: distanceFromCenter(cell) + random.range(0, 1.1) }))
    .sort((a, b) => a.order - b.order)
    .slice(0, plantCount)
    .map(({ cell }) => cell);
  const plots = plotCells.map((cell) => {
    cell.used = true;
    return { x: cell.x + random.range(-0.12, 0.12), y: cell.top, z: cell.z + random.range(-0.12, 0.12) };
  });

  const grassA = hsl(grassHue, 0.5, 0.55);
  const grassB = hsl(grassHue + 4, 0.52, 0.5);
  const grassSide = hsl(grassHue + 6, 0.48, 0.4);
  const sand = hsl(sandHue, 0.55, 0.76);
  const soil = hsl(random.range(22, 30), random.range(0.38, 0.5), 0.36);
  const rock = hsl(random.range(25, 35), random.range(0.18, 0.3), 0.5);
  const cellKeys = new Set(cells.map((cell) => `${cell.x},${cell.z}`));

  const islandParts: THREE.BufferGeometry[] = [];
  for (const cell of cells) {
    const edgeDistance = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => !cellKeys.has(`${cell.x + dx},${cell.z + dz}`)) ? 0 : 1;
    const depth = 0.55 + (1 - Math.min(1, distanceFromCenter(cell) / radius)) * 1.1 + random.range(0, 0.25) + edgeDistance * 0.1;
    const surface = cell.kind === "water" ? cell.top - 0.14 : cell.top;
    const grassDepth = 0.14;
    const checker = (cell.x + cell.z) & 1 ? grassA : grassB;
    const topColor = cell.kind === "path" ? sand : cell.kind === "water" ? soil : checker.clone().offsetHSL(0, 0, random.range(-0.015, 0.015));
    islandParts.push(part(new THREE.BoxGeometry(1, grassDepth, 1), topColor, { position: [cell.x, surface - grassDepth / 2, cell.z] }, { shade: 0 }));
    islandParts.push(part(new THREE.BoxGeometry(1, 0.06, 1), cell.kind === "path" ? sand.clone().offsetHSL(0, -0.05, -0.1) : grassSide, { position: [cell.x, surface - grassDepth - 0.03, cell.z] }, { shade: 0 }));
    const soilDepth = 0.32;
    islandParts.push(part(new THREE.BoxGeometry(1, soilDepth, 1), soil, { position: [cell.x, surface - grassDepth - 0.06 - soilDepth / 2, cell.z] }, { shade: 0.15 }));
    const rockTop = surface - grassDepth - 0.06 - soilDepth;
    const rockDepth = Math.max(0.1, depth - (surface - rockTop));
    islandParts.push(part(new THREE.BoxGeometry(1, rockDepth, 1), rock, { position: [cell.x, rockTop - rockDepth / 2, cell.z] }, { shade: 0.45 }));
  }
  const island = merge(islandParts);

  const waterCells = cells.filter((cell) => cell.kind === "water");
  const water = waterCells.length
    ? merge(waterCells.map((cell) => part(new THREE.BoxGeometry(1, 0.06, 1), hsl(195, 0.65, 0.58), { position: [cell.x, cell.top - 0.06, cell.z] }, { shade: 0 })))
    : null;

  const decorParts: THREE.BufferGeometry[] = [];
  for (const cell of waterCells) {
    if (random.chance(0.6)) decorParts.push(part(new THREE.CylinderGeometry(0.12, 0.12, 0.015, 8), hsl(110, 0.45, 0.45), { position: [cell.x + random.range(-0.25, 0.25), cell.top - 0.025, cell.z + random.range(-0.25, 0.25)] }, { shade: 0 }));
    if (random.chance(0.4)) {
      for (let reed = random.int(2, 4); reed > 0; reed--) {
        const height = random.range(0.2, 0.35);
        const x = cell.x + random.range(-0.4, 0.4);
        const z = cell.z + random.range(-0.4, 0.4);
        decorParts.push(part(new THREE.CylinderGeometry(0.008, 0.012, height, 4), hsl(100, 0.4, 0.4), { position: [x, cell.top - 0.08 + height / 2, z] }));
        decorParts.push(part(new THREE.CylinderGeometry(0.02, 0.02, 0.07, 5), hsl(25, 0.5, 0.3), { position: [x, cell.top - 0.08 + height, z] }));
      }
    }
  }
  for (const cell of cells) {
    if (cell.kind === "water" || cell.used) continue;
    const roll = random.next();
    const x = cell.x + random.range(-0.3, 0.3);
    const z = cell.z + random.range(-0.3, 0.3);
    if (roll < 0.14) {
      for (let stone = random.int(1, 3); stone > 0; stone--) {
        const size = random.range(0.07, 0.17);
        decorParts.push(part(blob(0), rock.clone().offsetHSL(0, -0.1, random.range(0.05, 0.18)), { position: [x + random.range(-0.15, 0.15), cell.top + size * 0.35, z + random.range(-0.15, 0.15)], scale: [size, size * random.range(0.6, 0.9), size * random.range(0.8, 1.1)], rotation: [0, random.range(0, 3), 0] }, { shade: 0.35 }));
      }
    } else if (roll < 0.5 && cell.kind === "grass") {
      for (let blade = random.int(3, 5); blade > 0; blade--) {
        const height = random.range(0.07, 0.14);
        decorParts.push(part(new THREE.ConeGeometry(0.018, height, 3), grassSide.clone().offsetHSL(0, 0.05, random.range(0, 0.08)), { position: [x + random.range(-0.08, 0.08), cell.top + height / 2, z + random.range(-0.08, 0.08)], rotation: [random.range(-0.3, 0.3), 0, random.range(-0.3, 0.3)] }, { shade: 0.3 }));
      }
    } else if (roll < 0.62 && cell.kind === "grass") {
      const petal = hsl(random.pick(blossomHues), 0.7, random.chance(0.4) ? 0.95 : 0.7);
      for (let flower = random.int(2, 4); flower > 0; flower--) {
        decorParts.push(part(blob(0), petal, { position: [x + random.range(-0.15, 0.15), cell.top + 0.03, z + random.range(-0.15, 0.15)], scale: [0.03, 0.02, 0.03] }, { shade: 0 }));
      }
    }
  }

  const bounds = island.boundingBox!.clone();
  bounds.max.y += 1.5;

  return {
    island,
    water,
    decor: decorParts.length ? merge(decorParts) : null,
    plots,
    bounds,
  };
};

// ---------------------------------------------------------------------------
// Camera shared by the WebGL scene and the DOM hit areas laid over it.

const cameraDirection = new THREE.Vector3(1, 0.95, 1).normalize();

// Isometric orthographic camera framing every point, padded to the frame's aspect ratio.
export const createIsometricCamera = (points: Iterable<THREE.Vector3>, center: THREE.Vector3, aspect: number, padding = 1.08) => {
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  camera.position.copy(center).addScaledVector(cameraDirection, 60);
  camera.lookAt(center);
  camera.updateMatrixWorld();

  let left = Infinity, right = -Infinity, bottom = Infinity, top = -Infinity;
  for (const point of points) {
    vector.copy(point).applyMatrix4(camera.matrixWorldInverse);
    left = Math.min(left, vector.x);
    right = Math.max(right, vector.x);
    bottom = Math.min(bottom, vector.y);
    top = Math.max(top, vector.y);
  }

  let width = (right - left) * padding;
  let height = (top - bottom) * padding;
  const middleX = (left + right) / 2;
  const middleY = (top + bottom) / 2;
  if (width / height > aspect) height = width / aspect;
  else width = height * aspect;

  camera.left = middleX - width / 2;
  camera.right = middleX + width / 2;
  camera.top = middleY + height / 2;
  camera.bottom = middleY - height / 2;
  camera.updateProjectionMatrix();
  return camera;
};

// The garden turns around the centre of its island.
export const getGardenPivot = (layout: GardenLayout) => {
  const center = layout.bounds.getCenter(new THREE.Vector3());
  return new THREE.Vector3(center.x, 0, center.z);
};

const yAxis = new THREE.Vector3(0, 1, 0);

export const rotateAroundPivot = (point: THREE.Vector3, pivot: THREE.Vector3, angle: number) =>
  point.sub(pivot).applyAxisAngle(yAxis, angle).add(pivot);

export const createGardenCamera = (layout: GardenLayout, aspect: number) => {
  // Fit the real island silhouette plus room above each plot for its plant,
  // at every angle the garden can be turned to, so rotating never clips it.
  const pivot = getGardenPivot(layout);
  const source: THREE.Vector3[] = [];
  const position = layout.island.attributes.position;
  for (let index = 0; index < position.count; index++) source.push(new THREE.Vector3().fromBufferAttribute(position, index));
  for (const plot of layout.plots) source.push(new THREE.Vector3(plot.x, plot.y + 1.5, plot.z));

  const points: THREE.Vector3[] = [];
  for (let step = 0; step < 12; step++) {
    const angle = (step / 12) * Math.PI * 2;
    for (const point of source) points.push(rotateAroundPivot(point.clone(), pivot, angle));
  }
  return createIsometricCamera(points, layout.bounds.getCenter(new THREE.Vector3()), aspect, 1.04);
};

export const projectToFrame = (camera: THREE.Camera, x: number, y: number, z: number) => {
  vector.set(x, y, z).project(camera);
  return { left: (vector.x + 1) * 50, top: (1 - vector.y) * 50 };
};
