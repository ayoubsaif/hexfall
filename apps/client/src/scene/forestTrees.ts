// 3D forests (specs/forest-trees): a dense mixed wood on every forest hex: faceted spruces,
// birches and broadleaf trees mixed with the textured trees of the 99.Miles pack, with boulders (the coast kit's), a woodpile, a fallen log,
// stumps, ferns, mushrooms and grass tufts between them. Everything stays clear of the number
// chip, the robber's spot, the hex corners (settlements, cities) and edges (roads). Pure and
// deterministic: positions depend only on the hex id, so every player sees the same forests.
import type { Board } from "@hexfall/engine";
import {
  STANDARD_TOPOLOGY,
  hexCenter,
  topologyOf,
  vertexPosition,
  type Topology,
} from "@hexfall/engine/geometry";
import { domeHeight } from "../theme/index.ts";
import { PATH_CLEAR, VERTEX_CLEAR, type PropInstance } from "./coastScatter.ts";
import { ROBBER_TOKEN_OFFSET, type XZ } from "./layout.ts";

/** Keep-out radius of the number chip at the hex centre. */
export const CHIP_CLEAR = 0.34;
/** Keep-out radius around the robber's spot beside the chip. */
export const ROBBER_CLEAR = 0.22;
/** Minimum distance between two trees' centres, as a multiple of their summed radii; under 1
 * so the crowns overlap a little and read as one wood. */
const SPACING = 0.72;
export const MIN_TREES = 18;
export const MAX_TREES = 26;
/** Tree scale range: the tallest tree (0.32 at scale 1) stays under a city (0.368). */
const TREE_SCALE_MIN = 0.78;
const TREE_SCALE_MAX = 1.1;
/** tree.glb variants (tools/blender/tree-pack.py): 0–4 the faceted trees (tall spruce, spruce,
 * young spruce, birch, broadleaf), 5–12 the textured trees of the 99.Miles pack. */
export const TREE_VARIANTS = {
  tallSpruce: 0,
  spruce: 1,
  youngSpruce: 2,
  birch: 3,
  broadleaf: 4,
  packSpruce: 5,
  packAutumn: 6,
  packYoungSpruce: 7,
  packSpruceSlim: 8,
  packAutumnWide: 9,
  packPine: 10,
  packFir: 11,
  packPineSlim: 12,
} as const;
/** Footprint radius at scale 1 per variant (a bit under half the crown width), and how often
 * each grows: about 40% faceted, 60% textured, autumn trees rare. */
const TREE_KINDS: readonly { radius: number; weight: number }[] = [
  { radius: 0.055, weight: 9 },
  { radius: 0.055, weight: 9 },
  { radius: 0.038, weight: 7 },
  { radius: 0.04, weight: 8 },
  { radius: 0.065, weight: 7 },
  { radius: 0.036, weight: 10 },
  { radius: 0.055, weight: 3 },
  { radius: 0.036, weight: 8 },
  { radius: 0.035, weight: 10 },
  { radius: 0.055, weight: 3 },
  { radius: 0.045, weight: 9 },
  { radius: 0.032, weight: 9 },
  { radius: 0.034, weight: 8 },
];
const TREE_WEIGHT = TREE_KINDS.reduce((s, k) => s + k.weight, 0);
/** Footprint radius of a grass tuft at scale 1, and its variant in the bush kit. */
const TUFT_RADIUS = 0.035;
const TUFT_VARIANT = 2;
/** woods.glb variants: 0 fallen log, 1 stump, 2 fern, 3 woodpile, 4 mushrooms. */
export const WOODS_VARIANTS = { log: 0, stump: 1, fern: 2, pile: 3, mushrooms: 4 } as const;
/** Scale of the woodland props and the forest boulders (the kit is modelled small). */
export const WOODS_SCALE = 1.6;
const TAU = Math.PI * 2;

export function hash01(n: number): number {
  let h = Math.imul(n ^ 0x27d4eb2f, 0x165667b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca77);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

function segDistance(px: number, pz: number, a: XZ, b: XZ): number {
  const dx = b[0] - a[0],
    dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(px - a[0] - dx * t, pz - a[1] - dz * t);
}

/** True when a tree of footprint `r` at (x, z) on hex `hex` stays clear of everything in play.
 * `chipClear` lets a prop standing behind the chip (the mountain) come closer than the default. */
export function forestSpotClear(
  hex: number,
  x: number,
  z: number,
  r: number,
  chipClear = CHIP_CLEAR,
  topo: Topology = STANDARD_TOPOLOGY,
): boolean {
  const [cx, cz] = hexCenter(hex, topo);
  if (Math.hypot(x - cx, z - cz) < chipClear + r) return false;
  const rx = cx + ROBBER_TOKEN_OFFSET[0],
    rz = cz + ROBBER_TOKEN_OFFSET[1];
  if (Math.hypot(x - rx, z - rz) < ROBBER_CLEAR + r) return false;
  const info = topo.hexes[hex]!;
  for (const v of info.vertices) {
    const [vx, vz] = vertexPosition(v, topo);
    if (Math.hypot(x - vx, z - vz) < VERTEX_CLEAR + r * 0.6) return false;
  }
  for (const e of info.edges) {
    const [a, b] = topo.edges[e]!.vertices;
    if (segDistance(x, z, vertexPosition(a, topo), vertexPosition(b, topo)) < PATH_CLEAR + r)
      return false;
  }
  return true;
}

/** A tree variant, faceted and textured mixed by their weights. */
function pickTree(u: number): number {
  let t = u * TREE_WEIGHT;
  for (let v = 0; v < TREE_KINDS.length; v++) {
    t -= TREE_KINDS[v]!.weight;
    if (t < 0) return v;
  }
  return TREE_KINDS.length - 1;
}

/** The trees of one forest hex, clear of `blockers` (rocks placed first). */
export function hexForest(
  hex: number,
  blockers: readonly PropInstance[] = [],
  topo: Topology = STANDARD_TOPOLOGY,
): PropInstance[] {
  const [cx, cz] = hexCenter(hex, topo);
  const want = MIN_TREES + Math.floor(hash01(hex * 977 + 1) * (MAX_TREES - MIN_TREES + 1));
  const out: PropInstance[] = [];
  for (let k = 0; k < 2000 && out.length < want; k++) {
    const seed = hex * 9973 + k * 31;
    const a = hash01(seed) * TAU;
    const d = Math.sqrt(hash01(seed + 1)) * 0.8;
    const variant = pickTree(hash01(seed + 3));
    const scale = TREE_SCALE_MIN + hash01(seed + 2) * (TREE_SCALE_MAX - TREE_SCALE_MIN);
    const r = TREE_KINDS[variant]!.radius * scale;
    const x = cx + Math.cos(a) * d,
      z = cz + Math.sin(a) * d;
    if (!forestSpotClear(hex, x, z, r, undefined, topo)) continue;
    if (blockers.some((b) => Math.hypot(b.x - x, b.z - z) < b.radius + r)) continue;
    if (out.some((t) => Math.hypot(t.x - x, t.z - z) < (t.radius + r) * SPACING)) continue;
    out.push({
      key: "prop.tree",
      variant,
      x,
      z,
      ground: domeHeight("tile.forest", d),
      yaw: hash01(seed + 4) * TAU,
      scale,
      radius: r,
    });
  }
  return out;
}

/** Grass tufts (the coast kit's tuft, `prop.bush` variant 2) scattered between the trees (or
 * the sheep of a pasture: pass its terrain and tuft count range). */
export function hexTufts(
  hex: number,
  trees: readonly PropInstance[],
  terrain = "tile.forest",
  min = 18,
  max = 26,
  topo: Topology = STANDARD_TOPOLOGY,
): PropInstance[] {
  const [cx, cz] = hexCenter(hex, topo);
  const want = min + Math.floor(hash01(hex * 613 + 9) * (max - min + 1));
  const out: PropInstance[] = [];
  for (let k = 0; k < 300 && out.length < want; k++) {
    const seed = hex * 7919 + k * 17 + 5;
    const a = hash01(seed) * TAU;
    const d = Math.sqrt(hash01(seed + 1)) * 0.82;
    const scale = 0.9 + hash01(seed + 2) * 0.6;
    const r = TUFT_RADIUS * scale;
    const x = cx + Math.cos(a) * d,
      z = cz + Math.sin(a) * d;
    if (!forestSpotClear(hex, x, z, r, undefined, topo)) continue;
    // Tufts may touch a trunk's footprint but not sit inside it.
    if (trees.some((t) => Math.hypot(t.x - x, t.z - z) < t.radius * 0.8)) continue;
    if (out.some((t) => Math.hypot(t.x - x, t.z - z) < (t.radius + r) * 1.2)) continue;
    out.push({
      key: "prop.bush",
      variant: TUFT_VARIANT,
      x,
      z,
      ground: domeHeight(terrain, d),
      yaw: hash01(seed + 4) * TAU,
      scale,
      radius: r,
    });
  }
  return out;
}

/** Footprint radius at scale 1 of each woodland prop, and how many a hex gets. */
const WOODS_RADIUS: Record<number, number> = {
  [WOODS_VARIANTS.log]: 0.055,
  [WOODS_VARIANTS.stump]: 0.022,
  [WOODS_VARIANTS.fern]: 0.04,
  [WOODS_VARIANTS.pile]: 0.036,
  [WOODS_VARIANTS.mushrooms]: 0.015,
};

/** Everything on one forest hex: boulders, trees, woodland props and grass tufts. */
export function hexWoods(hex: number, topo: Topology = STANDARD_TOPOLOGY): PropInstance[] {
  const [cx, cz] = hexCenter(hex, topo);
  const at = (a: number, d: number): XZ => [cx + Math.cos(a) * d, cz + Math.sin(a) * d];
  const ground = (d: number) => domeHeight("tile.forest", d);
  const placed: PropInstance[] = [];
  const free = (x: number, z: number, r: number) =>
    !placed.some((p) => Math.hypot(p.x - x, p.z - z) < p.radius + r);

  // Two to four boulders, sometimes with a small one beside.
  const rocks = 2 + Math.floor(hash01(hex * 59 + 3) * 3);
  for (let k = 0, n = 0; k < 200 && n < rocks; k++) {
    const seed = hex * 1229 + k * 19;
    const a = hash01(seed) * TAU;
    const d = 0.42 + hash01(seed + 1) * 0.38;
    const scale = (0.22 + hash01(seed + 2) * 0.16) * WOODS_SCALE;
    const r = 0.1 * scale;
    const [x, z] = at(a, d);
    if (!forestSpotClear(hex, x, z, r, undefined, topo) || !free(x, z, r)) continue;
    placed.push({
      key: "prop.boulder",
      variant: Math.floor(hash01(seed + 3) * 1000),
      x,
      z,
      ground: ground(d),
      yaw: hash01(seed + 4) * TAU,
      scale,
      radius: r,
    });
    n++;
  }

  placed.push(...hexForest(hex, placed, topo));

  // Woodland props: a woodpile, often a fallen log, stumps, ferns and mushrooms.
  const wants = [
    { variant: WOODS_VARIANTS.pile, count: 1 },
    { variant: WOODS_VARIANTS.log, count: hash01(hex * 47 + 1) < 0.7 ? 1 : 0 },
    { variant: WOODS_VARIANTS.stump, count: 1 + Math.floor(hash01(hex * 47 + 2) * 2) },
    { variant: WOODS_VARIANTS.fern, count: 2 + Math.floor(hash01(hex * 47 + 4) * 3) },
    { variant: WOODS_VARIANTS.mushrooms, count: 1 + Math.floor(hash01(hex * 47 + 3) * 2) },
  ];
  for (const want of wants) {
    for (let k = 0, n = 0; k < 300 && n < want.count; k++) {
      const seed = hex * 3301 + want.variant * 997 + k * 23;
      const a = hash01(seed) * TAU;
      const d = 0.4 + hash01(seed + 1) * 0.4;
      const scale = (0.9 + hash01(seed + 2) * 0.2) * WOODS_SCALE;
      const r = WOODS_RADIUS[want.variant]! * scale;
      const [x, z] = at(a, d);
      if (!forestSpotClear(hex, x, z, r, undefined, topo)) continue;
      // Ferns and mushrooms grow at the foot of trees; the rest needs open ground.
      const small =
        want.variant === WOODS_VARIANTS.fern || want.variant === WOODS_VARIANTS.mushrooms;
      if (
        placed.some(
          (p) =>
            Math.hypot(p.x - x, p.z - z) <
            (small && p.key === "prop.tree" ? p.radius * 0.6 + r * 0.5 : p.radius + r),
        )
      )
        continue;
      placed.push({
        key: "prop.woods",
        variant: want.variant,
        x,
        z,
        ground: ground(d),
        yaw: hash01(seed + 3) * TAU,
        scale,
        radius: r,
      });
      n++;
    }
  }

  return [...placed, ...hexTufts(hex, placed, undefined, undefined, undefined, topo)];
}

/** Every forest prop on the board (only forest hexes carry them). */
export function forestTrees(board: Board): PropInstance[] {
  const topo = topologyOf(board);
  return topo.hexes.flatMap((info) =>
    board.hexes[info.id]?.terrain === "forest" ? hexWoods(info.id, topo) : [],
  );
}
