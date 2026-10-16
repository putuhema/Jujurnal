"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { GardenPlot, PlantModel } from "@/lib/garden-procedural";
import { createPlantMaterial, plantTime } from "@/lib/plant-material";

// Shared by the garden and the plant lab so both render plants identically.

export const surfaceMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
export const waterMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.82 });
const highlightGeometry = new THREE.RingGeometry(0.5, 0.62, 4, 1, Math.PI / 4).rotateX(-Math.PI / 2);
const highlightMaterial = new THREE.MeshBasicMaterial({ color: "#ffe397", transparent: true, opacity: 0.95, depthWrite: false });

export const GardenLights = ({ shadowReach }: { shadowReach: number }) => (
  <>
    <hemisphereLight args={["#fff4dc", "#5d7a4c", 1.5]} />
    <directionalLight
      position={[-4, 10, 6]}
      intensity={2.1}
    castShadow
      shadow-mapSize={[2048, 2048]}
      shadow-bias={-0.0004}
      shadow-normalBias={0.02}
      shadow-camera-left={-shadowReach}
      shadow-camera-right={shadowReach}
      shadow-camera-top={shadowReach}
      shadow-camera-bottom={-shadowReach}
      shadow-camera-far={40}
    />
  </>
);

const easeOutCubic = (value: number) => 1 - (1 - value) ** 3;

export const GardenPlant = ({
  model,
  plot,
  growth,
  delay = 0,
  isActive = false,
  isHighlighted = false,
  animate,
  shown = true,
  gray,
  waterPulse = 0,
}: {
  model: PlantModel;
  plot: GardenPlot;
  growth: number;
  delay?: number;
  isActive?: boolean;
  isHighlighted?: boolean;
  animate: boolean;
  // Grows in when it becomes true and shrinks back into the ground when false.
  shown?: boolean;
  // Grayscale amount, read every frame so it can be animated without re-rendering.
  gray?: { current: number };
  // Bump to play the watered sheen.
  waterPulse?: number;
}) => {
  const plantRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const mountedAt = useRef<number | null>(null);
  const progress = useRef(animate ? 0 : 1);
  // Starts at 0 so a plant mounted with a pulse (a fresh watering) plays it straight away.
  const lastPulse = useRef(0);
  const { material, depthMaterial, uniforms } = useMemo(
    () => createPlantMaterial({ height: model.height, phase: model.swayPhase, vitality: model.vitality }),
    [model]
  );
  useEffect(() => () => {
    material.dispose();
    depthMaterial.dispose();
  }, [material, depthMaterial]);

  useFrame(({ clock }, delta) => {
    const plant = plantRef.current;
    if (!plant) return;
    const time = clock.elapsedTime;
    mountedAt.current ??= time;
    uniforms.uGray.value = gray?.current ?? 0;
    if (lastPulse.current !== waterPulse) {
      lastPulse.current = waterPulse;
      uniforms.uWater.value = 1;
    }
    uniforms.uWater.value = Math.max(0, uniforms.uWater.value - delta * 0.45);

    if (!animate) {
      progress.current = shown ? 1 : 0;
      uniforms.uReveal.value = progress.current;
      uniforms.uHover.value = isActive ? 1 : 0;
      plant.visible = shown;
      return;
    }
    plantTime.value = time;
    // Grow in from the ground up (after any delay), or sink back faster when hidden.
    const target = shown && time - mountedAt.current >= delay ? 1 : 0;
    const step = target > progress.current ? delta / 1.1 : -delta / 0.45;
    progress.current = Math.min(1, Math.max(0, progress.current + step));
    const eased = easeOutCubic(progress.current);
    uniforms.uReveal.value = eased;
    uniforms.uHover.value += ((isActive ? 1 : 0) - uniforms.uHover.value) * Math.min(1, delta * 10);
    plant.visible = progress.current > 0;
    plant.scale.setScalar(growth * (0.88 + 0.12 * eased) * (1 + uniforms.uHover.value * 0.06));
    plant.rotation.z = model.lean + Math.sin(time * model.swaySpeed * 0.6 + model.swayPhase) * 0.015;
    // The shadow pass doesn't know about the reveal, so only cast once fully grown.
    if (meshRef.current) meshRef.current.castShadow = progress.current >= 1;
  });

  return (
    <group position={[plot.x, plot.y, plot.z]}>
      {isHighlighted && shown ? <mesh geometry={highlightGeometry} material={highlightMaterial} position-y={0.012} /> : null}
      <group
        ref={plantRef}
        rotation-z={model.lean}
        scale={animate ? 0 : growth * (isActive ? 1.06 : 1)}
        visible={!animate && shown}
      >
        {/* Plants cast shadows but don't receive them: thin two-sided petals shadowing
            themselves shimmer as they sway. */}
        <mesh ref={meshRef} geometry={model.geometry} material={material} customDepthMaterial={depthMaterial} castShadow={!animate} />
      </group>
    </group>
  );
};
