"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Atmosphere, AtmosphereLook } from "@/lib/garden-atmosphere";
import type { WorldView } from "@/lib/garden-world";

// Weather and season particles live in a box that follows the camera, so the
// same few hundred particles cover your garden or the whole world.

type ViewRef = RefObject<WorldView>;

const random = (min: number, max: number) => min + Math.random() * (max - min);
const boxOf = (view: WorldView) => ({ half: view.width * 0.62, top: 2.5 + view.width * 0.22 });

// Moves a particle back into the box when it drifts out, so the box can follow the view.
const wrap = (value: number, center: number, half: number) => {
  const offset = value - center;
  if (offset > half) return value - half * 2;
  if (offset < -half) return value + half * 2;
  return value;
};

const Rain = ({ view, heavy }: { view: ViewRef; heavy: boolean }) => {
  const count = heavy ? 260 : 120;
  const { geometry, material, drops } = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 6), 3));
    const material = new THREE.LineBasicMaterial({ color: "#a8c6e6", transparent: true, opacity: 0.55, depthWrite: false });
    const drops = Array.from({ length: count }, () => ({ x: 0, y: 0, z: 0, speed: random(7, 10), placed: false }));
    return { geometry, material, drops };
  }, [count]);
  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  useFrame((_, delta) => {
    const v = view.current;
    const { half, top } = boxOf(v);
    const array = geometry.attributes.position.array as Float32Array;
    drops.forEach((drop, index) => {
      if (!drop.placed) {
        Object.assign(drop, { x: v.x + random(-half, half), y: random(0, top), z: v.z + random(-half, half), placed: true });
      }
      drop.y -= drop.speed * delta;
      if (drop.y < 0) {
        drop.y = top;
        drop.x = v.x + random(-half, half);
        drop.z = v.z + random(-half, half);
      }
      drop.x = wrap(drop.x, v.x, half);
      drop.z = wrap(drop.z, v.z, half);
      array.set([drop.x, drop.y, drop.z, drop.x - 0.05, drop.y + 0.32, drop.z - 0.03], index * 6);
    });
    geometry.attributes.position.needsUpdate = true;
  });

  return <lineSegments geometry={geometry} material={material} frustumCulled={false} renderOrder={5} />;
};

// A soft round dot, so point particles aren't drawn as squares.
let dot: THREE.CanvasTexture | undefined;
export const roundDot = () => {
  if (dot) return dot;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 32;
  const context = canvas.getContext("2d")!;
  const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.6, "rgba(255,255,255,0.85)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 32, 32);
  dot = new THREE.CanvasTexture(canvas);
  return dot;
};

const Snow = ({ view }: { view: ViewRef }) => {
  const count = 180;
  const { geometry, material, flakes } = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    const material = new THREE.PointsMaterial({ color: "#ffffff", size: 5, sizeAttenuation: false, transparent: true, opacity: 0.9, depthWrite: false, map: roundDot() });
    const flakes = Array.from({ length: count }, () => ({ x: 0, y: 0, z: 0, speed: random(0.35, 0.7), phase: random(0, 6.28), placed: false }));
    return { geometry, material, flakes };
  }, []);
  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  useFrame(({ clock }, delta) => {
    const v = view.current;
    const { half, top } = boxOf(v);
    const array = geometry.attributes.position.array as Float32Array;
    flakes.forEach((flake, index) => {
      if (!flake.placed) Object.assign(flake, { x: v.x + random(-half, half), y: random(0, top), z: v.z + random(-half, half), placed: true });
      flake.y -= flake.speed * delta;
      flake.x += Math.sin(clock.elapsedTime * 0.8 + flake.phase) * delta * 0.25;
      if (flake.y < 0) flake.y = top;
      flake.x = wrap(flake.x, v.x, half);
      flake.z = wrap(flake.z, v.z, half);
      array.set([flake.x, flake.y, flake.z], index * 3);
    });
    geometry.attributes.position.needsUpdate = true;
  });

  return <points geometry={geometry} material={material} frustumCulled={false} renderOrder={5} />;
};

// Spring blossom petals or autumn leaves, tumbling down.
const Drifting = ({ view, colors, size }: { view: ViewRef; colors: string[]; size: number }) => {
  const count = 42;
  const mesh = useRef<THREE.InstancedMesh>(null);
  const { geometry, material, bits, dummy } = useMemo(() => {
    const geometry = new THREE.CircleGeometry(size, 5).scale(1, 0.6, 1);
    const material = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
    const bits = Array.from({ length: count }, () => ({
      x: 0, y: 0, z: 0, placed: false,
      speed: random(0.35, 0.65), spin: random(1, 3), phase: random(0, 6.28),
      color: new THREE.Color(colors[Math.floor(Math.random() * colors.length)]),
    }));
    return { geometry, material, bits, dummy: new THREE.Object3D() };
  }, [colors, size]);
  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);
  useEffect(() => {
    bits.forEach((bit, index) => mesh.current?.setColorAt(index, bit.color));
    if (mesh.current?.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  }, [bits]);

  useFrame(({ clock }, delta) => {
    const instanced = mesh.current;
    if (!instanced) return;
    const v = view.current;
    const { half, top } = boxOf(v);
    const time = clock.elapsedTime;
    bits.forEach((bit, index) => {
      if (!bit.placed) Object.assign(bit, { x: v.x + random(-half, half), y: random(0, top), z: v.z + random(-half, half), placed: true });
      bit.y -= bit.speed * delta;
      bit.x += Math.sin(time * 0.9 + bit.phase) * delta * 0.4;
      bit.z += Math.cos(time * 0.7 + bit.phase) * delta * 0.25;
      if (bit.y < 0.02) bit.y = top;
      bit.x = wrap(bit.x, v.x, half);
      bit.z = wrap(bit.z, v.z, half);
      dummy.position.set(bit.x, bit.y, bit.z);
      dummy.rotation.set(time * bit.spin + bit.phase, time * bit.spin * 0.7, bit.phase);
      dummy.updateMatrix();
      instanced.setMatrixAt(index, dummy.matrix);
    });
    instanced.instanceMatrix.needsUpdate = true;
  });

  return <instancedMesh ref={mesh} args={[geometry, material, count]} frustumCulled={false} />;
};

const fireflyVertex = /* glsl */ `
  attribute float aPhase;
  uniform float uTime;
  uniform float uPixelRatio;
  varying float vGlow;
  void main() {
    vec3 p = position;
    p.x += sin(uTime * 0.6 + aPhase * 3.0) * 0.25;
    p.y += sin(uTime * 0.9 + aPhase) * 0.18;
    p.z += cos(uTime * 0.5 + aPhase * 2.0) * 0.25;
    vGlow = 0.35 + 0.65 * pow(max(0.0, sin(uTime * 1.7 + aPhase * 5.0)), 3.0);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = (10.0 + vGlow * 8.0) * uPixelRatio;
  }
`;
const fireflyFragment = /* glsl */ `
  varying float vGlow;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float core = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vec3(1.0, 0.95, 0.55), core * core * vGlow);
  }
`;

// Glowing, blinking specks drifting low over the grass.
export const Fireflies = ({ center, spread, count = 26, still }: { center: { x: number; z: number }; spread: number; count?: number; still: boolean }) => {
  const { geometry, material } = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    for (let index = 0; index < count; index++) {
      positions.set([center.x + random(-spread, spread), random(0.25, 1.3), center.z + random(-spread, spread)], index * 3);
      phases[index] = random(0, 6.28);
    }
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
    const material = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uPixelRatio: { value: Math.min(2, typeof window === "undefined" ? 1 : window.devicePixelRatio) } },
      vertexShader: fireflyVertex,
      fragmentShader: fireflyFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { geometry, material };
  }, [center.x, center.z, spread, count]);
  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);
  useFrame(({ clock }) => {
    material.uniforms.uTime.value = still ? 1 : clock.elapsedTime;
  });
  return <points geometry={geometry} material={material} frustumCulled={false} renderOrder={6} />;
};

const wingGeometry = new THREE.CircleGeometry(0.09, 6).scale(1, 1.3, 1).translate(0.09, 0, 0);

const Butterfly = ({ view, color, seed }: { view: ViewRef; color: string; seed: number }) => {
  const group = useRef<THREE.Group>(null);
  const left = useRef<THREE.Mesh>(null);
  const right = useRef<THREE.Mesh>(null);
  const material = useMemo(() => new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }), [color]);
  useEffect(() => () => material.dispose(), [material]);

  useFrame(({ clock }) => {
    const v = view.current;
    const t = clock.elapsedTime * 0.35 + seed * 10;
    const radius = Math.min(v.width * 0.3, 3.5);
    // A wandering figure-of-eight around the middle of the view.
    const x = v.x + Math.sin(t + seed) * radius;
    const z = v.z + Math.sin(t * 2 + seed * 2) * radius * 0.5;
    const y = 0.9 + Math.sin(t * 3 + seed) * 0.3;
    const g = group.current;
    if (!g) return;
    const heading = Math.atan2(Math.cos(t + seed), Math.cos(t * 2 + seed * 2));
    g.position.set(x, y, z);
    g.rotation.y = heading;
    const flap = Math.sin(clock.elapsedTime * 18 + seed * 4) * 1.1;
    if (left.current) left.current.rotation.y = flap;
    if (right.current) right.current.rotation.y = Math.PI - flap;
  });

  return (
    <group ref={group}>
      <mesh ref={left} geometry={wingGeometry} material={material} rotation-x={-Math.PI / 2} />
      <mesh ref={right} geometry={wingGeometry} material={material} rotation-x={-Math.PI / 2} />
    </group>
  );
};

const butterflyColors = ["#ffd166", "#f78fb3", "#8ecae6", "#ffffff", "#f4a261"];

export const WeatherEffects = ({ atmosphere, view, still }: { atmosphere: Atmosphere; view: ViewRef; still: boolean }) => {
  const { weather, season, dayPart } = atmosphere;
  const leafColors = useMemo(() => ["#e07a2f", "#c8452c", "#e9b23f", "#a3542a"], []);
  const blossomColors = useMemo(() => ["#ffd1dc", "#ffb7c8", "#fff0f4"], []);
  // Reduced motion: no falling or flying particles.
  if (still) return null;
  return (
    <>
      {weather === "rain" && season !== "winter" ? <Rain view={view} heavy /> : null}
      {season === "winter" && (weather === "rain" || weather === "cloudy" || dayPart === "night") ? <Snow view={view} /> : null}
      {season === "autumn" && weather !== "rain" ? <Drifting view={view} colors={leafColors} size={0.07} /> : null}
      {season === "spring" && weather !== "rain" ? <Drifting view={view} colors={blossomColors} size={0.05} /> : null}
      {weather === "sunny" && (dayPart === "day" || dayPart === "dawn")
        ? butterflyColors.slice(0, 4).map((color, index) => <Butterfly key={color} view={view} color={color} seed={index * 1.7 + 0.3} />)
        : null}
    </>
  );
};

// Light colours and strengths ease toward the atmosphere's look.
export const useAtmosphereLights = (
  look: AtmosphereLook,
  hemisphere: RefObject<THREE.HemisphereLight | null>,
  sun: RefObject<THREE.DirectionalLight | null>
) => {
  const targets = useMemo(
    () => ({
      sky: new THREE.Color(look.hemisphere.sky),
      ground: new THREE.Color(look.hemisphere.ground),
      sun: new THREE.Color(look.sun.color),
    }),
    [look]
  );
  useFrame((_, delta) => {
    const ease = Math.min(1, delta * 2);
    const h = hemisphere.current;
    if (h) {
      h.color.lerp(targets.sky, ease);
      h.groundColor.lerp(targets.ground, ease);
      h.intensity += (look.hemisphere.intensity - h.intensity) * ease;
    }
    const s = sun.current;
    if (s) {
      s.color.lerp(targets.sun, ease);
      s.intensity += (look.sun.intensity - s.intensity) * ease;
    }
  });
};
