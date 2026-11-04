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
export * from "./geometry.ts";
export {
  HARBOR_BAG,
  LETTER_VALUES,
  TERRAIN_BAG,
  createVariableBoard,
  tokenSpiral,
} from "./board.ts";
export type * from "./state.ts";
export { DEV_DECK, applyAction, createGame, legalActions } from "./game.ts";
export { playerView } from "./view.ts";
export { COSTS, RESOURCES, WIN_VP, hiddenVp, publicVp } from "./rules/common.ts";
export { RuleError, type RuleErrorCode } from "./rules/errors.ts";
export { longestRoadLength } from "./rules/longestRoad.ts";
export { harborsOf, maritimeRates } from "./rules/trade.ts";
export { makeState } from "./testing.ts";
