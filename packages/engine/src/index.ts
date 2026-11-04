// Public entry of the rules engine. Pure, deterministic, no I/O.
export {
  createRng,
  nextFloat,
  nextInt,
  nextUint32,
  shuffle,
  type RngSeed,
  type RngState,
} from "./rng.ts";
export type { GameState } from "./state.ts";
export { makeState } from "./testing.ts";
