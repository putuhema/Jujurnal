"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Globe, History, Map as MapIcon, Minus, Pause, Play, Plus, RotateCcw, RotateCw, Sprout, X } from "lucide-react";
import { toast } from "sonner";
import * as THREE from "three";
import { getCalendarDate } from "@/lib/calendar-date";
import { createPlant, getPlantGrowth, type GardenLayout, type PlantModel } from "@/lib/garden-procedural";
import {
  applyWorldView,
  createPieceLayout,
  growPiecePlants,
  panByScreen,
  pieceCenter,
  pieceFrameWidth,
  PIECE_SIZE,
  spiralCoordinates,
  viewReach,
  type WorldView,
} from "@/lib/garden-world";
import { plantPointer, plantPointerStrength } from "@/lib/plant-material";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import { createWorldMaterial, worldMaterials, worldUniforms } from "@/lib/world-material";
import { getJournalAriaLabel, moodLabels } from "./garden-flower";
import { JournalPanel } from "./journal-panel";
import { playGardenSound } from "@/lib/garden-sounds";
import { GardenPlant } from "./garden-three";
import type { IslandPost } from "./island-garden";
import { Slider } from "./ui/slider";

export type WorldGardenEntry = { userId: string; name: string; posts: IslandPost[] };
export type WaterResult = "watered" | "already" | "signedOut" | "unavailable";

type Placement = {
  // Changes whenever the garden's content does, so its piece is rebuilt.
  key: string;
  // Stable per garden and position, for React.
  slot: string;
  garden: WorldGardenEntry;
  gx: number;
  gz: number;
  center: THREE.Vector3;
  isMine: boolean;
};

type Mode = "garden" | "world" | "visit";

const DRAG_THRESHOLD = 5;
const DRAG_TURN = Math.PI * 1.5;
const BUTTON_TURN = Math.PI / 4;
const WORLD_ZOOM = { initial: 2.6, min: 1.6, step: 1.35 };
// Cap how far out the world view can zoom, which bounds how many pieces are drawn.
const MAX_WORLD_WIDTH = { fine: 72, coarse: 46 };
const CACHE_LIMIT = 48;
const FRAME_BUDGET_MS = 6;
const GRAY = 0.92;
const PLANTING = { zoom: 0.6, seedFall: 0.75, growDelay: 0.95, hold: 3.4 };
const REPLAY_STEP_MS = 420;
// Fingers are less precise than a mouse, so taps reach further on touch screens.
const WATER_TAP_RADIUS = { fine: 0.7, coarse: 1.1 };
const DOUBLE_TAP_MS = 350;
// A tap that misses every plant's button still opens the nearest plant this close (px).
const TAP_SLOP_PX = 40;
const GARDEN_ZOOM = { min: 0.4, max: 1.15 };
// A short buzz on phones that support it, for moments worth feeling.
const buzz = (pattern: number | number[] = 12) => navigator.vibrate?.(pattern);
// Reading a journal: how far the camera zooms in, how much the other plants fade,
// and where the plant sits so the panel doesn't cover it (fractions of the frame).
const READING = { zoom: 0.24, dim: 0.55, offsetWide: { x: -0.17, y: 0.1 }, offsetNarrow: { x: 0, y: -0.14 } };
const SUN_OFFSET = new THREE.Vector3(-4, 10, 6);
const SHADOW_MAP_SIZE = { fine: 2048, coarse: 1024 };
// The sun's frame of reference, for snapping shadows to whole shadow-map texels.
const sunBasis = new THREE.Matrix4().lookAt(SUN_OFFSET, new THREE.Vector3(), new THREE.Vector3(0, 1, 0));
const sunBasisInverse = sunBasis.clone().invert();

// ---------------------------------------------------------------------------
// Piece cache: other gardens are built a little at a time, spread over frames,
// and kept around for a while after they scroll out of range.

type PieceBuild = { layout: GardenLayout | null; plants: THREE.BufferGeometry | null };
type PieceJob = Generator<Partial<PieceBuild> | undefined, void>;

const disposeBuild = (build: PieceBuild) => {
  build.layout?.island.dispose();
  build.layout?.water?.dispose();
  build.layout?.decor?.dispose();
  build.plants?.dispose();
};

class PieceCache {
  private builds = new Map<string, PieceBuild>();
  private jobs = new Map<string, PieceJob>();
  private complete = new Set<string>();
  // Builds still on screen while their replacement is being made.
  private pinned = new Map<string, number>();
  private listeners = new Set<() => void>();

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  get = (key: string) => this.builds.get(key);

  get hasWork() {
    return this.jobs.size > 0;
  }

  pin(key: string) {
    this.pinned.set(key, (this.pinned.get(key) ?? 0) + 1);
    return () => {
      const count = (this.pinned.get(key) ?? 1) - 1;
      if (count > 0) this.pinned.set(key, count);
      else this.pinned.delete(key);
    };
  }

  request(key: string, createJob: () => PieceJob) {
    const existing = this.builds.get(key);
    if (existing) {
      // Re-insert so the map's order doubles as least-recently-used.
      this.builds.delete(key);
      this.builds.set(key, existing);
    }
    if (this.complete.has(key) || this.jobs.has(key)) return;
    this.jobs.set(key, createJob());
  }

  work(budgetMs: number) {
    const deadline = performance.now() + budgetMs;
    let changed = false;
    for (const [key, job] of this.jobs) {
      while (performance.now() < deadline) {
        const step = job.next();
        if (step.done) {
          this.jobs.delete(key);
          this.complete.add(key);
          break;
        }
        if (step.value) {
          this.builds.set(key, { ...(this.builds.get(key) ?? { layout: null, plants: null }), ...step.value });
          changed = true;
        }
      }
      if (performance.now() >= deadline) break;
    }
    if (changed) for (const listener of this.listeners) listener();
  }

  // Drop unfinished work for pieces that left the view, and evict the oldest
  // finished pieces beyond the limit.
  retain(visible: Set<string>) {
    for (const key of this.jobs.keys()) {
      if (visible.has(key)) continue;
      this.jobs.delete(key);
      const partial = this.builds.get(key);
      if (partial && !this.pinned.has(key)) {
        disposeBuild(partial);
        this.builds.delete(key);
      }
    }
    for (const [key, build] of this.builds) {
      if (this.builds.size <= CACHE_LIMIT) break;
      if (visible.has(key) || this.pinned.has(key)) continue;
      disposeBuild(build);
      this.builds.delete(key);
      this.complete.delete(key);
    }
  }

  dispose() {
    for (const build of this.builds.values()) disposeBuild(build);
    this.builds.clear();
    this.jobs.clear();
    this.complete.clear();
  }
}

const sortByTime = (posts: IslandPost[]) => [...posts].sort((a, b) => a._creationTime - b._creationTime);

function* buildOtherPiece(placement: Placement, now: number): PieceJob {
  const posts = sortByTime(placement.garden.posts);
  const layout = createPieceLayout(placement.garden.userId, placement.gx, placement.gz, posts.length);
  yield { layout };
  const plants = yield* growPiecePlants(posts, layout, now);
  yield { plants };
}

// Plant models keyed by everything that shapes them, so adding one journal
// grows one new plant instead of regenerating the whole garden.
const usePlantModels = (posts: IslandPost[], detail = 1) => {
  const cache = useRef(new Map<string, PlantModel>());
  const models = useMemo(() => {
    const next = new Map<string, PlantModel>();
    const list = posts.map((post) => {
      const key = `${post._id}:${post.mood}:${post.reactionCount ?? 0}:${detail}`;
      const model = cache.current.get(key) ?? next.get(key) ?? createPlant(post._id, { mood: post.mood, waterings: post.reactionCount, detail });
      next.set(key, model);
      return model;
    });
    for (const [key, model] of cache.current) if (!next.has(key)) model.geometry.dispose();
    cache.current = next;
    return list;
  }, [posts, detail]);
  useEffect(() => () => {
    for (const model of cache.current.values()) model.geometry.dispose();
    cache.current.clear();
  }, []);
  return models;
};

const dayOfMonth = (post: IslandPost) => Number(getCalendarDate(post._creationTime, post.entryDate).date.slice(8, 10));

// ---------------------------------------------------------------------------
// Scene pieces

const OtherPiece = ({
  placement,
  cache,
  gray,
  now,
  onTap,
  onVisit,
}: {
  placement: Placement;
  cache: PieceCache;
  gray: boolean;
  now: number;
  onTap: (placement: Placement, layout: GardenLayout, point: THREE.Vector3) => void;
  onVisit: (placement: Placement) => void;
}) => {
  useEffect(() => cache.request(placement.key, () => buildOtherPiece(placement, now)), [cache, placement, now]);
  const fresh = useSyncExternalStore(cache.subscribe, () => cache.get(placement.key), () => undefined);
  // Keep showing the previous build (e.g. before a new bloom) until its replacement is ready.
  const [shown, setShown] = useState<{ key: string; build: PieceBuild } | null>(null);
  const ready = fresh?.layout && fresh.plants !== undefined && (fresh.plants || placement.garden.posts.length === 0) ? fresh : null;
  if (ready && shown?.build !== ready) setShown({ key: placement.key, build: ready });
  const display = ready ?? shown?.build ?? fresh;
  const displayKey = ready ? placement.key : shown?.key;
  useEffect(() => (displayKey ? cache.pin(displayKey) : undefined), [cache, displayKey]);
  if (!display?.layout) return null;
  const layout = display.layout;

  return (
    <group
      onClick={(event: ThreeEvent<MouseEvent>) => {
        if (event.delta > DRAG_THRESHOLD) return;
        event.stopPropagation();
        onTap(placement, layout, event.point);
      }}
      onDoubleClick={(event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation();
        onVisit(placement);
      }}
    >
      <mesh geometry={layout.island} material={gray ? worldMaterials.groundGray : worldMaterials.ground} receiveShadow />
      {layout.decor ? <mesh geometry={layout.decor} material={gray ? worldMaterials.groundGray : worldMaterials.ground} castShadow receiveShadow /> : null}
      {layout.water ? <mesh geometry={layout.water} material={gray ? worldMaterials.waterGray : worldMaterials.water} /> : null}
      {/* Neighbouring plants skip the shadow pass: it would double their (largest) share of the frame. */}
      {display.plants ? <mesh geometry={display.plants} material={gray ? worldMaterials.plantsGray : worldMaterials.plants} /> : null}
    </group>
  );
};

// The garden you're visiting, at full detail, fading from gray to colour on
// arrival and back again as you leave.
const VisitedPiece = ({
  layout,
  posts,
  models,
  gray,
  leaving,
  now,
  still,
  activePostId,
  focusPostId,
  dim,
  onGone,
}: {
  layout: GardenLayout;
  posts: IslandPost[];
  models: PlantModel[];
  gray: RefObject<number>;
  leaving: boolean;
  now: number;
  still: boolean;
  activePostId: string | null;
  focusPostId: string | null;
  dim: RefObject<number>;
  onGone: () => void;
}) => {
  const grayMix = useMemo(() => ({ value: GRAY }), []);
  // Unread plants combine the visit's fade with the reading dim.
  const unreadGray = useRef(GRAY);
  const materials = useMemo(
    () => ({ ground: createWorldMaterial({ gray: false, grayMix }), water: createWorldMaterial({ gray: false, grayMix, opacity: 0.82 }) }),
    [grayMix]
  );
  useEffect(() => () => {
    materials.ground.dispose();
    materials.water.dispose();
  }, [materials]);
  const gone = useRef(false);

  useFrame((state, delta) => {
    const target = leaving ? 1 : 0;
    gray.current += (target - gray.current) * (still ? 1 : Math.min(1, delta * 3));
    grayMix.value = gray.current;
    unreadGray.current = Math.max(gray.current, dim.current);
    if (leaving && gray.current > 0.97 && !gone.current) {
      gone.current = true;
      onGone();
    }
    if (still && Math.abs(target - gray.current) > 0.01) state.invalidate();
  });

  return (
    <group>
      <mesh geometry={layout.island} material={materials.ground} receiveShadow />
      {layout.decor ? <mesh geometry={layout.decor} material={materials.ground} castShadow receiveShadow /> : null}
      {layout.water ? <mesh geometry={layout.water} material={materials.water} /> : null}
      {models.map((model, index) => {
        const post = posts[index];
        const plot = layout.plots[index];
        if (!plot) return null;
        return (
          <GardenPlant
            key={post._id}
            model={model}
            plot={plot}
            growth={getPlantGrowth(post._creationTime, now)}
            isActive={activePostId === post._id || focusPostId === post._id}
            isHighlighted={!leaving && (activePostId === post._id || focusPostId === post._id)}
            animate={!still}
            gray={focusPostId === post._id ? gray : unreadGray}
          />
        );
      })}
    </group>
  );
};

// A seed falls onto the new plot, bounces, and sinks in with a puff of soil.
const SeedDrop = ({ position }: { position: THREE.Vector3 }) => {
  const seed = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const startedAt = useRef<number | null>(null);
  const assets = useMemo(
    () => ({
      seedGeometry: new THREE.SphereGeometry(0.075, 12, 8).scale(1, 1.35, 1),
      seedMaterial: new THREE.MeshLambertMaterial({ color: "#7a5230" }),
      ringGeometry: new THREE.RingGeometry(0.12, 0.2, 24).rotateX(-Math.PI / 2),
      ringMaterial: new THREE.MeshBasicMaterial({ color: "#c79a62", transparent: true, opacity: 0, depthWrite: false }),
    }),
    []
  );
  useEffect(() => () => {
    for (const item of Object.values(assets)) item.dispose();
  }, [assets]);

  useFrame(({ clock }) => {
    startedAt.current ??= clock.elapsedTime;
    const t = clock.elapsedTime - startedAt.current;
    const fall = PLANTING.seedFall;
    const mesh = seed.current;
    if (mesh) {
      let y: number;
      let scale = 1;
      if (t < fall) y = 3 * (1 - (t / fall) ** 2);
      else if (t < fall + 0.2) y = Math.sin(((t - fall) / 0.2) * Math.PI) * 0.12;
      else {
        y = -Math.min(1, (t - fall - 0.2) / 0.35) * 0.08;
        scale = Math.max(0, 1 - (t - fall - 0.2) / 0.35);
      }
      mesh.position.set(position.x, position.y + 0.07 + y, position.z);
      mesh.rotation.z = t * 3;
      mesh.scale.setScalar(scale);
      mesh.visible = scale > 0;
    }
    const puff = Math.max(0, Math.min(1, (t - fall) / 0.6));
    if (ring.current) {
      ring.current.position.set(position.x, position.y + 0.015, position.z);
      ring.current.scale.setScalar(0.6 + puff * 3);
      assets.ringMaterial.opacity = puff > 0 && puff < 1 ? 0.7 * (1 - puff) : 0;
    }
  });

  return (
    <>
      <mesh ref={seed} geometry={assets.seedGeometry} material={assets.seedMaterial} castShadow />
      <mesh ref={ring} geometry={assets.ringGeometry} material={assets.ringMaterial} />
    </>
  );
};

type WaterEffect = { id: number; post: IslandPost; plot: THREE.Vector3; model: PlantModel };

// A droplet falls on a neighbour's flower, splashes, and the flower blooms in
// colour for a moment before settling back to gray.
const WaterSplash = ({ effect, now, still, onDone }: { effect: WaterEffect; now: number; still: boolean; onDone: (id: number) => void }) => {
  const drop = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const startedAt = useRef<number | null>(null);
  const gray = useRef(0);
  const done = useRef(false);
  const height = effect.model.height * getPlantGrowth(effect.post._creationTime, now);
  const assets = useMemo(
    () => ({
      dropGeometry: new THREE.SphereGeometry(0.06, 12, 10).scale(1, 1.5, 1),
      dropMaterial: new THREE.MeshLambertMaterial({ color: "#7cc8ff", emissive: "#2b7fd1", emissiveIntensity: 0.4 }),
      ringGeometry: new THREE.RingGeometry(0.2, 0.26, 32).rotateX(-Math.PI / 2),
      ringMaterial: new THREE.MeshBasicMaterial({ color: "#9fd8ff", transparent: true, opacity: 0, depthWrite: false }),
    }),
    []
  );
  useEffect(() => () => {
    for (const item of Object.values(assets)) item.dispose();
  }, [assets]);

  useFrame((state) => {
    startedAt.current ??= state.clock.elapsedTime;
    const t = still ? 2.6 : state.clock.elapsedTime - startedAt.current;
    const fall = 0.5;
    if (drop.current) {
      drop.current.visible = t < fall;
      drop.current.position.set(effect.plot.x, effect.plot.y + height + 2.4 * (1 - (t / fall) ** 2), effect.plot.z);
    }
    const splash = Math.max(0, Math.min(1, (t - fall) / 0.7));
    if (ring.current) {
      ring.current.position.set(effect.plot.x, effect.plot.y + 0.02, effect.plot.z);
      ring.current.scale.setScalar(0.5 + splash * 2.4);
      assets.ringMaterial.opacity = splash > 0 && splash < 1 ? 0.8 * (1 - splash) : 0;
    }
    // Colour while it blooms, then fade back to the gray of a neighbour's garden.
    gray.current = t < 1.6 ? 0 : Math.min(1, (t - 1.6) / 0.8);
    if (t > 2.5 && !done.current) {
      done.current = true;
      onDone(effect.id);
    }
  });

  return (
    <>
      <mesh ref={drop} geometry={assets.dropGeometry} material={assets.dropMaterial} />
      <mesh ref={ring} geometry={assets.ringGeometry} material={assets.ringMaterial} />
      {/* Slightly larger than the gray plant underneath, so it reads as the plant itself blooming. */}
      <GardenPlant
        model={effect.model}
        plot={{ x: effect.plot.x, y: effect.plot.y, z: effect.plot.z }}
        growth={getPlantGrowth(effect.post._creationTime, now) * 1.05}
        delay={0.45}
        animate={!still}
        gray={gray}
        waterPulse={1}
      />
    </>
  );
};

const WorldLights = ({ current, aspect, mapSize }: { current: RefObject<WorldView>; aspect: number; mapSize: number }) => {
  const light = useRef<THREE.DirectionalLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  const shadowReach = useRef(0);
  const center = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const sun = light.current;
    if (!sun) return;
    const view = current.current;
    // The shadow area grows in coarse steps: resizing it every frame while
    // zooming would make every shadow edge crawl.
    const reach = Math.ceil((viewReach(view.width, aspect) * 1.05) / 6) * 6;
    // The sun travels with the view so shadows stay sharp wherever you look,
    // but only in whole shadow-map texels: moving by fractions of a texel is
    // what makes shadow edges shimmer while the camera glides.
    const texel = (reach * 2) / mapSize;
    center.set(view.x, 0, view.z).applyMatrix4(sunBasisInverse);
    center.x = Math.round(center.x / texel) * texel;
    center.y = Math.round(center.y / texel) * texel;
    center.applyMatrix4(sunBasis);
    sun.position.copy(center).add(SUN_OFFSET);
    target.position.copy(center);
    target.updateMatrixWorld();
    if (reach !== shadowReach.current) {
      shadowReach.current = reach;
      const camera = sun.shadow.camera;
      camera.left = -reach;
      camera.right = reach;
      camera.top = reach;
      camera.bottom = -reach;
      camera.far = 80;
      camera.updateProjectionMatrix();
    }
  });

  return (
    <>
      <hemisphereLight args={["#fff4dc", "#5d7a4c", 1.5]} />
      <primitive object={target} />
      <directionalLight
        ref={light}
        target={target}
        intensity={2.1}
        castShadow
        shadow-mapSize={[mapSize, mapSize]}
        shadow-bias={-0.0005}
        shadow-normalBias={0.03}
      />
    </>
  );
};

// Fades every plant except the one being read.
const ReadingDim = ({ dim, reading, still }: { dim: RefObject<number>; reading: boolean; still: boolean }) => {
  useFrame((state, delta) => {
    const target = reading ? READING.dim : 0;
    dim.current += (target - dim.current) * (still ? 1 : Math.min(1, delta * 4));
    if (still && Math.abs(target - dim.current) > 0.01) state.invalidate();
  });
  return null;
};

// Eases the camera toward the goal view every frame and reports the few
// moments React needs to know about (started/stopped moving, entered a new
// piece), so panning never re-renders the page per frame.
const ViewController = ({
  camera,
  goal,
  current,
  aspect,
  still,
  cache,
  pointerTarget,
  screenOffset,
  size,
  onMovingChange,
  onFocusChange,
}: {
  camera: THREE.OrthographicCamera;
  goal: RefObject<WorldView>;
  current: RefObject<WorldView>;
  aspect: number;
  still: boolean;
  cache: PieceCache;
  pointerTarget: RefObject<number>;
  // Where the goal point should sit on screen, as a fraction of the frame from centre.
  screenOffset: RefObject<{ x: number; y: number }>;
  size: { width: number; height: number };
  onMovingChange: (moving: boolean, view: WorldView) => void;
  onFocusChange: (focus: { gx: number; gz: number; reach: number }) => void;
}) => {
  const moving = useRef(false);
  const focusKey = useRef("");

  useFrame((state, delta) => {
    const offset = screenOffset.current;
    const target =
      offset.x || offset.y
        ? { ...goal.current, ...panByScreen(goal.current, offset.x * size.width, offset.y * size.height, size.width) }
        : goal.current;
    const view = current.current;
    const ease = still ? 1 : 1 - Math.exp(-delta * 7);
    view.x += (target.x - view.x) * ease;
    view.z += (target.z - view.z) * ease;
    view.angle += (target.angle - view.angle) * ease;
    view.width += (target.width - view.width) * ease;

    const settled =
      Math.abs(target.x - view.x) < 0.01 &&
      Math.abs(target.z - view.z) < 0.01 &&
      Math.abs(target.angle - view.angle) < 0.001 &&
      Math.abs(target.width - view.width) < 0.01;
    if (settled) Object.assign(view, target);
    if (settled === moving.current) {
      moving.current = !settled;
      onMovingChange(!settled, { ...view });
    }

    applyWorldView(camera, view, aspect);
    const reach = viewReach(view.width, aspect);
    worldUniforms.uFocus.value.set(view.x, view.z);
    worldUniforms.uFade.value.set(reach * 0.94, reach * 1.12);
    // Plants ease into and out of leaning away from the pointer.
    plantPointerStrength.value += ((still ? 0 : pointerTarget.current) - plantPointerStrength.value) * Math.min(1, delta * 6);

    const gx = Math.round(view.x / PIECE_SIZE);
    const gz = Math.round(view.z / PIECE_SIZE);
    const reachStep = Math.ceil(reach / 4) * 4;
    const key = `${gx}:${gz}:${reachStep}`;
    if (key !== focusKey.current) {
      focusKey.current = key;
      onFocusChange({ gx, gz, reach: reachStep });
    }

    cache.work(FRAME_BUDGET_MS);
    // On-demand rendering (reduced motion) still needs frames to finish building pieces.
    if (still && (cache.hasWork || !settled)) state.invalidate();
  });

  return null;
};

const InvalidateBridge = ({ invalidate }: { invalidate: RefObject<(() => void) | null> }) => {
  const fn = useThree((state) => state.invalidate);
  useEffect(() => {
    invalidate.current = () => fn();
  }, [fn, invalidate]);
  return null;
};

// ---------------------------------------------------------------------------

const projectPoint = (camera: THREE.Camera, x: number, y: number, z: number) => {
  const point = new THREE.Vector3(x, y, z).project(camera);
  return { left: (point.x + 1) * 50, top: (1 - point.y) * 50, depth: point.z };
};

const previewLine = (post: IslandPost) => {
  if (post.visibility === "private") return "Private journal";
  const line = post.body.split("\n").find((text) => text.trim()) ?? "";
  return line.length > 72 ? `${line.slice(0, 70).trimEnd()}…` : line;
};

const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const raycaster = new THREE.Raycaster();

export default function WorldGardenScene({
  me,
  others,
  onWater,
  demo = false,
}: {
  me: WorldGardenEntry | null;
  others: WorldGardenEntry[];
  // Sample data: skip anything that would ask the server about these posts.
  demo?: boolean;
  // Waters someone else's journal; the scene plays the animation on success.
  onWater: (postId: string) => Promise<WaterResult>;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [mode, setMode] = useState<Mode>(me ? "garden" : "world");
  const [worldZoom, setWorldZoom] = useState(WORLD_ZOOM.initial);
  // Pinch / wheel zoom inside your own garden.
  const [gardenZoom, setGardenZoom] = useState(1);
  const [isMoving, setIsMoving] = useState(false);
  const [settledView, setSettledView] = useState<WorldView | null>(null);
  const [focus, setFocus] = useState({ gx: 0, gz: 0, reach: 40 });
  const [selected, setSelected] = useState<Placement | null>(null);
  const [visit, setVisit] = useState<{ placement: Placement; leaving: boolean } | null>(null);
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [planting, setPlanting] = useState<{ postId: string; key: number } | null>(null);
  const [replay, setReplay] = useState<{ day: number; playing: boolean } | null>(null);
  const [waterEffects, setWaterEffects] = useState<WaterEffect[]>([]);
  // The journal being read in the side panel.
  const [focusPostId, setFocusPostId] = useState<string | null>(null);
  const readingDim = useRef(0);
  const screenOffset = useRef({ x: 0, y: 0 });
  const [now] = useState(() => Date.now());
  const still = usePrefersReducedMotion();
  const cache = useMemo(() => new PieceCache(), []);
  useEffect(() => () => cache.dispose(), [cache]);
  const invalidate = useRef<(() => void) | null>(null);
  const pointerTarget = useRef(0);
  const visitGray = useRef(GRAY);
  const coarsePointer = useSyncExternalStore(
    () => () => {},
    () => window.matchMedia("(pointer: coarse)").matches,
    () => false
  );

  const aspect = size ? size.width / size.height : 16 / 9;

  // Your garden sits at the centre; everyone else spirals out around it.
  const placements = useMemo<Placement[]>(() => {
    const gardens = me ? [me, ...others] : others;
    const coordinates = spiralCoordinates(gardens.length);
    return gardens.map((garden, index) => {
      const [gx, gz] = coordinates[index];
      return {
        key: `${garden.userId}:${gx}:${gz}:${garden.posts.map((post) => `${post._id}${post.mood}${post.reactionCount ?? 0}`).join("")}`,
        slot: `${garden.userId}:${gx}:${gz}`,
        garden,
        gx,
        gz,
        center: pieceCenter(gx, gz),
        isMine: garden.userId === me?.userId,
      };
    });
  }, [me, others]);

  // --- Your garden ---
  const mine = placements.find((placement) => placement.isMine) ?? null;
  const myPosts = useMemo(() => sortByTime(me?.posts ?? []), [me]);
  const myLayout = useMemo(() => (me ? createPieceLayout(me.userId, 0, 0, myPosts.length) : null), [me, myPosts.length]);
  const myPlants = usePlantModels(myPosts);
  useEffect(() => () => {
    myLayout?.island.dispose();
    myLayout?.water?.dispose();
    myLayout?.decor?.dispose();
  }, [myLayout]);

  // --- The garden you're visiting ---
  const visitPosts = useMemo(() => sortByTime(visit?.placement.garden.posts ?? []), [visit?.placement]);
  const visitLayout = useMemo(
    () => (visit ? createPieceLayout(visit.placement.garden.userId, visit.placement.gx, visit.placement.gz, visitPosts.length) : null),
    [visit?.placement, visitPosts.length]
  );
  const visitPlants = usePlantModels(visitPosts);
  useEffect(() => () => {
    visitLayout?.island.dispose();
    visitLayout?.water?.dispose();
    visitLayout?.decor?.dispose();
  }, [visitLayout]);

  // --- Planting: a journal that appears while you're here gets its moment ---
  const knownPosts = useRef<Set<string> | null>(null);
  useEffect(() => {
    const ids = new Set(myPosts.map((post) => post._id));
    const previous = knownPosts.current;
    knownPosts.current = ids;
    if (!previous) return;
    const added = myPosts.find((post) => !previous.has(post._id));
    if (!added) return;
    setReplay(null);
    setFocusPostId(null);
    setSelected(null);
    setVisit(null);
    setMode("garden");
    if (!still) setPlanting({ postId: added._id, key: Date.now() });
    // Felt as the seed lands.
    window.setTimeout(() => buzz(20), PLANTING.seedFall * 1000);
  }, [myPosts, still]);
  useEffect(() => {
    if (!planting) return;
    const timer = window.setTimeout(() => setPlanting(null), PLANTING.hold * 1000);
    return () => window.clearTimeout(timer);
  }, [planting]);
  const plantingIndex = planting ? myPosts.findIndex((post) => post._id === planting.postId) : -1;
  const plantingPlot = plantingIndex >= 0 ? myLayout?.plots[plantingIndex] : undefined;

  // --- Replay: rebuild the month day by day ---
  const lastDay = myPosts.length ? Math.max(...myPosts.map(dayOfMonth)) : 1;
  useEffect(() => {
    if (!replay?.playing) return;
    if (replay.day >= lastDay) {
      setReplay({ day: lastDay, playing: false });
      return;
    }
    const timer = window.setTimeout(() => setReplay({ day: replay.day + 1, playing: true }), still ? 0 : REPLAY_STEP_MS);
    return () => window.clearTimeout(timer);
  }, [replay, lastDay, still]);

  // --- Journals you can read: yours in garden mode, theirs while visiting ---
  const readable =
    mode === "garden" && me && myLayout
      ? { posts: myPosts, layout: myLayout, models: myPlants, owner: undefined }
      : mode === "visit" && visit && !visit.leaving && visitLayout
        ? { posts: visitPosts, layout: visitLayout, models: visitPlants, owner: visit.placement.garden.name }
        : null;
  const readingIndex = focusPostId && readable ? readable.posts.findIndex((post) => post._id === focusPostId) : -1;
  const reading = readingIndex >= 0 && readable ? { post: readable.posts[readingIndex], plot: readable.layout.plots[readingIndex] } : null;
  // Drop the reading if its journal goes away (mode change, replay, data update).
  useEffect(() => {
    if (focusPostId && readingIndex < 0) setFocusPostId(null);
  }, [focusPostId, readingIndex]);

  // --- Camera framing ---
  const home = mine?.center ?? placements[0]?.center ?? new THREE.Vector3();
  const soloWidth = myLayout ? pieceFrameWidth(myLayout, home, aspect) : PIECE_SIZE * 1.8 * Math.max(1, 1 / aspect);
  const visitWidth = visitLayout && visit ? pieceFrameWidth(visitLayout, visit.placement.center, aspect) : soloWidth;
  const maxWorldWidth = coarsePointer ? MAX_WORLD_WIDTH.coarse : MAX_WORLD_WIDTH.fine;
  const worldWidth = Math.min(soloWidth * worldZoom, maxWorldWidth);
  const baseWidth =
    mode === "garden" ? soloWidth * (plantingPlot ? PLANTING.zoom : gardenZoom) : mode === "visit" ? visitWidth * gardenZoom : worldWidth;
  const goalWidth = reading?.plot ? (mode === "visit" ? visitWidth : soloWidth) * READING.zoom : baseWidth;
  const isWide = (size?.width ?? 1024) >= 640;

  const goal = useRef<WorldView>({ x: home.x, z: home.z, angle: 0, width: goalWidth });
  const current = useRef<WorldView>({ ...goal.current });
  const initialised = useRef(false);

  // Keep the goal in sync with the frame size, the mode, the zoom, planting and reading.
  const focusX = reading?.plot
    ? reading.plot.x
    : mode === "garden" ? (plantingPlot?.x ?? home.x) : mode === "visit" && visit ? visit.placement.center.x : null;
  const focusZ = reading?.plot
    ? reading.plot.z
    : mode === "garden" ? (plantingPlot?.z ?? home.z) : mode === "visit" && visit ? visit.placement.center.z : null;
  const isReading = Boolean(reading?.plot);
  useEffect(() => {
    if (!size) return;
    // Slide the plant aside so the journal panel doesn't cover it.
    screenOffset.current = isReading ? (isWide ? READING.offsetWide : READING.offsetNarrow) : { x: 0, y: 0 };
    goal.current.width = goalWidth;
    if (focusX !== null && focusZ !== null) {
      goal.current.x = focusX;
      goal.current.z = focusZ;
    }
    if (!initialised.current) {
      initialised.current = true;
      Object.assign(current.current, goal.current);
      setSettledView({ ...goal.current });
    }
    invalidate.current?.();
  }, [size, goalWidth, focusX, focusZ, isReading, isWide]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width && height) setSize({ width, height });
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  const camera = useMemo(() => Object.assign(new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 200), { manual: true }), []);

  // Render distance: only pieces whose centre is within reach of the focus.
  // Your own garden view shows just your piece; the world appears when you explore.
  const visible = useMemo(() => {
    if (mode === "garden" && mine) return [mine];
    const centerX = focus.gx * PIECE_SIZE;
    const centerZ = focus.gz * PIECE_SIZE;
    const limit = focus.reach + PIECE_SIZE * 1.5;
    return placements.filter((placement) => Math.hypot(placement.center.x - centerX, placement.center.z - centerZ) <= limit);
  }, [placements, focus, mode, mine]);
  useEffect(() => {
    cache.retain(new Set(visible.filter((placement) => !placement.isMine).map((placement) => placement.key)));
  }, [cache, visible]);

  // --- Actions ---
  const zoomWorld = (factor: number) =>
    setWorldZoom((zoom) => Math.min(Math.max(zoom * factor, WORLD_ZOOM.min), maxWorldWidth / soloWidth));
  // Zoom whatever you're looking at: the world, or the garden you're in (not while reading).
  const zoomBy = (factor: number) => {
    if (mode === "world") zoomWorld(factor);
    else if (!focusPostId) setGardenZoom((zoom) => Math.min(Math.max(zoom * factor, GARDEN_ZOOM.min), GARDEN_ZOOM.max));
  };

  const turnBy = (delta: number) => {
    goal.current.angle += delta;
    invalidate.current?.();
  };

  const goTo = (next: Mode) => {
    setGardenZoom(1);
    setSelected(null);
    setReplay(null);
    setFocusPostId(null);
    if (next !== "visit" && visit && !visit.leaving) setVisit({ ...visit, leaving: true });
    setMode(next);
  };

  const startVisit = (placement: Placement) => {
    if (placement.isMine) return goTo("garden");
    setSelected(null);
    setGardenZoom(1);
    visitGray.current = GRAY;
    setVisit({ placement, leaving: false });
    setMode("visit");
  };

  const leave = () => {
    if (mode === "visit") goTo("world");
    else if (mode === "world" && me) goTo("garden");
  };

  // A tap near a neighbour's flower waters it; anywhere else selects the garden.
  // Two quick taps on the same garden visit it (phones don't reliably send dblclick).
  const lastTap = useRef<{ slot: string; at: number } | null>(null);
  const handlePieceTap = (placement: Placement, layout: GardenLayout, point: THREE.Vector3) => {
    const previous = lastTap.current;
    lastTap.current = { slot: placement.slot, at: performance.now() };
    if (previous?.slot === placement.slot && performance.now() - previous.at < DOUBLE_TAP_MS) {
      lastTap.current = null;
      startVisit(placement);
      return;
    }
    const posts = sortByTime(placement.garden.posts);
    let nearest = -1;
    let nearestDistance = coarsePointer ? WATER_TAP_RADIUS.coarse : WATER_TAP_RADIUS.fine;
    layout.plots.forEach((plot, index) => {
      if (index >= posts.length) return;
      const distance = Math.hypot(plot.x - point.x, plot.z - point.z);
      if (distance < nearestDistance) {
        nearest = index;
        nearestDistance = distance;
      }
    });
    if (nearest < 0) {
      setSelected(placement);
      return;
    }
    const post = posts[nearest];
    const plot = layout.plots[nearest];
    void onWater(post._id).then((result) => {
      if (result === "signedOut") toast("Log in to water other people's flowers.");
      else if (result === "already") toast(`You've already watered this flower in ${placement.garden.name}'s garden.`);
      else if (result === "unavailable") toast("This flower can't be watered.");
      else {
        buzz([10, 40, 18]);
        const model = createPlant(post._id, { mood: post.mood, waterings: (post.reactionCount ?? 0) + 1, detail: 0.35 });
        setWaterEffects((effects) => [...effects, { id: Date.now() + Math.random(), post, plot: new THREE.Vector3(plot.x, plot.y, plot.z), model }]);
        invalidate.current?.();
      }
    }).catch(() => toast.error("Couldn't water that flower. Try again?"));
  };

  const finishWaterEffect = (id: number) =>
    setWaterEffects((effects) => {
      const finished = effects.find((effect) => effect.id === id);
      finished?.model.geometry.dispose();
      return effects.filter((effect) => effect.id !== id);
    });

  // --- Pointer: drag turns (your garden) or pans (world), pinch zooms, and plants lean away ---
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);
  const drag = useRef<{ pointerId: number; x: number; y: number; view: WorldView; isDragging: boolean } | null>(null);
  const suppressClick = useRef(false);

  const updatePlantPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    raycaster.setFromCamera(
      new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1),
      camera
    );
    if (raycaster.ray.intersectPlane(groundPlane, plantPointer.value)) pointerTarget.current = 1;
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    suppressClick.current = false;
    if (event.button !== 0 || (event.target as HTMLElement).closest("[data-world-control]")) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom: 1 };
      drag.current = null;
      setIsDragging(false);
      return;
    }
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, view: { ...goal.current }, isDragging: false };
  };
  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    updatePlantPointer(event);
    if (pointers.current.has(event.pointerId)) pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      // Apply the change since the last move, so pinching composes smoothly.
      zoomBy(pinch.current.distance / Math.max(distance, 1));
      pinch.current.distance = distance;
      suppressClick.current = true;
      return;
    }
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const dx = event.clientX - active.x;
    const dy = event.clientY - active.y;
    if (!active.isDragging) {
      if (Math.hypot(dx, mode === "world" ? dy : 0) < DRAG_THRESHOLD) return;
      active.isDragging = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      setIsDragging(true);
    }
    const width = event.currentTarget.clientWidth;
    if (mode === "world") Object.assign(goal.current, panByScreen(active.view, dx, dy, width));
    else goal.current.angle = active.view.angle + (dx / width) * DRAG_TURN;
    invalidate.current?.();
  };
  const endPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (event.pointerType !== "mouse") pointerTarget.current = 0;
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    if (active.isDragging) suppressClick.current = true;
    drag.current = null;
    setIsDragging(false);
  };

  // Wheel zooms (needs a non-passive listener to keep the page from scrolling).
  const zoomByRef = useRef(zoomBy);
  zoomByRef.current = zoomBy;
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      zoomByRef.current(Math.exp(event.deltaY * 0.0012));
    };
    frame.addEventListener("wheel", handleWheel, { passive: false });
    return () => frame.removeEventListener("wheel", handleWheel);
  }, []);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    // While reading, the arrows move between journals and Escape closes the panel.
    if (reading && readable && ["ArrowLeft", "ArrowRight", "Escape"].includes(event.key)) {
      event.preventDefault();
      if (event.key === "Escape") return setFocusPostId(null);
      const next = readingIndex + (event.key === "ArrowRight" ? 1 : -1);
      if (next >= 0 && next < readable.posts.length) setFocusPostId(readable.posts[next]._id);
      return;
    }
    if (event.target !== event.currentTarget) return;
    const step = (size?.width ?? 800) * 0.18;
    const pan = (dx: number, dy: number) => {
      Object.assign(goal.current, panByScreen(goal.current, dx, dy, size?.width ?? 800));
      invalidate.current?.();
    };
    const handled = (() => {
      switch (event.key) {
        case "ArrowLeft":
          return mode === "world" ? pan(step, 0) : turnBy(-BUTTON_TURN / 2);
        case "ArrowRight":
          return mode === "world" ? pan(-step, 0) : turnBy(BUTTON_TURN / 2);
        case "ArrowUp":
          return mode === "world" ? pan(0, step) : false;
        case "ArrowDown":
          return mode === "world" ? pan(0, -step) : false;
        case "q":
        case "Q":
          return turnBy(-BUTTON_TURN);
        case "e":
        case "E":
          return turnBy(BUTTON_TURN);
        case "+":
        case "=":
          return zoomBy(1 / WORLD_ZOOM.step);
        case "-":
        case "_":
          return zoomBy(WORLD_ZOOM.step);
        case "Escape":
          return mode === "garden" ? false : leave();
        default:
          return false;
      }
    })();
    if (handled !== false) event.preventDefault();
  };

  const interactive = readable;
  const showHitAreas = Boolean(interactive && !isMoving && !isDragging && !planting && settledView && size);
  if (showHitAreas && settledView) applyWorldView(camera, settledView, aspect);
  // Half a tile along the screen's horizontal, for sizing hit areas at any rotation.
  const screenRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion).setY(0).normalize().multiplyScalar(0.5);

  const newestPostId = myPosts.at(-1)?._id;
  const isShown = (post: IslandPost) => !replay || dayOfMonth(post) <= replay.day;
  const shownCount = replay ? myPosts.filter(isShown).length : myPosts.length;
  const monthLabel = new Date(now).toLocaleString(undefined, { month: "long" });
  const visitedName = visit?.placement.garden.name;

  return (
    <div
      ref={frameRef}
      tabIndex={0}
      role="application"
      aria-label={
        mode === "world"
          ? "Garden world. Arrow keys pan, Q and E rotate, plus and minus zoom, Escape returns to your garden."
          : "Your garden. Left and right arrows or Q and E rotate."
      }
      className={`relative -mx-4 -mb-32 h-[calc(100svh-4.85rem)] w-[calc(100%+2rem)] touch-none overflow-hidden select-none outline-none focus-visible:ring-2 focus-visible:ring-ring sm:mx-0 sm:mb-0 sm:h-[clamp(26rem,calc(100svh-9rem),56rem)] sm:w-full sm:rounded-3xl ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onPointerLeave={() => {
        pointerTarget.current = 0;
      }}
      onKeyDown={handleKeyDown}
      onClickCapture={(event) => {
        if (!suppressClick.current) return;
        suppressClick.current = false;
        event.preventDefault();
        event.stopPropagation();
      }}
      onClick={(event) => {
        // Fingers are imprecise: a tap that lands near a plant, but not on its
        // button, opens the closest one (measured to its stem, base to top).
        if (!showHitAreas || !interactive || (event.target as HTMLElement).closest("button, [data-world-control]")) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const tapX = event.clientX - rect.left;
        const tapY = event.clientY - rect.top;
        let nearest: string | null = null;
        let nearestDistance = TAP_SLOP_PX;
        interactive.posts.forEach((post, index) => {
          const plot = interactive.layout.plots[index];
          if (!plot || (mode === "garden" && !isShown(post))) return;
          const height = interactive.models[index].height * getPlantGrowth(post._creationTime, now);
          const base = projectPoint(camera, plot.x, plot.y, plot.z);
          const top = projectPoint(camera, plot.x, plot.y + height, plot.z);
          const [bx, by] = [(base.left / 100) * rect.width, (base.top / 100) * rect.height];
          const [tx, ty] = [(top.left / 100) * rect.width, (top.top / 100) * rect.height];
          const along = Math.max(0, Math.min(1, ((tapX - bx) * (tx - bx) + (tapY - by) * (ty - by)) / Math.max(1, (tx - bx) ** 2 + (ty - by) ** 2)));
          const distance = Math.hypot(tapX - (bx + (tx - bx) * along), tapY - (by + (ty - by) * along));
          if (distance < nearestDistance) {
            nearest = post._id;
            nearestDistance = distance;
          }
        });
        if (nearest) {
          playGardenSound("click");
          setFocusPostId(nearest);
        } else if (focusPostId) {
          // Tapping open ground closes the journal.
          setFocusPostId(null);
        }
      }}
    >
      {size ? (
        <Canvas
          camera={camera}
          shadows
          flat
          dpr={coarsePointer ? [1, mode === "world" ? 1 : 1.5] : [1, mode === "world" ? 1.25 : 2]}
          frameloop={still ? "demand" : "always"}
          gl={{ alpha: true, antialias: true }}
          className={`absolute! inset-0 ${mode === "world" ? "" : "pointer-events-none"}`}
          onPointerMissed={() => setSelected(null)}
          fallback={<p className="grid size-full place-items-center text-sm text-muted-foreground">Your browser can't draw the 3D garden.</p>}
        >
          <InvalidateBridge invalidate={invalidate} />
          <ViewController
            camera={camera}
            goal={goal}
            current={current}
            aspect={aspect}
            still={still}
            cache={cache}
            pointerTarget={pointerTarget}
            screenOffset={screenOffset}
            size={size}
            onMovingChange={(moving, view) => {
              setIsMoving(moving);
              if (!moving) setSettledView(view);
            }}
            onFocusChange={setFocus}
          />
          <WorldLights current={current} aspect={aspect} mapSize={coarsePointer ? SHADOW_MAP_SIZE.coarse : SHADOW_MAP_SIZE.fine} />
          <ReadingDim dim={readingDim} reading={isReading} still={still} />

          {visible.map((placement) =>
            placement.isMine || visit?.placement.slot === placement.slot ? null : (
              <OtherPiece
                key={placement.slot}
                placement={placement}
                cache={cache}
                gray={Boolean(me)}
                now={now}
                onTap={handlePieceTap}
                onVisit={startVisit}
              />
            )
          )}

          {visit && visitLayout ? (
            <VisitedPiece
              key={visit.placement.slot}
              layout={visitLayout}
              posts={visitPosts}
              models={visitPlants}
              gray={visitGray}
              leaving={visit.leaving}
              now={now}
              still={still}
              activePostId={activePostId}
              focusPostId={focusPostId}
              dim={readingDim}
              onGone={() => setVisit((current) => (current?.leaving ? null : current))}
            />
          ) : null}

          {mine && myLayout && visible.includes(mine) ? (
            <group
              onClick={(event) => {
                if (mode !== "world" || event.delta > DRAG_THRESHOLD) return;
                event.stopPropagation();
                goTo("garden");
              }}
            >
              <mesh geometry={myLayout.island} material={worldMaterials.ground} receiveShadow />
              {myLayout.decor ? <mesh geometry={myLayout.decor} material={worldMaterials.ground} castShadow receiveShadow /> : null}
              {myLayout.water ? <mesh geometry={myLayout.water} material={worldMaterials.water} /> : null}
              {myPlants.map((model, index) => {
                const post = myPosts[index];
                const plot = myLayout.plots[index];
                if (!plot) return null;
                const isPlanting = post._id === planting?.postId;
                return (
                  <GardenPlant
                    key={post._id}
                    model={model}
                    plot={plot}
                    growth={getPlantGrowth(post._creationTime, now)}
                    delay={isPlanting ? PLANTING.growDelay : index * Math.min(0.08, 1.6 / Math.max(1, myPosts.length))}
                    isActive={activePostId === post._id || focusPostId === post._id}
                    isHighlighted={
                      mode === "garden" && !replay && (focusPostId ? focusPostId === post._id : activePostId === post._id || post._id === newestPostId)
                    }
                    animate={!still}
                    shown={isShown(post)}
                    gray={focusPostId && focusPostId !== post._id ? readingDim : undefined}
                  />
                );
              })}
              {planting && plantingPlot ? (
                <SeedDrop key={planting.key} position={new THREE.Vector3(plantingPlot.x, plantingPlot.y, plantingPlot.z)} />
              ) : null}
            </group>
          ) : null}

          {waterEffects.map((effect) => (
            <WaterSplash key={effect.id} effect={effect} now={now} still={still} onDone={finishWaterEffect} />
          ))}
        </Canvas>
      ) : null}

      {showHitAreas && interactive
        ? interactive.posts.map((post, index) => {
            const plot = interactive.layout.plots[index];
            if (!plot || (mode === "garden" && !isShown(post))) return null;
            const height = interactive.models[index].height * getPlantGrowth(post._creationTime, now);
            const base = projectPoint(camera, plot.x, plot.y, plot.z);
            const top = projectPoint(camera, plot.x, plot.y + height, plot.z);
            const left = projectPoint(camera, plot.x - screenRight.x, plot.y, plot.z - screenRight.z);
            const right = projectPoint(camera, plot.x + screenRight.x, plot.y, plot.z + screenRight.z);
            const showPreview = activePostId === post._id && focusPostId !== post._id;
            const isPrivate = post.visibility === "private";
            return (
              <div key={post._id}>
                <button
                  type="button"
                  aria-label={isPrivate ? "Open private journal" : getJournalAriaLabel(mode === "garden" && post._id === newestPostId, post.mood)}
                  aria-pressed={focusPostId === post._id}
                  className="absolute -translate-x-1/2 cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onPointerEnter={() => setActivePostId(post._id)}
                  onPointerLeave={() => setActivePostId((active) => (active === post._id ? null : active))}
                  onFocus={() => setActivePostId(post._id)}
                  onBlur={() => setActivePostId((active) => (active === post._id ? null : active))}
                  onClick={() => {
                    playGardenSound("click");
                    setFocusPostId((current) => (current === post._id ? null : post._id));
                  }}
                  style={{
                    left: `${base.left}%`,
                    top: `${top.top}%`,
                    width: `${Math.abs(right.left - left.left) * 0.75}%`,
                    height: `${Math.max(base.top - top.top, 4)}%`,
                    // Plants nearer the camera sit on top so overlapping hit areas match what you see.
                    zIndex: Math.round((1 - base.depth) * 500) + 10,
                  }}
                />
                {showPreview ? (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute z-[1500] w-max max-w-56 -translate-x-1/2 -translate-y-full rounded-xl border border-border/60 bg-card/95 px-3 py-2 text-xs shadow-lg backdrop-blur-sm motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95"
                    style={{ left: `${base.left}%`, top: `calc(${top.top}% - 0.5rem)` }}
                  >
                    <p className="font-semibold text-primary">{moodLabels[post.mood]}</p>
                    <p className="mt-0.5 text-muted-foreground">{previewLine(post)}</p>
                  </div>
                ) : null}
              </div>
            );
          })
        : null}

      <div className="pointer-events-none absolute inset-x-0 top-0 z-[2000] flex items-start justify-between gap-4 p-4 sm:p-6">
        <div>
          <p className="board-eyebrow text-xs font-bold uppercase tracking-[0.16em] text-primary">
            {mode === "garden" ? `Your garden · ${monthLabel}` : mode === "visit" ? `Visiting · ${monthLabel}` : "The garden world"}
          </p>
          <p className="mt-1 font-display text-2xl tracking-[-0.02em] sm:text-3xl">
            {mode === "garden"
              ? `${shownCount} ${shownCount === 1 ? "flower" : "flowers"}`
              : mode === "visit"
                ? `${visitedName}'s garden`
                : `${placements.length} ${placements.length === 1 ? "garden" : "gardens"} this month`}
          </p>
          {mode === "garden" && myPosts.length === 0 ? (
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">Write today's journal to plant your first flower.</p>
          ) : null}
          {mode === "world" ? (
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">Tap a flower to water it · double-click a garden to visit</p>
          ) : null}
          {mode === "visit" ? (
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">Open a flower to read their journal and water it.</p>
          ) : null}
        </div>
      </div>

      {reading && readable ? (
        <JournalPanel
          post={reading.post}
          index={readingIndex}
          total={readable.posts.length}
          owner={readable.owner}
          canWater={!demo && Boolean(readable.owner)}
          onPrevious={() => setFocusPostId(readable.posts[Math.max(0, readingIndex - 1)]._id)}
          onNext={() => setFocusPostId(readable.posts[Math.min(readable.posts.length - 1, readingIndex + 1)]._id)}
          onClose={() => {
            setFocusPostId(null);
            frameRef.current?.focus();
          }}
        />
      ) : null}

      {selected && mode === "world" ? (
        <div data-world-control className="absolute inset-x-3 bottom-[calc(10.5rem+env(safe-area-inset-bottom))] z-[2000] rounded-2xl border border-border/70 bg-card/95 p-4 shadow-lg backdrop-blur-sm sm:inset-x-auto sm:bottom-6 sm:left-4 sm:w-64">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-display text-lg leading-tight">{selected.garden.name}'s garden</p>
              <p className="text-xs text-muted-foreground">
                {selected.garden.posts.length} {selected.garden.posts.length === 1 ? "flower" : "flowers"} this month
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              aria-label="Close"
              className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={() => startVisit(selected)}
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-primary px-3 text-sm font-medium text-primary-foreground"
            >
              <MapIcon className="size-3.5" aria-hidden="true" /> Visit
            </button>
            <Link href={`/profile/plants/${selected.garden.userId}`} className="text-sm font-medium text-primary hover:underline">
              Full garden →
            </Link>
          </div>
        </div>
      ) : null}

      <div
        data-world-control
        className={`pointer-events-none absolute inset-x-0 bottom-0 z-[2000] flex-col items-center gap-2 px-3 pt-4 pb-[calc(6.25rem+env(safe-area-inset-bottom))] sm:p-6 ${isReading ? "hidden sm:flex sm:pr-[24rem]" : "flex"}`}
      >
        {replay && mode === "garden" ? (
          <div className="pointer-events-auto flex w-[min(28rem,100%)] items-center gap-3 rounded-full bg-background/80 py-1.5 pr-4 pl-1.5 shadow-sm backdrop-blur-sm">
            <ControlButton
              label={replay.playing ? "Pause replay" : "Play replay"}
              onClick={() => setReplay((state) => state && { day: state.playing || state.day < lastDay ? state.day : 0, playing: !state.playing })}
            >
              {replay.playing ? <Pause className="size-4" aria-hidden="true" /> : <Play className="size-4" aria-hidden="true" />}
            </ControlButton>
            <Slider
              aria-label="Day of the month"
              value={[replay.day]}
              min={0}
              max={lastDay}
              step={1}
              onValueChange={(value) => setReplay({ day: Array.isArray(value) ? value[0] : value, playing: false })}
            />
            <span className="w-16 shrink-0 text-right text-xs font-medium tabular-nums text-muted-foreground">
              {replay.day === 0 ? "Start" : `${monthLabel.slice(0, 3)} ${replay.day}`}
            </span>
            <ControlButton label="Close replay" onClick={() => setReplay(null)}>
              <X className="size-4" aria-hidden="true" />
            </ControlButton>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-center gap-2">
          {mode === "visit" ? (
            <PrimaryButton onClick={() => goTo("world")}>
              <Globe className="size-4" aria-hidden="true" /> Back to the world
            </PrimaryButton>
          ) : me ? (
            <PrimaryButton onClick={() => goTo(mode === "garden" ? "world" : "garden")}>
              {mode === "garden" ? <Globe className="size-4" aria-hidden="true" /> : <Sprout className="size-4" aria-hidden="true" />}
              {mode === "garden" ? "Explore the world" : "Back to my garden"}
            </PrimaryButton>
          ) : null}
          <div className="pointer-events-auto flex gap-1 rounded-full bg-background/75 p-1 shadow-sm backdrop-blur-sm">
            <ControlButton label="Rotate left (Q)" onClick={() => turnBy(-BUTTON_TURN)}>
              <RotateCcw className="size-4" aria-hidden="true" />
            </ControlButton>
            <ControlButton label="Rotate right (E)" onClick={() => turnBy(BUTTON_TURN)}>
              <RotateCw className="size-4" aria-hidden="true" />
            </ControlButton>
            {mode === "garden" && myPosts.length > 0 && !replay ? (
              <ControlButton label="Replay your month" onClick={() => setReplay({ day: 0, playing: true })}>
                <History className="size-4" aria-hidden="true" />
              </ControlButton>
            ) : null}
            {mode === "world" ? (
              <>
                <ControlButton label="Zoom out (−)" disabled={worldWidth >= maxWorldWidth} onClick={() => zoomWorld(WORLD_ZOOM.step)}>
                  <Minus className="size-4" aria-hidden="true" />
                </ControlButton>
                <ControlButton label="Zoom in (+)" disabled={worldZoom <= WORLD_ZOOM.min} onClick={() => zoomWorld(1 / WORLD_ZOOM.step)}>
                  <Plus className="size-4" aria-hidden="true" />
                </ControlButton>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

const PrimaryButton = ({ onClick, children }: { onClick: () => void; children: ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    className="pointer-events-auto inline-flex h-11 cursor-pointer items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground shadow-md transition-transform active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
  >
    {children}
  </button>
);

const ControlButton = ({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    title={label}
    className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-foreground/80 hover:bg-muted sm:size-8 focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-default disabled:opacity-40"
  >
    {children}
  </button>
);
