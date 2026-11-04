// System-only `timeout` action (change floating-hud-turn-timer, tasks 1.1-1.4).
import { describe, expect, it } from "vite-plus/test";
import { TERRAIN_RESOURCE } from "../src/board.ts";
import { applyAction, createGame, legalActions } from "../src/game.ts";
import { RESOURCES, cardTotal, opponentsOnHex, publicVp } from "../src/rules/common.ts";
import { roadBuildingRoads } from "../src/rules/devCards.ts";
import { longestRoadLength } from "../src/rules/longestRoad.ts";
import { legalSetupSettlements } from "../src/rules/setup.ts";
import type {
  Action,
  ApplyResult,
  GameEvent,
  GameState,
  ResourceBundle,
  Seat,
} from "../src/state.ts";
import { failCode, give, makePlayState, makeState, putBuilding, step } from "../src/testing.ts";
import { TOPOLOGY, hexAt, type HexId } from "../src/topology.ts";

/** Where a `built` event placed its piece (-1 for anything else). */
function builtAt(e: GameEvent | undefined): number {
  return e?.type === "built" ? e.at : -1;
}

const TIMEOUT: Action = { type: "timeout" };

function timeout(s: GameState): { state: GameState; events: GameEvent[] } {
  const r: ApplyResult = applyAction(s, TIMEOUT);
  if (!r.ok) throw new Error(`timeout failed: ${r.code}: ${r.message}`);
  return { state: r.state, events: r.events };
}

function totalCards(s: GameState, seat: Seat): number {
  return cardTotal(s.players[seat]!.resources);
}

/** `n` cards spread over the resources in RESOURCES order. */
function cards(n: number): ResourceBundle {
  const b: ResourceBundle = {};
  for (let i = 0; i < n; i++) {
    const r = RESOURCES[i % RESOURCES.length]!;
    b[r] = (b[r] ?? 0) + 1;
  }
  return b;
}

const CENTER: HexId = hexAt(0, 0)!;
const INNER = TOPOLOGY.vertices.find((v) => v.edges.length === 3)!;

describe("timeout: dispatch", () => {
  it("fails with game_over in a finished game", () => {
    const s = makePlayState();
    s.phase = { kind: "ended" };
    s.winner = 0;
    expect(failCode(s, TIMEOUT)).toBe("game_over");
  });

  it("needs no seat, and does not mutate the input state", () => {
    const s = makePlayState({ rolled: false });
    const before = JSON.stringify(s);
    const { state } = timeout(s);
    expect(JSON.stringify(s)).toBe(before);
    expect(state.turn.rolled).toBe(true);
  });

  it("is never offered as a legal move", () => {
    const states = [
      makeState({ seed: 1 }),
      createGame({ seed: 2, playerCount: 4, mode: "variable", startingPlayer: 0 }),
      makePlayState({ rolled: false }),
      makePlayState(),
    ];
    for (const s of states) {
      for (let seat = 0; seat < s.playerCount; seat++) {
        const legal = legalActions(s, seat) as unknown as Record<string, unknown>;
        expect(Object.keys(legal)).not.toContain("timeout");
        expect(JSON.stringify(legal)).not.toContain("timeout");
      }
    }
  });
});

describe("timeout: main turn", () => {
  it("before the roll rolls the dice for the active player, with production", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = makePlayState({ seed, seat: 2, rolled: false });
      for (const h of TOPOLOGY.hexes) putBuilding(s, h.vertices[0]!, 1);
      const { state, events } = timeout(s);
      expect(events[0]).toEqual({ type: "timedOut", phase: "turn", seats: [2] });
      expect(events[1]).toMatchObject({ type: "diceRolled", seat: 2 });
      // Same RNG, same rules as the player's own roll.
      const manual = applyAction(s, { type: "rollDice", seat: 2 });
      if (!manual.ok) throw new Error("manual roll failed");
      expect(events.slice(1)).toEqual(manual.events);
      expect({ ...state, log: [] }).toEqual({ ...manual.state, log: [] });
      expect(state.turn.rolled).toBe(true);
    }
  });

  it("after the roll ends the turn, cancelling open offers", () => {
    let s = makePlayState({ seat: 0 });
    give(s, 0, { brick: 1 });
    s = step(s, { type: "proposeTrade", seat: 0, give: { brick: 1 }, get: { ore: 1 }, to: [1] });
    expect(s.offers).toHaveLength(1);
    const offerId = s.offers[0]!.id;
    const { state, events } = timeout(s);
    expect(events).toEqual([
      { type: "timedOut", phase: "turn", seats: [0] },
      { type: "tradeCancelled", offerId },
      { type: "turnEnded", seat: 0 },
      { type: "turnStarted", seat: 1, number: 2 },
    ]);
    expect(state.offers).toEqual([]);
    expect(state.turn).toMatchObject({ seat: 1, rolled: false });
    expect(state.players[0]!.resources.brick).toBe(1);
  });

  it("an end-turn timeout makes the next player win at the start of their turn", () => {
    const s = makePlayState({ seat: 0 });
    for (const v of [0, 3, 6, 9, 12]) s.vertices[v] = { owner: 1, kind: "city" };
    expect(publicVp(s, 1)).toBe(10);
    const { state, events } = timeout(s);
    expect(state.phase.kind).toBe("ended");
    expect(state.winner).toBe(1);
    expect(events.at(-1)).toEqual({ type: "gameWon", seat: 1, vp: 10 });
  });
});

describe("timeout: roll for order", () => {
  it("rolls for every contender still to roll, in seat order", () => {
    let s = makeState({ seed: 5 });
    s = step(s, { type: "rollForOrder", seat: 0 });
    const { state, events } = timeout(s);
    expect(events[0]).toEqual({ type: "timedOut", phase: "rollForOrder", seats: [1, 2, 3] });
    const rolled = events.filter((e) => e.type === "orderRolled").map((e) => e.seat);
    expect(rolled).toEqual([1, 2, 3]);
    const tied = events.some((e) => e.type === "orderTied");
    expect(state.phase.kind).toBe(tied ? "rollForOrder" : "setup");
  });

  it("after a tie, the next timeout rolls only for the tied seats", () => {
    for (let seed = 1; seed < 500; seed++) {
      const { state, events } = timeout(makeState({ seed, playerCount: 3 }));
      const tie = events.find((e) => e.type === "orderTied");
      if (!tie || tie.type !== "orderTied") continue;
      const next = timeout(state);
      expect(next.events[0]).toEqual({ type: "timedOut", phase: "rollForOrder", seats: tie.seats });
      return;
    }
    throw new Error("no seed ties");
  });
});

describe("timeout: setup", () => {
  it("places legal settlements and roads in snake order with starting resources", () => {
    let s = createGame({ seed: 9, playerCount: 4, mode: "variable", startingPlayer: 1 });
    const seats: Seat[] = [];
    let placements = 0;
    while (s.phase.kind === "setup") {
      const before = s;
      const seat = s.turn.seat;
      const legal = legalSetupSettlements(s, seat);
      const r = timeout(s);
      s = r.state;
      expect(r.events[0]).toEqual({ type: "timedOut", phase: "setup", seats: [seat] });
      seats.push(seat);
      const built = r.events.filter((e) => e.type === "built");
      expect(built.map((e) => e.type === "built" && e.piece)).toEqual(["settlement", "road"]);
      const v = builtAt(built[0]);
      const e = builtAt(built[1]);
      expect(legal).toContain(v);
      // Distance Rule: no building next to it.
      for (const n of TOPOLOGY.vertices[v]!.neighbors) expect(s.vertices[n]).toBeNull();
      expect(TOPOLOGY.edges[e]!.vertices).toContain(v);
      expect(before.vertices[v]).toBeNull();
      const gained = r.events.find((x) => x.type === "startingResources");
      if (placements < 4) {
        expect(gained).toBeUndefined();
      } else {
        const want: ResourceBundle = {};
        for (const h of TOPOLOGY.vertices[v]!.hexes) {
          const res = TERRAIN_RESOURCE[s.board.hexes[h]!.terrain];
          if (res) want[res] = (want[res] ?? 0) + 1;
        }
        expect(totalCards(s, seat)).toBe(cardTotal(want));
        if (cardTotal(want) > 0) expect(gained).toMatchObject({ seat, resources: want });
      }
      placements++;
    }
    expect(seats).toEqual([1, 2, 3, 0, 0, 3, 2, 1]);
    expect(s.phase.kind).toBe("turn");
    expect(s.turn).toMatchObject({ seat: 1, number: 1, rolled: false });
    for (let seat = 0; seat < 4; seat++) {
      expect(s.players[seat]!.pieces).toMatchObject({ settlements: 3, roads: 13 });
    }
  });

  it("places only the road when the settlement is already down", () => {
    let s = createGame({ seed: 3, playerCount: 3, mode: "beginner", startingPlayer: 0 });
    s = step(s, { type: "placeSettlement", seat: 0, vertex: INNER.id });
    const { state, events } = timeout(s);
    expect(events[0]).toEqual({ type: "timedOut", phase: "setup", seats: [0] });
    const built = events.filter((e) => e.type === "built");
    expect(built).toHaveLength(1);
    expect(built[0]).toMatchObject({ piece: "road", seat: 0 });
    expect(INNER.edges).toContain(builtAt(built[0]));
    expect(state.turn.seat).toBe(1);
  });
});

describe("timeout: seven", () => {
  it("discards the owed count for every owing seat; cards go to the bank", () => {
    const s = makePlayState({ seat: 0 });
    give(s, 1, cards(8));
    give(s, 2, cards(10));
    s.phase = { kind: "discard", owed: [0, 4, 5, 0] };
    const bankBefore = cardTotal(s.bank);
    const { state, events } = timeout(s);
    expect(events[0]).toEqual({ type: "timedOut", phase: "discard", seats: [1, 2] });
    expect(events.filter((e) => e.type === "discarded").map((e) => e.seat)).toEqual([1, 2]);
    expect(totalCards(state, 1)).toBe(4);
    expect(totalCards(state, 2)).toBe(5);
    expect(cardTotal(state.bank)).toBe(bankBefore + 9);
    expect(state.phase).toEqual({ kind: "moveRobber", source: "seven" });
  });

  it("skips seats that already discarded", () => {
    let s = makePlayState({ seat: 0 });
    give(s, 1, cards(8));
    give(s, 3, cards(8));
    s.phase = { kind: "discard", owed: [0, 4, 0, 4] };
    s = step(s, { type: "discard", seat: 1, cards: cards(4) });
    const { state, events } = timeout(s);
    expect(events[0]).toEqual({ type: "timedOut", phase: "discard", seats: [3] });
    expect(totalCards(state, 1)).toBe(4);
    expect(totalCards(state, 3)).toBe(4);
  });

  it("moves the robber to a different hex and steals from a qualifying opponent", () => {
    let steals = 0;
    let empty = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const s = makePlayState({ seed, seat: 0 });
      // Seat 2 on a few hexes only, so some picks have no victim.
      putBuilding(s, TOPOLOGY.hexes[CENTER]!.vertices[0]!, 2);
      give(s, 2, cards(3));
      s.phase = { kind: "moveRobber", source: "seven" };
      const from = s.robber;
      const { state, events } = timeout(s);
      expect(events[0]).toEqual({ type: "timedOut", phase: "moveRobber", seats: [0] });
      expect(state.robber).not.toBe(from);
      expect(state.phase.kind).toBe("turn");
      const victims = opponentsOnHex(s, state.robber, 0);
      const stole = events.find((e) => e.type === "stole");
      if (victims.length === 0) {
        expect(stole).toBeUndefined();
        empty++;
      } else {
        expect(stole).toMatchObject({ thief: 0, victim: 2 });
        expect(totalCards(state, 0)).toBe(1);
        expect(totalCards(state, 2)).toBe(2);
        steals++;
      }
    }
    expect(steals).toBeGreaterThan(0);
    expect(empty).toBeGreaterThan(0);
  });
});

describe("timeout: Road Building", () => {
  function roadBuilding(seed: number, roads = 15): GameState {
    const s = makePlayState({ seed, seat: 0 });
    s.players[0]!.devCards = ["roadBuilding"];
    putBuilding(s, INNER.id, 0);
    s.players[0]!.pieces.roads = roads;
    return step(s, { type: "playRoadBuilding", seat: 0 });
  }

  it("places both free roads at legal paths", () => {
    const s = roadBuilding(1);
    const { state, events } = timeout(s);
    expect(events[0]).toEqual({ type: "timedOut", phase: "roadBuilding", seats: [0] });
    const built = events.filter((e) => e.type === "built");
    expect(built).toHaveLength(2);
    for (const b of built) expect(b).toMatchObject({ piece: "road", seat: 0, free: true });
    expect(state.phase).toEqual({ kind: "turn" });
    expect(state.players[0]!.pieces.roads).toBe(13);
  });

  it("finishes the remaining road after one was placed by hand", () => {
    let s = roadBuilding(2);
    s = step(s, { type: "buildRoad", seat: 0, edge: INNER.edges[0]! });
    const { state, events } = timeout(s);
    expect(events.filter((e) => e.type === "built")).toHaveLength(1);
    expect(state.phase).toEqual({ kind: "turn" });
  });

  it("places only one road with one left in supply", () => {
    const s = roadBuilding(3, 1);
    expect(s.phase).toEqual({ kind: "roadBuilding", remaining: 1 });
    const { state, events } = timeout(s);
    expect(events.filter((e) => e.type === "built")).toHaveLength(1);
    expect(state.players[0]!.pieces.roads).toBe(0);
    expect(state.phase).toEqual({ kind: "turn" });
  });

  it("recomputes Longest Road after the automatic roads", () => {
    let awarded = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const s = makePlayState({ seed, seat: 0 });
      s.players[0]!.devCards = ["roadBuilding"];
      const h = TOPOLOGY.hexes[CENTER]!;
      putBuilding(s, h.vertices[0]!, 0);
      // Four connected roads around the center hex: one more at either end makes 5.
      let t = s;
      for (let i = 0; i < 4; i++) {
        t.players[0]!.resources.brick++;
        t.players[0]!.resources.lumber++;
        t.bank.brick--;
        t.bank.lumber--;
        t = step(t, { type: "buildRoad", seat: 0, edge: h.edges[i]! });
      }
      expect(t.longestRoad).toBeNull();
      t = step(t, { type: "playRoadBuilding", seat: 0 });
      const { state, events } = timeout(t);
      const len = longestRoadLength(state, 0);
      expect(len).toBeGreaterThanOrEqual(4);
      if (len >= 5) {
        awarded++;
        expect(state.longestRoad).toBe(0);
        const lr = events.filter((e) => e.type === "longestRoad");
        expect(lr).toHaveLength(1);
        expect(lr[0]).toMatchObject({ from: null, to: 0 });
      } else {
        expect(state.longestRoad).toBeNull();
      }
    }
    expect(awarded).toBeGreaterThan(0);
  });

  it("only offers legal paths (blocked by opponents)", () => {
    const s = roadBuilding(4);
    const legal = roadBuildingRoads(s, 0);
    const { events } = timeout(s);
    const first = events.find((e) => e.type === "built");
    expect(legal).toContain(builtAt(first));
  });
});
