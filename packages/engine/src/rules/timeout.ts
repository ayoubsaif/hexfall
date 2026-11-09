// System-only `timeout` action (turn timer, change floating-hud-turn-timer,
// design.md decision 1). Resolves whatever the game is waiting for by applying
// the same rule functions a player's own moves use. Every choice is drawn from
// the state RNG, so a replay of seed + actions reproduces it exactly.
import type { Resource } from "../board.ts";
import type { GameState, ResourceBundle, Seat } from "../state.ts";
import { RESOURCES, emit, playerOf, randInt } from "./common.ts";
import * as dev from "./devCards.ts";
import { check } from "./errors.ts";
import * as production from "./production.ts";
import * as robber from "./robber.ts";
import * as setup from "./setup.ts";
import { endTurn, passSpecialBuild } from "./turn.ts";

/** Uniform pick from a non-empty list, advancing s.rng. */
function pick<T>(s: GameState, xs: readonly T[]): T {
  return xs[randInt(s, xs.length)] as T;
}

/** `n` cards drawn one at a time, each uniform over the cards left in the seat's hand. */
function randomDiscard(s: GameState, seat: Seat, n: number): ResourceBundle {
  const hand = { ...playerOf(s, seat).resources };
  const out: ResourceBundle = {};
  for (let i = 0; i < n; i++) {
    const cards: Resource[] = [];
    for (const r of RESOURCES) for (let k = 0; k < hand[r]; k++) cards.push(r);
    const r = pick(s, cards);
    hand[r]--;
    out[r] = (out[r] ?? 0) + 1;
  }
  return out;
}

/** Applies a `timeout` to the draft state (the caller has rejected the ended phase). */
export function resolveTimeout(s: GameState): void {
  const phase = s.phase;
  const active = s.turn.seat;
  switch (phase.kind) {
    case "rollForOrder": {
      const pending = phase.contenders.filter((c) => phase.rolls[c] === null);
      emit(s, { type: "timedOut", phase: phase.kind, seats: pending });
      // Contenders roll in this order anyway; a tie at the end starts a new round
      // that waits for the tied seats again.
      for (const seat of pending) setup.rollForOrder(s, { type: "rollForOrder", seat });
      return;
    }
    case "setup": {
      emit(s, { type: "timedOut", phase: phase.kind, seats: [active] });
      if (phase.step === "settlement") {
        const vertex = pick(s, setup.legalSetupSettlements(s, active));
        setup.placeSettlement(s, { type: "placeSettlement", seat: active, vertex });
      }
      const edge = pick(s, setup.legalSetupRoads(s, active));
      setup.placeRoad(s, { type: "placeRoad", seat: active, edge });
      return;
    }
    case "turn": {
      emit(s, { type: "timedOut", phase: phase.kind, seats: [active] });
      if (s.turn.rolled) endTurn(s, active);
      else production.rollDice(s, { type: "rollDice", seat: active });
      return;
    }
    case "discard": {
      const owing: Seat[] = [];
      phase.owed.forEach((n, seat) => {
        if (n > 0) owing.push(seat);
      });
      emit(s, { type: "timedOut", phase: phase.kind, seats: owing });
      for (const seat of owing) {
        const cards = randomDiscard(s, seat, phase.owed[seat] ?? 0);
        robber.discard(s, { type: "discard", seat, cards });
      }
      return;
    }
    case "moveRobber": {
      emit(s, { type: "timedOut", phase: phase.kind, seats: [active] });
      const option = pick(s, robber.robberOptions(s, active));
      const victim = option.victims.length > 0 ? pick(s, option.victims) : null;
      robber.moveRobber(s, { type: "moveRobber", seat: active, hex: option.hex, victim });
      return;
    }
    case "roadBuilding": {
      emit(s, { type: "timedOut", phase: phase.kind, seats: [active] });
      while (s.phase.kind === "roadBuilding") {
        const edges = dev.roadBuildingRoads(s, active);
        if (edges.length === 0) {
          s.phase = { kind: "turn" };
          break;
        }
        dev.placeFreeRoad(s, { type: "buildRoad", seat: active, edge: pick(s, edges) });
      }
      return;
    }
    case "specialBuild": {
      emit(s, { type: "timedOut", phase: phase.kind, seats: [phase.current] });
      passSpecialBuild(s, { seat: phase.current });
      return;
    }
    case "ended":
      check(false, "game_over", "the game has ended");
  }
}
