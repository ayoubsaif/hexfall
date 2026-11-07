// Baked coast field for the sea (specs/sea-coast-rendering). The sea shader used to compute the
// distance to the island per pixel; the island never moves, so it is baked once into a small
// texture and the shader only reads it. Channels (hex-radius units):
//   R  shore distance, warped so the beach has bays, headlands and ragged edges
//   G  depth distance for the colour ramp (a different warp, so bands are not parallel)
//   B  phase offset that bends the animated wave contour lines
// The warps are value-noise based and seeded by position only, so the bake is deterministic.
import {
  DataUtils,
  DataTexture,
  HalfFloatType,
  LinearFilter,
  ClampToEdgeWrapping,
  RGBAFormat,
} from "three";
import type { XZ } from "./layout.ts";

/** Half-width of the square the field covers, in hex radii (the island reaches about 4.5). */
export const FIELD_HALF = 9;
/** Texels per side. */
export const FIELD_SIZE = 256;
/** Shore distance is clamped here; beyond it the sea is simply open water. */
export const FIELD_MAX = 6;

function hash(x: number, y: number): number {
  let px = (x * 123.34) % 1;
  let py = (y * 456.21) % 1;
  if (px < 0) px += 1;
  if (py < 0) py += 1;
  const d = px * (px + 45.32) + py * (py + 45.32) + px * py;
  px += d;
  py += d;
  const r = (px * py) % 1;
  return r < 0 ? r + 1 : r;
}

function noise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  let fx = x - ix;
  let fy = y - iy;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

function fbm(x: number, y: number): number {
  let v = 0;
  let a = 0.5;
  for (let i = 0; i < 4; i++) {
    v += a * noise(x, y);
    x = x * 2.03 + 11.7;
    y = y * 2.03 + 11.7;
    a *= 0.5;
  }
  return v;
}

/** Distance from a point to a pointy-top hex outline (corner toward +Z), circumradius 1. */
export function hexSdf(px: number, pz: number): number {
  let d = -1e3;
  for (let k = 0; k < 3; k++) {
    const t = ((30 + 60 * k) * Math.PI) / 180;
    d = Math.max(d, Math.abs(px * Math.sin(t) + pz * Math.cos(t)) - 0.8660254);
  }
  return d;
}

/** Distance to the nearest land hex, with the hex corners blended smoothly. */
export function landDistance(land: readonly XZ[], x: number, z: number): number {
  const k = 0.45;
  let d = 1e3;
  for (const [cx, cz] of land) {
    const h = hexSdf(x - cx, z - cz);
    const m = Math.min(1, Math.max(0, 0.5 + (0.5 * (h - d)) / k));
    d = h + (d - h) * m - k * m * (1 - m);
  }
  return d;
}

export interface CoastSample {
  shore: number;
  depth: number;
  phase: number;
}

/** The three baked values at a world position. */
export function sampleCoast(land: readonly XZ[], x: number, z: number): CoastSample {
  const d = landDistance(land, x, z);
  // Warp the coordinates, then vary the beach width at three scales.
  const wx = fbm(x * 0.8 + 3.1, z * 0.8 + 3.1) - 0.5;
  const wz = fbm(x * 0.8 + 17.7, z * 0.8 + 17.7) - 0.5;
  const pwx = x + wx * 1.1;
  const pwz = z + wz * 1.1;
  const bay = fbm(pwx * 0.7 + 5, pwz * 0.7 + 5) - 0.5;
  const rag = fbm(pwx * 2.6, pwz * 2.6) - 0.5;
  const fine = noise(pwx * 7.5, pwz * 7.5) - 0.5;
  // Kept small so the waterline stays close to the hexes, and never past d + 0.05 so the beach
  // is always dry right outside the land (specs/sea-shore "Narrow beach").
  return {
    shore: Math.min(d + 0.05, d - 0.14 + bay * 0.55 + rag * 0.22 + fine * 0.08),
    depth: d + bay * 1.6 + rag * 0.7,
    phase: rag * 0.9 + bay * 0.5,
  };
}

/** Bakes the field into RGBA float values, row-major, row 0 at the most negative z. */
export function bakeCoastField(
  land: readonly XZ[],
  size = FIELD_SIZE,
  half = FIELD_HALF,
): Float32Array {
  const out = new Float32Array(size * size * 4);
  for (let j = 0; j < size; j++) {
    const z = -half + ((j + 0.5) / size) * 2 * half;
    for (let i = 0; i < size; i++) {
      const x = -half + ((i + 0.5) / size) * 2 * half;
      const s = sampleCoast(land, x, z);
      const o = (j * size + i) * 4;
      out[o] = Math.min(FIELD_MAX, s.shore);
      out[o + 1] = Math.min(FIELD_MAX, s.depth);
      out[o + 2] = s.phase;
      out[o + 3] = 1;
    }
  }
  return out;
}

/** A linearly filtered half-float texture of the baked field (clamped at the edges). */
export function coastFieldTexture(land: readonly XZ[]): DataTexture {
  const f32 = bakeCoastField(land);
  const f16 = new Uint16Array(f32.length);
  for (let i = 0; i < f32.length; i++) f16[i] = DataUtils.toHalfFloat(f32[i] ?? 0);
  const tex = new DataTexture(f16, FIELD_SIZE, FIELD_SIZE, RGBAFormat, HalfFloatType);
  tex.minFilter = tex.magFilter = LinearFilter;
  tex.wrapS = tex.wrapT = ClampToEdgeWrapping;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}
