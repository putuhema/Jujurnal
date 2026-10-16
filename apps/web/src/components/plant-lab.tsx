"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import * as THREE from "three";
import { ArrowsClockwiseIcon, ShuffleIcon } from "@phosphor-icons/react";
import {
  createIsometricCamera,
  createPlant,
  getPlantGrowth,
  moodGrayscale,
  plantArchetypes,
  plantVariants,
  type MoodGrade,
  type PlantArchetype,
  type PlantModel,
} from "@/lib/garden-procedural";
import { GardenLights, GardenPlant } from "./garden-three";
import { GardenZoomProvider } from "./garden-zoom";
import { IslandGarden, type IslandPost } from "./island-garden";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Slider } from "./ui/slider";
import { Switch } from "./ui/switch";

const moods = Object.keys(moodGrayscale) as MoodGrade[];
const galleryColumns = 4;
const galleryRows = 3;
const gallerySpacing = 1.35;

const randomSeed = () => Math.random().toString(36).slice(2, 9);

const usePlant = (seed: string, options: Parameters<typeof createPlant>[1]) => {
  const plant = useMemo(
    () => createPlant(seed, options),
    // options is rebuilt each render, so depend on its fields.
    [seed, options.mood, options.waterings, options.archetype, options.variant]
  );
  useEffect(() => () => plant.geometry.dispose(), [plant]);
  return plant;
};

const tileGeometry = new THREE.BoxGeometry(1, 0.16, 1).translate(0, -0.08, 0);
const soilGeometry = new THREE.BoxGeometry(1, 0.4, 1).translate(0, -0.36, 0);
const grassMaterial = new THREE.MeshLambertMaterial({ color: new THREE.Color().setHSL(100 / 360, 0.5, 0.55, THREE.SRGBColorSpace) });
const soilMaterial = new THREE.MeshLambertMaterial({ color: new THREE.Color().setHSL(26 / 360, 0.45, 0.36, THREE.SRGBColorSpace) });

const Tile = () => (
  <>
    <mesh geometry={tileGeometry} material={grassMaterial} receiveShadow />
    <mesh geometry={soilGeometry} material={soilMaterial} receiveShadow />
  </>
);

const Orbit = ({ autoRotate }: { autoRotate: boolean }) => {
  const { camera, gl } = useThree();
  const controls = useRef<OrbitControls | null>(null);

  useEffect(() => {
    const orbit = new OrbitControls(camera, gl.domElement);
    orbit.target.set(0, 0.4, 0);
    orbit.update();
    orbit.enableDamping = true;
    orbit.minDistance = 0.8;
    orbit.maxDistance = 6;
    controls.current = orbit;
    return () => orbit.dispose();
  }, [camera, gl]);

  useEffect(() => {
    if (controls.current) controls.current.autoRotate = autoRotate;
  }, [autoRotate]);

  useFrame(() => controls.current?.update());
  return null;
};

const Inspector = ({
  plant,
  growth,
  sway,
  autoRotate,
  replay,
}: {
  plant: PlantModel;
  growth: number;
  sway: boolean;
  autoRotate: boolean;
  replay: number;
}) => (
  <Canvas shadows flat dpr={[1, 2]} camera={{ position: [2.5, 1.9, 2.5], fov: 30 }} className="touch-none">
    <GardenLights shadowReach={2} />
    <Orbit autoRotate={autoRotate} />
    <Tile />
    <GardenPlant key={replay} model={plant} plot={{ x: 0, y: 0, z: 0 }} growth={growth} animate={sway} />
  </Canvas>
);

const GalleryPlant = ({
  seed,
  index,
  mood,
  waterings,
  archetype,
  variant,
  isSelected,
  sway,
  onSelect,
}: {
  seed: string;
  index: number;
  mood: MoodGrade;
  waterings: number;
  archetype?: PlantArchetype;
  variant?: string;
  isSelected: boolean;
  sway: boolean;
  onSelect: (seed: string) => void;
}) => {
  const plant = usePlant(seed, { mood, waterings, archetype, variant });
  const [isHovered, setIsHovered] = useState(false);
  const column = index % galleryColumns;
  const row = Math.floor(index / galleryColumns);
  const x = (column - (galleryColumns - 1) / 2) * gallerySpacing;
  const z = (row - (galleryRows - 1) / 2) * gallerySpacing;

  return (
    <group
      onClick={(event) => {
        event.stopPropagation();
        onSelect(seed);
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        setIsHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setIsHovered(false);
        document.body.style.cursor = "";
      }}
    >
      <group position={[x, 0, z]}>
        <Tile />
      </group>
      <GardenPlant model={plant} plot={{ x, y: 0, z }} growth={1} animate={sway} isActive={isHovered} isHighlighted={isSelected} />
    </group>
  );
};

const Gallery = (props: Omit<Parameters<typeof GalleryPlant>[0], "seed" | "index" | "isSelected"> & { baseSeed: string; selectedSeed: string }) => {
  const camera = useMemo(() => {
    const halfX = ((galleryColumns - 1) / 2) * gallerySpacing + 0.5;
    const halfZ = ((galleryRows - 1) / 2) * gallerySpacing + 0.5;
    const points = [-1, 1].flatMap((sx) => [-1, 1].flatMap((sz) => [
      new THREE.Vector3(sx * halfX, -0.56, sz * halfZ),
      new THREE.Vector3(sx * halfX, 1.3, sz * halfZ),
    ]));
    return Object.assign(createIsometricCamera(points, new THREE.Vector3(0, 0.3, 0), 16 / 9, 1.02), { manual: true });
  }, []);

  return (
    <Canvas shadows flat dpr={[1, 2]} camera={camera}>
      <GardenLights shadowReach={5} />
      {Array.from({ length: galleryColumns * galleryRows }, (_, index) => {
        const seed = `${props.baseSeed}-${index}`;
        return <GalleryPlant key={seed} {...props} seed={seed} index={index} isSelected={seed === props.selectedSeed} />;
      })}
    </Canvas>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grid gap-2">
    <Label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</Label>
    {children}
  </div>
);

export default function PlantLab() {
  const [baseSeed, setBaseSeed] = useState("jujurnal");
  const [selectedSeed, setSelectedSeed] = useState("jujurnal-0");
  const [archetype, setArchetype] = useState<PlantArchetype | "random">("random");
  const [variant, setVariant] = useState("random");
  const [mood, setMood] = useState<MoodGrade>("A+");
  const [waterings, setWaterings] = useState(0);
  const [ageDays, setAgeDays] = useState(5);
  const [sway, setSway] = useState(true);
  const [autoRotate, setAutoRotate] = useState(false);
  const [replay, setReplay] = useState(0);
  const [showGarden, setShowGarden] = useState(false);

  const forced = archetype === "random" ? undefined : archetype;
  const forcedVariant = forced && variant !== "random" ? variant : undefined;
  const plant = usePlant(selectedSeed, { mood, waterings, archetype: forced, variant: forcedVariant });
  const growth = getPlantGrowth(0, ageDays * 86_400_000);
  const triangles = plant.geometry.attributes.position.count / 3;

  const changeBaseSeed = (seed: string) => {
    setBaseSeed(seed);
    setSelectedSeed(`${seed}-0`);
  };

  const gardenPosts = useMemo<IslandPost[]>(() => {
    const now = Date.now();
    return Array.from({ length: 16 }, (_, index) => ({
      _id: `${baseSeed}-garden-${index}` as IslandPost["_id"],
      _creationTime: now - (16 - index) * 86_400_000 * 0.5,
      body: `Sample journal ${index + 1}`,
      mood,
      reactionCount: waterings,
      visibility: "public",
    }));
  }, [baseSeed, mood, waterings]);

  return (
    <div className="grid gap-6 py-8 lg:grid-cols-[18rem_1fr]">
      <aside className="paper-card flex h-fit flex-col gap-5 rounded-3xl border border-border/70 bg-card/80 p-5 lg:sticky lg:top-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Dev tool</p>
          <h1 className="font-display text-2xl">Plant lab</h1>
        </div>

        <Field label="Seed">
          <div className="flex gap-2">
            <Input value={baseSeed} onChange={(event) => changeBaseSeed(event.target.value)} spellCheck={false} />
            <Button type="button" variant="outline" size="icon" aria-label="Random seed" title="Random seed" onClick={() => changeBaseSeed(randomSeed())}>
              <ShuffleIcon />
            </Button>
          </div>
          <p className="truncate font-mono text-xs text-muted-foreground">Inspecting {selectedSeed}</p>
        </Field>

        <Field label="Type">
          <Select
            value={archetype}
            onValueChange={(value) => {
              setArchetype(value as PlantArchetype | "random");
              setVariant("random");
            }}
          >
            <SelectTrigger className="w-full capitalize"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="random">random</SelectItem>
              {plantArchetypes.map((name) => <SelectItem key={name} value={name} className="capitalize">{name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>

        {forced && plantVariants(forced).length > 1 ? (
          <Field label="Variant">
            <Select value={variant} onValueChange={(value) => setVariant(value as string)}>
              <SelectTrigger className="w-full capitalize"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="random">random</SelectItem>
                {plantVariants(forced).map((name) => <SelectItem key={name} value={name} className="capitalize">{name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        ) : null}

        <Field label="Mood">
          <Select value={mood} onValueChange={(value) => setMood(value as MoodGrade)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{moods.map((grade) => <SelectItem key={grade} value={grade}>{grade}</SelectItem>)}</SelectContent>
          </Select>
        </Field>

        <Field label={`Waterings · ${waterings}`}>
          <Slider value={[waterings]} min={0} max={6} step={1} onValueChange={(value) => setWaterings(Array.isArray(value) ? value[0] : value)} />
        </Field>

        <Field label={`Age · ${ageDays} ${ageDays === 1 ? "day" : "days"} (${Math.round(growth * 100)}% grown)`}>
          <Slider value={[ageDays]} min={0} max={5} step={0.5} onValueChange={(value) => setAgeDays(Array.isArray(value) ? value[0] : value)} />
        </Field>

        <div className="grid gap-3">
          <label className="flex items-center justify-between text-sm">Sway <Switch checked={sway} onCheckedChange={setSway} /></label>
          <label className="flex items-center justify-between text-sm">Auto-rotate <Switch checked={autoRotate} onCheckedChange={setAutoRotate} /></label>
          <label className="flex items-center justify-between text-sm">Garden preview <Switch checked={showGarden} onCheckedChange={setShowGarden} /></label>
        </div>

        <Button type="button" variant="outline" onClick={() => setReplay((count) => count + 1)} disabled={!sway}>
          <ArrowsClockwiseIcon /> Replay growth
        </Button>

        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-2xl bg-muted/50 p-3 font-mono text-xs">
          <dt className="text-muted-foreground">type</dt><dd className="capitalize">{plant.archetype}</dd>
          <dt className="text-muted-foreground">variant</dt><dd className="capitalize">{plant.variant}</dd>
          <dt className="text-muted-foreground">height</dt><dd>{(plant.height * growth).toFixed(2)}</dd>
          <dt className="text-muted-foreground">triangles</dt><dd>{triangles.toLocaleString()}</dd>
        </dl>
      </aside>

      <main className="grid min-w-0 gap-6">
        <section className="paper-card overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-b from-sky-50 to-card dark:from-sky-950/30">
          <div className="aspect-[4/3] w-full sm:aspect-[16/10]">
            <Inspector plant={plant} growth={growth} sway={sway} autoRotate={autoRotate} replay={replay} />
          </div>
          <p className="px-5 pb-4 text-xs text-muted-foreground">Drag to orbit · scroll to zoom</p>
        </section>

        <section className="paper-card overflow-hidden rounded-3xl border border-border/70 bg-card/80">
          <div className="aspect-video w-full">
            <Gallery baseSeed={baseSeed} selectedSeed={selectedSeed} mood={mood} waterings={waterings} archetype={forced} variant={forcedVariant} sway={sway} onSelect={setSelectedSeed} />
          </div>
          <p className="px-5 pb-4 text-xs text-muted-foreground">12 variations of seed “{baseSeed}” · click one to inspect it</p>
        </section>

        {showGarden ? (
          <section className="paper-card rounded-3xl border border-border/70 bg-card/80 p-5">
            <GardenZoomProvider>
              <IslandGarden posts={gardenPosts} seed={baseSeed} />
            </GardenZoomProvider>
          </section>
        ) : null}
      </main>
    </div>
  );
}
