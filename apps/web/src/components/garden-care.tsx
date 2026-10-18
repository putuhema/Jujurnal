"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { createRandom } from "@/lib/garden-procedural";

// Weeds: scruffy tufts that creep into your garden while you're away. Pulling
// one yanks it up out of the soil with a little spin before it vanishes.

const bladeGeometry = new THREE.ConeGeometry(0.018, 1, 4).translate(0, 0.5, 0);
const headGeometry = new THREE.SphereGeometry(0.03, 8, 6);
const soilGeometry = new THREE.CircleGeometry(0.11, 12).rotateX(-Math.PI / 2);
const weedGreen = new THREE.MeshLambertMaterial({ color: "#5d7a2e" });
const weedDark = new THREE.MeshLambertMaterial({ color: "#46601f" });
const dandelion = new THREE.MeshLambertMaterial({ color: "#f2c94c" });
const puff = new THREE.MeshLambertMaterial({ color: "#f4f1e6" });
const disturbed = new THREE.MeshLambertMaterial({ color: "#6b4a2f", transparent: true, opacity: 0.55, depthWrite: false });

export const PULL_SECONDS = 0.6;
// Big enough to spot (and want to pull) from the whole-garden view.
const SIZE = 1.9;

export const Weed = ({ spot, seed, pulling, still }: { spot: { x: number; y: number; z: number }; seed: string; pulling: boolean; still: boolean }) => {
  const group = useRef<THREE.Group>(null);
  const pulledAt = useRef<number | null>(null);
  const look = useMemo(() => {
    const random = createRandom(`weed:${seed}`);
    const blades = Array.from({ length: random.int(5, 8) }, (_, index) => ({
      angle: (index / 6) * Math.PI * 2 + random.range(-0.4, 0.4),
      tilt: random.range(0.25, 0.7),
      height: random.range(0.12, 0.22),
      dark: random.chance(0.4),
    }));
    // Some weeds have gone to flower (or to seed).
    const flower = random.chance(0.5) ? (random.chance(0.5) ? "dandelion" : "puff") : null;
    return { blades, flower, turn: random.range(0, Math.PI * 2), dx: random.range(-0.15, 0.15), dz: random.range(-0.15, 0.15) };
  }, [seed]);

  useFrame((state) => {
    const weed = group.current;
    if (!weed) return;
    if (!pulling) {
      pulledAt.current = null;
      weed.visible = true;
      weed.position.set(spot.x + look.dx, spot.y, spot.z + look.dz);
      weed.scale.setScalar(SIZE);
      // A slight sway, like the grass around it.
      weed.rotation.set(still ? 0 : Math.sin(state.clock.elapsedTime * 1.7 + look.turn) * 0.05, look.turn, 0);
      return;
    }
    pulledAt.current ??= state.clock.elapsedTime;
    const t = still ? 1 : Math.min(1, (state.clock.elapsedTime - pulledAt.current) / PULL_SECONDS);
    // Up and out with a twist, shrinking away at the top.
    weed.position.set(spot.x + look.dx, spot.y + Math.sin(t * Math.PI * 0.5) * 0.45, spot.z + look.dz);
    weed.rotation.set(0, look.turn + t * 4, t * 0.6);
    weed.scale.setScalar(SIZE * Math.max(0.001, 1 - Math.max(0, t - 0.5) * 2));
    weed.visible = t < 1;
  });

  return (
    <group>
      <mesh geometry={soilGeometry} material={disturbed} position={[spot.x + look.dx, spot.y + 0.006, spot.z + look.dz]} scale={SIZE} visible={!pulling} renderOrder={1} />
      <group ref={group} position={[spot.x + look.dx, spot.y, spot.z + look.dz]}>
        {look.blades.map((blade, index) => (
          <mesh
            key={index}
            geometry={bladeGeometry}
            material={blade.dark ? weedDark : weedGreen}
            scale={[1, blade.height, 1]}
            rotation={[Math.cos(blade.angle) * blade.tilt, 0, Math.sin(blade.angle) * blade.tilt]}
          />
        ))}
        {look.flower ? (
          <>
            <mesh geometry={bladeGeometry} material={weedGreen} scale={[0.4, 0.3, 0.4]} />
            <mesh geometry={headGeometry} material={look.flower === "dandelion" ? dandelion : puff} position-y={0.3} scale={look.flower === "puff" ? 1.4 : 1} />
          </>
        ) : null}
      </group>
    </group>
  );
};
