import * as THREE from "three";

// Materials for the world view. Shared uniforms let every piece dissolve
// smoothly at the edge of the render distance (a dithered fade, so no
// transparency sorting), and gardens that aren't yours render in grayscale.

export const worldUniforms = {
  uFocus: { value: new THREE.Vector2() },
  // Ground distance from the focus where pieces start and finish dissolving.
  uFade: { value: new THREE.Vector2(1000, 1001) },
};

const vertexPars = /* glsl */ `
  varying vec2 vWorldXZ;
`;

const vertexWorld = /* glsl */ `
  #include <project_vertex>
  vWorldXZ = (modelMatrix * vec4(transformed, 1.0)).xz;
`;

const fragmentPars = /* glsl */ `
  uniform vec2 uFocus;
  uniform vec2 uFade;
  varying vec2 vWorldXZ;
  #ifdef WORLD_GRAY_UNIFORM
    uniform float uGrayMix;
  #endif
`;

const fragmentFade = /* glsl */ `
  #include <clipping_planes_fragment>
  float worldFade = smoothstep(uFade.x, uFade.y, distance(vWorldXZ, uFocus));
  // Interleaved gradient noise: a stable screen-space dither for the dissolve.
  float worldDither = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  if (worldFade > worldDither) discard;
`;

const fragmentGray = /* glsl */ `
  #ifdef WORLD_GRAY
    float worldLuma = dot(outgoingLight, vec3(0.299, 0.587, 0.114));
    outgoingLight = mix(outgoingLight, vec3(worldLuma) * vec3(1.0, 0.985, 0.96), WORLD_GRAY);
  #endif
  #ifdef WORLD_GRAY_UNIFORM
    float worldLumaMix = dot(outgoingLight, vec3(0.299, 0.587, 0.114));
    outgoingLight = mix(outgoingLight, vec3(worldLumaMix) * vec3(1.0, 0.985, 0.96), uGrayMix * 0.92);
  #endif
  #include <opaque_fragment>
`;

export const createWorldMaterial = ({
  gray,
  doubleSide = false,
  opacity = 1,
  grayMix,
}: {
  gray: boolean;
  doubleSide?: boolean;
  opacity?: number;
  // An animatable gray amount (0 colour, 1 gray) instead of a fixed one.
  grayMix?: { value: number };
}) => {
  const material = new THREE.MeshLambertMaterial({
    vertexColors: true,
    side: doubleSide ? THREE.DoubleSide : THREE.FrontSide,
    transparent: opacity < 1,
    opacity,
  });
  if (gray) material.defines = { WORLD_GRAY: "0.92" };
  if (grayMix) material.defines = { WORLD_GRAY_UNIFORM: "" };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, worldUniforms, grayMix ? { uGrayMix: grayMix } : {});
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${vertexPars}`)
      .replace("#include <project_vertex>", vertexWorld);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${fragmentPars}`)
      .replace("#include <clipping_planes_fragment>", fragmentFade)
      .replace("#include <opaque_fragment>", fragmentGray);
  };
  material.customProgramCacheKey = () => `jujurnal-world-${grayMix ? "mix" : gray}`;
  return material;
};

export const worldMaterials = {
  ground: createWorldMaterial({ gray: false }),
  groundGray: createWorldMaterial({ gray: true }),
  water: createWorldMaterial({ gray: false, opacity: 0.82 }),
  waterGray: createWorldMaterial({ gray: true, opacity: 0.82 }),
  plants: createWorldMaterial({ gray: false, doubleSide: true }),
  plantsGray: createWorldMaterial({ gray: true, doubleSide: true }),
};
