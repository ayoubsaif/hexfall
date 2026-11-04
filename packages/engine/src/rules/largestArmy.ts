// Largest Army (AGENTS.md §10b, §13.6). Owner: cards agent.
import type { GameState } from "../state.ts";
import { emit, playerOf } from "./common.ts";

/** Minimum played Knights for Largest Army. */
const MIN_KNIGHTS = 3;

/** Moves Largest Army after a Knight is played (strictly more, 3 minimum), emitting largestArmy. */
export function updateLargestArmy(s: GameState): void {
  const seat = s.turn.seat;
  const k = playerOf(s, seat).knights;
  if (k < MIN_KNIGHTS) return;
  const holder = s.largestArmy;
  if (holder === seat) return;
  if (holder !== null && k <= playerOf(s, holder).knights) return;
  s.largestArmy = seat;
  emit(s, { type: "largestArmy", from: holder, to: seat, knights: k });
}
