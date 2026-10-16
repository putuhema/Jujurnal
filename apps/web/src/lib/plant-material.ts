import * as THREE from "three";

// Shader for the plants only. It extends the built-in Lambert material, so
// plants keep the scene's lighting and shadows and gain:
// - wind: tips bend and petals flutter, more the higher up the plant
// - rim light and a soft glow toward sunlit tips, stronger on happier plants
// - grow-in: the plant is revealed from the ground up behind a glowing edge
// - hover: a gentle lift in brightness and rim

// One clock shared by every plant material.
export const plantTime = { value: 0 };

export type PlantUniforms = {
  uHeight: { value: number };
  uPhase: { value: number };
  uVitality: { value: number };
  uReveal: { value: number };
  uHover: { value: number };
};

const vertexPars = /* glsl */ `
  uniform float uTime;
  uniform float uHeight;
  uniform float uPhase;
  varying float vHeight;
`;

const vertexWind = /* glsl */ `
  #include <begin_vertex>
  vHeight = clamp(position.y / max(uHeight, 0.001), 0.0, 1.0);
  float bend = vHeight * vHeight;
  float gust = sin(uTime * 0.9 + uPhase) * 0.035 + sin(uTime * 2.1 + uPhase * 1.7) * 0.012;
  float flutter = sin(uTime * 3.1 + uPhase + position.x * 11.0 + position.z * 9.0) * 0.01;
  transformed.x += (gust + flutter) * bend * uHeight;
  transformed.z += (sin(uTime * 1.3 + uPhase * 0.7) * 0.02 + flutter) * bend * uHeight;
`;

const fragmentPars = /* glsl */ `
  uniform float uVitality;
  uniform float uReveal;
  uniform float uHover;
  varying float vHeight;
`;

const fragmentReveal = /* glsl */ `
  #include <clipping_planes_fragment>
  if (vHeight > uReveal + 0.002) discard;
`;

const fragmentGlow = /* glsl */ `
  vec3 viewDirection = normalize(vViewPosition);
  float facing = abs(dot(normalize(normal), viewDirection));
  float fresnel = pow(1.0 - facing, 2.2);
  float life = 0.35 + 0.65 * uVitality;

  // Rim light tinted by the plant's own colour, plus warmth toward the tips.
  vec3 rimColor = mix(vec3(1.0, 0.96, 0.84), diffuseColor.rgb * 1.8 + 0.15, 0.45);
  outgoingLight += rimColor * fresnel * (0.22 + 0.3 * life + 0.45 * uHover);
  outgoingLight += diffuseColor.rgb * vHeight * vHeight * 0.22 * life;

  // Glowing growth front while the plant is being revealed.
  float front = smoothstep(0.07, 0.0, uReveal - vHeight) * (1.0 - step(0.999, uReveal));
  outgoingLight += vec3(1.0, 0.88, 0.5) * front * 2.0;

  outgoingLight *= 1.0 + uHover * 0.12;
  #include <opaque_fragment>
`;

const extendShader: THREE.Material["onBeforeCompile"] = function (this: THREE.Material & { userData: { plantUniforms: PlantUniforms } }, shader) {
  Object.assign(shader.uniforms, this.userData.plantUniforms, { uTime: plantTime });
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", `#include <common>\n${vertexPars}`)
    .replace("#include <begin_vertex>", vertexWind);
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", `#include <common>\n${fragmentPars}`)
    .replace("#include <clipping_planes_fragment>", fragmentReveal)
    .replace("#include <opaque_fragment>", fragmentGlow);
};

export const createPlantMaterial = ({ height, phase, vitality }: { height: number; phase: number; vitality: number }) => {
  const uniforms: PlantUniforms = {
    uHeight: { value: height },
    uPhase: { value: phase },
    uVitality: { value: vitality },
    uReveal: { value: 1 },
    uHover: { value: 0 },
  };
  // Petals and leaves are single surfaces, so draw both faces.
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  material.userData.plantUniforms = uniforms;
  material.onBeforeCompile = extendShader;
  // Every plant shares one compiled program; only the uniforms differ.
  material.customProgramCacheKey = () => "jujurnal-plant";
  return { material, uniforms };
};
