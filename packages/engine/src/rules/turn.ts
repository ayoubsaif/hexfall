// Ending a turn (AGENTS.md §5). Shared by the endTurn action and the turn timer.
import type { GameState, Seat } from "../state.ts";
import { assertActive, assertPhase, assertRolled, emit, nextSeat, playerOf } from "./common.ts";

/** Ends `seat`'s turn: cancels open offers and starts the next seat's turn, before its roll. */
export function endTurn(s: GameState, seat: Seat): void {
  assertPhase(s, "turn");
  assertActive(s, seat);
  assertRolled(s);
  playerOf(s, seat).boughtThisTurn = [];
  for (const o of s.offers) emit(s, { type: "tradeCancelled", offerId: o.id });
  s.offers = [];
  emit(s, { type: "turnEnded", seat });
  const next = nextSeat(s, seat);
  s.turn = { seat: next, number: s.turn.number + 1, rolled: false, devPlayed: false, dice: null };
  emit(s, { type: "turnStarted", seat: next, number: s.turn.number });
}
