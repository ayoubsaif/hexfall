// 3D pastures (specs/pasture-meadow): every pasture hex becomes a little sheep camp, after the
// owner's "sheep camp biome" sheet: a thatched shepherd's hut with a hay pile on one side, a rail
// fence along the rim on the other with a flock of 3–5 sheep in front of it, a sandy path that
// hugs the chip from the hut door to the flock, plus grass tufts and the odd bush. Everything stays
// clear of the number chip, the robber's spot, the hex corners (settlements, cities) and edges
// (roads). Pure and deterministic: it depends only on the hex id, so every player sees the same
// camps.
import type { Board } from "@hexfall/engine";
import { STANDARD_TOPOLOGY, hexCenter, topologyOf, type Topology } from "@hexfall/engine/geometry";
import { domeHeight } from "../theme/index.ts";
import type { PropInstance } from "./coastScatter.ts";
import { forestSpotClear, hash01, hexTufts } from "./forestTrees.ts";

/** The camp is drawn larger than the models' native size so it reads at the default camera next
 * to the busy painted tiles: hut, other camp props and sheep. The hut stays shorter than a
 * settlement (0.222). */
export const HUT_SCALE = 2.0;
export const KIT_SCALE = 1.7;
export const SHEEP_SCALE = 1.6;
/** Footprint radius of a sheep at scale 1 (half its body length), before SHEEP_SCALE. */
export const SHEEP_RADIUS = 0.06 * SHEEP_SCALE;
export const MIN_SHEEP = 3;
export const MAX_SHEEP = 5;
/** sheep.glb variants: 0 standing, 1 grazing, 2 lying down, 3 lamb. */
export const SHEEP_VARIANTS = { standing: 0, grazing: 1, lying: 2, lamb: 3 } as const;
/** camp.glb variants: 0 hut (door on +X), 1 fence segment (along X), 2 feed trough (kept in the
 * kit but not placed: next to the chip it read as a stray box), 3 hay pile. */
export const CAMP_VARIANTS = { hut: 0, fence: 1, trough: 2, hay: 3 } as const;
/** Footprint radius of the hut, and its distance from the hex centre. */
export const HUT_RADIUS = 0.075 * HUT_SCALE;
const HUT_DIST = 0.6;
/** Fence: segment length, the rim circle it follows, and the collision radius of its points. */
export const FENCE_LENGTH = 0.16 * KIT_SCALE;
const FENCE_RING = 0.68;
const FENCE_POINT = 0.016;
const FENCE_SEGMENTS = 3;
const HAY_RADIUS = 0.03 * KIT_SCALE;
/** Path (owner's sketch): it leaves the hut door, hugs the chip on a close ring through its bends
 * and ends among the flock. */
const PATH_DOOR = 0.5;
export const PATH_RING = 0.43;
const PATH_END = 0.5;
/** Short straight legs of the path (bends = legs - 1). */
export const PATH_LEGS = 4;
const BUSH_RADIUS = 0.05;
const TERRAIN = "tile.pasture";
const TAU = Math.PI * 2;

/** Ground the island shader paints under a camp: a sandy path of straight legs. */
export interface CampGround {
  /** The path's PATH_LEGS + 1 points (hut door, bends, fence) as x0, z0, x1, z1, … */
  path: readonly number[];
}

export interface HexCamp {
  props: PropInstance[];
  ground: CampGround | null;
}

/** Grazing most often, then standing, lying, and a lamb now and then. */
function pickVariant(u: number): number {
  if (u < 0.42) return SHEEP_VARIANTS.grazing;
  if (u < 0.7) return SHEEP_VARIANTS.standing;
  if (u < 0.88) return SHEEP_VARIANTS.lying;
  return SHEEP_VARIANTS.lamb;
}

/** Yaw that turns a model's +X axis toward the direction (dx, dz). */
const yawToward = (dx: number, dz: number) => Math.atan2(-dz, dx);

const wrap = (a: number) => ((a % TAU) + TAU) % TAU;

interface Blocker {
  x: number;
  z: number;
  radius: number;
}

const blocked = (list: readonly Blocker[], x: number, z: number, r: number, k = 1) =>
  list.some((b) => Math.hypot(b.x - x, b.z - z) < (b.radius + r) * k);

/** The whole camp of one pasture hex. */
export function hexCamp(hex: number, topo: Topology = STANDARD_TOPOLOGY): HexCamp {
  const [cx, cz] = hexCenter(hex, topo);
  const at = (a: number, d: number) => [cx + Math.cos(a) * d, cz + Math.sin(a) * d] as const;
  const props: PropInstance[] = [];
  const blockers: Blocker[] = [];
  const put = (p: PropInstance) => {
    props.push(p);
    blockers.push(p);
  };

  // Hut: the first clear spot on the ring, door facing the chip.
  const start = hash01(hex * 211 + 7) * TAU;
  let hutA: number | null = null;
  for (let k = 0; k < 24 && hutA === null; k++) {
    const a = start + k * (TAU / 24);
    const [x, z] = at(a, HUT_DIST);
    if (forestSpotClear(hex, x, z, HUT_RADIUS, undefined, topo)) hutA = a;
  }
  if (hutA !== null) {
    const [x, z] = at(hutA, HUT_DIST);
    put({
      key: "prop.camp",
      variant: CAMP_VARIANTS.hut,
      x,
      z,
      ground: domeHeight(TERRAIN, HUT_DIST),
      yaw: yawToward(cx - x, cz - z),
      scale: HUT_SCALE,
      radius: HUT_RADIUS,
    });
    // A hay pile beside the hut, on whichever side is clear.
    for (const side of [1, -1]) {
      const [hx, hz] = at(hutA + side * 0.36, HUT_DIST - 0.03);
      if (
        !forestSpotClear(hex, hx, hz, HAY_RADIUS, undefined, topo) ||
        blocked(blockers, hx, hz, HAY_RADIUS)
      )
        continue;
      put({
        key: "prop.camp",
        variant: CAMP_VARIANTS.hay,
        x: hx,
        z: hz,
        ground: domeHeight(TERRAIN, HUT_DIST - 0.03),
        yaw: hash01(hex * 31 + 1) * TAU,
        scale: KIT_SCALE * (0.9 + hash01(hex * 31 + 2) * 0.25),
        radius: HAY_RADIUS,
      });
      break;
    }
  }

  // The pen faces the hut across the chip: a fence along the rim, chained segment to segment.
  // The pen faces the hut across the chip: a fence along the rim, chained segment to segment.
  // A few pen angles are tried (the robber's spot can block part of the rim); the longest wins.
  const facing = (hutA ?? start) + Math.PI + (hash01(hex * 97 + 3) * 2 - 1) * 0.3;
  const step = 2 * Math.asin(FENCE_LENGTH / (2 * FENCE_RING));
  const mid = FENCE_RING * Math.cos(step / 2);
  type Segment = { prop: PropInstance; points: (readonly [number, number])[] };
  const fenceRun = (centre: number): Segment[] => {
    const run: Segment[] = [];
    for (let i = 0; i < FENCE_SEGMENTS; i++) {
      const a = centre + (i - (FENCE_SEGMENTS - 1) / 2) * step;
      const [x, z] = at(a, mid);
      const tx = -Math.sin(a),
        tz = Math.cos(a);
      // Every post and the rails between must be clear; a failing segment leaves a gap (a gate).
      // Segments share their end posts, so they only check what was placed before the fence.
      const points = [-0.5, -0.25, 0, 0.25, 0.5].map(
        (t) => [x + tx * FENCE_LENGTH * t, z + tz * FENCE_LENGTH * t] as const,
      );
      if (!points.every(([px, pz]) => forestSpotClear(hex, px, pz, FENCE_POINT, undefined, topo)))
        continue;
      if (points.some(([px, pz]) => blocked(blockers, px, pz, FENCE_POINT))) continue;
      run.push({
        prop: {
          key: "prop.camp",
          variant: CAMP_VARIANTS.fence,
          x,
          z,
          ground: domeHeight(TERRAIN, mid),
          yaw: yawToward(tx, tz),
          scale: KIT_SCALE,
          radius: FENCE_LENGTH / 2,
        },
        points,
      });
    }
    return run;
  };
  let penA = facing;
  let fence: Segment[] = [];
  for (const off of [0, 0.35, -0.35, 0.7, -0.7, 1.05, -1.05]) {
    const run = fenceRun(facing + off);
    if (run.length > fence.length) {
      fence = run;
      penA = facing + off;
    }
    if (fence.length === FENCE_SEGMENTS) break;
  }
  for (const seg of fence) {
    props.push(seg.prop);
    for (const [px, pz] of seg.points) blockers.push({ x: px, z: pz, radius: FENCE_POINT });
  }

  // The flock grazes between the chip and the fence, gathered round the pen.
  const want = MIN_SHEEP + Math.floor(hash01(hex * 503 + 3) * (MAX_SHEEP - MIN_SHEEP + 1));
  let sheep = 0;
  for (let k = 0; k < 800 && sheep < want; k++) {
    const seed = hex * 6007 + k * 37 + 11;
    // The first tries keep the flock in the pen; later ones may wander round the whole ring.
    const spread = k < 200 ? 1.0 : Math.PI;
    const a = penA + (hash01(seed) * 2 - 1) * spread;
    const d = 0.42 + hash01(seed + 1) * (k < 200 ? 0.17 : 0.36);
    const variant = pickVariant(hash01(seed + 2));
    const size = 0.9 + hash01(seed + 3) * 0.2;
    const scale = SHEEP_SCALE * size;
    const r = SHEEP_RADIUS * size * (variant === SHEEP_VARIANTS.lamb ? 0.72 : 1);
    const [x, z] = at(a, d);
    if (!forestSpotClear(hex, x, z, r, undefined, topo)) continue;
    if (blocked(blockers, x, z, r, 0.95)) continue;
    put({
      key: "prop.sheep",
      variant,
      x,
      z,
      ground: domeHeight(TERRAIN, d),
      yaw: penA + Math.PI / 2 + (hash01(seed + 4) * 2 - 1) * 1.6,
      scale,
      radius: r,
    });
    sheep++;
  }

  // Up to two leafy bushes near the rim.
  const bushes = Math.floor(hash01(hex * 389 + 5) * 3);
  for (let k = 0, n = 0; k < 200 && n < bushes; k++) {
    const seed = hex * 4241 + k * 13 + 2;
    const a = hash01(seed) * TAU;
    const d = 0.6 + hash01(seed + 1) * 0.22;
    const scale = 0.7 + hash01(seed + 2) * 0.35;
    const r = BUSH_RADIUS * scale;
    const [x, z] = at(a, d);
    if (!forestSpotClear(hex, x, z, r, undefined, topo) || blocked(blockers, x, z, r)) continue;
    put({
      key: "prop.bush",
      variant: Math.floor(hash01(seed + 3) * 2),
      x,
      z,
      ground: domeHeight(TERRAIN, d),
      yaw: hash01(seed + 4) * TAU,
      scale,
      radius: r,
    });
    n++;
  }

  // Grass tufts keep out from under everything (hexTufts only avoids a trunk-sized core).
  const keepOut = blockers.map((b) => ({ ...b, radius: b.radius * 1.4 })) as PropInstance[];
  props.push(...hexTufts(hex, keepOut, TERRAIN, 10, 16, topo));

  // The path leaves the hut door and hugs the chip, the short way round, in short straight legs
  // whose bends sit on a ring just outside it, and ends among the flock.
  let ground: CampGround | null = null;
  if (hutA !== null && fence.length) {
    let span = wrap(penA - hutA);
    if (span > Math.PI) span -= TAU;
    const path: number[] = [];
    for (let i = 0; i <= PATH_LEGS; i++) {
      const d = i === 0 ? PATH_DOOR : i === PATH_LEGS ? PATH_END : PATH_RING;
      path.push(...at(hutA + (span * i) / PATH_LEGS, d));
    }
    ground = { path };
  }
  return { props, ground };
}

/** Every camp prop on the board (only pasture hexes carry them). */
export function pastureSheep(board: Board): PropInstance[] {
  const topo = topologyOf(board);
  return topo.hexes.flatMap((info) =>
    board.hexes[info.id]?.terrain === "pasture" ? hexCamp(info.id, topo).props : [],
  );
}

/** The flock of one pasture hex. */
export function hexFlock(hex: number, topo: Topology = STANDARD_TOPOLOGY): PropInstance[] {
  return hexCamp(hex, topo).props.filter((p) => p.key === "prop.sheep");
}
