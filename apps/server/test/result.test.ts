// earlyResult: most total VP wins, hidden VP cards count, ties share (specs/early-end).
import { createGame, type GameState } from "@hexfall/engine";
import { describe, expect, it } from "vite-plus/test";
import { earlyResult } from "../src/rooms/result.ts";

/** A 3-player game with no buildings or special cards: everyone at 0 VP. */
function bare(): GameState {
  const s = createGame({ seed: "result", mode: "variable", playerCount: 3 });
  s.vertices = s.vertices.map(() => null);
  s.longestRoad = null;
  s.largestArmy = null;
  return s;
}

const settle = (s: GameState, vertex: number, owner: number, kind: "settlement" | "city") => {
  s.vertices[vertex] = { owner, kind };
};

describe("earlyResult", () => {
  it("Clear leader", () => {
    const s = bare();
    settle(s, 0, 0, "city");
    settle(s, 10, 1, "city");
    settle(s, 20, 1, "settlement");
    s.longestRoad = 1;
    expect(earlyResult(s, 42)).toEqual({
      reason: "host",
      at: 42,
      winners: [1],
      scores: [
        { seat: 0, vp: 2, hiddenVp: 0 },
        { seat: 1, vp: 5, hiddenVp: 0 },
        { seat: 2, vp: 0, hiddenVp: 0 },
      ],
    });
  });

  it("Hidden VP cards count", () => {
    const s = bare();
    settle(s, 0, 0, "city");
    settle(s, 10, 1, "city");
    s.players[0]!.devCards = ["victoryPoint", "knight"];
    const r = earlyResult(s, 0);
    expect(r.winners).toEqual([0]);
    expect(r.scores[0]).toEqual({ seat: 0, vp: 3, hiddenVp: 1 });
  });

  it("revealed VP cards count once, through public VP", () => {
    const s = bare();
    s.players[2]!.revealedVp = 2;
    expect(earlyResult(s, 0).scores[2]).toEqual({ seat: 2, vp: 2, hiddenVp: 0 });
  });

  it("Tie shared", () => {
    const s = bare();
    settle(s, 0, 0, "city");
    settle(s, 10, 2, "settlement");
    settle(s, 20, 2, "settlement");
    expect(earlyResult(s, 0).winners).toEqual([0, 2]);
  });

  it("everyone wins when nobody has scored (ended during setup)", () => {
    expect(earlyResult(bare(), 0).winners).toEqual([0, 1, 2]);
  });
});
