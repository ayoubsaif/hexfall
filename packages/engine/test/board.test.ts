import { describe, expect, it } from "vite-plus/test";
import {
  HARBOR_BAG,
  LETTER_VALUES,
  TERRAIN_BAG,
  TERRAIN_RESOURCE,
  TOPOLOGY,
  beginnerBoard,
  createRng,
  createVariableBoard,
  nextInt,
  shuffle,
  tokenSpiral,
  type Board,
  type RngState,
} from "../src/index.ts";

function counts<T>(items: readonly T[]): Map<T, number> {
  const m = new Map<T, number>();
  for (const x of items) m.set(x, (m.get(x) ?? 0) + 1);
  return m;
}

function sortedCounts<T>(items: readonly T[]): [T, number][] {
  return [...counts(items).entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0])));
}

/** Replays the documented draw order to recover the start corner. */
function startCorner(rng: RngState): number {
  const [, s1] = shuffle(rng, TERRAIN_BAG);
  const [, s2] = shuffle(s1, HARBOR_BAG);
  return nextInt(s2, 6)[0];
}

function expectComponentCounts(board: Board): void {
  expect(board.hexes).toHaveLength(19);
  expect(board.harbors).toHaveLength(9);
  expect(sortedCounts(board.hexes.map((h) => h.terrain))).toEqual([
    ["desert", 1],
    ["fields", 4],
    ["forest", 4],
    ["hills", 3],
    ["mountains", 3],
    ["pasture", 4],
  ]);
  const tokens = board.hexes.map((h) => h.token).filter((t): t is number => t !== null);
  expect(tokens.sort((a, b) => a - b)).toEqual([
    2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12,
  ]);
  expect(sortedCounts(board.harbors)).toEqual([
    ["brick", 1],
    ["generic", 4],
    ["grain", 1],
    ["lumber", 1],
    ["ore", 1],
    ["wool", 1],
  ]);
  const robberHex = board.hexes[board.robber];
  expect(robberHex?.terrain).toBe("desert");
  expect(robberHex?.token).toBeNull();
  for (const h of board.hexes) expect(h.token === null).toBe(h.terrain === "desert");
}

describe("board value", () => {
  it("maps terrain to resource", () => {
    expect(TERRAIN_RESOURCE.desert).toBeNull();
    expect(TERRAIN_RESOURCE.forest).toBe("lumber");
    expect(TERRAIN_RESOURCE.hills).toBe("brick");
  });

  it("round-trips through JSON", () => {
    const b = beginnerBoard();
    expect(JSON.parse(JSON.stringify(b))).toEqual(b);
    const [v] = createVariableBoard(createRng(1));
    expect(JSON.parse(JSON.stringify(v))).toEqual(v);
  });

  it("holds the component counts for the beginner board and 200 variable boards", () => {
    expectComponentCounts(beginnerBoard());
    for (let seed = 0; seed < 200; seed++) {
      expectComponentCounts(createVariableBoard(createRng(seed))[0]);
    }
  });
});

describe("beginner board", () => {
  it("matches the AGENTS.md §4a table", () => {
    const b = beginnerBoard();
    expect(b.hexes.map((h) => [h.terrain, h.token])).toEqual([
      ["mountains", 10],
      ["pasture", 2],
      ["forest", 9],
      ["fields", 12],
      ["hills", 6],
      ["pasture", 4],
      ["hills", 10],
      ["fields", 9],
      ["forest", 11],
      ["desert", null],
      ["forest", 3],
      ["mountains", 8],
      ["forest", 8],
      ["mountains", 3],
      ["fields", 4],
      ["pasture", 5],
      ["hills", 5],
      ["fields", 6],
      ["pasture", 11],
    ]);
    expect(b.hexes[0]).toEqual({ terrain: "mountains", token: 10 });
    expect(b.hexes[9]).toEqual({ terrain: "desert", token: null });
    expect(b.hexes[18]).toEqual({ terrain: "pasture", token: 11 });
    expect(b.robber).toBe(9);
  });

  it("has the harbor order", () => {
    expect(beginnerBoard().harbors).toEqual([
      "generic",
      "grain",
      "ore",
      "generic",
      "wool",
      "generic",
      "generic",
      "brick",
      "lumber",
    ]);
  });

  it("uses no randomness and returns equal, independent boards", () => {
    const a = beginnerBoard();
    const b = beginnerBoard();
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
    expect(beginnerBoard.length).toBe(0);
  });
});

describe("variable board", () => {
  it("is deterministic from the seed", () => {
    const [a, sa] = createVariableBoard(createRng("same"));
    const [b, sb] = createVariableBoard(createRng("same"));
    expect(a).toEqual(b);
    expect(sa).toEqual(sb);
  });

  it("does not mutate the input state or the bags", () => {
    const rng = createRng(5);
    const copy = { ...rng };
    createVariableBoard(rng);
    expect(rng).toEqual(copy);
    expect(TERRAIN_BAG).toHaveLength(19);
    expect(HARBOR_BAG).toHaveLength(9);
  });

  it("follows the documented draw order and returns the state after it", () => {
    const rng = createRng(77);
    const [terrains, s1] = shuffle(rng, TERRAIN_BAG);
    const [harbors, s2] = shuffle(s1, HARBOR_BAG);
    const [, s3] = nextInt(s2, 6);
    const [board, next] = createVariableBoard(rng);
    expect(board.hexes.map((h) => h.terrain)).toEqual(terrains);
    expect(board.harbors).toEqual(harbors);
    expect(next).toEqual(s3);
  });

  it("varies the layout across 20 seeds", () => {
    const layouts = new Set<string>();
    for (let seed = 0; seed < 20; seed++) {
      const [b] = createVariableBoard(createRng(seed));
      layouts.add(b.hexes.map((h) => h.terrain).join(","));
    }
    expect(layouts.size).toBeGreaterThanOrEqual(2);
  });

  it("builds each spiral from the corner, counter-clockwise along the coast, then inward", () => {
    for (let k = 0; k < 6; k++) {
      const spiral = tokenSpiral(k);
      expect(spiral).toHaveLength(19);
      expect(new Set(spiral).size).toBe(19);
      expect(spiral[0]).toBe(TOPOLOGY.cornerHexes[k]);
      expect(spiral[18]).toBe(9);
      const hex = (i: number) => TOPOLOGY.hexes[spiral[i] ?? -1]!;
      const dist = (i: number, j: number) => {
        const a = hex(i);
        const b = hex(j);
        const dq = a.q - b.q;
        const dr = a.r - b.r;
        return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr));
      };
      // Consecutive spiral hexes are adjacent; the middle ring starts next to the corner.
      for (let i = 1; i < 19; i++) expect(dist(i - 1, i)).toBe(1);
      expect(dist(0, 12)).toBe(1);
      // Counter-clockwise on screen (x right, z down): negative signed area for the outer ring.
      let area = 0;
      for (let i = 0; i < 12; i++) {
        const a = hex(i);
        const b = hex((i + 1) % 12);
        const [ax, az] = [2 * a.q + a.r, 3 * a.r];
        const [bx, bz] = [2 * b.q + b.r, 3 * b.r];
        area += ax * bz - bx * az;
      }
      expect(area).toBeLessThan(0);
    }
  });

  it("places A=5 on the start corner and B=2 on the next coastal hex", () => {
    let checked = 0;
    for (let seed = 0; seed < 50; seed++) {
      const rng = createRng(seed);
      const [board] = createVariableBoard(rng);
      const spiral = tokenSpiral(startCorner(rng));
      const first = board.hexes[spiral[0] ?? -1];
      const second = board.hexes[spiral[1] ?? -1];
      if (first?.terrain === "desert" || second?.terrain === "desert") continue;
      expect(first?.token).toBe(5);
      expect(second?.token).toBe(2);
      checked++;
    }
    expect(checked).toBeGreaterThan(30);
  });

  it("skips the desert without consuming a letter", () => {
    let checked = 0;
    for (let seed = 0; seed < 200; seed++) {
      const rng = createRng(seed);
      const [board] = createVariableBoard(rng);
      const spiral = tokenSpiral(startCorner(rng));
      const pos = spiral.findIndex((h) => board.hexes[h]?.terrain === "desert");
      expect(board.hexes[spiral[pos] ?? -1]?.token).toBeNull();
      expect(board.robber).toBe(spiral[pos]);
      if (pos < 18) {
        expect(board.hexes[spiral[pos + 1] ?? -1]?.token).toBe(LETTER_VALUES[pos]);
        checked++;
      }
      // Full order: letters in spiral order with the desert removed.
      const tokens = spiral.map((h) => board.hexes[h]?.token).filter((t) => t !== null);
      expect(tokens).toEqual([...LETTER_VALUES]);
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("matches the pinned board for seed 'hexfall' (replay contract)", () => {
    const [board, next] = createVariableBoard(createRng("hexfall"));
    expect({
      hexes: board.hexes.map((h) => `${h.terrain}:${h.token ?? "-"}`).join(" "),
      harbors: board.harbors.join(" "),
      robber: board.robber,
      next,
    }).toMatchInlineSnapshot(`
      {
        "harbors": "grain generic generic lumber brick wool generic ore generic",
        "hexes": "forest:6 hills:2 pasture:5 fields:3 fields:9 fields:10 desert:- pasture:8 mountains:4 pasture:11 pasture:3 hills:8 forest:10 mountains:5 mountains:6 fields:4 forest:9 hills:12 forest:11",
        "next": {
          "a": 1799395449,
          "b": 599608343,
          "c": 2173904129,
          "d": 3871435821,
        },
        "robber": 6,
      }
    `);
  });
});
