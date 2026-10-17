"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { plantTime } from "@/lib/plant-material";
import { roundDot } from "./garden-weather";

// Soft, light-based ways to point at a plant: a glow on the ground for the one
// you're looking at, a beam for a journal you haven't opened yet, and a burst
// of petals when a new one blooms.

// ---------------------------------------------------------------------------
// Ground glow: a warm pool of light with a slowly breathing ring.

const glowGeometry = new THREE.CircleGeometry(0.75, 48).rotateX(-Math.PI / 2);
const glowMaterial = new THREE.ShaderMaterial({
  uniforms: { uTime: plantTime, uColor: { value: new THREE.Color("#ffe6a3") } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform float uTime;
    uniform vec3 uColor;
    varying vec2 vUv;
    void main() {
      float d = length(vUv - 0.5) * 2.0;
      float pool = pow(smoothstep(1.0, 0.0, d), 2.2) * 0.55;
      float radius = 0.62 + 0.06 * sin(uTime * 2.2);
      float ring = smoothstep(0.07, 0.0, abs(d - radius)) * 0.45;
      gl_FragColor = vec4(uColor, (pool + ring) * smoothstep(1.0, 0.85, d));
    }
  `,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});

export const GroundGlow = ({ y = 0.014 }: { y?: number }) => (
  <mesh geometry={glowGeometry} material={glowMaterial} position-y={y} renderOrder={2} />
);

// ---------------------------------------------------------------------------
// New-journal beam: a column of light with motes drifting up through it.
// Readable from the whole world view, so you can always find what's new.

const beamGeometry = new THREE.CylinderGeometry(0.2, 0.34, 2.6, 28, 1, true).translate(0, 1.3, 0);
const beamMaterial = new THREE.ShaderMaterial({
  uniforms: { uTime: plantTime, uColor: { value: new THREE.Color("#fff1c4") } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform float uTime;
    uniform vec3 uColor;
    varying vec2 vUv;
    void main() {
      // Bright at the ground, fading toward the top, with soft shimmering streaks.
      float fade = pow(1.0 - vUv.y, 1.8);
      float streaks = 0.75 + 0.25 * sin(vUv.x * 40.0 + uTime * 1.5) * sin(vUv.y * 6.0 - uTime * 2.0);
      float pulse = 0.85 + 0.15 * sin(uTime * 1.8);
      gl_FragColor = vec4(uColor, fade * streaks * pulse * 0.32);
    }
  `,
  transparent: true,
  depthWrite: false,
  side: THREE.DoubleSide,
  blending: THREE.AdditiveBlending,
});

const MOTES = 14;
const moteGeometry = (() => {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(MOTES * 3);
  const phases = new Float32Array(MOTES);
  for (let index = 0; index < MOTES; index++) {
    const angle = (index / MOTES) * Math.PI * 2;
    positions.set([Math.cos(angle) * 0.22, 0, Math.sin(angle) * 0.22], index * 3);
    phases[index] = index / MOTES;
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
  return geometry;
})();
const moteMaterial = new THREE.ShaderMaterial({
  uniforms: { uTime: plantTime, uPixelRatio: { value: 1 } },
  vertexShader: /* glsl */ `
    attribute float aPhase;
    uniform float uTime;
    uniform float uPixelRatio;
    varying float vAlpha;
    void main() {
      // Each mote rises from the ground to the top of the beam, then starts again.
      float t = fract(uTime * 0.22 + aPhase);
      vec3 p = position;
      p.y = t * 2.2;
      p.xz *= 1.0 + sin(uTime + aPhase * 12.0) * 0.35;
      vAlpha = sin(t * 3.14159);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      gl_PointSize = 7.0 * uPixelRatio;
    }
  `,
  fragmentShader: /* glsl */ `
    varying float vAlpha;
    void main() {
      float d = length(gl_PointCoord - 0.5);
      gl_FragColor = vec4(1.0, 0.96, 0.78, smoothstep(0.5, 0.0, d) * vAlpha);
    }
  `,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});

export const NewBeam = ({ position }: { position: { x: number; y: number; z: number } }) => {
  const group = useRef<THREE.Group>(null);
  const shownAt = useRef<number | null>(null);
  useEffect(() => {
    moteMaterial.uniforms.uPixelRatio.value = Math.min(2, window.devicePixelRatio);
  }, []);
  // Rises out of the ground rather than popping in.
  useFrame(({ clock }) => {
    shownAt.current ??= clock.elapsedTime;
    const grow = Math.min(1, (clock.elapsedTime - shownAt.current) / 0.8);
    group.current?.scale.set(1, 1 - (1 - grow) ** 3, 1);
  });
  return (
    <group ref={group} position={[position.x, position.y, position.z]}>
      <mesh geometry={beamGeometry} material={beamMaterial} renderOrder={3} />
      <points geometry={moteGeometry} material={moteMaterial} renderOrder={4} frustumCulled={false} />
      <GroundGlow />
    </group>
  );
};

// ---------------------------------------------------------------------------
// Bloom burst: petals in the flower's colours fly out and drift down.

const BURST = 28;

export const BloomBurst = ({ position, colors, delay = 0 }: { position: { x: number; y: number; z: number }; colors: string[]; delay?: number }) => {
  const startedAt = useRef<number | null>(null);
  const { geometry, material, particles } = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(BURST * 3), 3));
    const colorArray = new Float32Array(BURST * 3);
    const particles = Array.from({ length: BURST }, (_, index) => {
      const color = new THREE.Color(colors[index % colors.length]);
      colorArray.set([color.r, color.g, color.b], index * 3);
      const angle = (index / BURST) * Math.PI * 2 + Math.random() * 0.4;
      const speed = 0.9 + Math.random() * 0.9;
      return { vx: Math.cos(angle) * speed, vy: 1.4 + Math.random() * 1.4, vz: Math.sin(angle) * speed };
    });
    geometry.setAttribute("color", new THREE.BufferAttribute(colorArray, 3));
    const material = new THREE.PointsMaterial({ size: 9, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false, map: roundDot() });
    return { geometry, material, particles };
  }, [colors]);
  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  useFrame(({ clock }) => {
    startedAt.current ??= clock.elapsedTime;
    const t = clock.elapsedTime - startedAt.current - delay;
    const array = geometry.attributes.position.array as Float32Array;
    particles.forEach((particle, index) => {
      const time = Math.max(0, t);
      // Thrown up and out, then slowed by the air as they fall.
      const drag = 1 - Math.exp(-time * 2.2);
      array[index * 3] = position.x + (particle.vx * drag) / 2.2;
      array[index * 3 + 1] = position.y + 0.5 + (particle.vy * drag) / 2.2 - time * time * 0.45;
      array[index * 3 + 2] = position.z + (particle.vz * drag) / 2.2;
    });
    geometry.attributes.position.needsUpdate = true;
    material.opacity = t < 0 ? 0 : Math.max(0, 1 - t / 1.8);
  });

  return <points geometry={geometry} material={material} frustumCulled={false} renderOrder={5} />;
};
