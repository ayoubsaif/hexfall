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
  LARGE_HARBOR_BAG,
  LARGE_TERRAIN_BAG,
  LARGE_TOKEN_BAG,
  LETTER_VALUES,
  MAX_TOKEN_SHUFFLES,
  TERRAIN_BAG,
  createLargeBoard,
  createVariableBoard,
  placeLargeTokens,
  redNumbersApart,
  separateRedNumbers,
  tokenSpiral,
} from "./board.ts";
export type * from "./state.ts";
export {
  DEV_DECK,
  LARGE_DEV_DECK,
  applyAction,
  createGame,
  legalActions,
  rulesProfile,
  type RulesProfile,
} from "./game.ts";
export { playerView } from "./view.ts";
export {
  COSTS,
  DEFAULT_VICTORY_TARGET,
  MAX_VICTORY_TARGET,
  MIN_VICTORY_TARGET,
  RESOURCES,
  hiddenVp,
  publicVp,
  victoryTargetOf,
} from "./rules/common.ts";
export { SPECIAL_BUILD_MIN_PLAYERS } from "./rules/turn.ts";
export { RuleError, type RuleErrorCode } from "./rules/errors.ts";
export { longestRoadLength } from "./rules/longestRoad.ts";
export { harborsOf, maritimeRates } from "./rules/trade.ts";
export { makeState } from "./testing.ts";
