// 3D mountains (specs/mountain-peaks): every mountain hex carries one big grey mountain in the
// middle, standing just behind the number chip (from the default camera) so it never covers the
// number. Around it: a few clusters of grey stones, one cluster of ore rocks with glowing blue
// seams like the ore resource icon, a few small spruces and some grey pebbles. Everything stays clear of the chip, the
// robber's spot, the hex corners (settlements, cities) and edges (roads). Pure and deterministic:
// it depends only on the hex id, so every player sees the same mountains.
import type { Board } from "@hexfall/engine";
import { STANDARD_TOPOLOGY, hexCenter, topologyOf, type Topology } from "@hexfall/engine/geometry";
import { TOKEN_RADIUS, domeHeight } from "../theme/index.ts";
import type { PropInstance } from "./coastScatter.ts";
import { TREE_VARIANTS, forestSpotClear, hash01 } from "./forestTrees.ts";

/** peak.glb variants: footprint radius and height at scale 1 (tools/blender/mountain-kit.py). */
export const PEAK_KINDS: readonly { radius: number; height: number }[] = [
  { radius: 0.2, height: 0.3 },
  { radius: 0.17, height: 0.232 },
  { radius: 0.19, height: 0.27 },
  { radius: 0.15, height: 0.201 },
  { radius: 0.25, height: 0.517 },
  { radius: 0.25, height: 0.498 },
];
/** The big centre mountains (peak.glb variants 4–5). About 1.4× a city, yet from the default
 * camera (55° down) it never hides the settlement on the back corner behind it. */
export const MOUNTAIN_VARIANTS = [4, 5];
/** The mountain's foot may come this close to the chip centre (the chip disc plus a gap): it
 * stands behind the chip, so it never covers the number. */
export const MOUNTAIN_CHIP_CLEAR = TOKEN_RADIUS + 0.04;
/** ore.glb: variants 0–2 are ore with blue seams, 3–5 the same clusters in plain grey stone. */
export const ORE_VARIANTS = 3;
export const STONE_VARIANT_BASE = 3;
export const MIN_STONES = 3;
export const MAX_STONES = 4;
/** Rock clusters are drawn larger than the model so they read at the default camera. */
export const ORE_SCALE = 1.5;
const ORE_RADIUS = 0.065;
const PINE_RADIUS = 0.03;
const PINE_SCALE = 0.5;
/** Pebbles: the grey stone clusters drawn small. */
export const PEBBLE_SCALE = 0.7;
const TERRAIN = "tile.mountains";
const TAU = Math.PI * 2;

interface Blocker {
  x: number;
  z: number;
  radius: number;
}

const blocked = (list: readonly Blocker[], x: number, z: number, r: number, k = 1) =>
  list.some((b) => Math.hypot(b.x - x, b.z - z) < (b.radius + r) * k);

/** The mountain, stones, ore, spruces and pebbles of one mountain hex. */
export function hexMountain(hex: number, topo: Topology = STANDARD_TOPOLOGY): PropInstance[] {
  const [cx, cz] = hexCenter(hex, topo);
  const at = (a: number, d: number) => [cx + Math.cos(a) * d, cz + Math.sin(a) * d] as const;
  const out: PropInstance[] = [];

  // The mountain: straight behind the chip (-z is away from the default camera), shrinking only
  // if it would not fit.
  const variant = MOUNTAIN_VARIANTS[Math.floor(hash01(hex * 733 + 1) * MOUNTAIN_VARIANTS.length)]!;
  const kind = PEAK_KINDS[variant]!;
  for (let scale = 1; scale > 0.5; scale *= 0.95) {
    const r = kind.radius * scale;
    const d = MOUNTAIN_CHIP_CLEAR + r + 0.005;
    const x = cx,
      z = cz - d;
    if (!forestSpotClear(hex, x, z, r, MOUNTAIN_CHIP_CLEAR, topo)) continue;
    out.push({
      key: "prop.peak",
      variant,
      x,
      z,
      ground: domeHeight(TERRAIN, d),
      yaw: hash01(hex * 389 + 2) * TAU,
      scale,
      radius: r,
    });
    break;
  }

  // Rock clusters round the chip: 3–4 grey stone clusters and one ore cluster.
  const stones = MIN_STONES + Math.floor(hash01(hex * 157 + 4) * (MAX_STONES - MIN_STONES + 1));
  const rocks = [true, ...Array.from({ length: stones }, () => false)]; // true = ore
  for (let k = 0, n = 0; k < 400 && n < rocks.length; k++) {
    const seed = hex * 3301 + k * 23 + 7;
    const a = hash01(seed) * TAU;
    const d = 0.42 + hash01(seed + 1) * 0.3;
    const r = ORE_RADIUS * ORE_SCALE;
    const [x, z] = at(a, d);
    if (!forestSpotClear(hex, x, z, r, undefined, topo) || blocked(out, x, z, r)) continue;
    const pick = Math.floor(hash01(seed + 2) * ORE_VARIANTS);
    out.push({
      key: "prop.ore",
      variant: rocks[n] ? pick : STONE_VARIANT_BASE + pick,
      x,
      z,
      ground: domeHeight(TERRAIN, d),
      yaw: hash01(seed + 3) * TAU,
      scale: ORE_SCALE * (0.9 + hash01(seed + 4) * 0.2),
      radius: r,
    });
    n++;
  }

  // A few small spruces.
  const pines = 2 + Math.floor(hash01(hex * 271 + 5) * 2);
  const pineKinds = [TREE_VARIANTS.spruce, TREE_VARIANTS.youngSpruce, TREE_VARIANTS.tallSpruce];
  for (let k = 0, n = 0; k < 300 && n < pines; k++) {
    const seed = hex * 2203 + k * 19 + 11;
    const a = hash01(seed) * TAU;
    const d = 0.4 + hash01(seed + 1) * 0.42;
    const scale = PINE_SCALE * (0.85 + hash01(seed + 2) * 0.3);
    const r = PINE_RADIUS * (scale / PINE_SCALE);
    const [x, z] = at(a, d);
    if (!forestSpotClear(hex, x, z, r, undefined, topo) || blocked(out, x, z, r)) continue;
    out.push({
      key: "prop.tree",
      variant: pineKinds[Math.floor(hash01(seed + 3) * pineKinds.length)]!,
      x,
      z,
      ground: domeHeight(TERRAIN, d),
      yaw: hash01(seed + 4) * TAU,
      scale,
      radius: r,
    });
    n++;
  }

  // Pebbles: small grey stones scattered over the scree.
  const rubble = 3 + Math.floor(hash01(hex * 619 + 6) * 3);
  for (let k = 0, n = 0; k < 300 && n < rubble; k++) {
    const seed = hex * 1709 + k * 13 + 17;
    const a = hash01(seed) * TAU;
    const d = 0.38 + hash01(seed + 1) * 0.45;
    const scale = PEBBLE_SCALE * (0.8 + hash01(seed + 2) * 0.4);
    const r = ORE_RADIUS * scale;
    const [x, z] = at(a, d);
    if (!forestSpotClear(hex, x, z, r, undefined, topo) || blocked(out, x, z, r, 0.9)) continue;
    out.push({
      key: "prop.ore",
      variant: STONE_VARIANT_BASE + Math.floor(hash01(seed + 3) * ORE_VARIANTS),
      x,
      z,
      ground: domeHeight(TERRAIN, d),
      yaw: hash01(seed + 4) * TAU,
      scale,
      radius: r,
    });
    n++;
  }
  return out;
}

/** Every mountain prop on the board (only mountain hexes carry them). */
export function mountainPeaks(board: Board): PropInstance[] {
  const topo = topologyOf(board);
  return topo.hexes.flatMap((info) =>
    board.hexes[info.id]?.terrain === "mountains" ? hexMountain(info.id, topo) : [],
  );
}
