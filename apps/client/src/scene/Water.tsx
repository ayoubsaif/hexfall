// Sea and coast, built the cheap way: the island never moves, so its shore distance is baked once
// into a small texture (coastField.ts) and every pixel just reads it. Everything is driven by that
// one field, like a heightmap: a gradient ramp gives sand, turquoise shallows and deep blue; crisp
// white contour lines of the same field make the shoreline and the waves that roll toward it;
// soft lace foam, caustic light and a wet-sand band add the softer look. A tiling noise texture
// (the theme's caustics image) breaks the lines up; with no texture, hash noise stands in. The
// sand texture is optional too: nothing here needs an asset file.
import type { Topology } from "@hexfall/engine/geometry";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { Color, type DataTexture, type ShaderMaterial, Texture } from "three";
import { resolveWaterUrls, useTheme } from "../theme/index.ts";
import { FIELD_HALF, coastFieldTexture } from "./coastField.ts";
import type { XZ } from "./layout.ts";
import { useReducedMotion } from "./motion.ts";
import { loadWaterTextures, waterTime, syncWaterUniforms } from "./waterTextures.ts";

import { usePrefsStore } from "../store/prefs.ts";
import { SEA } from "./graphicsQuality.ts";
import { visibleSeaHalf } from "./seaBounds.ts";
import { CoastTerrain } from "./CoastTerrain.tsx";
import { coastScatter, propsAsRocks } from "./coastScatter.ts";
import { SEA_ORDER } from "./hullMask.ts";
import { supportsWaterSimulation, WaterSimulation } from "./waterSimulation.ts";
import { realisticVertex, realisticFragment } from "./realisticWater.ts";

export const WATER_DEEP = "#12547d";
export const WATER_MID = "#2a9fc2";
export const WATER_SHALLOW = "#59d8cf";
export const WATER_FOAM = "#f6fcf9";
export const WATER_SKY = "#bfe3ee";

const vertex = /* glsl */ `
uniform float uSeaHalf;
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position.xy * uSeaHalf / 100.0, position.z, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const fragment = /* glsl */ `
#define HALF ${FIELD_HALF.toFixed(1)}
uniform sampler2D uField;
uniform sampler2D uNoise;
uniform sampler2D uSand;
uniform float uTime;
uniform float uHasNoise;
uniform float uHasSand;
uniform float uLow;
uniform vec3 uDeep;
uniform vec3 uMid;
uniform vec3 uShallow;
uniform vec3 uFoam;
uniform vec3 uSky;
varying vec3 vWorld;

// Fallback noise, used only while the noise texture is missing or loading.
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
             mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
// One tiling noise sample in 0..1: the texture, or hash noise at a similar scale.
float nz(vec2 q) {
  return uHasNoise > 0.5 ? texture2D(uNoise, q).r : vnoise(q * 7.0);
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
    g += dir * k * amp * cos(dot(p, dir) * k + t * (0.6 + fi * 0.25));
  }
  return g;
}

// Beach sand: the theme texture, or procedural warm sand, graded toward natural tan.
vec3 sandAt(vec2 q) {
  vec3 c = uHasSand > 0.5
    ? texture2D(uSand, q).rgb
    : mix(vec3(0.93, 0.8, 0.54), vec3(0.99, 0.9, 0.67), vnoise(q * 9.0));
  return c * vec3(0.8, 0.74, 0.66);
}

void main() {
  vec2 p = vWorld.xz;
  float t = uTime;
  // The baked field: shore distance, depth distance and wave phase offset.
  vec4 F = texture2D(uField, p / (2.0 * HALF) + 0.5);
  float dd = F.r;
  float dz = F.g;
  float ph = F.b;

  vec3 V = normalize(cameraPosition - vWorld);
  vec3 L = normalize(vec3(0.5, 0.75, 0.4));

  // Gradient ramp by depth: luminous turquoise shallows, mid blue, deep blue offshore.
  vec3 base = mix(uShallow, uMid, smoothstep(0.25, 1.9, dz));
  base = mix(base, uDeep, smoothstep(1.7, 4.2, dz));
  float shallowK = 1.0 - smoothstep(0.2, 2.2, dz);
  // Slow painted patches in the water colour.
  base *= 0.93 + 0.14 * nz(p * 0.11 + vec2(t * 0.004, -t * 0.003));

  // Lit surface: swell normal, sun glint, sky reflection by Fresnel.
  vec2 g = swellGrad(p, t);
  if (uLow < 0.5) {
    g += (vec2(nz(p * 1.9 + t * 0.03), nz(p * 1.9 + 7.7 - t * 0.025)) - 0.5) * 0.03;
  }
  vec3 N = normalize(vec3(-g.x, 1.0, -g.y));
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  vec3 col = base * (0.84 + 0.26 * max(dot(N, L), 0.0));
  col = mix(col, uSky, fres * 0.5);
  float spec = pow(max(dot(reflect(-L, N), V), 0.0), 220.0);
  col += vec3(1.0, 0.97, 0.88) * spec * 0.9;

  // Sand seen through the shallows, fading with depth.
  vec3 sand = sandAt(p * 0.5);
  float under = (1.0 - smoothstep(0.0, 1.15, dd)) * 0.5;
  col = mix(col, sand * (0.92 + 0.12 * max(dot(N, L), 0.0)), under);

  // Caustics: two crossing scrolls of the noise light the shallow floor.
  float c1 = nz(p * 0.32 + vec2(t * 0.012, t * 0.008));
  float c2 = uLow > 0.5 ? c1 : nz(mat2(0.8, -0.6, 0.6, 0.8) * p * 0.51 - vec2(t * 0.009, -t * 0.011));
  float cc = smoothstep(0.52, 0.95, 0.5 * (c1 + c2));
  col += vec3(0.85, 1.0, 0.96) * cc * 0.2 * (0.35 + 0.65 * shallowK);

  // Beach: the waterline breathes in and out; a wet, darker, glossier band lies just inside it.
  // Narrow band so the water reaches close to the hexes (specs/sea-shore "Narrow beach").
  float tide = 0.26 + 0.06 * sin(t * 0.7 + p.x * 1.5 + p.y * 1.1);
  float beach = 1.0 - smoothstep(0.0, tide, dd);
  float wet = smoothstep(tide * 0.15, tide * 0.85, dd) * beach;
  vec3 beachCol = sand * (0.9 + 0.2 * max(dot(N, L), 0.0));
  beachCol = mix(beachCol, beachCol * vec3(0.7, 0.66, 0.6), wet * 0.9);
  col = mix(col, beachCol, beach * 0.92);

  // Soft layer: wet-sand shadow and lace foam trailing behind each wave front.
  col *= 1.0 - 0.22 * exp(-max(dd, 0.0) * 5.0);
  float s = fract((dd + ph * 1.4) * 0.85 + t * 0.11);
  float front = smoothstep(0.0, 0.16, s) * (1.0 - smoothstep(0.16, 0.5, s));
  float lace = smoothstep(0.42, 0.74, nz(p * 0.9 + vec2(t * 0.012, -t * 0.009)));
  float reach = (1.0 - smoothstep(0.2, 1.5, dd)) * smoothstep(0.03, 0.3, dd);
  col = mix(col, uFoam, clamp(front * (0.05 + 0.6 * lace) * reach, 0.0, 0.55));

  float swash = 0.2 + 0.1 * sin(t * 0.9 + p.x * 1.7 + p.y * 1.3);
  float shore = (1.0 - smoothstep(0.0, swash, dd)) * (0.4 + 0.4 * lace);
  col = mix(col, uFoam, clamp(shore, 0.0, 0.5));

  // Crisp layer: hard white contour lines of the same field. Wave lines roll toward the beach,
  // thick near it and thin offshore, and the noise breaks each one into segments; a thin line
  // marks the waterline. One-pixel edges (fwidth) keep them sharp at any zoom.
  float wph = (dd + ph) * 1.7 + t * 0.16;
  float band = fract(wph);
  float wwid = mix(0.14, 0.05, smoothstep(0.2, 1.8, dd));
  float aa = max(fwidth(wph), 1e-4) * 1.2;
  float wline = smoothstep(0.0, aa, band) * (1.0 - smoothstep(wwid, wwid + aa, band));
  float segs = smoothstep(0.45, 0.6, nz(p * 0.42 + floor(wph) * 0.173));
  float wreach = (1.0 - smoothstep(0.3, 1.9, dd)) * smoothstep(0.14, 0.4, dd);
  col = mix(col, uFoam, clamp(wline * segs * wreach, 0.0, 0.85));

  float aaS = max(fwidth(dd), 1e-4) * 1.2;
  float edgeLine = smoothstep(swash - 0.035 - aaS, swash - 0.035, dd) * (1.0 - smoothstep(swash, swash + aaS, dd));
  col = mix(col, uFoam, edgeLine * (0.55 + 0.4 * smoothstep(0.3, 0.6, lace)));

  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function Water({
  land,
  topology,
  y,
}: {
  land: readonly XZ[];
  /** Topology of the board shown; its paths and harbors keep the coast props clear. */
  topology?: Topology;
  y: number;
}) {
  const renderer = useThree((s) => s.gl);
  const material = useRef<ShaderMaterial>(null);
  const [simulation, setSimulation] = useState<WaterSimulation | null>(null);
  const reduced = useReducedMotion();
  const mode = usePrefsStore((s) => s.graphicsMode);
  const realistic = mode === "realistic";
  // The sea ignores the quality tier (specs/graphics-quality "Uniform sea across quality levels").
  const physical = realistic && SEA.physical && supportsWaterSimulation(renderer);
  // The coast dressing; its rocks are also obstacles for the waves (specs/coast-dressing).
  const coast = useMemo(() => coastScatter(land, topology), [land, topology]);
  const rocks = useMemo(() => propsAsRocks(coast.props), [coast]);
  useEffect(() => {
    if (!physical) {
      setSimulation(null);
      return;
    }
    const solver = new WaterSimulation(land, rocks, y);
    setSimulation(solver);
    return () => solver.dispose();
  }, [physical, land, rocks, y]);
  const defines = useMemo(() => ({ WAVE_COUNT: SEA.waves }), []);
  const { theme } = useTheme();
  // The island's shore distance, baked once (the board's land hexes never move).
  const field = useMemo<DataTexture>(() => coastFieldTexture(land), [land]);
  useEffect(() => () => field.dispose(), [field]);
  // A blank placeholder per sampler: the shader only reads a slot when its uHas* flag is set.
  const blank = useMemo(() => new Texture(), []);
  const uniforms = useMemo(
    () => ({
      uField: { value: field as Texture },
      uSimulation: { value: blank },
      uBed: { value: blank },
      uPhysical: { value: 0 },
      uSeaLevel: { value: y },
      uSeaHalf: { value: 20 },
      uNoise: { value: blank },
      uSand: { value: blank },
      uTime: { value: 0 },
      uHasNoise: { value: 0 },
      uHasSand: { value: 0 },
      uLow: { value: SEA.low ? 1 : 0 },
      uDeep: { value: new Color(WATER_DEEP) },
      uMid: { value: new Color(WATER_MID) },
      uShallow: { value: new Color(WATER_SHALLOW) },
      uFoam: { value: new Color(WATER_FOAM) },
      uSky: { value: new Color(WATER_SKY) },
    }),
    [field, blank, y],
  );
  useEffect(() => () => blank.dispose(), [blank]);
  // Textures arrive whenever they arrive; each layer switches on independently.
  useEffect(() => {
    const owned: Texture[] = [];
    uniforms.uHasSand.value = uniforms.uHasNoise.value = 0;
    uniforms.uSand.value = uniforms.uNoise.value = blank;
    const cancel = loadWaterTextures(
      resolveWaterUrls(theme),
      (slot, texture) => {
        owned.push(texture);
        if (slot === "sand") {
          uniforms.uSand.value = texture;
          uniforms.uHasSand.value = 1;
        } else {
          uniforms.uNoise.value = texture;
          uniforms.uHasNoise.value = 1;
        }
      },
      (slot, url, error) =>
        console.warn(
          `[theme] failed to load water texture "${slot}" (${url}): ${
            error instanceof Error ? error.message : String(error)
          }. Using procedural fallback.`,
        ),
    );
    return () => {
      cancel();
      owned.forEach((texture) => texture.dispose());
    };
  }, [theme, uniforms, blank]);
  useFrame(({ clock, camera }, delta) => {
    uniforms.uSeaHalf.value = visibleSeaHalf(camera, y);
    uniforms.uPhysical.value = physical && simulation ? 1 : 0;
    if (physical && simulation) {
      simulation.advance(renderer, delta, reduced);
      uniforms.uSimulation.value = simulation.texture;
      uniforms.uBed.value = simulation.bedSmooth;
    }
    // Reduced motion: a still sea (waves, caustics and tide frozen), never an animation.
    uniforms.uTime.value = waterTime(reduced, clock.elapsedTime);
    syncWaterUniforms(material.current, uniforms);
  });
  return (
    <>
      {realistic && (
        <CoastTerrain
          land={land}
          props={coast.props}
          y={y}
          raisedBeach={physical && !!simulation}
        />
      )}
      <mesh
        frustumCulled={false}
        raycast={() => {}}
        // Drawn after the boats' hull lids, so no sea shows inside a hull (hullMask.ts).
        renderOrder={SEA_ORDER}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, y, 0]}
      >
        <planeGeometry
          args={[200, 200, realistic ? SEA.segments : 1, realistic ? SEA.segments : 1]}
        />
        <shaderMaterial
          ref={material}
          key={mode}
          defines={defines}
          uniforms={uniforms}
          vertexShader={realistic ? realisticVertex : vertex}
          fragmentShader={realistic ? realisticFragment : fragment}
          toneMapped={false}
        />
      </mesh>
    </>
  );
}
