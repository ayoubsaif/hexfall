// Seeded, pure PRNG for the engine: sfc32 seeded through splitmix32.
// The state is plain JSON data and every function returns the next state
// instead of mutating anything, so a game can be replayed from its seed.

/** sfc32 state: four uint32 words. Plain data, safe to JSON round-trip. */
export type RngState = {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
};

export type RngSeed = number | string;

const UINT32_RANGE = 0x1_0000_0000;

/** FNV-1a over UTF-16 code units: maps a string seed to a uint32. */
function hashString(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** One splitmix32 step: returns [output, nextSeed]. */
function splitmix32(s: number): [number, number] {
  const next = (s + 0x9e3779b9) | 0;
  let z = next;
  z = Math.imul(z ^ (z >>> 16), 0x21f0aaad);
  z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
  return [(z ^ (z >>> 15)) >>> 0, next];
}

/** Creates an RNG state from an integer seed (taken mod 2^32) or a string seed. */
export function createRng(seed: RngSeed): RngState {
  let s: number;
  if (typeof seed === "string") {
    s = hashString(seed);
  } else {
    if (!Number.isInteger(seed)) throw new RangeError(`RNG seed must be an integer, got ${seed}`);
    s = seed >>> 0;
  }
  const words: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [out, next] = splitmix32(s);
    words.push(out);
    s = next;
  }
  let state: RngState = { a: words[0] ?? 0, b: words[1] ?? 0, c: words[2] ?? 0, d: words[3] ?? 0 };
  // Standard sfc32 warm-up.
  for (let i = 0; i < 12; i++) state = nextUint32(state)[1];
  return state;
}

/** Next uint32 in [0, 2^32). */
export function nextUint32(state: RngState): [number, RngState] {
  const { a, b, c, d } = state;
  const t = (((a + b) | 0) + d) | 0;
  const nc = (c << 21) | (c >>> 11);
  return [
    t >>> 0,
    {
      a: (b ^ (b >>> 9)) >>> 0,
      b: (c + (c << 3)) >>> 0,
      c: (nc + t) >>> 0,
      d: (d + 1) >>> 0,
    },
  ];
}

/** Next float in [0, 1). */
export function nextFloat(state: RngState): [number, RngState] {
  const [x, next] = nextUint32(state);
  return [x / UINT32_RANGE, next];
}

/** Unbiased integer in [0, maxExclusive) via rejection sampling. */
export function nextInt(state: RngState, maxExclusive: number): [number, RngState] {
  if (!Number.isInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > UINT32_RANGE) {
    throw new RangeError(`maxExclusive must be an integer in [1, 2^32], got ${maxExclusive}`);
  }
  const limit = UINT32_RANGE - (UINT32_RANGE % maxExclusive);
  let s = state;
  for (;;) {
    const [x, next] = nextUint32(s);
    s = next;
    if (x < limit) return [x % maxExclusive, s];
  }
}

/** Fisher–Yates shuffle. Returns a new array and the next state; the input is untouched. */
export function shuffle<T>(state: RngState, items: readonly T[]): [T[], RngState] {
  const out = items.slice();
  let s = state;
  for (let i = out.length - 1; i > 0; i--) {
    const [j, next] = nextInt(s, i + 1);
    s = next;
    const tmp = out[i] as T;
    out[i] = out[j] as T;
    out[j] = tmp;
  }
  return [out, s];
}
