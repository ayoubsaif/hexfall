import { describe, expect, it } from "vite-plus/test";
import {
  STANDARD_TOPOLOGY,
  createGame,
  legalActions,
  playerView,
  type GameState,
  type Seat,
} from "@hexfall/engine";
import { BotRng, chooseAction } from "../src/index.ts";
import { producedBy, vertexValue } from "../src/eval.ts";

function act(s: GameState, seat: Seat, seed = 1) {
  return chooseAction(playerView(s, seat), legalActions(s, seat), new BotRng(seed));
}

/** A started turn-phase game where `seat` 0 is active and has rolled. */
function turnState(): GameState {
  const s = createGame({ seed: 9, playerCount: 3, mode: "variable", startingPlayer: 0 });
  s.phase = { kind: "turn" };
  s.turn = { seat: 0, number: 5, rolled: true, devPlayed: false, dice: [3, 4] };
  s.vertices[20] = { owner: 0, kind: "settlement" };
  s.players[0]!.pieces.settlements = 4;
  return s;
}

function give(
  s: GameState,
  seat: Seat,
  hand: Partial<Record<"brick" | "grain" | "lumber" | "ore" | "wool", number>>,
) {
  const p = s.players[seat]!;
  for (const r of Object.keys(p.resources) as (keyof typeof p.resources)[]) {
    s.bank[r] += p.resources[r];
    p.resources[r] = 0;
  }
  for (const [r, n] of Object.entries(hand) as [keyof typeof p.resources, number][]) {
    p.resources[r] = n;
    s.bank[r] -= n;
  }
}

describe("setup", () => {
  it("places the first settlement on the best legal vertex", () => {
    const s = createGame({ seed: 3, playerCount: 3, mode: "variable", startingPlayer: 0 });
    // Roll for order is skipped by startingPlayer: seat 0 places first.
    expect(s.phase.kind).toBe("setup");
    const view = playerView(s, 0);
    const legal = legalActions(s, 0);
    const a = chooseAction(view, legal, new BotRng(1));
    expect(a?.type).toBe("placeSettlement");
    const owned = producedBy(view, 0);
    const bestValue = Math.max(...legal.placeSettlement.map((v) => vertexValue(view, v, owned)));
    const chosen = a?.type === "placeSettlement" ? a.vertex : -1;
    expect(vertexValue(view, chosen, owned)).toBeCloseTo(bestValue, 5);
  });

  it("places the road next to the settlement it just placed", () => {
    const s = createGame({ seed: 3, playerCount: 3, mode: "variable", startingPlayer: 0 });
    const first = act(s, 0)!;
    if (first.type !== "placeSettlement") throw new Error("expected a settlement");
    const after = JSON.parse(JSON.stringify(s)) as GameState;
    after.vertices[first.vertex] = { owner: 0, kind: "settlement" };
    after.phase = {
      kind: "setup",
      order: (s.phase as { order: Seat[] }).order,
      index: 0,
      step: "road",
      lastSettlement: first.vertex,
    };
    const road = act(after, 0)!;
    expect(road.type).toBe("placeRoad");
    if (road.type === "placeRoad") {
      expect(STANDARD_TOPOLOGY.edges[road.edge]!.vertices).toContain(first.vertex);
    }
  });
});

describe("turn", () => {
  it("discards from its largest pile", () => {
    const s = turnState();
    give(s, 0, { brick: 5, grain: 1, lumber: 1, ore: 1 });
    s.phase = { kind: "discard", owed: [4, 0, 0] };
    expect(act(s, 0)).toEqual({ type: "discard", seat: 0, cards: { brick: 4 } });
  });

  it("moves the robber off its own hexes", () => {
    const s = turnState();
    s.phase = { kind: "moveRobber", source: "knight" };
    const a = act(s, 0)!;
    expect(a.type).toBe("moveRobber");
    if (a.type === "moveRobber") {
      const own = STANDARD_TOPOLOGY.hexes[a.hex]!.vertices.some((v) => s.vertices[v]?.owner === 0);
      expect(own).toBe(false);
    }
  });

  it("trades 4:1 with the bank when one card short of a city", () => {
    const s = turnState();
    give(s, 0, { ore: 3, grain: 1, brick: 5 });
    expect(act(s, 0)).toMatchObject({
      type: "maritimeTrade",
      give: "brick",
      get: "grain",
      count: 1,
    });
  });

  it("builds the city when it can pay", () => {
    const s = turnState();
    give(s, 0, { ore: 3, grain: 2 });
    expect(act(s, 0)).toEqual({ type: "buildCity", seat: 0, vertex: 20 });
  });

  it("ends the turn when it has nothing useful to do", () => {
    const s = turnState();
    give(s, 0, {});
    expect(act(s, 0)).toEqual({ type: "endTurn", seat: 0 });
  });

  it("rejects an offer made to it and never proposes", () => {
    const s = turnState();
    s.turn = { ...s.turn, seat: 1 };
    give(s, 1, { ore: 1 });
    give(s, 0, { brick: 1 });
    s.offers = [{ id: 1, from: 1, to: [0], give: { ore: 1 }, get: { brick: 1 }, rejectedBy: [] }];
    s.nextOfferId = 2;
    expect(act(s, 0)).toEqual({ type: "rejectTrade", seat: 0, offerId: 1 });
  });

  it("does nothing when it is not its turn", () => {
    const s = turnState();
    expect(act(s, 1)).toBeNull();
  });
});
