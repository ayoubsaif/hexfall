import type { RngState } from "./rng.ts";

/** Full game state. Plain JSON data; grows as rules are added. */
export type GameState = {
  readonly rng: RngState;
};
