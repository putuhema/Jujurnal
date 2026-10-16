"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Globe, Minus, Plus, RotateCcw, RotateCw, Sprout, X } from "lucide-react";
import * as THREE from "three";
import { createPlant, getPlantGrowth, type GardenLayout } from "@/lib/garden-procedural";
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
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import { worldMaterials, worldUniforms } from "@/lib/world-material";
import { GardenFlower } from "./garden-flower";
import { GardenPlant } from "./garden-three";
import type { IslandPost } from "./island-garden";

export type WorldGardenEntry = { userId: string; name: string; posts: IslandPost[] };

type Placement = {
  key: string;
  garden: WorldGardenEntry;
  gx: number;
  gz: number;
  center: THREE.Vector3;
  isMine: boolean;
};

const DRAG_THRESHOLD = 5;
const DRAG_TURN = Math.PI * 1.5;
const BUTTON_TURN = Math.PI / 4;
const WORLD_ZOOM = { initial: 2.6, min: 1.6, step: 1.35 };
// Cap how far out the world view can zoom, which bounds how many pieces are drawn.
const MAX_WORLD_WIDTH = { fine: 72, coarse: 46 };
const CACHE_LIMIT = 48;
const FRAME_BUDGET_MS = 6;

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
      if (partial) disposeBuild(partial);
      this.builds.delete(key);
    }
    for (const [key, build] of this.builds) {
      if (this.builds.size <= CACHE_LIMIT) break;
      if (visible.has(key)) continue;
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

function* buildOtherPiece(placement: Placement, now: number): PieceJob {
  const posts = [...placement.garden.posts].sort((a, b) => a._creationTime - b._creationTime);
  const layout = createPieceLayout(placement.garden.userId, placement.gx, placement.gz, posts.length);
  yield { layout };
  const plants = yield* growPiecePlants(posts, layout, now);
  yield { plants };
}

// ---------------------------------------------------------------------------
// Scene pieces

const OtherPiece = ({
  placement,
  cache,
  gray,
  now,
  onSelect,
}: {
  placement: Placement;
  cache: PieceCache;
  gray: boolean;
  now: number;
  onSelect: (garden: WorldGardenEntry) => void;
}) => {
  useEffect(() => cache.request(placement.key, () => buildOtherPiece(placement, now)), [cache, placement, now]);
  const build = useSyncExternalStore(cache.subscribe, () => cache.get(placement.key), () => undefined);
  if (!build?.layout) return null;

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    if (event.delta > DRAG_THRESHOLD) return;
    event.stopPropagation();
    onSelect(placement.garden);
  };

  return (
    <group onClick={handleClick}>
      <mesh geometry={build.layout.island} material={gray ? worldMaterials.groundGray : worldMaterials.ground} receiveShadow />
      {build.layout.decor ? <mesh geometry={build.layout.decor} material={gray ? worldMaterials.groundGray : worldMaterials.ground} castShadow receiveShadow /> : null}
      {build.layout.water ? <mesh geometry={build.layout.water} material={gray ? worldMaterials.waterGray : worldMaterials.water} /> : null}
      {/* Neighbouring plants skip the shadow pass: it would double their (largest) share of the frame. */}
      {build.plants ? <mesh geometry={build.plants} material={gray ? worldMaterials.plantsGray : worldMaterials.plants} /> : null}
    </group>
  );
};

const WorldLights = ({ current, aspect }: { current: RefObject<WorldView>; aspect: number }) => {
  const light = useRef<THREE.DirectionalLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  const shadowReach = useRef(0);

  useFrame(() => {
    const sun = light.current;
    if (!sun) return;
    const view = current.current;
    // The sun travels with the view so shadows stay sharp wherever you look.
    sun.position.set(view.x - 4, 10, view.z + 6);
    target.position.set(view.x, 0, view.z);
    target.updateMatrixWorld();
    const reach = Math.ceil(viewReach(view.width, aspect) * 1.05);
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
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
    </>
  );
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
  onMovingChange,
  onFocusChange,
}: {
  camera: THREE.OrthographicCamera;
  goal: RefObject<WorldView>;
  current: RefObject<WorldView>;
  aspect: number;
  still: boolean;
  cache: PieceCache;
  onMovingChange: (moving: boolean, view: WorldView) => void;
  onFocusChange: (focus: { gx: number; gz: number; reach: number }) => void;
}) => {
  const moving = useRef(false);
  const focusKey = useRef("");

  useFrame((state, delta) => {
    const target = goal.current;
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

const monthName = (date: Date) => date.toLocaleString(undefined, { month: "long" });

const projectPoint = (camera: THREE.Camera, x: number, y: number, z: number) => {
  const point = new THREE.Vector3(x, y, z).project(camera);
  return { left: (point.x + 1) * 50, top: (1 - point.y) * 50, depth: point.z };
};

export default function WorldGardenScene({
  me,
  others,
}: {
  me: WorldGardenEntry | null;
  others: WorldGardenEntry[];
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [mode, setMode] = useState<"garden" | "world">(me ? "garden" : "world");
  const [worldZoom, setWorldZoom] = useState(WORLD_ZOOM.initial);
  const [isMoving, setIsMoving] = useState(false);
  const [settledView, setSettledView] = useState<WorldView | null>(null);
  const [focus, setFocus] = useState({ gx: 0, gz: 0, reach: 40 });
  const [selected, setSelected] = useState<WorldGardenEntry | null>(null);
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [now] = useState(() => Date.now());
  const still = usePrefersReducedMotion();
  const cache = useMemo(() => new PieceCache(), []);
  useEffect(() => () => cache.dispose(), [cache]);
  const invalidate = useRef<(() => void) | null>(null);
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
        garden,
        gx,
        gz,
        center: pieceCenter(gx, gz),
        isMine: garden.userId === me?.userId,
      };
    });
  }, [me, others]);

  const mine = placements.find((placement) => placement.isMine) ?? null;
  const myPosts = useMemo(() => [...(me?.posts ?? [])].sort((a, b) => a._creationTime - b._creationTime), [me]);
  const myLayout = useMemo(() => (me ? createPieceLayout(me.userId, 0, 0, myPosts.length) : null), [me, myPosts.length]);
  const myPlants = useMemo(
    () => myPosts.map((post) => createPlant(post._id, { mood: post.mood, waterings: post.reactionCount })),
    [myPosts]
  );
  useEffect(() => () => {
    myLayout?.island.dispose();
    myLayout?.water?.dispose();
    myLayout?.decor?.dispose();
  }, [myLayout]);
  useEffect(() => () => {
    for (const plant of myPlants) plant.geometry.dispose();
  }, [myPlants]);

  const home = mine?.center ?? placements[0]?.center ?? new THREE.Vector3();
  const homeLayoutForFrame = myLayout;
  const soloWidth = homeLayoutForFrame ? pieceFrameWidth(homeLayoutForFrame, home, aspect) : PIECE_SIZE * 1.8 * Math.max(1, 1 / aspect);
  const maxWorldWidth = coarsePointer ? MAX_WORLD_WIDTH.coarse : MAX_WORLD_WIDTH.fine;
  const worldWidth = Math.min(soloWidth * worldZoom, maxWorldWidth);
  const goalWidth = mode === "garden" ? soloWidth : worldWidth;

  const goal = useRef<WorldView>({ x: home.x, z: home.z, angle: 0, width: goalWidth });
  const current = useRef<WorldView>({ ...goal.current });
  const initialised = useRef(false);

  // Keep the goal in sync with the frame size, the mode and the zoom level.
  useEffect(() => {
    if (!size) return;
    goal.current.width = goalWidth;
    if (mode === "garden") {
      goal.current.x = home.x;
      goal.current.z = home.z;
    }
    if (!initialised.current) {
      initialised.current = true;
      Object.assign(current.current, goal.current);
      setSettledView({ ...goal.current });
    }
    invalidate.current?.();
  }, [size, goalWidth, mode, home.x, home.z]);

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
    const focusX = focus.gx * PIECE_SIZE;
    const focusZ = focus.gz * PIECE_SIZE;
    const limit = focus.reach + PIECE_SIZE * 1.5;
    return placements.filter((placement) => Math.hypot(placement.center.x - focusX, placement.center.z - focusZ) <= limit);
  }, [placements, focus, mode, mine]);
  useEffect(() => {
    cache.retain(new Set(visible.filter((placement) => !placement.isMine).map((placement) => placement.key)));
  }, [cache, visible]);

  const turnBy = (delta: number) => {
    goal.current.angle += delta;
    invalidate.current?.();
  };

  const switchMode = (next: "garden" | "world") => {
    setSelected(null);
    setMode(next);
  };

  // Drag: in your garden it turns the island; in the world it pans.
  const drag = useRef<{ pointerId: number; x: number; y: number; view: WorldView; isDragging: boolean } | null>(null);
  const suppressClick = useRef(false);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    suppressClick.current = false;
    if (event.button !== 0 || (event.target as HTMLElement).closest("[data-world-control]")) return;
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, view: { ...goal.current }, isDragging: false };
  };
  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    if (!current.isDragging) {
      if (Math.hypot(dx, mode === "world" ? dy : 0) < DRAG_THRESHOLD) return;
      current.isDragging = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      setIsDragging(true);
    }
    const width = event.currentTarget.clientWidth;
    if (mode === "garden") {
      goal.current.angle = current.view.angle + (dx / width) * DRAG_TURN;
    } else {
      Object.assign(goal.current, panByScreen(current.view, dx, dy, width));
    }
    invalidate.current?.();
  };
  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (current.isDragging) suppressClick.current = true;
    drag.current = null;
    setIsDragging(false);
  };

  // Hit areas for your own plants, only while the camera is still in garden mode.
  const showHitAreas = mode === "garden" && !isMoving && !isDragging && Boolean(me && myLayout && settledView && size);
  if (showHitAreas && settledView) applyWorldView(camera, settledView, aspect);
  // Half a tile along the screen's horizontal, for sizing hit areas at any rotation.
  const screenRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion).setY(0).normalize().multiplyScalar(0.5);

  const newestPostId = myPosts.at(-1)?._id;
  const gardenCount = placements.length;
  const flowerCount = myPosts.length;

  return (
    <div
      ref={frameRef}
      className={`relative h-[clamp(26rem,calc(100svh-9rem),56rem)] w-full overflow-hidden select-none ${mode === "world" ? "touch-none" : "touch-pan-y"} ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onClickCapture={(event) => {
        if (!suppressClick.current) return;
        suppressClick.current = false;
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      {size ? (
        <Canvas
          camera={camera}
          shadows
          flat
          dpr={[1, mode === "world" ? 1.25 : 2]}
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
            onMovingChange={(moving, view) => {
              setIsMoving(moving);
              if (!moving) setSettledView(view);
            }}
            onFocusChange={setFocus}
          />
          <WorldLights current={current} aspect={aspect} />

          {visible.map((placement) =>
            placement.isMine ? null : (
              <OtherPiece
                key={placement.key}
                placement={placement}
                cache={cache}
                gray={Boolean(me)}
                now={now}
                onSelect={(garden) => setSelected(garden)}
              />
            )
          )}

          {mine && myLayout && visible.includes(mine) ? (
            <group
              onClick={(event) => {
                if (mode !== "world" || event.delta > DRAG_THRESHOLD) return;
                event.stopPropagation();
                switchMode("garden");
              }}
            >
              <mesh geometry={myLayout.island} material={worldMaterials.ground} receiveShadow />
              {myLayout.decor ? <mesh geometry={myLayout.decor} material={worldMaterials.ground} castShadow receiveShadow /> : null}
              {myLayout.water ? <mesh geometry={myLayout.water} material={worldMaterials.water} /> : null}
              {myPlants.map((model, index) => {
                const post = myPosts[index];
                const plot = myLayout.plots[index];
                if (!plot) return null;
                return (
                  <GardenPlant
                    key={post._id}
                    model={model}
                    plot={plot}
                    growth={getPlantGrowth(post._creationTime, now)}
                    delay={index * Math.min(0.08, 1.6 / Math.max(1, myPosts.length))}
                    isActive={activePostId === post._id}
                    isHighlighted={mode === "garden" && (activePostId === post._id || post._id === newestPostId)}
                    animate={!still}
                  />
                );
              })}
            </group>
          ) : null}
        </Canvas>
      ) : null}

      {showHitAreas && myLayout
        ? myPosts.map((post, index) => {
            const plot = myLayout.plots[index];
            if (!plot) return null;
            const height = myPlants[index].height * getPlantGrowth(post._creationTime, now);
            const base = projectPoint(camera, plot.x, plot.y, plot.z);
            const top = projectPoint(camera, plot.x, plot.y + height, plot.z);
            const left = projectPoint(camera, plot.x - screenRight.x, plot.y, plot.z - screenRight.z);
            const right = projectPoint(camera, plot.x + screenRight.x, plot.y, plot.z + screenRight.z);
            return (
              <GardenFlower
                key={post._id}
                mood={post.mood}
                text={post.body}
                postId={post._id}
                visibility={post.visibility ?? "public"}
                createdAt={new Date(post._creationTime)}
                isNewest={post._id === newestPostId}
                onActiveChange={(isActive) => setActivePostId((active) => (isActive ? post._id : active === post._id ? null : active))}
                style={{
                  left: `${base.left}%`,
                  top: `${top.top}%`,
                  width: `${Math.abs(right.left - left.left) * 0.75}%`,
                  height: `${Math.max(base.top - top.top, 4)}%`,
                  // Plants nearer the camera sit on top so overlapping hit areas match what you see.
                  zIndex: Math.round((1 - base.depth) * 500) + 10,
                }}
              />
            );
          })
        : null}

      <div className="pointer-events-none absolute inset-x-0 top-0 z-[2000] flex items-start justify-between gap-4 p-4 sm:p-6">
        <div>
          <p className="board-eyebrow text-xs font-bold uppercase tracking-[0.16em] text-primary">
            {mode === "garden" ? `Your garden · ${monthName(new Date(now))}` : "The garden world"}
          </p>
          <p className="mt-1 font-display text-2xl tracking-[-0.02em] sm:text-3xl">
            {mode === "garden"
              ? `${flowerCount} ${flowerCount === 1 ? "flower" : "flowers"}`
              : `${gardenCount} ${gardenCount === 1 ? "garden" : "gardens"} this month`}
          </p>
          {mode === "garden" && flowerCount === 0 ? (
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">Write today's journal to plant your first flower.</p>
          ) : null}
        </div>
      </div>

      {selected && mode === "world" ? (
        <div data-world-control className="absolute bottom-20 left-4 z-[2000] w-64 rounded-2xl border border-border/70 bg-card/90 p-4 shadow-lg backdrop-blur-sm sm:bottom-6">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-display text-lg leading-tight">{selected.name}'s garden</p>
              <p className="text-xs text-muted-foreground">
                {selected.posts.length} {selected.posts.length === 1 ? "flower" : "flowers"} this month
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
          <Link href={`/profile/plants/${selected.userId}`} className="mt-3 inline-flex text-sm font-medium text-primary hover:underline">
            Visit garden →
          </Link>
        </div>
      ) : null}

      <div data-world-control className="pointer-events-none absolute inset-x-0 bottom-0 z-[2000] flex flex-wrap items-center justify-center gap-2 p-4 sm:p-6">
        {me ? (
          <button
            type="button"
            onClick={() => switchMode(mode === "garden" ? "world" : "garden")}
            className="pointer-events-auto inline-flex h-10 cursor-pointer items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground shadow-md transition-transform active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {mode === "garden" ? <Globe className="size-4" aria-hidden="true" /> : <Sprout className="size-4" aria-hidden="true" />}
            {mode === "garden" ? "Explore the world" : "Back to my garden"}
          </button>
        ) : null}
        <div className="pointer-events-auto flex gap-1 rounded-full bg-background/75 p-1 shadow-sm backdrop-blur-sm">
          <ControlButton label="Rotate left" onClick={() => turnBy(-BUTTON_TURN)}>
            <RotateCcw className="size-4" aria-hidden="true" />
          </ControlButton>
          <ControlButton label="Rotate right" onClick={() => turnBy(BUTTON_TURN)}>
            <RotateCw className="size-4" aria-hidden="true" />
          </ControlButton>
          {mode === "world" ? (
            <>
              <ControlButton
                label="Zoom out"
                disabled={worldWidth >= maxWorldWidth}
                onClick={() => setWorldZoom((zoom) => Math.min(zoom * WORLD_ZOOM.step, maxWorldWidth / soloWidth))}
              >
                <Minus className="size-4" aria-hidden="true" />
              </ControlButton>
              <ControlButton
                label="Zoom in"
                disabled={worldZoom <= WORLD_ZOOM.min}
                onClick={() => setWorldZoom((zoom) => Math.max(zoom / WORLD_ZOOM.step, WORLD_ZOOM.min))}
              >
                <Plus className="size-4" aria-hidden="true" />
              </ControlButton>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

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
    className="flex size-8 cursor-pointer items-center justify-center rounded-full text-foreground/80 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-default disabled:opacity-40"
  >
    {children}
  </button>
);
