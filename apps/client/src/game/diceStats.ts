// Dice statistics for the log drawer's "Dice" tab (specs/game-hud "Dice statistics").
import type { GameEvent } from "@hexfall/engine";

/** Every possible total of two dice, in order. */
export const DICE_TOTALS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export type DiceTotal = (typeof DICE_TOTALS)[number];

export interface DiceCounts {
  /** How many turn rolls landed on each total. */
  counts: Record<DiceTotal, number>;
  /** Number of turn rolls counted. */
  total: number;
}

/** Counts the turn rolls (`diceRolled`) in a log. Rolls for turn order are not counted. */
export function diceCounts(log: readonly GameEvent[]): DiceCounts {
  const counts = Object.fromEntries(DICE_TOTALS.map((n) => [n, 0])) as Record<DiceTotal, number>;
  let total = 0;
  for (const e of log) {
    if (e.type !== "diceRolled") continue;
    counts[e.total as DiceTotal] += 1;
    total += 1;
  }
  return { counts, total };
}
