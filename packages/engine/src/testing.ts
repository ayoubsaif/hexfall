import { createRng, type RngSeed } from "./rng.ts";
import type { GameState } from "./state.ts";

/** Builds a minimal game state from a seed. Intended for tests. */
export function makeState({ seed }: { seed: RngSeed }): GameState {
  return { rng: createRng(seed) };
}
