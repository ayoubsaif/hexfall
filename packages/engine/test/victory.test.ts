import { describe, expect, it } from "vite-plus/test";
import { applyAction, legalActions } from "../src/game.ts";
import { publicVp } from "../src/rules/common.ts";
import type { Action, GameState } from "../src/state.ts";
import { failCode, give, makePlayState, putBuilding, step } from "../src/testing.ts";

/** Seat 0 with Longest Road + Largest Army (4) + 2 cities (4) + 1 settlement at vertex 20 (1) = 9 VP. */
function nineVp(): GameState {
  const s = makePlayState({ seat: 0 });
  s.longestRoad = 0;
  s.largestArmy = 0;
  s.players[0]!.knights = 3;
  putBuilding(s, 0, 0, "city");
  putBuilding(s, 10, 0, "city");
  putBuilding(s, 20, 0, "settlement");
  expect(publicVp(s, 0)).toBe(9);
  return s;
}

describe("victory (AGENTS.md §12)", () => {
  it("ends the game the moment the active player reaches 10 on their turn", () => {
    const s = nineVp();
    give(s, 0, { ore: 3, grain: 2 });
    const r = applyAction(s, { type: "buildCity", seat: 0, vertex: 20 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.phase.kind).toBe("ended");
    expect(r.state.winner).toBe(0);
    expect(r.events.at(-1)).toEqual({ type: "gameWon", seat: 0, vp: 10 });
  });

  it("hidden VP cards need a reveal, which is allowed only to reach 10", () => {
    const s = nineVp();
    s.players[0]!.devCards = ["victoryPoint"];
    s.players[0]!.boughtThisTurn = ["victoryPoint"]; // bought this turn is fine
    expect(s.phase.kind).toBe("turn");
    expect(legalActions(s, 0).revealVictoryPoints).toBe(true);
    const won = step(s, { type: "revealVictoryPoints", seat: 0 });
    expect(won.winner).toBe(0);
    expect(won.players[0]!.revealedVp).toBe(1);

    const low = makePlayState({ seat: 0 });
    low.players[0]!.devCards = ["victoryPoint"];
    expect(legalActions(low, 0).revealVictoryPoints).toBe(false);
    expect(failCode(low, { type: "revealVictoryPoints", seat: 0 })).toBe("cannot_reveal");
  });

  it("a reveal is only possible on the player's own turn", () => {
    const s = nineVp();
    s.turn.seat = 1;
    expect(failCode(s, { type: "revealVictoryPoints", seat: 0 })).toBe("not_your_turn");
  });

  it("10 VP on another player's turn waits for the player's own turn", () => {
    let s = makePlayState({ seat: 0 });
    for (const v of [0, 3, 6, 9, 12]) s.vertices[v] = { owner: 1, kind: "city" };
    give(s, 0, { ore: 1, wool: 1, grain: 1 });
    s = step(s, { type: "buyDevCard", seat: 0 });
    expect(s.winner).toBeNull();
    expect(s.phase.kind).toBe("turn");
    s = step(s, { type: "endTurn", seat: 0 });
    expect(s.winner).toBe(1);
  });

  it("rejects every action after the game has ended", () => {
    const s = nineVp();
    give(s, 0, { ore: 3, grain: 2 });
    const ended = step(s, { type: "buildCity", seat: 0, vertex: 20 });
    const attempts: Action[] = [
      { type: "endTurn", seat: 0 },
      { type: "rollDice", seat: 1 },
      { type: "buyDevCard", seat: 0 },
      { type: "maritimeTrade", seat: 0, give: "ore", get: "wool", count: 1 },
    ];
    for (const a of attempts) expect(failCode(ended, a)).toBe("game_over");
    const legal = legalActions(ended, 0);
    expect(legal.endTurn).toBe(false);
    expect(legal.buildRoad).toEqual([]);
  });
});
