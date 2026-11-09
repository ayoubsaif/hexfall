// Ending a turn (AGENTS.md §5) and the Special Building Phase of 5–6 player games
// (specs/special-building-phase). Shared by the actions and the turn timer.
import type { ActionOf, GameState, Seat } from "../state.ts";
import { assertActive, assertPhase, assertRolled, emit, nextSeat, playerOf } from "./common.ts";
import { check } from "./errors.ts";

/** Games with this many players or more have a Special Building Phase after each turn. */
export const SPECIAL_BUILD_MIN_PLAYERS = 5;

/** Starts the turn of the seat after `from`, before its roll. */
function startNextTurn(s: GameState, from: Seat): void {
  const next = nextSeat(s, from);
  s.phase = { kind: "turn" };
  s.turn = { seat: next, number: s.turn.number + 1, rolled: false, devPlayed: false, dice: null };
  emit(s, { type: "turnStarted", seat: next, number: s.turn.number });
}

/**
 * Ends `seat`'s turn: cancels open offers, then opens the Special Building Phase
 * (5–6 players) or starts the next seat's turn.
 */
export function endTurn(s: GameState, seat: Seat): void {
  assertPhase(s, "turn");
  assertActive(s, seat);
  assertRolled(s);
  playerOf(s, seat).boughtThisTurn = [];
  for (const o of s.offers) emit(s, { type: "tradeCancelled", offerId: o.id });
  s.offers = [];
  emit(s, { type: "turnEnded", seat });
  if (s.playerCount < SPECIAL_BUILD_MIN_PLAYERS) {
    startNextTurn(s, seat);
    return;
  }
  const order: Seat[] = [];
  for (let i = 1; i < s.playerCount; i++) order.push((seat + i) % s.playerCount);
  const [current, ...queue] = order as [Seat, ...Seat[]];
  s.phase = { kind: "specialBuild", current, queue, afterTurnOf: seat };
  emit(s, { type: "specialBuildOpened", seat: current });
}

/**
 * Closes the current window. Cards bought in it become playable on the seat's
 * next turn. The next window opens, or the next turn starts after the last one.
 */
export function passSpecialBuild(
  s: GameState,
  a: Pick<ActionOf<"passSpecialBuild">, "seat">,
): void {
  const phase = s.phase;
  check(phase.kind === "specialBuild", "wrong_phase", `not allowed during ${phase.kind}`);
  check(phase.current === a.seat, "not_your_turn", `it is not seat ${a.seat}'s building window`);
  playerOf(s, a.seat).boughtThisTurn = [];
  emit(s, { type: "specialBuildPassed", seat: a.seat });
  const [next, ...queue] = phase.queue;
  if (next === undefined) {
    startNextTurn(s, phase.afterTurnOf);
    return;
  }
  s.phase = { kind: "specialBuild", current: next, queue, afterTurnOf: phase.afterTurnOf };
  emit(s, { type: "specialBuildOpened", seat: next });
}
