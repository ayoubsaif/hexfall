import { describe, expect, it } from "vite-plus/test";
import { applyAction, legalActions } from "../src/game.ts";
import { cardTotal } from "../src/rules/common.ts";
import type { GameState } from "../src/state.ts";
import { give, makePlayState, putBuilding, step } from "../src/testing.ts";
import { STANDARD_TOPOLOGY } from "../src/topology.ts";

/** First seed whose opening roll is a 7, with the board arranged for the flow. */
function sevenGame(): GameState {
  for (let seed = 1; seed < 500; seed++) {
    const s = makePlayState({ seed, seat: 0, rolled: false });
    const probe = applyAction(s, { type: "rollDice", seat: 0 });
    if (
      probe.ok &&
      probe.state.turn.dice &&
      probe.state.turn.dice[0] + probe.state.turn.dice[1] === 7
    ) {
      return s;
    }
  }
  throw new Error("no seed rolls a 7");
}

describe("7 → discard → robber → steal → build (AGENTS.md §8)", () => {
  it("runs the whole sequence in order", () => {
    let s = sevenGame();
    const victimHex = 4;
    const victimVertex = STANDARD_TOPOLOGY.hexes[victimHex]!.vertices[0]!;
    putBuilding(s, victimVertex, 1);
    const ownVertex = STANDARD_TOPOLOGY.hexes[16]!.vertices[3]!;
    putBuilding(s, ownVertex, 0);
    give(s, 0, { brick: 4, lumber: 4 }); // 8 → discards 4
    give(s, 1, { wool: 9 }); // 9 → discards 4
    give(s, 2, { ore: 7 }); // 7 → keeps all

    s = step(s, { type: "rollDice", seat: 0 });
    expect(s.phase).toEqual({ kind: "discard", owed: [4, 4, 0, 0] });
    expect(legalActions(s, 0).moveRobber).toEqual([]);
    expect(applyAction(s, { type: "moveRobber", seat: 0, hex: victimHex, victim: 1 }).ok).toBe(
      false,
    );
    expect(legalActions(s, 2).discard).toBe(0);

    s = step(s, { type: "discard", seat: 1, cards: { wool: 4 } });
    s = step(s, { type: "discard", seat: 0, cards: { brick: 2, lumber: 2 } });
    expect(s.phase).toEqual({ kind: "moveRobber", source: "seven" });
    const opt = legalActions(s, 0).moveRobber.find((o) => o.hex === victimHex);
    expect(opt?.victims).toEqual([1]);

    s = step(s, { type: "moveRobber", seat: 0, hex: victimHex, victim: 1 });
    expect(s.robber).toBe(victimHex);
    expect(s.players[0]!.resources.wool).toBe(1);
    expect(cardTotal(s.players[1]!.resources)).toBe(4);
    expect(s.phase.kind).toBe("turn");

    const edge = STANDARD_TOPOLOGY.vertices[ownVertex]!.edges[0]!;
    expect(legalActions(s, 0).buildRoad).toContain(edge);
    s = step(s, { type: "buildRoad", seat: 0, edge });
    expect(s.edges[edge]).toBe(0);

    const types = s.log.map((e) => e.type);
    expect(types).toEqual([
      "diceRolled",
      "discarded",
      "discarded",
      "robberMoved",
      "stole",
      "built",
    ]);
    expect(cardTotal(s.bank) + s.players.reduce((n, p) => n + cardTotal(p.resources), 0)).toBe(95);
  });
});
