// Coast dressing layout (specs/coast-dressing): where the boulders, cliff rocks, walls, trees and
// bushes go. Pure and deterministic: it depends only on the board topology (land hexes, harbor
// slots, intersections and paths never move), so every player sees the same coast.
import {
  STANDARD_TOPOLOGY,
  edgeMidpoint,
  edgeOutward,
  vertexPosition,
  type Topology,
} from "@hexfall/engine/geometry";
import type { CoastKey } from "../theme/index.ts";
import { JETTY_LENGTH } from "../theme/index.ts";
import { LAND_CENTERS, boatDistance } from "./boatFloat.ts";
import { landDistance, sampleCoast } from "./coastField.ts";
import { beachHeight } from "./coastTerrain.ts";
import type { CoastRock } from "./coastTerrain.ts";
import type { XZ } from "./layout.ts";

export interface PropInstance {
  key: CoastKey;
  /** Any non-negative integer; the renderer takes it modulo the number of variants. */
  variant: number;
  x: number;
  z: number;
  /** Ground height relative to mean sea level (add the sea level to place it). */
  ground: number;
  yaw: number;
  scale: number;
  /** Footprint radius in world units after scaling, for clear-zone checks. */
  radius: number;
}

/** Keep-out radius around every board intersection: a city footprint plus a margin. */
export const VERTEX_CLEAR = 0.26;
/** Keep-out half-width around every board path (a road plus a margin). */
export const PATH_CLEAR = 0.07;
/** Keep-out half-width of a harbor lane (jetty, boat and the water between). */
export const HARBOR_CLEAR = 0.34;
/** Gap from the jetty's sea end to the boat (matches HarborMarker). */
const BOAT_GAP = 0.135;
/** Arc spacing of rock spots along the shoreline. */
const ROCK_STEP = 0.2;
/** Share of rock spots that get a rock; the owner wants a sparse coast, not a rock ring. */
const ROCK_KEEP = 0.25;

/** Footprint radius (world units, at scale 1) per key. */
const BASE_RADIUS: Record<CoastKey, number> = {
  "prop.boulder": 0.1,
  "prop.cliff": 0.11,
  "prop.wall": 0.15,
  "prop.tree": 0.08,
  "prop.bush": 0.055,
  "prop.sheep": 0.06,
  "prop.camp": 0.075,
  "prop.woods": 0.08,
  "prop.peak": 0.2,
};

/** Integer hash -> [0, 1). */
function hash01(n: number): number {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function segDistance(px: number, pz: number, a: XZ, b: XZ): number {
  const dx = b[0] - a[0],
    dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(px - a[0] - dx * t, pz - a[1] - dz * t);
}

export interface ClearZones {
  vertices: readonly XZ[];
  paths: readonly (readonly [XZ, XZ])[];
  /** Jetty start (coastal edge midpoint) to just past the boat. */
  harborLanes: readonly (readonly [XZ, XZ])[];
}

/** `land` and `topo` must describe the same board (the standard island by default). */
export function clearZones(
  land: readonly XZ[] = LAND_CENTERS,
  topo: Topology = STANDARD_TOPOLOGY,
): ClearZones {
  const vertices = topo.vertices.map((_, i) => vertexPosition(i, topo));
  const paths = topo.edges.map(
    (e) => [vertexPosition(e.vertices[0], topo), vertexPosition(e.vertices[1], topo)] as const,
  );
  const harborLanes = topo.harborSlots.map((edge) => {
    const m = edgeMidpoint(edge, topo);
    const [ox, oz] = edgeOutward(edge, topo);
    const [a, b] = paths[edge]!;
    const el = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const along: XZ = [(b[0] - a[0]) / el, (b[1] - a[1]) / el];
    const boat = boatDistance(land, [m.x, m.z], [ox, oz], along, JETTY_LENGTH + BOAT_GAP);
    return [[m.x, m.z] as XZ, [m.x + ox * (boat + 0.12), m.z + oz * (boat + 0.12)] as XZ] as const;
  });
  return { vertices, paths, harborLanes };
}

/** True when a prop of footprint `radius` at (x, z) stays off the land, board spots and harbors. */
export function isClear(
  zones: ClearZones,
  land: readonly XZ[],
  x: number,
  z: number,
  radius: number,
  onLandOk = 0.02,
): boolean {
  if (landDistance(land, x, z) < radius * 0.6 + onLandOk) return false;
  for (const [vx, vz] of zones.vertices)
    if (Math.hypot(x - vx, z - vz) < VERTEX_CLEAR + radius * 0.6) return false;
  for (const [a, b] of zones.paths)
    if (segDistance(x, z, a, b) < PATH_CLEAR + radius * 0.6) return false;
  for (const [a, b] of zones.harborLanes)
    if (segDistance(x, z, a, b) < HARBOR_CLEAR + radius * 0.6) return false;
  return true;
}

/** Shore distance at which the beach meets mean sea level (beachHeight = 0). */
export const WATERLINE_SHORE = (() => {
  let lo = -0.18,
    hi = 1.5;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (beachHeight(mid) > 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
})();

/** The waterline as a closed loop of points, walked by angle around the island centre. */
export function shoreline(land: readonly XZ[], steps = 360, target = WATERLINE_SHORE): XZ[] {
  const out: XZ[] = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const c = Math.cos(a),
      s = Math.sin(a);
    // Outward from the centre until the shore distance reaches the target, then refine.
    let r = 2;
    while (r < 8 && sampleCoast(land, c * r, s * r).shore < target) r += 0.05;
    let lo = r - 0.05,
      hi = r;
    for (let k = 0; k < 20; k++) {
      const mid = (lo + hi) / 2;
      if (sampleCoast(land, c * mid, s * mid).shore < target) lo = mid;
      else hi = mid;
    }
    out.push([c * hi, s * hi]);
  }
  return out;
}

function groundAt(land: readonly XZ[], x: number, z: number): number {
  return beachHeight(sampleCoast(land, x, z).shore);
}

/** Walks a closed loop at a fixed arc step, returning points and unit outward normals. */
function walk(loop: readonly XZ[], step: number): { p: XZ; n: XZ; t: XZ; s: number }[] {
  const out: { p: XZ; n: XZ; t: XZ; s: number }[] = [];
  let carry = 0;
  let s = 0;
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i]!,
      b = loop[(i + 1) % loop.length]!;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len === 0) continue;
    const t: XZ = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
    // The loop runs counter-clockwise in x/z, so the outward normal is (t.z, -t.x).
    const n: XZ = [t[1], -t[0]];
    let d = step - carry;
    while (d <= len) {
      out.push({ p: [a[0] + t[0] * d, a[1] + t[1] * d], n, t, s: s + d });
      d += step;
    }
    carry = len - (d - step);
    s += len;
  }
  // Make the normal point away from the island centre whatever the loop's winding is.
  return out.map((w) =>
    w.n[0] * w.p[0] + w.n[1] * w.p[1] < 0 ? { ...w, n: [-w.n[0], -w.n[1]] as XZ } : w,
  );
}

export interface CoastLayout {
  props: PropInstance[];
}

/** The full coast dressing for the island. */
export function coastScatter(
  land: readonly XZ[] = LAND_CENTERS,
  topo: Topology = STANDARD_TOPOLOGY,
): CoastLayout {
  const zones = clearZones(land, topo);
  const props: PropInstance[] = [];
  const placed = (x: number, z: number, r: number) =>
    props.some((p) => Math.hypot(p.x - x, p.z - z) < (p.radius + r) * 0.82);
  const loop = shoreline(land);

  // 1. A few rocks along the waterline: mostly boulders, some cliff stacks. Which spots get one
  //    and the jitter come from a hash of the step index, never from Math.random.
  walk(loop, ROCK_STEP).forEach((w, i) => {
    if (hash01(i * 7 + 10) >= ROCK_KEEP) return;
    const h1 = hash01(i * 7 + 1),
      h2 = hash01(i * 7 + 2),
      h3 = hash01(i * 7 + 3);
    const key: CoastKey = h1 < 0.28 ? "prop.cliff" : "prop.boulder";
    const scale = 0.75 + h2 * 0.55;
    const radius = BASE_RADIUS[key] * scale;
    const off = -0.04 + h3 * 0.14; // a little inland of the waterline up to the shallows
    const jitter = (hash01(i * 7 + 4) - 0.5) * ROCK_STEP * 0.5;
    const x = w.p[0] + w.n[0] * off + w.t[0] * jitter;
    const z = w.p[1] + w.n[1] * off + w.t[1] * jitter;
    if (!isClear(zones, land, x, z, radius) || placed(x, z, radius)) return;
    props.push({
      key,
      variant: Math.floor(hash01(i * 7 + 5) * 1000),
      x,
      z,
      ground: groundAt(land, x, z),
      yaw: hash01(i * 7 + 6) * Math.PI * 2,
      scale,
      radius,
    });
  });

  // 2. Dry-stone walls on the rim, chained along the coast on the longest harbor-free runs.
  const rim = shoreline(land, 360, WATERLINE_SHORE * 0.45);
  const wallSteps = walk(rim, BASE_RADIUS["prop.wall"] * 2 * 0.98);
  const runs: { p: XZ; t: XZ; s: number }[][] = [];
  let run: { p: XZ; t: XZ; s: number }[] = [];
  for (const w of wallSteps) {
    const ok = [-0.5, 0, 0.5].every((k) =>
      isClear(zones, land, w.p[0] + w.t[0] * 0.15 * k, w.p[1] + w.t[1] * 0.15 * k, 0.05, 0.01),
    );
    if (ok) run.push(w);
    else if (run.length) {
      runs.push(run);
      run = [];
    }
  }
  if (run.length) runs.push(run);
  runs
    .filter((r) => r.length >= 2)
    .sort((a, b) => b.length - a.length || a[0]!.s - b[0]!.s)
    .slice(0, 3)
    .forEach((r, ri) => {
      r.forEach((w, k) => {
        props.push({
          key: "prop.wall",
          variant: 0,
          x: w.p[0],
          z: w.p[1],
          ground: groundAt(land, w.p[0], w.p[1]),
          yaw: Math.atan2(-w.t[1], w.t[0]),
          scale: 1,
          radius: 0.05,
        });
        if (k === r.length - 1) {
          const x = w.p[0] + w.t[0] * 0.17,
            z = w.p[1] + w.t[1] * 0.17;
          props.push({
            key: "prop.wall",
            variant: 1,
            x,
            z,
            ground: groundAt(land, x, z),
            yaw: ri,
            scale: 1,
            radius: 0.045,
          });
        }
      });
    });

  // 3. Bushes and grass on the dry rim between the hexes and the rocks (no trees: the owner
  //    keeps trees to the forest hexes).
  walk(rim, 0.13).forEach((w, i) => {
    const h1 = hash01(i * 11 + 21),
      h2 = hash01(i * 11 + 22),
      h3 = hash01(i * 11 + 23);
    if (h1 < 0.3) return; // the spots that used to hold trees stay open
    const key: CoastKey = "prop.bush";
    const scale = 0.8 + h2 * 0.5;
    const radius = BASE_RADIUS[key] * scale;
    const off = (h3 - 0.5) * 0.12;
    const x = w.p[0] + w.n[0] * off,
      z = w.p[1] + w.n[1] * off;
    if (groundAt(land, x, z) < 0.01) return; // stay on dry beach
    if (!isClear(zones, land, x, z, radius, 0.005) || placed(x, z, radius)) return;
    props.push({
      key,
      variant: Math.floor(hash01(i * 11 + 24) * 1000),
      x,
      z,
      ground: groundAt(land, x, z),
      yaw: hash01(i * 11 + 25) * Math.PI * 2,
      scale,
      radius,
    });
  });
  return { props };
}

/** Rocks as obstacles for the wave simulation (waves reflect and foam off them). */
export function propsAsRocks(props: readonly PropInstance[]): CoastRock[] {
  return props
    .filter((p) => p.key === "prop.boulder" || p.key === "prop.cliff")
    .map((p) => ({
      x: p.x,
      z: p.z,
      radius: p.radius * 0.8,
      height: p.key === "prop.cliff" ? p.radius * 1.4 : p.radius * 0.9,
      yaw: p.yaw,
    }));
}
