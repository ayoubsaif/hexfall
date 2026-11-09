import { BufferGeometry, Float32BufferAttribute } from "three";
import { sampleCoast } from "./coastField.ts";
import type { XZ } from "./layout.ts";

export const BEACH_HALF = 7;
export const BEACH_SEGMENTS = 240;
const smooth = (a: number, b: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Shore distance where the beach slope ends and the sand shelf begins (specs/sea-shore).
 * Smaller = narrower beach; the waterline sits about a third of the way from -0.18. */
export const BEACH_SLOPE_END = 0.5;

/** Height relative to mean sea level. Shared profile with the water shader.
 * The dry berm joins the island below its roads, then slopes into a submerged sand shelf. */
export function beachHeight(shore: number): number {
  return (
    0.095 -
    0.38 * smooth(-0.18, BEACH_SLOPE_END, shore) -
    Math.max(0, shore - BEACH_SLOPE_END) * 0.35
  );
}

const SLOPE_END_GLSL = BEACH_SLOPE_END.toFixed(4);
export const beachHeightGlsl = /* glsl */ `
float beachHeight(float shore) {
  return 0.095 - 0.38 * smoothstep(-0.18, ${SLOPE_END_GLSL}, shore) - max(0.0, shore - ${SLOPE_END_GLSL}) * 0.35;
}`;

/** Shore distances where the grass band on the beach fades out into sand (specs/coast-dressing). */
export const GRASS_FULL = -0.07;
export const GRASS_END = 0.03;

/** 1 on the land side of the beach, 0 on the sand; `phase` (coast noise) makes the edge ragged. */
export function grassWeight(shore: number, phase: number): number {
  return 1 - smooth(GRASS_FULL, GRASS_END, shore + phase * 0.06);
}

export function beachGeometry(land: readonly XZ[], seaLevel: number): BufferGeometry {
  const positions: number[] = [],
    uv: number[] = [],
    colors: number[] = [],
    grass: number[] = [],
    indices: number[] = [];
  const distances: number[] = [];
  for (let row = 0; row <= BEACH_SEGMENTS; row++) {
    const z = -BEACH_HALF + (row / BEACH_SEGMENTS) * BEACH_HALF * 2;
    for (let col = 0; col <= BEACH_SEGMENTS; col++) {
      const x = -BEACH_HALF + (col / BEACH_SEGMENTS) * BEACH_HALF * 2;
      const sample = sampleCoast(land, x, z);
      const d = sample.shore;
      distances.push(d);
      grass.push(grassWeight(d, sample.phase));
      // Keep the mesh below game pieces even with a flat/procedural theme.
      positions.push(x, Math.min(-0.005, seaLevel + beachHeight(d)), z);
      uv.push(x * 0.7, z * 0.7);
      const wet = smooth(0.12, 0.65, d);
      colors.push(1 - wet * 0.36, 1 - wet * 0.4, 1 - wet * 0.44);
    }
  }
  for (let row = 0; row < BEACH_SEGMENTS; row++) {
    for (let col = 0; col < BEACH_SEGMENTS; col++) {
      const a = row * (BEACH_SEGMENTS + 1) + col,
        b = a + 1;
      const c = a + BEACH_SEGMENTS + 1,
        d = c + 1;
      // Omit only distant sea. The interior stays: it is the sand that shows between land tiles.
      if ([a, b, c, d].every((i) => distances[i]! > 2.2)) continue;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.setAttribute("grass", new Float32BufferAttribute(grass, 1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

export interface CoastRock {
  x: number;
  z: number;
  radius: number;
  height: number;
  yaw: number;
}
