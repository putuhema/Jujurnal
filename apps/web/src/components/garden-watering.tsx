"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { roundDot } from "./garden-weather";

// Watering: a little can floats in beside the plant, tips over and pours a
// stream of droplets onto it, the soil ripples, and the can floats away.

export const WATERING_SECONDS = 2.6;
// When the first droplets reach the plant (for timing the plant's shimmer).
export const WATERING_HIT = 0.8;

const DROPS = 18;
const GRAVITY = -7;

const tin = new THREE.MeshLambertMaterial({ color: "#7fb6ad", transparent: true });
const tinDark = new THREE.MeshLambertMaterial({ color: "#5d958c", transparent: true });
const brass = new THREE.MeshLambertMaterial({ color: "#d9b46a", transparent: true });
const bodyGeometry = new THREE.CylinderGeometry(0.13, 0.15, 0.22, 20);
const rimGeometry = new THREE.TorusGeometry(0.13, 0.014, 8, 24).rotateX(Math.PI / 2);
const handleGeometry = new THREE.TorusGeometry(0.09, 0.016, 8, 20, Math.PI);
// The spout runs from the body's side up and out toward the plant (+x).
const spoutStart = new THREE.Vector3(0.11, -0.05, 0);
const spoutEnd = new THREE.Vector3(0.34, 0.11, 0);
const spoutGeometry = (() => {
  const length = spoutStart.distanceTo(spoutEnd);
  const geometry = new THREE.CylinderGeometry(0.018, 0.03, length, 10);
  geometry.translate(0, length / 2, 0);
  const direction = spoutEnd.clone().sub(spoutStart).normalize();
  geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction));
  geometry.translate(spoutStart.x, spoutStart.y, spoutStart.z);
  return geometry;
})();
const roseGeometry = new THREE.CylinderGeometry(0.045, 0.02, 0.04, 12)
  .rotateZ(-Math.PI / 2 + 0.6)
  .translate(spoutEnd.x + 0.01, spoutEnd.y + 0.005, 0);
const tip = new THREE.Vector3(spoutEnd.x + 0.03, spoutEnd.y, 0);
const ringGeometry = new THREE.RingGeometry(0.2, 0.26, 32).rotateX(-Math.PI / 2);

const ease = (value: number) => {
  const clamped = Math.min(1, Math.max(0, value));
  return clamped * clamped * (3 - 2 * clamped);
};

export const WateringCan = ({ plot, height, still, onDone }: { plot: { x: number; y: number; z: number }; height: number; still: boolean; onDone?: () => void }) => {
  const facing = useRef<THREE.Group>(null);
  const can = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const startedAt = useRef<number | null>(null);
  const done = useRef(false);
  const assets = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(DROPS * 3), 3));
    const material = new THREE.PointsMaterial({ color: "#8fd0ff", size: 7, sizeAttenuation: false, transparent: true, depthWrite: false, map: roundDot() });
    const ringMaterial = new THREE.MeshBasicMaterial({ color: "#9fd8ff", transparent: true, opacity: 0, depthWrite: false });
    // Where and when each droplet left the spout.
    const spawns = Array.from({ length: DROPS }, (_, index) => ({ at: 0.55 + index * 0.055, from: new THREE.Vector3(), velocity: new THREE.Vector3(), started: false }));
    return { geometry, material, ringMaterial, spawns };
  }, []);
  useEffect(() => () => {
    assets.geometry.dispose();
    assets.material.dispose();
    assets.ringMaterial.dispose();
  }, [assets]);
  const scratch = useMemo(() => ({ tip: new THREE.Vector3(), toward: new THREE.Vector3() }), []);
  // Hover beside the plant, a little above its top.
  const lift = Math.max(height, 0.3) + 0.45;

  useFrame((state) => {
    startedAt.current ??= state.clock.elapsedTime;
    const t = still ? WATERING_SECONDS : state.clock.elapsedTime - startedAt.current;
    if (t >= WATERING_SECONDS && !done.current) {
      done.current = true;
      onDone?.();
    }
    const group = facing.current;
    const body = can.current;
    if (!group || !body) return;

    // Turn so the spout points at the plant from where the camera is looking.
    const camera = state.camera.position;
    group.position.set(plot.x, plot.y, plot.z);
    group.rotation.y = Math.atan2(camera.x - plot.x, camera.z - plot.z) - Math.PI / 2 + 0.35;

    const appear = ease(t / 0.35) * (1 - ease((t - 2.1) / 0.4));
    const tilt = ease((t - 0.3) / 0.3) * (1 - ease((t - 1.75) / 0.35));
    body.visible = appear > 0.01;
    body.position.set(-0.36 - (1 - appear) * 0.15, lift + (1 - appear) * 0.25 + Math.sin(t * 3) * 0.015, 0);
    body.rotation.z = -tilt * 0.85;
    body.scale.setScalar(0.7 + appear * 0.3);
    for (const material of [tin, tinDark, brass]) material.opacity = appear;

    // Droplets leave the spout while it's tipped, and fall onto the plant.
    body.updateMatrixWorld();
    const positions = assets.geometry.attributes.position.array as Float32Array;
    assets.spawns.forEach((drop, index) => {
      const age = t - drop.at;
      if (age >= 0 && !drop.started && tilt > 0.6) {
        drop.started = true;
        drop.from.copy(scratch.tip.copy(tip).applyMatrix4(body.matrixWorld));
        scratch.toward.set(plot.x - drop.from.x, 0, plot.z - drop.from.z).multiplyScalar(1.4);
        drop.velocity.set(scratch.toward.x + (Math.random() - 0.5) * 0.15, -0.3, scratch.toward.z + (Math.random() - 0.5) * 0.15);
      }
      const falling = drop.started ? age : -1;
      const y = drop.from.y + drop.velocity.y * falling + 0.5 * GRAVITY * falling * falling;
      if (falling < 0 || y < plot.y + 0.03) {
        positions.set([0, -1000, 0], index * 3);
        return;
      }
      positions.set([drop.from.x + drop.velocity.x * falling, y, drop.from.z + drop.velocity.z * falling], index * 3);
    });
    assets.geometry.attributes.position.needsUpdate = true;

    // A ripple spreads across the soil as the water lands.
    const splash = Math.max(0, Math.min(1, (t - WATERING_HIT) / 0.9));
    if (ring.current) {
      ring.current.position.set(plot.x, plot.y + 0.02, plot.z);
      ring.current.scale.setScalar(0.5 + splash * 2.2);
      assets.ringMaterial.opacity = splash > 0 && splash < 1 ? 0.75 * (1 - splash) : 0;
    }
  });

  return (
    <>
      <group ref={facing}>
        <group ref={can} visible={false}>
          <mesh geometry={bodyGeometry} material={tin} />
          <mesh geometry={rimGeometry} material={tinDark} position-y={0.11} />
          <mesh geometry={handleGeometry} material={tinDark} position={[-0.06, 0.1, 0]} rotation-z={0.4} />
          <mesh geometry={spoutGeometry} material={tin} />
          <mesh geometry={roseGeometry} material={brass} />
        </group>
      </group>
      <points geometry={assets.geometry} material={assets.material} frustumCulled={false} renderOrder={6} />
      <mesh ref={ring} geometry={ringGeometry} material={assets.ringMaterial} />
    </>
  );
};
