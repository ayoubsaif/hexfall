// Board values and the beginner / variable setups (specs/board-topology, AGENTS.md §4),
// plus the large 5–6 player board (specs/large-board).
import { nextInt, shuffle, type RngState } from "./rng.ts";
import {
  AXIAL_DIRECTIONS,
  LARGE_TOPOLOGY,
  STANDARD_TOPOLOGY,
  hexAt,
  hexRing,
  type BoardLayout,
  type HexId,
  type Topology,
} from "./topology.ts";

export type { BoardLayout } from "./topology.ts";

export type Terrain = "forest" | "pasture" | "fields" | "hills" | "mountains" | "desert";
export type Resource = "brick" | "grain" | "lumber" | "ore" | "wool";
export type HarborType = "generic" | Resource;

export interface BoardHex {
  readonly terrain: Terrain;
  /** 2–12 excluding 7; null only for the desert. */
  readonly token: number | null;
}

/** Plain JSON. Everything derivable lives in the layout's topology (topologyOf). */
export interface Board {
  /** Missing means "standard" (boards stored before the large board existed). */
  readonly layout?: BoardLayout;
  /** Index = HexId, length 19 (standard) or 30 (large). */
  readonly hexes: readonly BoardHex[];
  /** Index = harbor slot, length 9 (standard) or 11 (large). */
  readonly harbors: readonly HarborType[];
  readonly robber: HexId;
}

export const TERRAIN_RESOURCE: Readonly<Record<Terrain, Resource | null>> = {
  forest: "lumber",
  pasture: "wool",
  fields: "grain",
  hills: "brick",
  mountains: "ore",
  desert: null,
};

// REPLAY CONTRACT: the bag orders, the letter values and the draw order in
// createVariableBoard are part of every seeded game's replay. Changing any of
// them changes every variable board for a given seed (pinned by a test).

/** Fixed terrain bag order: 4 forest, 4 pasture, 4 fields, 3 hills, 3 mountains, 1 desert. */
export const TERRAIN_BAG: readonly Terrain[] = Object.freeze([
  ...Array<Terrain>(4).fill("forest"),
  ...Array<Terrain>(4).fill("pasture"),
  ...Array<Terrain>(4).fill("fields"),
  ...Array<Terrain>(3).fill("hills"),
  ...Array<Terrain>(3).fill("mountains"),
  "desert" as const,
]);

/** Fixed harbor bag order: 4 generic, then brick, grain, lumber, ore, wool. */
export const HARBOR_BAG: readonly HarborType[] = Object.freeze([
  "generic",
  "generic",
  "generic",
  "generic",
  "brick",
  "grain",
  "lumber",
  "ore",
  "wool",
] as const);

/** Number token values for letters A..R. */
export const LETTER_VALUES: readonly number[] = Object.freeze([
  5, 2, 6, 3, 8, 10, 9, 12, 11, 4, 8, 10, 9, 4, 5, 6, 3, 11,
]);

/**
 * Token placement order for start corner k (index into STANDARD_TOPOLOGY.cornerHexes):
 * the 12 outer hexes counter-clockwise from the corner, then the 6 middle-ring
 * hexes starting with the one inward of the corner, then the center.
 */
export function tokenSpiral(k: number): HexId[] {
  if (!Number.isInteger(k) || k < 0 || k > 5) throw new RangeError(`corner must be 0..5, got ${k}`);
  return [...hexRing(2, k), ...hexRing(1, k), ...hexRing(0, k)].map(
    ({ q, r }) => hexAt(q, r) ?? -1,
  );
}

/** Places the A–R tokens along `spiral`, skipping the desert without using a letter. */
function placeTokens(terrains: readonly Terrain[], spiral: readonly HexId[]): (number | null)[] {
  const tokens: (number | null)[] = terrains.map(() => null);
  let letter = 0;
  for (const h of spiral) {
    if (terrains[h] === "desert") continue;
    tokens[h] = LETTER_VALUES[letter] ?? null;
    letter++;
  }
  return tokens;
}

/** AGENTS.md §4a, in hex-id (reading) order. */
const BEGINNER_HEXES: readonly (readonly [Terrain, number | null])[] = [
  // Row 1
  ["mountains", 10],
  ["pasture", 2],
  ["forest", 9],
  // Row 2
  ["fields", 12],
  ["hills", 6],
  ["pasture", 4],
  ["hills", 10],
  // Row 3
  ["fields", 9],
  ["forest", 11],
  ["desert", null],
  ["forest", 3],
  ["mountains", 8],
  // Row 4
  ["forest", 8],
  ["mountains", 3],
  ["fields", 4],
  ["pasture", 5],
  // Row 5
  ["hills", 5],
  ["fields", 6],
  ["pasture", 11],
];

const BEGINNER_HARBORS: readonly HarborType[] = [
  "generic",
  "grain",
  "ore",
  "generic",
  "wool",
  "generic",
  "generic",
  "brick",
  "lumber",
];

/** The fixed beginner board (AGENTS.md §4a). Uses no randomness; fresh object each call. */
export function beginnerBoard(): Board {
  return {
    layout: "standard",
    hexes: BEGINNER_HEXES.map(([terrain, token]) => ({ terrain, token })),
    harbors: BEGINNER_HARBORS.slice(),
    robber: BEGINNER_HEXES.findIndex(([t]) => t === "desert"),
  };
}

/**
 * A variable board (AGENTS.md §4b). Draw order (replay contract): shuffle the
 * terrain bag, then the harbor bag, then pick the token start corner.
 */
export function createVariableBoard(rng: RngState): [Board, RngState] {
  const [terrains, s1] = shuffle(rng, TERRAIN_BAG);
  const [harbors, s2] = shuffle(s1, HARBOR_BAG);
  const [corner, s3] = nextInt(s2, STANDARD_TOPOLOGY.cornerHexes.length);
  const tokens = placeTokens(terrains, tokenSpiral(corner));
  const board: Board = {
    layout: "standard",
    hexes: terrains.map((terrain, h) => ({ terrain, token: tokens[h] ?? null })),
    harbors,
    robber: terrains.indexOf("desert"),
  };
  return [board, s3];
}

// ---- Large board (5–6 players, specs/large-board). REPLAY CONTRACT as above.

/** 6 forest, 6 pasture, 6 fields, 5 hills, 5 mountains, 2 deserts. */
export const LARGE_TERRAIN_BAG: readonly Terrain[] = Object.freeze([
  ...Array<Terrain>(6).fill("forest"),
  ...Array<Terrain>(6).fill("pasture"),
  ...Array<Terrain>(6).fill("fields"),
  ...Array<Terrain>(5).fill("hills"),
  ...Array<Terrain>(5).fill("mountains"),
  ...Array<Terrain>(2).fill("desert"),
]);

/** 5 generic, then brick, grain, lumber, ore, wool, wool. */
export const LARGE_HARBOR_BAG: readonly HarborType[] = Object.freeze([
  "generic",
  "generic",
  "generic",
  "generic",
  "generic",
  "brick",
  "grain",
  "lumber",
  "ore",
  "wool",
  "wool",
] as const);

/** Two each of 2 and 12, three each of 3, 4, 5, 6, 8, 9, 10, 11. */
export const LARGE_TOKEN_BAG: readonly number[] = Object.freeze([
  2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6, 8, 8, 8, 9, 9, 9, 10, 10, 10, 11, 11, 11, 12, 12,
]);

/** Token shuffles tried before the deterministic fallback separates the red numbers. */
export const MAX_TOKEN_SHUFFLES = 1000;

const isRed = (t: number | null): boolean => t === 6 || t === 8;

function neighborHexes(topo: Topology, h: HexId): HexId[] {
  const info = topo.hexes[h];
  if (!info) return [];
  const out: HexId[] = [];
  for (const [dq, dr] of AXIAL_DIRECTIONS) {
    const n = hexAt(info.q + dq, info.r + dr, topo);
    if (n !== undefined) out.push(n);
  }
  return out;
}

/** True if no two hexes with a 6 or 8 are adjacent. */
export function redNumbersApart(tokens: readonly (number | null)[], topo: Topology): boolean {
  for (let h = 0; h < tokens.length; h++) {
    if (!isRed(tokens[h] ?? null)) continue;
    if (neighborHexes(topo, h).some((n) => isRed(tokens[n] ?? null))) return false;
  }
  return true;
}

/**
 * Deterministic fallback: moves red tokens that touch another red onto the first
 * non-red token hex (by id) whose neighbors hold no red, swapping the tokens.
 * Leaves the desert(s) alone. Returns a new array.
 */
export function separateRedNumbers(
  tokens: readonly (number | null)[],
  topo: Topology,
): (number | null)[] {
  const out = [...tokens];
  const redNeighbor = (h: HexId, ignore: HexId): boolean =>
    neighborHexes(topo, h).some((n) => n !== ignore && isRed(out[n] ?? null));
  for (let guard = 0; guard < out.length * out.length; guard++) {
    const bad = out.findIndex((t, h) => isRed(t) && redNeighbor(h, -1));
    if (bad < 0) break;
    const target = out.findIndex(
      (t, h) => t !== null && !isRed(t) && h !== bad && !redNeighbor(h, bad),
    );
    if (target < 0) break;
    const tmp = out[bad] ?? null;
    out[bad] = out[target] ?? null;
    out[target] = tmp;
  }
  return out;
}

/**
 * Shuffles the 28 tokens onto the non-desert hexes, reshuffling until no 6/8 touch
 * (at most MAX_TOKEN_SHUFFLES tries, then separateRedNumbers). Returns the tokens
 * by hex id, the next RNG state and the number of shuffles used.
 */
export function placeLargeTokens(
  rng: RngState,
  terrains: readonly Terrain[],
): [(number | null)[], RngState, number] {
  const slots = terrains.flatMap((t, h) => (t === "desert" ? [] : [h]));
  let state = rng;
  let tokens: (number | null)[] = terrains.map(() => null);
  for (let attempt = 1; attempt <= MAX_TOKEN_SHUFFLES; attempt++) {
    const [bag, next] = shuffle(state, LARGE_TOKEN_BAG);
    state = next;
    tokens = terrains.map(() => null);
    slots.forEach((h, i) => (tokens[h] = bag[i] ?? null));
    if (redNumbersApart(tokens, LARGE_TOPOLOGY)) return [tokens, state, attempt];
  }
  return [separateRedNumbers(tokens, LARGE_TOPOLOGY), state, MAX_TOKEN_SHUFFLES];
}

/**
 * A large board (specs/large-board). Draw order (replay contract): shuffle the
 * terrain bag, then the harbor bag, then the token bag (repeated until no 6/8
 * touch). The robber starts on the desert with the lower hex id.
 */
export function createLargeBoard(rng: RngState): [Board, RngState] {
  const [terrains, s1] = shuffle(rng, LARGE_TERRAIN_BAG);
  const [harbors, s2] = shuffle(s1, LARGE_HARBOR_BAG);
  const [tokens, s3] = placeLargeTokens(s2, terrains);
  const board: Board = {
    layout: "large",
    hexes: terrains.map((terrain, h) => ({ terrain, token: tokens[h] ?? null })),
    harbors,
    robber: terrains.indexOf("desert"),
  };
  return [board, s3];
}
