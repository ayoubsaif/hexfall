import { describe, expect, it } from "vite-plus/test";
import {
  LARGE_TOKEN_BAG,
  LARGE_TOPOLOGY,
  MAX_TOKEN_SHUFFLES,
  STANDARD_TOPOLOGY,
  beginnerBoard,
  createLargeBoard,
  createRng,
  createVariableBoard,
  placeLargeTokens,
  redNumbersApart,
  separateRedNumbers,
  type Board,
  type Terrain,
} from "../src/index.ts";

function count<T>(xs: readonly T[]): Map<T, number> {
  const m = new Map<T, number>();
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
  return m;
}

function large(seed: number): Board {
  return createLargeBoard(createRng(seed))[0];
}

describe("large board", () => {
  it("has the large-board component counts", () => {
    for (const seed of [1, 2, 3, 42, 999]) {
      const b = large(seed);
      expect(b.layout).toBe("large");
      expect(b.hexes).toHaveLength(30);
      expect(b.harbors).toHaveLength(11);
      const t = count(b.hexes.map((h) => h.terrain));
      expect(Object.fromEntries(t)).toEqual({
        forest: 6,
        pasture: 6,
        fields: 6,
        hills: 5,
        mountains: 5,
        desert: 2,
      });
      const tokens = b.hexes.map((h) => h.token).filter((x): x is number => x !== null);
      expect([...tokens].sort((a, c) => a - c)).toEqual([...LARGE_TOKEN_BAG]);
      for (const h of b.hexes) if (h.terrain === "desert") expect(h.token).toBeNull();
      const hb = count(b.harbors);
      expect(Object.fromEntries(hb)).toMatchObject({
        generic: 5,
        wool: 2,
        brick: 1,
        grain: 1,
        lumber: 1,
        ore: 1,
      });
      const deserts = b.hexes.flatMap((h, i) => (h.terrain === "desert" ? [i] : []));
      expect(b.robber).toBe(Math.min(...deserts));
    }
  });

  it("is deterministic from the seed and survives JSON", () => {
    const [a, ra] = createLargeBoard(createRng(7));
    const [b, rb] = createLargeBoard(createRng(7));
    expect(a).toEqual(b);
    expect(ra).toEqual(rb);
    expect(JSON.parse(JSON.stringify(a))).toEqual(a);
  });

  it("never puts 6/8 next to each other (200 seeds)", () => {
    for (let seed = 0; seed < 200; seed++) {
      const b = large(seed);
      expect(
        redNumbersApart(
          b.hexes.map((h) => h.token),
          LARGE_TOPOLOGY,
        ),
      ).toBe(true);
    }
  });

  it("needs few token shuffles (1000 seeds)", () => {
    let worst = 0;
    for (let seed = 0; seed < 1000; seed++) {
      const [terrains] = createLargeBoard(createRng(seed));
      const [, , attempts] = placeLargeTokens(
        createRng(seed + 1_000_000),
        terrains.hexes.map((h) => h.terrain),
      );
      worst = Math.max(worst, attempts);
    }
    expect(worst).toBeLessThan(MAX_TOKEN_SHUFFLES);
  });

  it("separates red numbers deterministically in the fallback", () => {
    // All six reds packed into hexes 0..5, everything else 2s; deserts at 28, 29.
    const tokens: (number | null)[] = Array.from({ length: 30 }, (_, h) =>
      h < 3 ? 6 : h < 6 ? 8 : h >= 28 ? null : 2,
    );
    expect(redNumbersApart(tokens, LARGE_TOPOLOGY)).toBe(false);
    const fixed = separateRedNumbers(tokens, LARGE_TOPOLOGY);
    expect(redNumbersApart(fixed, LARGE_TOPOLOGY)).toBe(true);
    expect(count(fixed)).toEqual(count(tokens));
    expect(fixed[28]).toBeNull();
    expect(fixed[29]).toBeNull();
    expect(separateRedNumbers(tokens, LARGE_TOPOLOGY)).toEqual(fixed);
  });

  it("does not touch standard boards", () => {
    expect(beginnerBoard().layout).toBe("standard");
    const [v] = createVariableBoard(createRng(3));
    expect(v.layout).toBe("standard");
    expect(v.hexes).toHaveLength(STANDARD_TOPOLOGY.hexes.length);
    const old: Board = JSON.parse(JSON.stringify({ ...v, layout: undefined })) as Board;
    expect(old.layout).toBeUndefined();
  });

  it("uses all terrain kinds in the bag", () => {
    const kinds: Terrain[] = ["forest", "pasture", "fields", "hills", "mountains", "desert"];
    expect(new Set(large(5).hexes.map((h) => h.terrain))).toEqual(new Set(kinds));
  });
});
