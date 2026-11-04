// Board values and the beginner / variable setups (specs/board-topology, AGENTS.md §4).
import { nextInt, shuffle, type RngState } from "./rng.ts";
import { TOPOLOGY, hexAt, hexRing, type HexId } from "./topology.ts";

export type Terrain = "forest" | "pasture" | "fields" | "hills" | "mountains" | "desert";
export type Resource = "brick" | "grain" | "lumber" | "ore" | "wool";
export type HarborType = "generic" | Resource;

export interface BoardHex {
  readonly terrain: Terrain;
  /** 2–12 excluding 7; null only for the desert. */
  readonly token: number | null;
}

/** Plain JSON. Everything derivable lives in TOPOLOGY. */
export interface Board {
  /** Index = HexId, length 19. */
  readonly hexes: readonly BoardHex[];
  /** Index = harbor slot, length 9. */
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
 * Token placement order for start corner k (index into TOPOLOGY.cornerHexes):
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
  const [corner, s3] = nextInt(s2, TOPOLOGY.cornerHexes.length);
  const tokens = placeTokens(terrains, tokenSpiral(corner));
  const board: Board = {
    hexes: terrains.map((terrain, h) => ({ terrain, token: tokens[h] ?? null })),
    harbors,
    robber: terrains.indexOf("desert"),
  };
  return [board, s3];
}
