"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Canvas } from "@react-three/fiber";
import { RotateCcw, RotateCw } from "lucide-react";
import * as THREE from "three";
import {
  createGardenCamera,
  createGardenLayout,
  createPlant,
  getGardenPivot,
  getPlantGrowth,
  totalWaterings,
  projectToFrame,
  rotateAroundPivot,
} from "@/lib/garden-procedural";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import { GardenLights, GardenPlant, surfaceMaterial, waterMaterial } from "./garden-three";
import { NewBeam } from "./garden-highlights";
import { GardenFlower } from "./garden-flower";
import { useGardenZoom } from "./garden-zoom";
import type { IslandPost } from "./island-garden";

const FRAME_ASPECT = 3 / 2;
// A drag across the full width of the frame turns the garden by this much.
const DRAG_TURN = Math.PI * 1.5;
const DRAG_THRESHOLD = 5;
const BUTTON_TURN = Math.PI / 4;


export default function GardenIslandScene({
  posts,
  seed,
}: {
  posts: IslandPost[];
  seed: string;
}) {
  const { zoomMode } = useGardenZoom();
  const frameRef = useRef<HTMLDivElement>(null);
  const [isNearViewport, setIsNearViewport] = useState(false);
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const prefersReducedMotion = usePrefersReducedMotion();
  const [angle, setAngle] = useState(0);
  const angleRef = useRef(0);
  // Where button turns are heading, so quick repeated clicks add up.
  const targetAngle = useRef(0);
  const turnAnimation = useRef<number | null>(null);
  const drag = useRef<{ pointerId: number; startX: number; startAngle: number; isDragging: boolean } | null>(null);
  const suppressClick = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  const sortedPosts = [...posts].sort((a, b) => a._creationTime - b._creationTime);
  const newestPostId = sortedPosts.at(-1)?._id;
  const plantKey = sortedPosts.map((post) => `${post._id}:${post.mood}:${post.reactionCount ?? 0}`).join("|");

  const layout = useMemo(() => createGardenLayout(seed, sortedPosts.length), [seed, sortedPosts.length]);
  // plantKey captures every input to the plant models.
  const plants = useMemo(() => sortedPosts.map((post) => createPlant(post._id, { mood: post.mood, waterings: post.reactionCount, plantedAt: post._creationTime })), [plantKey]);
  const camera = useMemo(() => {
    const frame = createGardenCamera(layout, FRAME_ASPECT);
    // Keep R3F from refitting the frustum on resize; the frame's aspect ratio is fixed in CSS.
    Object.assign(frame, { manual: true });
    return frame;
  }, [layout]);

  useEffect(() => () => {
    layout.island.dispose();
    layout.water?.dispose();
    layout.decor?.dispose();
  }, [layout]);
  useEffect(() => () => {
    for (const plant of plants) plant.geometry.dispose();
  }, [plants]);

  // Only keep a WebGL context alive for gardens near the viewport; browsers cap them at ~16.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new IntersectionObserver(([entry]) => setIsNearViewport(entry.isIntersecting), { rootMargin: "300px 0px" });
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  const pivot = useMemo(() => getGardenPivot(layout), [layout]);

  const applyAngle = (next: number) => {
    angleRef.current = next;
    setAngle(next);
  };
  const setAngleNow = (next: number) => {
    targetAngle.current = next;
    applyAngle(next);
  };

  const stopTurnAnimation = () => {
    if (turnAnimation.current !== null) cancelAnimationFrame(turnAnimation.current);
    turnAnimation.current = null;
  };
  useEffect(() => stopTurnAnimation, []);

  const turnBy = (delta: number) => {
    stopTurnAnimation();
    const from = angleRef.current;
    const to = targetAngle.current + delta;
    targetAngle.current = to;
    if (prefersReducedMotion) return applyAngle(to);
    const startedAt = performance.now();
    const step = (time: number) => {
      const progress = Math.min(1, (time - startedAt) / 420);
      applyAngle(from + (to - from) * (1 - (1 - progress) ** 3));
      turnAnimation.current = progress < 1 ? requestAnimationFrame(step) : null;
    };
    turnAnimation.current = requestAnimationFrame(step);
  };

  // Horizontal drags turn the garden; vertical swipes still scroll the page (touch-action: pan-y).
  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    // A fresh press always starts clean, even if a previous drag never produced a click.
    suppressClick.current = false;
    if (event.button !== 0 || (event.target as HTMLElement).closest("[data-garden-control]")) return;
    stopTurnAnimation();
    targetAngle.current = angleRef.current;
    drag.current = { pointerId: event.pointerId, startX: event.clientX, startAngle: angleRef.current, isDragging: false };
  };
  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - current.startX;
    if (!current.isDragging) {
      if (Math.abs(deltaX) < DRAG_THRESHOLD) return;
      // Capture only once it's clearly a drag, so plain taps still reach the plant buttons.
      current.isDragging = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      setIsDragging(true);
    }
    setAngleNow(current.startAngle + (deltaX / event.currentTarget.clientWidth) * DRAG_TURN);
  };
  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (current.isDragging) suppressClick.current = true;
    drag.current = null;
    setIsDragging(false);
  };

  const { bounds } = layout;
  // Wide enough to cover the island's corners at any rotation.
  const shadowReach = Math.hypot(Math.max(-bounds.min.x, bounds.max.x), Math.max(-bounds.min.z, bounds.max.z)) + 2;
  const stagger = Math.min(0.08, 1.6 / Math.max(1, sortedPosts.length));

  return (
    <div
      ref={frameRef}
      className={`relative isolate mx-auto aspect-[3/2] w-full max-w-3xl touch-pan-y overflow-hidden rounded-2xl select-none ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onClickCapture={(event) => {
        // A drag that ends over a plant shouldn't also open its journal.
        if (!suppressClick.current) return;
        suppressClick.current = false;
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <div className="garden-zoom-scene absolute inset-0" data-zoom={zoomMode}>
        {isNearViewport ? (
          <Canvas
            camera={camera}
            shadows
            flat
            dpr={[1, 2]}
            frameloop={prefersReducedMotion ? "demand" : "always"}
            gl={{ alpha: true, antialias: true }}
            className="pointer-events-none absolute! inset-0"
            fallback={<p className="grid size-full place-items-center text-sm text-muted-foreground">Your browser can't draw the 3D garden.</p>}
          >
            <GardenLights shadowReach={shadowReach} />
            <group position={[pivot.x, 0, pivot.z]} rotation-y={angle}>
            <group position={[-pivot.x, 0, -pivot.z]}>
            <mesh geometry={layout.island} material={surfaceMaterial} receiveShadow />
            {layout.decor ? <mesh geometry={layout.decor} material={surfaceMaterial} castShadow receiveShadow /> : null}
            {layout.water ? <mesh geometry={layout.water} material={waterMaterial} receiveShadow /> : null}
            {plants.map((model, index) => {
              const post = sortedPosts[index];
              return (
                <GardenPlant
                  key={post._id}
                  model={model}
                  plot={layout.plots[index]}
                  growth={getPlantGrowth(post._creationTime, now, totalWaterings(post))}
                  delay={index * stagger}
                  isActive={activePostId === post._id}
                  isHighlighted={activePostId === post._id}
                  animate={!prefersReducedMotion}
                />
              );
            })}
            {/* A journal from the last day still glows with its beam of light. */}
            {newestPostId && now - (sortedPosts.at(-1)?._creationTime ?? 0) < 86_400_000 && layout.plots[sortedPosts.length - 1] ? (
              <NewBeam position={layout.plots[sortedPosts.length - 1]} />
            ) : null}
            </group>
            </group>
          </Canvas>
        ) : null}

        {sortedPosts.map((post, index) => {
          const plot = rotateAroundPivot(new THREE.Vector3(layout.plots[index].x, layout.plots[index].y, layout.plots[index].z), pivot, angle);
          const height = plants[index].height * getPlantGrowth(post._creationTime, now, totalWaterings(post));
          // The hit area follows the plant as the garden turns; its width is the
          // tile's screen width, which doesn't change with rotation.
          const base = projectToFrame(camera, plot.x, plot.y, plot.z);
          const top = projectToFrame(camera, plot.x, plot.y + height, plot.z);
          const left = projectToFrame(camera, plot.x - 0.5, plot.y, plot.z + 0.5);
          const right = projectToFrame(camera, plot.x + 0.5, plot.y, plot.z - 0.5);
          return (
            <GardenFlower
              key={post._id}
              mood={post.mood}
              text={post.body}
              postId={post._id}
              visibility={post.visibility ?? "public"}
              createdAt={new Date(post._creationTime)}
              isNewest={post._id === newestPostId}
              onActiveChange={(isActive) => setActivePostId((current) => isActive ? post._id : current === post._id ? null : current)}
              style={{
                left: `${base.left}%`,
                top: `${top.top}%`,
                width: `${Math.abs(right.left - left.left) * 0.7}%`,
                height: `${Math.max(base.top - top.top, 4)}%`,
                // Plants nearer the camera sit on top so overlapping hit areas match what you see.
                zIndex: Math.round((plot.x + plot.z) * 4) + 500,
              }}
            />
          );
        })}
      </div>

      <div data-garden-control className="absolute right-2 bottom-2 z-[1000] flex gap-1 rounded-full bg-background/70 p-1 shadow-sm backdrop-blur-sm">
        <button
          type="button"
          onClick={() => turnBy(-BUTTON_TURN)}
          aria-label="Rotate garden left"
          title="Rotate garden left"
          className="flex size-7 cursor-pointer items-center justify-center rounded-full text-foreground/80 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
        >
          <RotateCcw className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => turnBy(BUTTON_TURN)}
          aria-label="Rotate garden right"
          title="Rotate garden right"
          className="flex size-7 cursor-pointer items-center justify-center rounded-full text-foreground/80 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
        >
          <RotateCw className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
