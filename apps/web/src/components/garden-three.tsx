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
}: {
  model: PlantModel;
  plot: GardenPlot;
  growth: number;
  delay?: number;
  isActive?: boolean;
  isHighlighted?: boolean;
  animate: boolean;
}) => {
  const plantRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const startedAt = useRef<number | null>(null);
  const { material, uniforms } = useMemo(
    () => createPlantMaterial({ height: model.height, phase: model.swayPhase, vitality: model.vitality }),
    [model]
  );
  useEffect(() => () => material.dispose(), [material]);

  useFrame(({ clock }, delta) => {
    const plant = plantRef.current;
    if (!plant) return;
    if (!animate) {
      uniforms.uReveal.value = 1;
      uniforms.uHover.value = isActive ? 1 : 0;
      return;
    }
    const time = clock.elapsedTime;
    plantTime.value = time;
    startedAt.current ??= time;
    // Grow in from the ground up, then settle to the plant's size.
    const progress = Math.min(1, Math.max(0, (time - startedAt.current - delay) / 1.1));
    uniforms.uReveal.value = easeOutCubic(progress);
    uniforms.uHover.value += ((isActive ? 1 : 0) - uniforms.uHover.value) * Math.min(1, delta * 10);
    plant.visible = progress > 0;
    plant.scale.setScalar(growth * (0.88 + 0.12 * easeOutCubic(progress)) * (1 + uniforms.uHover.value * 0.06));
    plant.rotation.z = model.lean + Math.sin(time * model.swaySpeed * 0.6 + model.swayPhase) * 0.015;
    // The shadow pass doesn't know about the reveal, so only cast once fully grown.
    if (meshRef.current) meshRef.current.castShadow = progress >= 1;
  });

  return (
    <group position={[plot.x, plot.y, plot.z]}>
      {isHighlighted ? <mesh geometry={highlightGeometry} material={highlightMaterial} position-y={0.012} /> : null}
      <group
        ref={plantRef}
        rotation-z={model.lean}
        scale={animate ? 0 : growth * (isActive ? 1.06 : 1)}
        visible={!animate}
      >
        <mesh ref={meshRef} geometry={model.geometry} material={material} castShadow={!animate} receiveShadow />
      </group>
    </group>
  );
};
