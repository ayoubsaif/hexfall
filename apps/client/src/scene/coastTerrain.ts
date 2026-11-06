import { BufferGeometry, Float32BufferAttribute } from "three";
import { landDistance, sampleCoast } from "./coastField.ts";
import type { XZ } from "./layout.ts";

export const BEACH_HALF = 7;
export const BEACH_SEGMENTS = 240;
const smooth = (a: number, b: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Height relative to mean sea level. Shared profile with the water shader.
 * The dry berm joins the island below its roads, then slopes into a submerged sand shelf. */
export function beachHeight(shore: number): number {
  return 0.095 - 0.38 * smooth(-0.18, 1.5, shore) - Math.max(0, shore - 1.5) * 0.35;
}

export const beachHeightGlsl = /* glsl */ `
float beachHeight(float shore) {
  return 0.095 - 0.38 * smoothstep(-0.18, 1.5, shore) - max(0.0, shore - 1.5) * 0.35;
}`;

export function beachGeometry(land: readonly XZ[], seaLevel: number): BufferGeometry {
  const positions: number[] = [],
    uv: number[] = [],
    colors: number[] = [],
    indices: number[] = [];
  const distances: number[] = [];
  for (let row = 0; row <= BEACH_SEGMENTS; row++) {
    const z = -BEACH_HALF + (row / BEACH_SEGMENTS) * BEACH_HALF * 2;
    for (let col = 0; col <= BEACH_SEGMENTS; col++) {
      const x = -BEACH_HALF + (col / BEACH_SEGMENTS) * BEACH_HALF * 2;
      const d = sampleCoast(land, x, z).shore;
      distances.push(d);
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
      // Omit distant sea and the interior; the join remains hidden beneath the land tiles.
      if ([a, b, c, d].every((i) => distances[i]! < -0.4 || distances[i]! > 2.2)) continue;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
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

/** Fixed scenery independent of the game's seeded RNG. Keep harbor approaches and all paths clear. */
export function coastRocks(land: readonly XZ[], harbors: readonly XZ[]): CoastRock[] {
  const rocks: CoastRock[] = [];
  for (let i = 0; i < 72; i++) {
    const angle = (i / 72) * Math.PI * 2;
    let x = 0,
      z = 0;
    const target = 0.45 + ((i * 17) % 11) * 0.045;
    for (let r = 3.5; r < 6.5; r += 0.035) {
      x = Math.cos(angle) * r;
      z = Math.sin(angle) * r;
      if (sampleCoast(land, x, z).shore >= target) break;
    }
    const radius = (0.12 + ((i * 13) % 7) * 0.024) * 0.65;
    if (landDistance(land, x, z) < radius + 0.24) continue;
    if (harbors.some(([hx, hz]) => Math.hypot(x - hx, z - hz) < 0.85 + radius)) continue;
    if (rocks.some((rock) => Math.hypot(x - rock.x, z - rock.z) < radius + rock.radius + 0.18))
      continue;
    if (i % 5 > 2) continue;
    rocks.push({ x, z, radius, height: radius * (0.9 + (i % 3) * 0.4), yaw: angle * 3 });
  }
  // Sparse formations, not a regular necklace around the island: two outcrops and
  // two lone stones. Satellites are smaller and partly nestled against the anchor.
  const scenery: CoastRock[] = [];
  for (let group = 0; group < 4; group++) {
    const anchor = rocks[Math.floor((group / 4) * rocks.length)];
    if (!anchor) continue;
    scenery.push(anchor);
    if (group % 2 !== 0) continue;
    const angle = Math.atan2(anchor.z, anchor.x);
    for (const side of [-1, 1]) {
      const radius = anchor.radius * (side < 0 ? 0.72 : 0.5);
      const offset = anchor.radius + radius * 0.72;
      const x = anchor.x - Math.sin(angle) * offset * side + Math.cos(angle) * radius * 0.3;
      const z = anchor.z + Math.cos(angle) * offset * side + Math.sin(angle) * radius * 0.3;
      if (landDistance(land, x, z) < radius + 0.24) continue;
      if (harbors.some(([hx, hz]) => Math.hypot(x - hx, z - hz) < 0.85 + radius)) continue;
      scenery.push({
        x,
        z,
        radius,
        height: anchor.height * (side < 0 ? 0.65 : 0.45),
        yaw: anchor.yaw + side * 1.2,
      });
    }
  }
  return scenery;
}
