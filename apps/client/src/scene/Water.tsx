// Simple procedural sea: one plane, flat blue that lightens toward the coast, with soft wave
// crests that roll in and break as foam on the shore. No images. The coast distance is a
// signed-distance field over the land hexes, so the waves follow the island's outline.
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { useMemo, useRef } from "react";
import { Color, RepeatWrapping, type ShaderMaterial, SRGBColorSpace, Vector2 } from "three";
import type { XZ } from "./layout.ts";
import { useReducedMotion } from "./motion.ts";

export const WATER_DEEP = "#14587f";
export const WATER_SHALLOW = "#4dbdc6";
export const WATER_FOAM = "#f4fbf8";
export const WATER_SKY = "#b9dcea";
/** Most land hexes the shader handles (the base game has 19). */
export const MAX_LAND = 19;

const vertex = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const fragment = /* glsl */ `
uniform vec2 uLand[${MAX_LAND}];
uniform int uCount;
uniform float uTime;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uFoam;
uniform vec3 uSky;
uniform sampler2D uSand;
varying vec3 vWorld;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
             mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + 11.7; a *= 0.5; }
  return v;
}

// Pointy-top hex (corner toward +Z), circumradius 1: distance to its outline.
float hexSdf(vec2 p) {
  float d = -1e3;
  for (int k = 0; k < 3; k++) {
    float t = radians(30.0 + 60.0 * float(k));
    d = max(d, abs(dot(p, vec2(sin(t), cos(t)))) - 0.8660254);
  }
  return d;
}

// Sum of travelling sines: height gradient (xz) of the open-water swell.
vec2 swellGrad(vec2 p, float t) {
  vec2 g = vec2(0.0);
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float ang = 0.7 + fi * 1.45;
    vec2 dir = vec2(cos(ang), sin(ang));
    float k = 1.1 + fi * 0.7;
    float amp = 0.020 / (1.0 + fi * 0.8);
    g += dir * k * amp * cos(dot(p + 0.8 * vec2(noise(p * 0.7), noise(p * 0.7 + 9.0)), dir) * k + t * (0.6 + fi * 0.25));
  }
  return g;
}

void main() {
  vec2 p = vWorld.xz;
  float d = 1e3;
  for (int i = 0; i < ${MAX_LAND}; i++) {
    if (i >= uCount) break;
    d = min(d, hexSdf(p - uLand[i]));
  }
  // Break up the regular outline so waves and foam look hand-made, not offset curves.
  float dd = d + (fbm(p * 1.1 + uTime * 0.03) - 0.5) * 0.45;

  // Depth tint: turquoise shallows near the coast, deep blue offshore.
  float depth = smoothstep(0.05, 3.6, d);
  vec3 base = mix(uShallow, uDeep, pow(depth, 0.7));

  // Lit surface: swell normal, sun glint, sky reflection by Fresnel.
  vec2 g = swellGrad(p, uTime) + (vec2(noise(p * 6.0 + uTime * 0.2), noise(p * 6.0 - uTime * 0.17)) - 0.5) * 0.02;
  vec3 N = normalize(vec3(-g.x, 1.0, -g.y));
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 L = normalize(vec3(0.5, 0.75, 0.4));
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  vec3 col = base * (0.82 + 0.28 * max(dot(N, L), 0.0));
  col = mix(col, uSky, fres * 0.55);
  float spec = pow(max(dot(reflect(-L, N), V), 0.0), 220.0);
  col += vec3(1.0, 0.97, 0.88) * spec * 0.9;

  // Beach: sandy shallows around the island, the waterline breathing in and out with the swell.
  float tide = 0.5 + 0.12 * sin(uTime * 0.7 + p.x * 1.5 + p.y * 1.1);
  float sandMix = (1.0 - smoothstep(0.0, tide, dd)) * 0.9;
  vec3 sand = texture2D(uSand, p * 0.55).rgb;
  col = mix(col, sand * (0.9 + 0.2 * max(dot(N, L), 0.0)), sandMix);

  // Wet-sand shadow and surf: waves break toward the coast, foam trails behind each front.
  col *= 1.0 - 0.28 * exp(-max(d, 0.0) * 5.0);
  float s = fract(dd * 0.85 + uTime * 0.11);
  float front = smoothstep(0.0, 0.16, s) * (1.0 - smoothstep(0.16, 0.5, s));
  float lace = smoothstep(0.42, 0.74, fbm(p * 5.5 + vec2(uTime * 0.12, -uTime * 0.09)));
  float reach = (1.0 - smoothstep(0.35, 3.4, d)) * smoothstep(0.03, 0.3, d);
  col = mix(col, uFoam, clamp(front * (0.1 + 0.9 * lace) * reach, 0.0, 0.85));

  float swash = 0.18 + 0.1 * sin(uTime * 0.9 + p.x * 1.7 + p.y * 1.3);
  float shore = (1.0 - smoothstep(0.0, swash, d)) * (0.55 + 0.45 * lace);
  col = mix(col, uFoam, clamp(shore, 0.0, 0.95));

  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function Water({ land, y }: { land: readonly XZ[]; y: number }) {
  const reduced = useReducedMotion();
  const mat = useRef<ShaderMaterial>(null);
  const sand = useTexture("/textures/sand.webp");
  sand.wrapS = sand.wrapT = RepeatWrapping;
  sand.colorSpace = SRGBColorSpace;
  const uniforms = useMemo(
    () => ({
      uLand: { value: [] as Vector2[] },
      uCount: { value: 0 },
      uTime: { value: 0 },
      uDeep: { value: new Color(WATER_DEEP) },
      uShallow: { value: new Color(WATER_SHALLOW) },
      uFoam: { value: new Color(WATER_FOAM) },
      uSky: { value: new Color(WATER_SKY) },
      uSand: { value: sand },
    }),
    [sand],
  );
  // The array uniform needs exactly MAX_LAND entries.
  uniforms.uLand.value = Array.from(
    { length: MAX_LAND },
    (_, i) => new Vector2(land[i]?.[0] ?? 0, land[i]?.[1] ?? 0),
  );
  uniforms.uCount.value = Math.min(land.length, MAX_LAND);
  useFrame(({ clock }) => {
    // Reduced motion: a still sea (crests frozen mid-way), never an animation.
    uniforms.uTime.value = reduced ? 1.2 : clock.elapsedTime;
  });
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]}>
      <planeGeometry args={[200, 200]} />
      <shaderMaterial
        ref={mat}
        uniforms={uniforms}
        vertexShader={vertex}
        fragmentShader={fragment}
        toneMapped={false}
      />
    </mesh>
  );
}
