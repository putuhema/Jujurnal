"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { DecorationKind, GiftKind } from "@puma-brain/backend/convex/gardenItems";
import { createRandom } from "@/lib/garden-procedural";
import { Fireflies } from "./garden-weather";

// Decorations, gifts and critters that live on an island's cells. All built
// from a handful of primitives so they match the low-poly plants.

const lambert = (color: string, extra: THREE.MeshLambertMaterialParameters = {}) => new THREE.MeshLambertMaterial({ color, ...extra });
const materials = {
  wood: lambert("#9a6a43"),
  darkWood: lambert("#6f4a2e"),
  stone: lambert("#b9b2a6"),
  paleStone: lambert("#d8d2c6"),
  iron: lambert("#3b3a3f"),
  water: lambert("#7cc7e8", { transparent: true, opacity: 0.85 }),
  glow: lambert("#ffd27a", { emissive: "#ffb347", emissiveIntensity: 1.2 }),
  leaf: lambert("#4f8f4a"),
  rose: lambert("#f28aa5"),
  glass: lambert("#dff3ff", { transparent: true, opacity: 0.35, depthWrite: false }),
  white: lambert("#ffffff"),
  black: lambert("#2a2623"),
  frog: lambert("#6fbf4f"),
  frogBelly: lambert("#d8ef9f"),
  pad: lambert("#3f8f4a", { side: THREE.DoubleSide }),
  bee: lambert("#f7c948"),
  wing: lambert("#ffffff", { transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }),
};

const geometries = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cylinder: new THREE.CylinderGeometry(1, 1, 1, 12),
  sphere: new THREE.SphereGeometry(1, 14, 10),
  cone: new THREE.ConeGeometry(1, 1, 8),
  arch: new THREE.TorusGeometry(0.38, 0.025, 6, 20, Math.PI),
  wing: new THREE.CircleGeometry(1, 8),
  tail: new THREE.TorusGeometry(0.17, 0.03, 6, 16, Math.PI * 1.1),
};

type Spot = { x: number; y: number; z: number };

// ---------------------------------------------------------------------------
// Decorations

const Stones = () => (
  <>
    {[[-0.22, -0.18, 0.13], [0.05, 0.08, 0.15], [0.26, -0.12, 0.11]].map(([x, z, r], index) => (
      <mesh key={index} geometry={geometries.cylinder} material={materials.paleStone} position={[x, 0.015, z]} scale={[r, 0.03, r * 0.85]} receiveShadow />
    ))}
  </>
);

const Bench = () => (
  <>
    <mesh geometry={geometries.box} material={materials.wood} position={[0, 0.2, 0]} scale={[0.62, 0.04, 0.22]} castShadow />
    <mesh geometry={geometries.box} material={materials.wood} position={[0, 0.34, -0.1]} scale={[0.62, 0.16, 0.03]} castShadow />
    {[[-0.26, -0.08], [0.26, -0.08], [-0.26, 0.08], [0.26, 0.08]].map(([x, z], index) => (
      <mesh key={index} geometry={geometries.box} material={materials.darkWood} position={[x, 0.09, z]} scale={[0.04, 0.18, 0.04]} castShadow />
    ))}
  </>
);

const Lantern = ({ night }: { night: boolean }) => (
  <>
    <mesh geometry={geometries.cylinder} material={materials.iron} position={[0, 0.3, 0]} scale={[0.025, 0.6, 0.025]} castShadow />
    <mesh geometry={geometries.box} material={night ? materials.glow : materials.paleStone} position={[0, 0.66, 0]} scale={[0.12, 0.14, 0.12]} castShadow />
    <mesh geometry={geometries.cone} material={materials.iron} position={[0, 0.77, 0]} scale={[0.1, 0.08, 0.1]} />
    {night ? <pointLight position={[0, 0.66, 0]} color="#ffbe6b" intensity={1.4} distance={2.4} decay={2} /> : null}
  </>
);

const Birdbath = () => (
  <>
    <mesh geometry={geometries.cylinder} material={materials.stone} position={[0, 0.17, 0]} scale={[0.06, 0.34, 0.06]} castShadow />
    <mesh geometry={geometries.cylinder} material={materials.stone} position={[0, 0.36, 0]} scale={[0.22, 0.06, 0.22]} castShadow />
    <mesh geometry={geometries.cylinder} material={materials.water} position={[0, 0.395, 0]} scale={[0.18, 0.01, 0.18]} />
    <mesh geometry={geometries.sphere} material={materials.darkWood} position={[0.12, 0.44, 0.04]} scale={[0.04, 0.035, 0.05]} />
  </>
);

const Arch = () => {
  const roses = useMemo(() => Array.from({ length: 9 }, (_, index) => (index / 8) * Math.PI), []);
  return (
    <group position={[0, 0.02, 0]}>
      {[-0.38, 0.38].map((x) => (
        <mesh key={x} geometry={geometries.cylinder} material={materials.darkWood} position={[x, 0.3, 0]} scale={[0.025, 0.6, 0.025]} castShadow />
      ))}
      <mesh geometry={geometries.arch} material={materials.darkWood} position={[0, 0.6, 0]} castShadow />
      {roses.map((angle, index) => (
        <mesh
          key={index}
          geometry={geometries.sphere}
          material={index % 3 === 1 ? materials.leaf : materials.rose}
          position={[Math.cos(angle) * 0.38, 0.6 + Math.sin(angle) * 0.38, 0.02]}
          scale={0.045}
        />
      ))}
    </group>
  );
};

export const Decoration = ({ kind, spot, turn, night, selected }: { kind: DecorationKind; spot: Spot; turn: number; night: boolean; selected?: boolean }) => (
  <group position={[spot.x, spot.y, spot.z]} rotation-y={(turn * Math.PI) / 2}>
    {kind === "stones" ? <Stones /> : kind === "bench" ? <Bench /> : kind === "lantern" ? <Lantern night={night} /> : kind === "birdbath" ? <Birdbath /> : <Arch />}
    {selected ? <CellRing /> : null}
  </group>
);

// ---------------------------------------------------------------------------
// Gifts

const giftColors = ["#e76f51", "#2a9d8f", "#e9c46a", "#8ab17d", "#b5838d", "#6d8fd8"];

export const Gift = ({ id, kind, spot, still }: { id: string; kind: GiftKind; spot: Spot; still: boolean }) => {
  const look = useMemo(() => {
    const random = createRandom(`gift:${id}`);
    return { color: random.pick(giftColors), turn: random.range(0, Math.PI * 2), dx: random.range(-0.2, 0.2), dz: random.range(-0.2, 0.2) };
  }, [id]);
  const paint = useMemo(() => lambert(look.color), [look.color]);
  useEffect(() => () => paint.dispose(), [paint]);
  const at = new THREE.Vector3(spot.x + look.dx, spot.y, spot.z + look.dz);
  return (
    <group position={at} rotation-y={look.turn} scale={1.5}>
      {kind === "pebble" ? (
        <>
          <mesh geometry={geometries.sphere} material={materials.paleStone} position={[0, 0.04, 0]} scale={[0.12, 0.05, 0.09]} castShadow />
          <mesh geometry={geometries.sphere} material={paint} position={[0, 0.07, 0]} scale={[0.05, 0.025, 0.04]} />
        </>
      ) : kind === "fireflies" ? (
        <>
          <mesh geometry={geometries.cylinder} material={materials.glass} position={[0, 0.12, 0]} scale={[0.08, 0.24, 0.08]} />
          <mesh geometry={geometries.cylinder} material={materials.darkWood} position={[0, 0.25, 0]} scale={[0.085, 0.03, 0.085]} />
          <mesh geometry={geometries.sphere} material={materials.glow} position={[0, 0.12, 0]} scale={0.035} />
          <Fireflies center={{ x: 0, z: 0 }} spread={0.35} count={5} still={still} />
        </>
      ) : (
        <>
          {[[-0.05, 0.02], [0.05, 0.03], [0, -0.05]].map(([x, z], index) => (
            <group key={index} position={[x, 0.03, z]}>
              <mesh geometry={geometries.sphere} material={paint} scale={[0.05, 0.02, 0.05]} />
              <mesh geometry={geometries.sphere} material={materials.bee} position={[0, 0.015, 0]} scale={0.018} />
            </group>
          ))}
          <mesh geometry={geometries.box} material={materials.leaf} position={[0, 0.01, 0.07]} scale={[0.02, 0.01, 0.12]} />
        </>
      )}
    </group>
  );
};

// ---------------------------------------------------------------------------
// Critters. `poke` changes each time someone taps the critter.

const catCoats = [
  { body: "#e8a25a", patch: "#f6e3c6" },
  { body: "#8a8a8f", patch: "#d9d9dc" },
  { body: "#2f2a28", patch: "#f2efe9" },
  { body: "#f2efe9", patch: "#c98b57" },
];

export const Cat = ({ spot, seed, poke, still }: { spot: Spot; seed: string; poke: number; still: boolean }) => {
  const coat = useMemo(() => catCoats[Math.floor(createRandom(`cat:${seed}`).next() * catCoats.length)], [seed]);
  const mats = useMemo(() => ({ body: lambert(coat.body), patch: lambert(coat.patch) }), [coat]);
  useEffect(() => () => {
    mats.body.dispose();
    mats.patch.dispose();
  }, [mats]);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const pokedAt = useRef(-10);
  const lastPoke = useRef(poke);

  useFrame(({ clock }) => {
    const time = clock.elapsedTime;
    if (poke !== lastPoke.current) {
      lastPoke.current = poke;
      pokedAt.current = time;
    }
    if (body.current) body.current.scale.y = 1 + (still ? 0 : Math.sin(time * 1.6) * 0.04);
    // A poke lifts the sleepy head for a moment.
    const awake = Math.max(0, 1 - (time - pokedAt.current) / 1.6);
    if (head.current) head.current.rotation.x = -awake * 0.6 + Math.sin(time * 9) * awake * 0.08;
  });

  return (
    <group position={[spot.x, spot.y, spot.z]} rotation-y={0.6} scale={1.9}>
      <group ref={body}>
        <mesh geometry={geometries.sphere} material={mats.body} position={[0, 0.09, 0]} scale={[0.2, 0.1, 0.15]} castShadow />
        <mesh geometry={geometries.sphere} material={mats.patch} position={[0.02, 0.1, 0.08]} scale={[0.12, 0.06, 0.06]} />
        <mesh geometry={geometries.tail} material={mats.body} position={[0, 0.04, 0]} rotation-x={Math.PI / 2} rotation-z={0.6} castShadow />
      </group>
      <group ref={head} position={[0.17, 0.12, 0.06]}>
        <mesh geometry={geometries.sphere} material={mats.body} scale={[0.085, 0.075, 0.08]} castShadow />
        <mesh geometry={geometries.cone} material={mats.body} position={[0.01, 0.07, -0.04]} scale={[0.03, 0.06, 0.03]} />
        <mesh geometry={geometries.cone} material={mats.body} position={[0.01, 0.07, 0.04]} scale={[0.03, 0.06, 0.03]} />
        <mesh geometry={geometries.box} material={materials.black} position={[0.07, 0.01, -0.03]} scale={[0.005, 0.006, 0.025]} />
        <mesh geometry={geometries.box} material={materials.black} position={[0.07, 0.01, 0.03]} scale={[0.005, 0.006, 0.025]} />
      </group>
    </group>
  );
};

export const Frog = ({ spot, poke, still }: { spot: Spot; poke: number; still: boolean }) => {
  const frog = useRef<THREE.Group>(null);
  const hopAt = useRef(-10);
  const lastPoke = useRef(poke);
  const nextHop = useRef(4 + Math.random() * 5);

  useFrame(({ clock }) => {
    const time = clock.elapsedTime;
    if (poke !== lastPoke.current) {
      lastPoke.current = poke;
      hopAt.current = time;
    }
    // Hops now and then on its own, and whenever it's tapped.
    if (!still && time > nextHop.current) {
      hopAt.current = time;
      nextHop.current = time + 5 + Math.random() * 7;
    }
    const t = (time - hopAt.current) / 0.55;
    const g = frog.current;
    if (!g) return;
    const hop = t >= 0 && t <= 1 ? Math.sin(t * Math.PI) : 0;
    g.position.y = 0.035 + hop * 0.22;
    g.rotation.y = 0.4 + (t >= 0 && t <= 1 ? t * Math.PI * 2 : 0);
    g.scale.set(1, 1 - hop * 0.15 + (t > 1 && t < 1.25 ? -0.1 : 0), 1);
  });

  return (
    <group position={[spot.x, spot.y - 0.08, spot.z]} scale={1.6}>
      <mesh geometry={geometries.cylinder} material={materials.pad} position={[0, 0.02, 0]} scale={[0.2, 0.008, 0.2]} />
      <group ref={frog}>
        <mesh geometry={geometries.sphere} material={materials.frog} position={[0, 0.05, 0]} scale={[0.1, 0.06, 0.08]} castShadow />
        <mesh geometry={geometries.sphere} material={materials.frogBelly} position={[0.04, 0.035, 0]} scale={[0.06, 0.035, 0.06]} />
        {[-0.04, 0.04].map((z) => (
          <group key={z} position={[0.05, 0.1, z]}>
            <mesh geometry={geometries.sphere} material={materials.frog} scale={0.03} />
            <mesh geometry={geometries.sphere} material={materials.black} position={[0.018, 0.01, 0]} scale={0.014} />
          </group>
        ))}
      </group>
    </group>
  );
};

export const Bee = ({ spot, height, poke, still }: { spot: Spot; height: number; poke: number; still: boolean }) => {
  const bee = useRef<THREE.Group>(null);
  const wings = useRef<THREE.Group>(null);
  const zipAt = useRef(-10);
  const lastPoke = useRef(poke);

  useFrame(({ clock }) => {
    const time = clock.elapsedTime;
    if (poke !== lastPoke.current) {
      lastPoke.current = poke;
      zipAt.current = time;
    }
    // A lazy loop around the flower; a tap sends it zipping round a wide circle.
    const zip = Math.max(0, 1 - (time - zipAt.current) / 1.2);
    const t = still ? 0 : time * (1.3 + zip * 5);
    const radius = 0.28 + zip * 0.5;
    const g = bee.current;
    if (!g) return;
    g.position.set(spot.x + Math.cos(t) * radius, spot.y + height + 0.12 + Math.sin(t * 2.3) * 0.06, spot.z + Math.sin(t) * radius);
    g.rotation.y = -t;
    if (wings.current) wings.current.rotation.x = Math.sin(time * 60) * 0.5;
  });

  return (
    <group ref={bee} scale={1.6}>
      <mesh geometry={geometries.sphere} material={materials.bee} scale={[0.035, 0.03, 0.05]} />
      <mesh geometry={geometries.cylinder} material={materials.black} rotation-x={Math.PI / 2} scale={[0.031, 0.012, 0.031]} />
      <group ref={wings} position={[0, 0.03, 0]}>
        <mesh geometry={geometries.wing} material={materials.wing} position={[0.025, 0, 0]} rotation-x={-Math.PI / 2} scale={[0.03, 0.02, 1]} />
        <mesh geometry={geometries.wing} material={materials.wing} position={[-0.025, 0, 0]} rotation-x={-Math.PI / 2} scale={[0.03, 0.02, 1]} />
      </group>
    </group>
  );
};

// ---------------------------------------------------------------------------
// Editing aids

const ringGeometry = new THREE.RingGeometry(0.42, 0.48, 4, 1, Math.PI / 4).rotateX(-Math.PI / 2);
const ringMaterial = new THREE.MeshBasicMaterial({ color: "#ffe397", transparent: true, opacity: 0.95, depthWrite: false });
const markerGeometry = new THREE.PlaneGeometry(0.86, 0.86).rotateX(-Math.PI / 2);
const markerMaterial = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.22, depthWrite: false });

export const CellRing = ({ spot }: { spot?: Spot }) => (
  <mesh geometry={ringGeometry} material={ringMaterial} position={spot ? [spot.x, spot.y + 0.015, spot.z] : [0, 0.015, 0]} />
);

// Soft squares on every free cell while you're placing something.
export const FreeCellMarkers = ({ cells }: { cells: Spot[] }) => (
  <>
    {cells.map((cell) => (
      <mesh key={`${cell.x},${cell.z}`} geometry={markerGeometry} material={markerMaterial} position={[cell.x, cell.y + 0.012, cell.z]} />
    ))}
  </>
);
