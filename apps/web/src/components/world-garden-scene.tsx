"use client";

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
import { ArrowLeft, Gift as GiftIcon, History, HouseHeart, HousePlus, Sparkles, Inbox, Map as MapIcon, Pause, Play, Shovel, Sprout, Share2, Volume2, VolumeX, X } from "lucide-react";
import { toast } from "sonner";
import * as THREE from "three";
import { getCalendarDate } from "@/lib/calendar-date";
import { cn, glassSurface } from "@/lib/utils";
import { createPlant, createRandom, getGrowthStage, getPlantGrowth, totalWaterings, type GrowthStage, type GardenLayout, type MoodGrade, type PlantModel } from "@/lib/garden-procedural";
import { arrangePlots, cellAt, emptyArrangement, freeCells, type Arrangement } from "@/lib/garden-arrangement";
import { getAtmosphereLook, getDayPart, getSeason, getWeather, describeAtmosphere, type Atmosphere, type DayPart, type Season, type Weather } from "@/lib/garden-atmosphere";
import { makePostcard, sharePostcard } from "@/lib/garden-postcard";
import { startAmbience, stopAmbience, updateAmbience } from "@/lib/garden-sounds";
import { weedCount, type GiftKind } from "@puma-brain/backend/convex/gardenItems";
import { format } from "date-fns";
import { DropIcon } from "@phosphor-icons/react";
import { PULL_SECONDS, Weed } from "./garden-care";
import { Bee, Cat, Decoration, FreeCellMarkers, Frog, Gift } from "./garden-objects";
import { Fireflies, WeatherEffects, useAtmosphereLights } from "./garden-weather";
import { GardenEditor, type EditorHeld } from "./garden-editor";
import { BloomBurst, NewBeam } from "./garden-highlights";
import { WATERING_HIT, WATERING_SECONDS, WateringCan } from "./garden-watering";
import { moodLabels } from "./garden-flower";
import { GiftComposer, GiftInbox, type GiftView } from "./garden-gifts";
import { ModeSwitch, MoreMenu, PillButton } from "./garden-controls";
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
import { getJournalAriaLabel } from "./garden-flower";
import { JournalPanel } from "./journal-panel";
import { playGardenSound } from "@/lib/garden-sounds";
import { GardenPlant } from "./garden-three";
import type { IslandPost } from "./island-garden";
import { Slider } from "./ui/slider";

// The world only carries what it draws; a journal's words arrive when it's opened.
export type WorldPost = Omit<IslandPost, "body"> & { body?: string };
export type WorldGardenEntry = { userId: string; name: string; posts: WorldPost[]; arrangement?: Arrangement };

// Your own garden's extras: how it's arranged, what's unlocked, your recent
// moods (the weather) and gifts left by visitors. Omitted in demos.
export type MyGarden = {
  arrangement: Arrangement;
  longestStreak: number;
  recentMoods: MoodGrade[];
  gifts: GiftView[];
  onSaveArrangement: (arrangement: Arrangement) => void;
  // Gardens you've already left a gift in today (one a day each).
  giftedToday: string[];
  onSendGift: (toUserId: string, kind: GiftKind, note: string) => Promise<"sent" | "already" | "unavailable" | "signedOut">;
  onMarkGiftsRead: () => void;
  onRemoveGift: (id: string) => void;
  // Water one of your own plants (once a day each); it helps it grow.
  onWaterOwn: (postId: string) => Promise<"watered" | "already" | "unavailable" | "signedOut">;
  // Gardens you keep close: they sit next to yours and their new journals come first.
  neighbours: string[];
  onToggleNeighbour: (userId: string) => Promise<"added" | "removed" | "full" | "unavailable" | "signedOut">;
  // Weeds grow back from `since`; `pulled` are the ones pulled already.
  weeds: { since: number; pulled: number[] };
  onPullWeed: (index: number) => Promise<{ status: "pulled" | "gone" | "signedOut"; cleared?: boolean }>;
};
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
// Phones are narrow, so a whole island fitted edge to edge looks small: frame
// it tighter and let the island's rim run off the sides.
const NARROW_GARDEN_FRAME = 0.5;
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

const sortByTime = (posts: WorldPost[]) => [...posts].sort((a, b) => a._creationTime - b._creationTime);

function* buildOtherPiece(placement: Placement, now: number): PieceJob {
  const posts = sortByTime(placement.garden.posts);
  const created = createPieceLayout(placement.garden.userId, placement.gx, placement.gz, posts.length);
  const layout = { ...created, plots: arrangePlots(created, posts.map((post) => post._id), placement.garden.arrangement, placement.center) };
  yield { layout };
  const plants = yield* growPiecePlants(posts, layout, now);
  yield { plants };
}

// Plant models keyed by everything that shapes them, so adding one journal
// grows one new plant instead of regenerating the whole garden.
const usePlantModels = (posts: WorldPost[], now: number, detail = 1) => {
  const cache = useRef(new Map<string, PlantModel>());
  const models = useMemo(() => {
    const next = new Map<string, PlantModel>();
    const list = posts.map((post) => {
      const stage = getGrowthStage(post._creationTime, now, totalWaterings(post));
      const key = `${post._id}:${post.mood}:${post.reactionCount ?? 0}:${stage}:${detail}`;
      const model = cache.current.get(key) ?? next.get(key) ?? createPlant(post._id, { mood: post.mood, waterings: post.reactionCount, plantedAt: post._creationTime, stage, detail });
      next.set(key, model);
      return model;
    });
    for (const [key, model] of cache.current) if (!next.has(key)) model.geometry.dispose();
    cache.current = next;
    return list;
  }, [posts, now, detail]);
  useEffect(() => () => {
    for (const model of cache.current.values()) model.geometry.dispose();
    cache.current.clear();
  }, []);
  return models;
};

// A few colours from the top of a plant (its petals), for the bloom burst.
const petalColors = (model: PlantModel) => {
  const position = model.geometry.attributes.position.array as Float32Array;
  const color = model.geometry.attributes.color?.array as Float32Array | undefined;
  const picks: string[] = [];
  if (color) {
    const count = position.length / 3;
    const step = Math.max(1, Math.floor(count / 600));
    for (let index = 0; index < count && picks.length < 6; index += step) {
      if (position[index * 3 + 1] < model.height * 0.72) continue;
      picks.push(`#${new THREE.Color(color[index * 3], color[index * 3 + 1], color[index * 3 + 2]).getHexString()}`);
    }
  }
  return picks.length ? [...picks, "#fff6d8"] : ["#ffd166", "#f78fb3", "#fff6d8"];
};

const dayOfMonth = (post: WorldPost) => Number(getCalendarDate(post._creationTime, post.entryDate).date.slice(8, 10));

// ---------------------------------------------------------------------------
// Scene pieces

// The decorations someone placed, drawn on their island in the world view too.
const IslandDecorations = ({ layout, center, decorations, night }: { layout: GardenLayout; center: { x: number; z: number }; decorations: Arrangement["decorations"]; night: boolean }) => (
  <>
    {decorations.map((decoration) => {
      const cell = cellAt(layout, center.x + decoration.x, center.z + decoration.z);
      return cell && cell.kind === "grass" ? (
        <Decoration key={decoration.id} kind={decoration.kind} spot={{ x: cell.x, y: cell.top, z: cell.z }} turn={decoration.turn} night={night} />
      ) : null;
    })}
  </>
);

const OtherPiece = ({
  placement,
  cache,
  gray,
  now,
  beamPostId,
  night,
  onTap,
  onVisit,
}: {
  night: boolean;
  placement: Placement;
  cache: PieceCache;
  gray: boolean;
  now: number;
  // A fresh journal here you haven't read yet; it gets a beam of light.
  beamPostId?: string;
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
  const beamIndex = beamPostId ? sortByTime(placement.garden.posts).findIndex((post) => post._id === beamPostId) : -1;
  const beamPlot = beamIndex >= 0 ? layout.plots[beamIndex] : undefined;

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
      {beamPlot ? <NewBeam position={beamPlot} /> : null}
      {placement.garden.arrangement?.decorations.length ? (
        <IslandDecorations layout={layout} center={placement.center} decorations={placement.garden.arrangement.decorations} night={night} />
      ) : null}
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
  beamPostId,
  onGone,
}: {
  beamPostId?: string;
  layout: GardenLayout;
  posts: WorldPost[];
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
            growth={getPlantGrowth(post._creationTime, now, totalWaterings(post))}
            isActive={activePostId === post._id || focusPostId === post._id}
            isHighlighted={!leaving && (activePostId === post._id || focusPostId === post._id)}
            animate={!still}
            gray={focusPostId === post._id ? gray : unreadGray}
          />
        );
      })}
      {!leaving && beamPostId && beamPostId !== focusPostId && layout.plots[posts.findIndex((post) => post._id === beamPostId)] ? (
        <NewBeam position={layout.plots[posts.findIndex((post) => post._id === beamPostId)]} />
      ) : null}
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

// Watering anything: the can pours over the plant. On a neighbour's gray island
// a coloured copy of the plant blooms for a moment, then fades back to gray.
type WaterEffect = { id: number; plot: THREE.Vector3; height: number; bloom?: { post: WorldPost; model: PlantModel } };

const WaterSplash = ({ effect, now, still, onDone }: { effect: WaterEffect; now: number; still: boolean; onDone: (id: number) => void }) => {
  const gray = useRef(0);
  const startedAt = useRef<number | null>(null);
  useFrame((state) => {
    startedAt.current ??= state.clock.elapsedTime;
    const t = still ? WATERING_SECONDS : state.clock.elapsedTime - startedAt.current;
    gray.current = t < WATERING_SECONDS - 0.6 ? 0 : Math.min(1, (t - (WATERING_SECONDS - 0.6)) / 0.6);
  });
  const bloom = effect.bloom;
  return (
    <>
      <WateringCan plot={effect.plot} height={effect.height} still={still} onDone={() => onDone(effect.id)} />
      {bloom ? (
        // Slightly larger than the gray plant underneath, so it reads as the plant itself blooming.
        <GardenPlant
          model={bloom.model}
          plot={{ x: effect.plot.x, y: effect.plot.y, z: effect.plot.z }}
          growth={getPlantGrowth(bloom.post._creationTime, now, totalWaterings(bloom.post) + 1) * 1.05}
          delay={WATERING_HIT - 0.2}
          animate={!still}
          gray={gray}
          waterPulse={1}
        />
      ) : null}
    </>
  );
};

const WorldLights = ({ current, aspect, mapSize, look }: { current: RefObject<WorldView>; aspect: number; mapSize: number; look: ReturnType<typeof getAtmosphereLook> }) => {
  const light = useRef<THREE.DirectionalLight>(null);
  const hemisphere = useRef<THREE.HemisphereLight>(null);
  // Time of day and weather tint and dim the light.
  useAtmosphereLights(look, hemisphere, light);
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
      <hemisphereLight ref={hemisphere} args={[look.hemisphere.sky, look.hemisphere.ground, look.hemisphere.intensity]} />
      <primitive object={target} />
      <directionalLight
        ref={light}
        target={target}
        // Starting value only; useAtmosphereLights eases it toward the look.
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

type Snapshot = { renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.Camera };

// Hands the renderer to the postcard button, outside the canvas.
const SnapshotBridge = ({ snapshot }: { snapshot: RefObject<Snapshot | null> }) => {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    snapshot.current = { renderer: gl, scene, camera };
  }, [gl, scene, camera, snapshot]);
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

const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const raycaster = new THREE.Raycaster();

export default function WorldGardenScene({
  me,
  others,
  onWater,
  garden,
  fresh = [],
  demo = false,
}: {
  me: WorldGardenEntry | null;
  others: WorldGardenEntry[];
  garden?: MyGarden;
  // Other people's journals from the last day that you haven't read, newest first.
  fresh?: { postId: string; userId: string }[];
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
  const [toolsOpen, setToolsOpen] = useState(false);
  // Your plants watered this visit, before the server confirms it.
  const [wateredHere, setWateredHere] = useState<Set<string>>(() => new Set());
  const [waterEffects, setWaterEffects] = useState<WaterEffect[]>([]);
  // The journal being read in the side panel.
  const [focusPostId, setFocusPostId] = useState<string | null>(null);
  // The newest journal you've opened; a newer one gets a beam of light until you do.
  const [seenNewest, setSeenNewest] = useState<string | null>(() =>
    typeof window === "undefined" ? null : window.localStorage.getItem("bloom-seen-newest")
  );
  const readingDim = useRef(0);
  const screenOffset = useRef({ x: 0, y: 0 });
  const [now] = useState(() => Date.now());
  const still = usePrefersReducedMotion();
  const cache = useMemo(() => new PieceCache(), []);
  useEffect(() => () => cache.dispose(), [cache]);
  const invalidate = useRef<(() => void) | null>(null);
  const snapshot = useRef<Snapshot | null>(null);
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
        key: `${garden.userId}:${gx}:${gz}:${garden.posts.map((post) => `${post._id}${post.mood}${post.reactionCount ?? 0}${post.selfWaterings ?? 0}`).join("")}:${garden.arrangement?.moves.map((move) => `${move.postId}${move.x},${move.z}`).join("") ?? ""}`,
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
  const myPlants = usePlantModels(myPosts, now);
  useEffect(() => () => {
    myLayout?.island.dispose();
    myLayout?.water?.dispose();
    myLayout?.decor?.dispose();
  }, [myLayout]);

  // --- Arranging your garden: your moves and decorations, saved as you go ---
  const [draft, setDraft] = useState<Arrangement | null>(null);
  const arrangement = draft ?? garden?.arrangement ?? me?.arrangement ?? emptyArrangement;
  const [editing, setEditing] = useState(false);
  const [held, setHeld] = useState<EditorHeld>(null);
  const homeCenter = useMemo(() => ({ x: 0, z: 0 }), []);
  const myArranged = useMemo(
    () => (myLayout ? { ...myLayout, plots: arrangePlots(myLayout, myPosts.map((post) => post._id), arrangement, homeCenter) } : null),
    [myLayout, myPosts, arrangement, homeCenter]
  );
  const saveTimer = useRef<number | undefined>(undefined);
  const changeArrangement = (next: Arrangement) => {
    setDraft(next);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => garden?.onSaveArrangement(next), 500);
  };

  // --- The garden you're visiting ---
  const visitPosts = useMemo(() => sortByTime(visit?.placement.garden.posts ?? []), [visit?.placement]);
  const visitLayout = useMemo(
    () => (visit ? createPieceLayout(visit.placement.garden.userId, visit.placement.gx, visit.placement.gz, visitPosts.length) : null),
    [visit?.placement, visitPosts.length]
  );
  const visitPlants = usePlantModels(visitPosts, now);
  const visitArranged = useMemo(
    () =>
      visitLayout && visit
        ? { ...visitLayout, plots: arrangePlots(visitLayout, visitPosts.map((post) => post._id), visit.placement.garden.arrangement, visit.placement.center) }
        : null,
    [visitLayout, visit, visitPosts]
  );
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
    // Felt as the seed lands, and heard as the flower opens.
    window.setTimeout(() => buzz(20), PLANTING.seedFall * 1000);
    window.setTimeout(() => playGardenSound("bloom"), (PLANTING.growDelay + 0.3) * 1000);
  }, [myPosts, still]);
  useEffect(() => {
    if (!planting) return;
    const timer = window.setTimeout(() => setPlanting(null), PLANTING.hold * 1000);
    return () => window.clearTimeout(timer);
  }, [planting]);
  const plantingIndex = planting ? myPosts.findIndex((post) => post._id === planting.postId) : -1;
  const plantingPlot = plantingIndex >= 0 ? myArranged?.plots[plantingIndex] : undefined;

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
    mode === "garden" && me && myArranged
      ? { posts: myPosts, layout: myArranged, models: myPlants, owner: undefined }
      : mode === "visit" && visit && !visit.leaving && visitArranged
        ? { posts: visitPosts, layout: visitArranged, models: visitPlants, owner: visit.placement.garden.name }
        : null;
  const readingIndex = focusPostId && readable ? readable.posts.findIndex((post) => post._id === focusPostId) : -1;
  const reading = readingIndex >= 0 && readable ? { post: readable.posts[readingIndex], plot: readable.layout.plots[readingIndex] } : null;
  // Drop the reading if its journal goes away (mode change, replay, data update).
  useEffect(() => {
    if (focusPostId && readingIndex < 0) setFocusPostId(null);
  }, [focusPostId, readingIndex]);

  // --- Atmosphere: time of day, season, and weather from the last week of moods ---
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 5 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);
  // Development only: ?daypart=night&weather=rain&season=winter previews any sky.
  const [preview] = useState(() => {
    if (process.env.NODE_ENV === "production" || typeof window === "undefined") return {};
    const params = new URLSearchParams(window.location.search);
    return {
      dayPart: (params.get("daypart") ?? undefined) as DayPart | undefined,
      weather: (params.get("weather") ?? undefined) as Weather | undefined,
      season: (params.get("season") ?? undefined) as Season | undefined,
    };
  });
  const weatherMoods =
    mode === "visit" ? [...visitPosts].reverse().map((post) => post.mood) : garden?.recentMoods ?? [...myPosts].reverse().map((post) => post.mood);
  const atmosphere: Atmosphere = {
    dayPart: preview.dayPart ?? getDayPart(clock),
    season: preview.season ?? getSeason(clock),
    weather: preview.weather ?? getWeather(weatherMoods),
  };
  const look = useMemo(() => getAtmosphereLook(atmosphere), [atmosphere.dayPart, atmosphere.season, atmosphere.weather]);
  const night = atmosphere.dayPart === "night";

  // --- Panels and sound ---
  const [panel, setPanel] = useState<"gift" | "inbox" | null>(null);
  const [soundOn, setSoundOn] = useState(false);
  const unreadGifts = garden?.gifts.filter((gift) => !gift.read).length ?? 0;
  useEffect(() => {
    if (soundOn) updateAmbience(atmosphere);
  }, [soundOn, atmosphere.dayPart, atmosphere.weather]);
  useEffect(() => () => stopAmbience(), []);
  const toggleSound = () => {
    if (soundOn) {
      stopAmbience();
      setSoundOn(false);
    } else if (startAmbience(atmosphere)) setSoundOn(true);
  };

  // --- Critters and gifts: who's living in the garden you're looking at ---
  const [pokes, setPokes] = useState({ cat: 0, frog: 0, bee: 0 });
  const residents = useMemo(() => {
    const scene =
      mode === "visit" && visitArranged && visit
        ? { layout: visitArranged, posts: visitPosts, models: visitPlants, center: visit.placement.center, seed: visit.placement.garden.userId, decorations: visit.placement.garden.arrangement?.decorations ?? [], gifts: [] as GiftView[] }
        : myArranged && me && mode !== "world"
          ? { layout: myArranged, posts: myPosts, models: myPlants, center: new THREE.Vector3(), seed: me.userId, decorations: arrangement.decorations, gifts: (garden?.gifts ?? []).slice(0, 12) }
          : null;
    if (!scene) return null;
    const open = freeCells(scene.layout, scene.layout.plots, scene.decorations, scene.center).sort((a, b) => a.x - b.x || a.z - b.z);
    const take = (seed: string) => {
      if (!open.length) return null;
      const index = Math.floor(createRandom(seed).next() * open.length);
      const [cell] = open.splice(index, 1);
      return { x: cell.x, y: cell.top, z: cell.z };
    };
    // A cat naps in gardens with plenty of steady days.
    const steady = scene.posts.filter((post) => post.mood.startsWith("C")).length;
    const cat = steady >= 3 ? take(`cat:${scene.seed}`) : null;
    // A frog lives on the pond, if there is one.
    const pond = scene.layout.cells.find((cell) => cell.kind === "water");
    const frog = pond ? { x: pond.x, y: pond.top + 0.03, z: pond.z } : null;
    // A bee visits the most-watered flower.
    let beeIndex = -1;
    scene.posts.forEach((post, index) => {
      if ((post.reactionCount ?? 0) > 0 && (beeIndex < 0 || (post.reactionCount ?? 0) > (scene.posts[beeIndex].reactionCount ?? 0))) beeIndex = index;
    });
    const beePlot = beeIndex >= 0 ? scene.layout.plots[beeIndex] : undefined;
    const bee = beePlot
      ? { spot: { x: beePlot.x, y: beePlot.y, z: beePlot.z }, height: scene.models[beeIndex].height * getPlantGrowth(scene.posts[beeIndex]._creationTime, now, totalWaterings(scene.posts[beeIndex])) }
      : null;
    const gifts = scene.gifts.flatMap((gift) => {
      const spot = take(`gift:${gift._id}`);
      return spot ? [{ gift, spot }] : [];
    });
    const decorations = scene.decorations.flatMap((decoration) => {
      const cell = cellAt(scene.layout, scene.center.x + decoration.x, scene.center.z + decoration.z);
      return cell && cell.kind === "grass" ? [{ decoration, spot: { x: cell.x, y: cell.top, z: cell.z } }] : [];
    });
    return { cat, frog, bee, gifts, decorations, center: scene.center, seed: scene.seed, free: open };
  }, [mode, visitArranged, visit, visitPosts, visitPlants, myArranged, me, myPosts, myPlants, arrangement, garden?.gifts, now]);

  // --- Garden care: thirsty young plants, weeds, and plants moving up a stage ---
  const today = format(clock, "yyyy-MM-dd");
  const caring = mode === "garden" && Boolean(garden) && !editing && !replay && !planting;
  // Plants still growing want water once a day; blooming ones are happy.
  const thirsty = useMemo(
    () =>
      caring && myArranged
        ? myPosts.flatMap((post, index) => {
            const plot = myArranged.plots[index];
            if (!plot || getGrowthStage(post._creationTime, now, totalWaterings(post)) === "bloom") return [];
            if (post.selfWateredOn === today || wateredHere.has(post._id)) return [];
            return [{ post, index, plot }];
          })
        : [],
    [caring, myArranged, myPosts, now, today, wateredHere]
  );
  // Weeds creep onto free grass while you're away; pulled ones animate out first.
  const [pulledHere, setPulledHere] = useState<number[]>([]);
  const [pulling, setPulling] = useState<number[]>([]);
  const weedSince = garden?.weeds.since;
  useEffect(() => setPulledHere([]), [weedSince]);
  const weeds = useMemo(() => {
    if (!garden || !residents || mode !== "garden" || editing) return [];
    const free = [...residents.free];
    const list: { index: number; spot: { x: number; y: number; z: number }; pulling: boolean }[] = [];
    for (let index = 0; index < weedCount(garden.weeds.since, clock.getTime()); index++) {
      if (!free.length) break;
      const [cell] = free.splice(Math.floor(createRandom(`weed:${garden.weeds.since}:${index}`).next() * free.length), 1);
      if (garden.weeds.pulled.includes(index) || pulledHere.includes(index)) continue;
      list.push({ index, spot: { x: cell.x, y: cell.top, z: cell.z }, pulling: pulling.includes(index) });
    }
    return list;
  }, [garden, residents, mode, editing, clock, pulledHere, pulling]);
  const pullWeed = (index: number) => {
    if (!garden || pulling.includes(index)) return;
    buzz(14);
    if (soundOn) playGardenSound("click");
    setPulling((list) => [...list, index]);
    window.setTimeout(() => {
      setPulling((list) => list.filter((item) => item !== index));
      setPulledHere((list) => [...list, index]);
    }, PULL_SECONDS * 1000);
    void garden.onPullWeed(index).catch(() => toast.error("Couldn't pull that weed. Try again?"));
  };
  const careTasks = thirsty.length + weeds.filter((weed) => !weed.pulling).length;
  // A thank-you when the last task of the day is done.
  const hadTasks = useRef(false);
  useEffect(() => {
    if (!caring) return;
    if (careTasks > 0) hadTasks.current = true;
    else if (hadTasks.current) {
      hadTasks.current = false;
      if (soundOn) playGardenSound("bloom");
      toast("Your garden is all tended. It looks happy today.");
    }
  }, [careTasks, caring, soundOn]);
  // When care moves a plant to its next stage, celebrate it.
  const stages = useRef(new Map<string, GrowthStage>());
  const [stageBursts, setStageBursts] = useState<{ key: string; at: { x: number; y: number; z: number }; colors: string[] }[]>([]);
  useEffect(() => {
    if (!myArranged) return;
    myPosts.forEach((post, index) => {
      const stage = getGrowthStage(post._creationTime, now, totalWaterings(post));
      const before = stages.current.get(post._id);
      stages.current.set(post._id, stage);
      const plot = myArranged.plots[index];
      if (!before || before === stage || !plot) return;
      const key = `${post._id}:${stage}`;
      const colors = stage === "bloom" && myPlants[index] ? petalColors(myPlants[index]) : ["#9ad46a", "#c8ec9a", "#6fb34a", "#e9f7c8"];
      setStageBursts((list) => [...list, { key, at: plot, colors }]);
      window.setTimeout(() => setStageBursts((list) => list.filter((burst) => burst.key !== key)), 2600);
      toast(stage === "bloom" ? "It bloomed! Your care paid off." : stage === "bud" ? "Buds are forming." : "Your sprout grew its first real leaves.");
      if (soundOn && stage === "bloom") window.setTimeout(() => playGardenSound("gift"), 400);
    });
  }, [myPosts, myPlants, myArranged, now, soundOn]);

  // --- Camera framing ---
  const home = mine?.center ?? placements[0]?.center ?? new THREE.Vector3();
  const isWide = (size?.width ?? 1024) >= 640;
  const gardenFrame = isWide ? 1 : NARROW_GARDEN_FRAME;
  const soloWidth = myLayout ? pieceFrameWidth(myLayout, home, aspect) : PIECE_SIZE * 1.8 * Math.max(1, 1 / aspect);
  const visitWidth = visitLayout && visit ? pieceFrameWidth(visitLayout, visit.placement.center, aspect) : soloWidth;
  const maxWorldWidth = coarsePointer ? MAX_WORLD_WIDTH.coarse : MAX_WORLD_WIDTH.fine;
  const worldWidth = Math.min(soloWidth * worldZoom, maxWorldWidth);
  const baseWidth =
    mode === "garden"
      ? soloWidth * gardenFrame * (plantingPlot ? PLANTING.zoom : gardenZoom)
      : mode === "visit"
        ? visitWidth * gardenFrame * gardenZoom
        : worldWidth;
  const goalWidth = reading?.plot ? (mode === "visit" ? visitWidth : soloWidth) * READING.zoom : baseWidth;

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
    if (mode === "visit" && visit && !visit.leaving) return [];
    const centerX = focus.gx * PIECE_SIZE;
    const centerZ = focus.gz * PIECE_SIZE;
    const limit = focus.reach + PIECE_SIZE * 1.5;
    return placements.filter((placement) => Math.hypot(placement.center.x - centerX, placement.center.z - centerZ) <= limit);
  }, [placements, focus, mode, mine, visit]);
  useEffect(() => {
    cache.retain(new Set(visible.filter((placement) => !placement.isMine).map((placement) => placement.key)));
  }, [cache, visible]);

  // --- Actions ---
  const zoomWorld = (factor: number) =>
    setWorldZoom((zoom) => Math.min(Math.max(zoom * factor, WORLD_ZOOM.min), maxWorldWidth / soloWidth));
  // Zoom whatever you're looking at: the world, or the garden you're in (not while reading).
  const zoomBy = (factor: number) => {
    if (mode === "world") zoomWorld(factor);
    else if (!focusPostId) setGardenZoom((zoom) => Math.min(Math.max(zoom * factor, GARDEN_ZOOM.min), GARDEN_ZOOM.max / gardenFrame));
  };

  const turnBy = (delta: number) => {
    goal.current.angle += delta;
    invalidate.current?.();
  };

  // Fresh journals waiting for a reader: the newest unread one in each garden glows.
  const freshByGarden = useMemo(() => {
    const byGarden = new Map<string, string>();
    for (const { postId, userId } of fresh) if (!byGarden.has(userId)) byGarden.set(userId, postId);
    return byGarden;
  }, [fresh]);
  const freshTargets = useMemo(
    () =>
      fresh.flatMap(({ postId, userId }) => {
        const placement = placements.find((item) => item.garden.userId === userId && !item.isMine);
        return placement && placement.garden.posts.some((post) => post._id === postId) ? [{ postId, placement }] : [];
      }),
    [fresh, placements]
  );
  // Fly to a garden with a fresh journal you haven't read, and open it.
  // Your neighbours' come first.
  const isNeighbour = (userId: string) => garden?.neighbours.includes(userId) ?? false;
  const readSomethingNew = () => {
    const fromNeighbours = freshTargets.filter((target) => isNeighbour(target.placement.garden.userId));
    const choices = fromNeighbours.length ? fromNeighbours : freshTargets;
    const pick = choices[Math.floor(Math.random() * choices.length)];
    if (!pick) return;
    startVisit(pick.placement);
    setFocusPostId(pick.postId);
    buzz(10);
  };

  const toggleNeighbour = async (placement: Placement) => {
    if (!garden) return toast("Log in to choose neighbours.");
    const name = placement.garden.name;
    const result = await garden.onToggleNeighbour(placement.garden.userId).catch(() => "failed" as const);
    if (result === "added") {
      buzz(10);
      toast(`${name} is now your neighbour. Their garden will sit next to yours.`);
    } else if (result === "removed") toast(`${name} is no longer your neighbour.`);
    else if (result === "full") toast("You can have up to 12 neighbours. Remove one to add another.");
    else toast.error("Couldn't change that. Try again?");
  };

  const goTo = (next: Mode) => {
    setEditing(false);
    setHeld(null);
    setPanel(null);
    setGardenZoom(1);
    setSelected(null);
    setReplay(null);
    setFocusPostId(null);
    if (next !== "visit" && visit && !visit.leaving) setVisit({ ...visit, leaving: true });
    setMode(next);
  };

  const startVisit = (placement: Placement) => {
    if (placement.isMine) return goTo("garden");
    setPanel(null);
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
        const model = createPlant(post._id, { mood: post.mood, waterings: (post.reactionCount ?? 0) + 1, plantedAt: post._creationTime, stage: getGrowthStage(post._creationTime, now, totalWaterings(post) + 1), detail: 0.35 });
        const height = model.height * getPlantGrowth(post._creationTime, now, totalWaterings(post) + 1);
        playWater(plot, height, { post, model });
      }
    }).catch(() => toast.error("Couldn't water that flower. Try again?"));
  };

  const finishWaterEffect = (id: number) =>
    setWaterEffects((effects) => {
      const finished = effects.find((effect) => effect.id === id);
      finished?.bloom?.model.geometry.dispose();
      return effects.filter((effect) => effect.id !== id);
    });
  const playWater = (plot: { x: number; y: number; z: number }, height: number, bloom?: WaterEffect["bloom"]) => {
    setWaterEffects((effects) => [...effects, { id: Date.now() + Math.random(), plot: new THREE.Vector3(plot.x, plot.y, plot.z), height, bloom }]);
    if (soundOn) window.setTimeout(() => playGardenSound("bloom"), WATERING_HIT * 1000);
    invalidate.current?.();
  };

  // Water the journal you're reading: your own (once a day, helps it grow) or
  // someone else's. The panel only asks when it hasn't been watered yet, so the
  // can starts pouring straight away while the server catches up.
  const [ownPulse, setOwnPulse] = useState({ postId: "", count: 0 });
  // Your own plant: pour straight away, and count it as watered today while the server catches up.
  const waterOwnPlant = async (post: WorldPost, plot: { x: number; y: number; z: number }, model?: PlantModel) => {
    const height = (model?.height ?? 0.6) * getPlantGrowth(post._creationTime, now, totalWaterings(post) + 1);
    buzz([10, 40, 18]);
    playWater(plot, height);
    setWateredHere((set) => new Set(set).add(post._id));
    window.setTimeout(() => setOwnPulse((pulse) => ({ postId: post._id, count: pulse.count + 1 })), WATERING_HIT * 1000);
    const result = garden ? await garden.onWaterOwn(post._id).catch(() => "failed" as const) : "unavailable";
    if (result !== "watered" && result !== "already") {
      toast.error("Couldn't water it. Try again?");
      setWateredHere((set) => {
        const next = new Set(set);
        next.delete(post._id);
        return next;
      });
    }
  };
  const waterReading = async () => {
    if (!reading?.plot || !readable) return;
    const { post, plot } = reading;
    const model = readable.models[readingIndex];
    if (!readable.owner) return waterOwnPlant(post, plot, model);
    const height = (model?.height ?? 0.6) * getPlantGrowth(post._creationTime, now, totalWaterings(post) + 1);
    buzz([10, 40, 18]);
    playWater(plot, height);
    const result = await onWater(post._id).catch(() => "failed" as const);
    if (result === "signedOut") toast("Log in to water other people's flowers.");
    else if (result === "unavailable") toast("This flower can't be watered.");
    else if (result === "failed") toast.error("Couldn't water that flower. Try again?");
  };

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
      // Panels (journal, gifts) scroll normally.
      if ((event.target as HTMLElement).closest("[data-world-control]")) return;
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
  // Opening the newest journal puts its beam out.
  useEffect(() => {
    if (!focusPostId || focusPostId !== newestPostId) return;
    setSeenNewest(focusPostId);
    window.localStorage.setItem("bloom-seen-newest", focusPostId);
  }, [focusPostId, newestPostId]);
  const beamPlot =
    newestPostId && newestPostId !== seenNewest && !planting && !editing && !replay && myArranged ? myArranged.plots[myPosts.length - 1] : undefined;
  const burstColors = useMemo(
    () => (planting && plantingIndex >= 0 && myPlants[plantingIndex] ? petalColors(myPlants[plantingIndex]) : null),
    [planting, plantingIndex, myPlants]
  );
  const plantingPost = plantingIndex >= 0 ? myPosts[plantingIndex] : undefined;
  const isShown = (post: WorldPost) => !replay || dayOfMonth(post) <= replay.day;
  const monthLabel = new Date(now).toLocaleString(undefined, { month: "long" });

  // --- Arranging: tap a flower or decoration to pick it up, then an empty spot to put it down ---
  const startEditing = () => {
    setFocusPostId(null);
    setReplay(null);
    setPanel(null);
    setToolsOpen(false);
    setHeld(null);
    setEditing(true);
  };
  const handleEditTap = (clientX: number, clientY: number, rect: DOMRect) => {
    if (!myArranged) return;
    raycaster.setFromCamera(new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1), camera);
    const point = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(groundPlane, point)) return;
    const cell = cellAt(myArranged, point.x, point.z);
    if (!cell) return setHeld(null);
    const local = { x: cell.x - homeCenter.x, z: cell.z - homeCenter.z };
    const plantIndex = myArranged.plots.findIndex((plot) => Math.round(plot.x) === cell.x && Math.round(plot.z) === cell.z);
    const decoration = arrangement.decorations.find((item) => item.x === local.x && item.z === local.z);
    const isFree = cell.kind === "grass" && plantIndex < 0 && !decoration;
    playGardenSound("click");
    buzz(8);
    if (held && isFree) {
      if (held.type === "plant") {
        changeArrangement({ ...arrangement, moves: [...arrangement.moves.filter((move) => move.postId !== held.postId), { postId: held.postId, ...local }] });
      } else if (held.type === "new") {
        if (arrangement.decorations.length >= 24) return void toast("Your garden is full of decorations. Remove one to add another.");
        changeArrangement({ ...arrangement, decorations: [...arrangement.decorations, { id: crypto.randomUUID(), kind: held.kind, ...local, turn: 0 }] });
      } else {
        changeArrangement({ ...arrangement, decorations: arrangement.decorations.map((item) => (item.id === held.id ? { ...item, ...local } : item)) });
      }
      setHeld(null);
      return;
    }
    if (held && !isFree && cell.kind !== "grass") return void toast("Flowers and decorations need grass to sit on.");
    if (plantIndex >= 0) setHeld({ type: "plant", postId: myPosts[plantIndex]._id });
    else if (decoration) setHeld({ type: "decoration", id: decoration.id });
    else setHeld(null);
  };
  const heldDecoration = held?.type === "decoration" ? arrangement.decorations.find((item) => item.id === held.id) : undefined;

  // --- A one-time hint for the gestures (drag to turn, pinch to zoom, tap to read) ---
  const [hintSeen, setHintSeen] = useState(() => typeof window === "undefined" || window.localStorage.getItem("bloom-hint-seen") === "1");
  const dismissHint = () => {
    if (hintSeen) return;
    setHintSeen(true);
    window.localStorage.setItem("bloom-hint-seen", "1");
  };
  useEffect(() => {
    if (isDragging || focusPostId) dismissHint();
  });
  useEffect(() => {
    if (hintSeen || mode !== "garden") return;
    const timer = window.setTimeout(dismissHint, 8000);
    return () => window.clearTimeout(timer);
  });
  const showHint = !hintSeen && mode === "garden" && Boolean(me) && myPosts.length > 0 && !planting && !editing && !isReading && !replay;

  // --- Postcard ---
  const [sharing, setSharing] = useState(false);
  const shareGarden = async () => {
    const shot = snapshot.current;
    if (!shot) return;
    setToolsOpen(false);
    setSharing(true);
    try {
      const flowers = myPosts.length;
      const streak = garden?.longestStreak ? ` · best streak ${garden.longestStreak} days` : "";
      const blob = await makePostcard({
        ...shot,
        title: `My ${monthLabel} in Bloom`,
        subtitle: `${flowers} ${flowers === 1 ? "flower" : "flowers"} · ${describeAtmosphere(atmosphere).toLowerCase()}${streak}`,
        sky: look.sky,
      });
      const outcome = await sharePostcard(blob, `bloom-${monthLabel.toLowerCase()}.png`, `My ${monthLabel} in Bloom`);
      if (outcome.result === "downloaded") toast.success("Postcard saved to your downloads");
      if (outcome.result === "needsTap") toast("Your postcard is ready", { action: { label: "Share", onClick: () => void outcome.share() } });
    } catch {
      toast.error("Couldn't make the postcard. Try again?");
    } finally {
      setSharing(false);
    }
  };

  const poke = (critter: "cat" | "frog" | "bee") => {
    setPokes((current) => ({ ...current, [critter]: current[critter] + 1 }));
    playGardenSound(critter === "cat" ? "purr" : critter === "frog" ? "ribbit" : "buzz");
    buzz(critter === "cat" ? [8, 30, 8, 30, 8] : 12);
  };

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
      className={`fixed inset-0 isolate z-0 h-[100lvh] w-full touch-none overflow-hidden select-none outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
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
        if (editing) {
          if (!(event.target as HTMLElement).closest("button, [data-world-control]")) {
            handleEditTap(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect());
          }
          return;
        }
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
          const height = interactive.models[index].height * getPlantGrowth(post._creationTime, now, totalWaterings(post));
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
      {/* The sky: time of day and the week's weather. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 transition-opacity duration-700"
        style={{ background: `linear-gradient(to bottom, ${look.sky[0]}, ${look.sky[1]})` }}
      />
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
          <WorldLights current={current} aspect={aspect} mapSize={coarsePointer ? SHADOW_MAP_SIZE.coarse : SHADOW_MAP_SIZE.fine} look={look} />
          <SnapshotBridge snapshot={snapshot} />
          <WeatherEffects atmosphere={atmosphere} view={current} still={still} />
          {night && residents ? <Fireflies key={`${residents.center.x},${residents.center.z}`} center={residents.center} spread={3.6} still={still} /> : null}
          {residents ? (
            <>
              {residents.decorations.map(({ decoration, spot }) => (
                <Decoration
                  key={decoration.id}
                  kind={decoration.kind}
                  spot={spot}
                  turn={decoration.turn}
                  night={night}
                  selected={editing && held?.type === "decoration" && held.id === decoration.id}
                />
              ))}
              {residents.gifts.map(({ gift, spot }) => (
                <Gift key={gift._id} id={gift._id} kind={gift.kind} spot={spot} still={still} />
              ))}
              {residents.cat ? <Cat spot={residents.cat} seed={residents.seed} poke={pokes.cat} still={still} /> : null}
              {residents.frog ? <Frog spot={residents.frog} poke={pokes.frog} still={still} /> : null}
              {residents.bee ? <Bee spot={residents.bee.spot} height={residents.bee.height} poke={pokes.bee} still={still} /> : null}
              {editing && held ? <FreeCellMarkers cells={residents.free.map((cell) => ({ x: cell.x, y: cell.top, z: cell.z }))} /> : null}
            </>
          ) : null}
          <ReadingDim dim={readingDim} reading={isReading} still={still} />

          {visible.map((placement) =>
            placement.isMine || visit?.placement.slot === placement.slot ? null : (
              <OtherPiece
                key={placement.slot}
                placement={placement}
                cache={cache}
                gray={Boolean(me)}
                now={now}
                beamPostId={freshByGarden.get(placement.garden.userId)}
                night={night}
                onTap={handlePieceTap}
                onVisit={startVisit}
              />
            )
          )}

          {visit && visitArranged ? (
            <VisitedPiece
              key={visit.placement.slot}
              layout={visitArranged}
              posts={visitPosts}
              models={visitPlants}
              gray={visitGray}
              leaving={visit.leaving}
              now={now}
              still={still}
              activePostId={activePostId}
              focusPostId={focusPostId}
              dim={readingDim}
              beamPostId={freshByGarden.get(visit.placement.garden.userId)}
              onGone={() => setVisit((current) => (current?.leaving ? null : current))}
            />
          ) : null}

          {mine && myArranged && visible.includes(mine) ? (
            <group
              onClick={(event) => {
                if (mode !== "world" || event.delta > DRAG_THRESHOLD) return;
                event.stopPropagation();
                goTo("garden");
              }}
            >
              <mesh geometry={myArranged.island} material={worldMaterials.ground} receiveShadow />
              {myArranged.decor ? <mesh geometry={myArranged.decor} material={worldMaterials.ground} castShadow receiveShadow /> : null}
              {myArranged.water ? <mesh geometry={myArranged.water} material={worldMaterials.water} /> : null}
              {myPlants.map((model, index) => {
                const post = myPosts[index];
                const plot = myArranged.plots[index];
                if (!plot) return null;
                const isPlanting = post._id === planting?.postId;
                return (
                  <GardenPlant
                    key={post._id}
                    model={model}
                    plot={plot}
                    growth={getPlantGrowth(post._creationTime, now, totalWaterings(post))}
                    delay={isPlanting ? PLANTING.growDelay : index * Math.min(0.08, 1.6 / Math.max(1, myPosts.length))}
                    isActive={activePostId === post._id || focusPostId === post._id}
                    isHighlighted={
                      editing
                        ? held?.type === "plant" && held.postId === post._id
                        : mode === "garden" && !replay && (focusPostId ? focusPostId === post._id : activePostId === post._id)
                    }
                    animate={!still}
                    shown={isShown(post)}
                    gray={focusPostId && focusPostId !== post._id ? readingDim : undefined}
                    waterPulse={ownPulse.postId === post._id ? ownPulse.count : 0}
                  />
                );
              })}
              {planting && plantingPlot ? (
                <SeedDrop key={planting.key} position={new THREE.Vector3(plantingPlot.x, plantingPlot.y, plantingPlot.z)} />
              ) : null}
              {planting && plantingPlot && burstColors && !still ? (
                <BloomBurst key={`burst-${planting.key}`} position={plantingPlot} colors={burstColors} delay={PLANTING.growDelay + 0.75} />
              ) : null}
              {beamPlot ? <NewBeam key={newestPostId} position={beamPlot} /> : null}
              {/* Your decorations stay put when you zoom out to the world. */}
              {mode === "world" ? <IslandDecorations layout={myArranged} center={homeCenter} decorations={arrangement.decorations} night={night} /> : null}
            </group>
          ) : null}

          {weeds.map((weed) => (
            <Weed key={`${weedSince}:${weed.index}`} spot={weed.spot} seed={`${weedSince}:${weed.index}`} pulling={weed.pulling} still={still} />
          ))}
          {!still
            ? stageBursts.map((burst) => <BloomBurst key={burst.key} position={burst.at} colors={burst.colors} delay={WATERING_HIT + 0.3} />)
            : null}
          {waterEffects.map((effect) => (
            <WaterSplash key={effect.id} effect={effect} now={now} still={still} onDone={finishWaterEffect} />
          ))}
        </Canvas>
      ) : null}

      {showHitAreas && residents && !editing
        ? (
            [
              ["cat", residents.cat, "Pet the cat", 0.22],
              ["frog", residents.frog, "Poke the frog", 0.1],
              // Above the flower's bloom, so tapping the flower still opens its journal.
              ["bee", residents.bee ? { ...residents.bee.spot, y: residents.bee.spot.y + residents.bee.height } : null, "Say hello to the bee", 0.45],
            ] as const
          ).map(([critter, spot, label, lift]) => {
            if (!spot) return null;
            const at = projectPoint(camera, spot.x, spot.y + lift, spot.z);
            return (
              <button
                key={critter}
                type="button"
                aria-label={label}
                title={label}
                onClick={() => poke(critter)}
                className={cn(
                  "absolute z-[600] -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  // The bee circles a flower: let the flower's own button win where they overlap.
                  critter === "bee" ? "z-[5] size-9" : "size-11",
                )}
                style={{ left: `${at.left}%`, top: `${at.top}%` }}
              />
            );
          })
        : null}

      {showHitAreas && interactive && !editing
        ? interactive.posts.map((post, index) => {
            const plot = interactive.layout.plots[index];
            if (!plot || (mode === "garden" && !isShown(post))) return null;
            const height = interactive.models[index].height * getPlantGrowth(post._creationTime, now, totalWaterings(post));
            const base = projectPoint(camera, plot.x, plot.y, plot.z);
            const top = projectPoint(camera, plot.x, plot.y + height, plot.z);
            const left = projectPoint(camera, plot.x - screenRight.x, plot.y, plot.z - screenRight.z);
            const right = projectPoint(camera, plot.x + screenRight.x, plot.y, plot.z + screenRight.z);
            const isPrivate = post.visibility === "private";
            return (
              <button
                key={post._id}
                type="button"
                aria-label={isPrivate ? "Open private journal" : getJournalAriaLabel(mode === "garden" && post._id === newestPostId, post.mood)}
                aria-pressed={focusPostId === post._id}
                className="absolute -translate-x-1/2 cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onPointerEnter={(event) => event.pointerType === "mouse" && setActivePostId(post._id)}
                onPointerLeave={(event) => event.pointerType === "mouse" && setActivePostId((active) => (active === post._id ? null : active))}
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
            );
          })
        : null}

      {reading && readable ? (
        <JournalPanel
          post={reading.post}
          index={readingIndex}
          total={readable.posts.length}
          owner={readable.owner}
          onWater={demo ? undefined : () => void waterReading()}
          live={!demo}
          onPrevious={() => setFocusPostId(readable.posts[Math.max(0, readingIndex - 1)]._id)}
          onNext={() => setFocusPostId(readable.posts[Math.min(readable.posts.length - 1, readingIndex + 1)]._id)}
          onClose={() => {
            setFocusPostId(null);
            frameRef.current?.focus();
          }}
        />
      ) : null}

      {selected && mode === "world" ? (
        <div
          data-world-control
          className={cn(
            "absolute inset-x-3 bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+9.5rem)] z-[2000] flex items-center gap-2 rounded-full py-1.5 pr-1.5 pl-4 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-200 sm:right-auto sm:bottom-24 sm:left-6 sm:w-80",
            glassSurface,
          )}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{selected.garden.name}</p>
            <p className="text-xs text-muted-foreground">
              {isNeighbour(selected.garden.userId) ? "Your neighbour · " : ""}
              {selected.garden.posts.length} {selected.garden.posts.length === 1 ? "flower" : "flowers"} this month
            </p>
          </div>
          <button
            type="button"
            onClick={() => startVisit(selected)}
            className="inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium whitespace-nowrap text-primary-foreground transition-transform duration-150 ease-out active:scale-[0.97]"
          >
            <MapIcon className="size-4" aria-hidden="true" /> Visit
          </button>
          <button
            type="button"
            onClick={() => setSelected(null)}
            aria-label="Close"
            className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-transform duration-150 ease-out hover:bg-foreground/5 active:scale-[0.97]"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {mode === "visit" && visit && !visit.leaving && !isReading ? (
        <div
          key={visit.placement.slot}
          className="pointer-events-none absolute top-[calc(max(0.5rem,env(safe-area-inset-top))+5.5rem)] left-1/2 z-[2000] max-w-[calc(100%-2rem)] -translate-x-1/2 text-center motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-2 motion-safe:duration-300"
        >
          <p className={cn("truncate rounded-full px-5 py-2", glassSurface)}>
            <span className="font-display text-lg">{visit.placement.garden.name}'s garden</span>
            <span className="ml-2 text-xs text-muted-foreground">
              {visit.placement.garden.posts.length} {visit.placement.garden.posts.length === 1 ? "flower" : "flowers"}
            </span>
          </p>
        </div>
      ) : null}

      {showHitAreas && caring && !isReading
        ? (
            <>
              {thirsty.map(({ post, index, plot }) => {
                const height = (myPlants[index]?.height ?? 0.4) * getPlantGrowth(post._creationTime, now, totalWaterings(post));
                const at = projectPoint(camera, plot.x, plot.y + height, plot.z);
                return (
                  <button
                    key={`thirsty-${post._id}`}
                    type="button"
                    onClick={() => void waterOwnPlant(post, plot, myPlants[index])}
                    aria-label="This plant is thirsty. Water it."
                    title="Thirsty. Tap to water"
                    className="group absolute z-[700] flex size-11 -translate-x-1/2 -translate-y-[120%] cursor-pointer items-center justify-center rounded-full outline-none"
                    style={{ left: `${at.left}%`, top: `${at.top}%` }}
                  >
                    <span className="flex size-8 items-center justify-center rounded-full bg-sky-100/95 text-sky-600 shadow-md ring-1 ring-sky-300/60 transition-transform duration-150 ease-out group-focus-visible:ring-2 group-focus-visible:ring-ring group-active:scale-90 motion-safe:animate-[bob_2.4s_ease-in-out_infinite] dark:bg-sky-950/90 dark:text-sky-300">
                      <DropIcon weight="fill" className="size-4" />
                    </span>
                  </button>
                );
              })}
              {weeds.map((weed) => {
                if (weed.pulling) return null;
                const at = projectPoint(camera, weed.spot.x, weed.spot.y + 0.08, weed.spot.z);
                return (
                  <button
                    key={`weed-${weed.index}`}
                    type="button"
                    onClick={() => pullWeed(weed.index)}
                    aria-label="Pull this weed"
                    title="Pull the weed"
                    className="absolute z-[650] size-11 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full outline-none hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-ring"
                    style={{ left: `${at.left}%`, top: `${at.top}%` }}
                  />
                );
              })}
            </>
          )
        : null}

      {caring && careTasks > 0 && !showHint && !isReading ? (
        <p
          role="status"
          className={cn(
            "pointer-events-none absolute top-[calc(max(0.5rem,env(safe-area-inset-top))+5.5rem)] left-1/2 z-[2000] flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2 text-xs font-medium whitespace-nowrap text-foreground/80 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-2 motion-safe:duration-300",
            glassSurface,
          )}
        >
          <span className="font-semibold">Today's care</span>
          {thirsty.length ? (
            <span className="inline-flex items-center gap-1 text-sky-700 dark:text-sky-300">
              <DropIcon weight="fill" className="size-3.5" /> {thirsty.length} thirsty
            </span>
          ) : null}
          {weeds.filter((weed) => !weed.pulling).length ? (
            <span className="inline-flex items-center gap-1 text-lime-800 dark:text-lime-300">
              <Sprout className="size-3.5" aria-hidden="true" /> {weeds.filter((weed) => !weed.pulling).length} {weeds.filter((weed) => !weed.pulling).length === 1 ? "weed" : "weeds"}
            </span>
          ) : null}
        </p>
      ) : null}

      {showHint ? (
        <p
          role="status"
          className={cn(
            "pointer-events-none absolute top-[calc(max(0.5rem,env(safe-area-inset-top))+5.5rem)] left-1/2 z-[2000] -translate-x-1/2 rounded-full px-4 py-2 text-xs font-medium whitespace-nowrap text-foreground/80",
            "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-2 motion-safe:duration-300 [animation-delay:800ms] [animation-fill-mode:both]",
            glassSurface,
          )}
        >
          {coarsePointer ? "Drag to turn · Pinch to zoom · Tap a flower to read" : "Drag to turn · Scroll to zoom · Click a flower to read"}
        </p>
      ) : null}

      {planting && plantingPost ? (
        <div
          key={planting.key}
          role="status"
          className={cn(
            "pointer-events-none absolute top-[calc(max(0.5rem,env(safe-area-inset-top))+5.5rem)] left-1/2 z-[2000] flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap",
            "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-3 motion-safe:duration-500 [animation-delay:1.2s] [animation-fill-mode:both]",
            glassSurface,
          )}
        >
          <Sprout className="size-4 text-primary" aria-hidden="true" />
          Planted today · {moodLabels[plantingPost.mood]}
        </div>
      ) : null}

      {replay && mode === "garden" && !editing ? (
        <div
          data-world-control
          className={cn(
            "absolute inset-x-3 bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+9.5rem)] z-[2000] flex items-center gap-3 rounded-full py-1 pr-4 pl-1 sm:right-auto sm:bottom-24 sm:left-1/2 sm:w-[min(28rem,calc(100%-10rem))] sm:-translate-x-1/2",
            glassSurface,
            isReading && "hidden sm:flex",
          )}
        >
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

      {editing && mode === "garden" ? (
        <GardenEditor
          held={held}
          longestStreak={garden?.longestStreak ?? 0}
          onPick={(kind) => setHeld((current) => (current?.type === "new" && current.kind === kind ? null : { type: "new", kind }))}
          onTurn={() =>
            heldDecoration &&
            changeArrangement({
              ...arrangement,
              decorations: arrangement.decorations.map((item) => (item.id === heldDecoration.id ? { ...item, turn: (item.turn + 1) % 4 } : item)),
            })
          }
          onRemove={() => {
            if (!heldDecoration) return;
            changeArrangement({ ...arrangement, decorations: arrangement.decorations.filter((item) => item.id !== heldDecoration.id) });
            setHeld(null);
          }}
          onDone={() => {
            setEditing(false);
            setHeld(null);
          }}
        />
      ) : null}

      {panel === "gift" && mode === "visit" && visit && garden ? (
        <GiftComposer
          name={visit.placement.garden.name}
          onClose={() => setPanel(null)}
          onSend={async (kind, note) => {
            const name = visit.placement.garden.name;
            const result = await garden.onSendGift(visit.placement.garden.userId, kind, note).catch(() => "failed" as const);
            if (result === "sent") {
              playGardenSound("gift");
              buzz([10, 30, 10]);
              toast.success(`You left a gift for ${name}`);
              setPanel(null);
            } else if (result === "already") {
              toast(`You've already left ${name} a gift today. Come back tomorrow!`);
              setPanel(null);
            } else if (result === "signedOut") toast("Log in to leave gifts.");
            else toast.error("Couldn't leave the gift. Try again?");
          }}
        />
      ) : null}

      {panel === "inbox" && mode === "garden" && garden ? (
        <GiftInbox gifts={garden.gifts} onRemove={garden.onRemoveGift} onClose={() => setPanel(null)} />
      ) : null}

      {/* Controls: Garden | World on the left, what you'd do next on the right. */}
      <div
        data-world-control
        className={cn(
          "absolute inset-x-3 bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+5.75rem)] z-[2000] flex items-end justify-between gap-2 sm:inset-x-6 sm:bottom-6",
          isReading && "hidden sm:flex sm:right-[24rem]",
          (editing || panel) && "hidden",
        )}
      >
        {mode === "visit" && visit ? (
          <PillButton onClick={() => goTo("world")} label="Back to the world">
            <ArrowLeft className="size-4" aria-hidden="true" /> World
          </PillButton>
        ) : me ? (
          <ModeSwitch mode={mode === "world" ? "world" : "garden"} onChange={(next) => next !== mode && goTo(next)} />
        ) : (
          <span />
        )}
        <div className="flex items-end gap-2">
          {mode === "world" && freshTargets.length > 0 ? (
            <PillButton primary onClick={readSomethingNew} label={`Read a new journal (${freshTargets.length} waiting)`}>
              <Sparkles className="size-4 shrink-0" aria-hidden="true" /> New
              <span className="rounded-full bg-primary-foreground/20 px-1.5 text-xs tabular-nums">{freshTargets.length}</span>
            </PillButton>
          ) : null}
          {mode === "visit" && garden && visit ? (
            <button
              type="button"
              onClick={() => void toggleNeighbour(visit.placement)}
              aria-pressed={isNeighbour(visit.placement.garden.userId)}
              aria-label={isNeighbour(visit.placement.garden.userId) ? `${visit.placement.garden.name} is your neighbour (tap to remove)` : `Make ${visit.placement.garden.name} your neighbour`}
              title={isNeighbour(visit.placement.garden.userId) ? "Your neighbour" : "Make neighbour"}
              className={cn(
                "flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-full transition-[transform,background-color,color] duration-150 ease-out active:scale-[0.95] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                isNeighbour(visit.placement.garden.userId) ? "bg-primary/15 text-primary ring-1 ring-primary/40 backdrop-blur-xl" : cn("text-foreground/80", glassSurface),
              )}
            >
              {isNeighbour(visit.placement.garden.userId) ? <HouseHeart className="size-5" aria-hidden="true" /> : <HousePlus className="size-5" aria-hidden="true" />}
            </button>
          ) : null}
          {mode === "visit" && garden && visit ? (
            garden.giftedToday.includes(visit.placement.garden.userId) ? (
              <p className={cn("flex h-12 items-center gap-1.5 rounded-full px-4 text-sm font-medium whitespace-nowrap text-foreground/70", glassSurface)}>
                <GiftIcon className="size-4 shrink-0" aria-hidden="true" /> Gift left today
              </p>
            ) : (
              <PillButton primary onClick={() => setPanel("gift")}>
                <GiftIcon className="size-4 shrink-0" aria-hidden="true" /> <span className="whitespace-nowrap">Leave a gift</span>
              </PillButton>
            )
          ) : null}
          <MoreMenu
            open={toolsOpen}
            onOpenChange={setToolsOpen}
            badge={mode === "garden" && unreadGifts > 0}
            turn={{ left: () => turnBy(-BUTTON_TURN), right: () => turnBy(BUTTON_TURN) }}
            zoom={
              mode === "world"
                ? { in: () => zoomWorld(1 / WORLD_ZOOM.step), out: () => zoomWorld(WORLD_ZOOM.step), canIn: worldZoom > WORLD_ZOOM.min, canOut: worldWidth < maxWorldWidth }
                : undefined
            }
            items={[
              ...(mode === "garden" && me
                ? [
                    { label: "Arrange garden", icon: Shovel, onClick: startEditing },
                    ...(garden
                      ? [{ label: "Gifts", icon: Inbox, badge: unreadGifts, onClick: () => {
                          setPanel("inbox");
                          if (unreadGifts) garden.onMarkGiftsRead();
                        } }]
                      : []),
                    { label: "Share a postcard", icon: Share2, disabled: sharing, onClick: () => void shareGarden() },
                    ...(myPosts.length > 0 && !replay ? [{ label: "Replay this month", icon: History, onClick: () => setReplay({ day: 0, playing: true }) }] : []),
                  ]
                : []),
              { label: soundOn ? "Sounds on" : "Sounds off", icon: soundOn ? Volume2 : VolumeX, onClick: toggleSound, keepOpen: true },
            ]}
          />
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
    className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-foreground/80 transition-transform duration-150 ease-out hover:bg-muted active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-default disabled:opacity-40"
  >
    {children}
  </button>
);
