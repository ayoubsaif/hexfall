// Numbers of the 5–6 player extension and the victory target that the HUD needs
// (openspec add-5-6-player-extension). App code never runs engine code, so they are
// mirrored here; test/game/extension.test.ts checks them against the engine.

/** Victory target range and default (specs/rules-engine "Victory target"). */
export const MIN_VICTORY_TARGET = 8;
export const MAX_VICTORY_TARGET = 15;
export const DEFAULT_VICTORY_TARGET = 10;

/** From this many seats the game uses the large board and the Special Building Phase. */
export const LARGE_BOARD_SEATS = 5;

/** Cards of each resource in the bank: 19, or 24 with 5–6 players. */
export function bankPerResource(playerCount: number): number {
  return playerCount >= LARGE_BOARD_SEATS ? 24 : 19;
}
