import { describe, expect, it } from "vite-plus/test";
import {
  createRng,
  makeState,
  nextFloat,
  nextInt,
  nextUint32,
  shuffle,
  type RngState,
} from "../src/index.ts";

function take(state: RngState, n: number): [number[], RngState] {
  const out: number[] = [];
  let s = state;
  for (let i = 0; i < n; i++) {
    const [x, next] = nextUint32(s);
    out.push(x);
    s = next;
  }
  return [out, s];
}

describe("rng", () => {
  it("gives the same sequence for the same seed", () => {
    expect(take(createRng(7), 20)[0]).toEqual(take(createRng(7), 20)[0]);
    expect(take(createRng("abc"), 20)[0]).toEqual(take(createRng("abc"), 20)[0]);
  });

  it("gives different sequences for different seeds", () => {
    expect(take(createRng(1), 10)[0]).not.toEqual(take(createRng(2), 10)[0]);
    expect(take(createRng("a"), 10)[0]).not.toEqual(take(createRng("b"), 10)[0]);
    expect(take(createRng(0), 10)[0]).not.toEqual(take(createRng("0"), 10)[0]);
  });

  it("matches the pinned golden sequence for seed 42", () => {
    // sfc32 seeded by splitmix32(42), 12 warm-up rounds. Changing this breaks replays.
    expect(take(createRng(42), 5)[0]).toEqual([
      3825871779, 1851418855, 1383259262, 890322987, 2796912455,
    ]);
  });

  it("continues identically after a JSON round-trip mid-sequence", () => {
    const [, mid] = take(createRng(42), 37);
    const restored = JSON.parse(JSON.stringify(mid)) as RngState;
    expect(restored).toEqual(mid);
    expect(take(restored, 50)[0]).toEqual(take(mid, 50)[0]);
  });

  it("does not mutate the input state", () => {
    const s = createRng(5);
    const copy = { ...s };
    nextUint32(s);
    nextInt(s, 6);
    shuffle(s, [1, 2, 3]);
    expect(s).toEqual(copy);
  });

  it("nextFloat stays in [0, 1)", () => {
    let s = createRng(9);
    for (let i = 0; i < 10_000; i++) {
      const [x, next] = nextFloat(s);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      s = next;
    }
  });

  it("nextInt stays in range with a roughly uniform distribution", () => {
    const n = 6;
    const draws = 60_000;
    const counts = Array.from({ length: n }, () => 0);
    let s = createRng(123);
    for (let i = 0; i < draws; i++) {
      const [x, next] = nextInt(s, n);
      expect(Number.isInteger(x) && x >= 0 && x < n).toBe(true);
      counts[x] = (counts[x] ?? 0) + 1;
      s = next;
    }
    for (const c of counts) expect(Math.abs(c - draws / n)).toBeLessThan((draws / n) * 0.05);
    expect(nextInt(createRng(1), 1)[0]).toBe(0);
  });

  it("nextInt rejects invalid bounds", () => {
    const s = createRng(1);
    expect(() => nextInt(s, 0)).toThrow(RangeError);
    expect(() => nextInt(s, 2.5)).toThrow(RangeError);
    expect(() => nextInt(s, 2 ** 32 + 1)).toThrow(RangeError);
  });

  it("shuffle is deterministic and returns a permutation", () => {
    const items = Array.from({ length: 19 }, (_, i) => i);
    const [a, sa] = shuffle(createRng(42), items);
    const [b, sb] = shuffle(createRng(42), items);
    expect(a).toEqual(b);
    expect(sa).toEqual(sb);
    expect([...a].sort((x, y) => x - y)).toEqual(items);
    expect(a).not.toEqual(items);
    expect(items).toEqual(Array.from({ length: 19 }, (_, i) => i));
    expect(shuffle(createRng(43), items)[0]).not.toEqual(a);
  });

  it("makeState seeds the game RNG", () => {
    const state = makeState({ seed: 42 });
    expect(state.rng).toEqual(createRng(42));
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});
