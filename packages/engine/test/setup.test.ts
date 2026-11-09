import { describe, expect, it } from "vite-plus/test";
import { TERRAIN_RESOURCE } from "../src/board.ts";
import { createGame, legalActions } from "../src/game.ts";
import { cardTotal, publicVp } from "../src/rules/common.ts";
import { canRollForOrder, legalSetupRoads, legalSetupSettlements } from "../src/rules/setup.ts";
import type { GameConfig, GameState, Seat } from "../src/state.ts";
import { failCode, makeState, step } from "../src/testing.ts";
import { STANDARD_TOPOLOGY } from "../src/topology.ts";

function setupPhase(s: GameState) {
  if (s.phase.kind !== "setup") throw new Error(`not in setup: ${s.phase.kind}`);
  return s.phase;
}

/** Places the first legal settlement and road for the active seat. Returns the settlement. */
function placeFirstLegal(s: GameState): [GameState, number] {
  const seat = s.turn.seat;
  const v = legalSetupSettlements(s, seat)[0];
  if (v === undefined) throw new Error("no settlement spot");
  s = step(s, { type: "placeSettlement", seat, vertex: v });
  const e = legalSetupRoads(s, seat)[0];
  if (e === undefined) throw new Error("no road spot");
  return [step(s, { type: "placeRoad", seat, edge: e }), v];
}

/** Drives a whole setup; returns the final state and the seat order placements happened in. */
function runSetup(config: GameConfig): { s: GameState; seats: Seat[]; spots: number[] } {
  let s = createGame(config);
  const seats: Seat[] = [];
  const spots: number[] = [];
  while (s.phase.kind === "setup") {
    seats.push(s.turn.seat);
    let v: number;
    [s, v] = placeFirstLegal(s);
    spots.push(v);
  }
  return { s, seats, spots };
}

describe("setup snake order", () => {
  it("4 players starting at seat 1: 1,2,3,0,0,3,2,1", () => {
    const s = createGame({ seed: 1, playerCount: 4, mode: "beginner", startingPlayer: 1 });
    expect(setupPhase(s).order).toEqual([1, 2, 3, 0, 0, 3, 2, 1]);
    expect(s.turn).toMatchObject({ seat: 1, number: 0 });
    expect(s.log).toContainEqual({ type: "startingPlayer", seat: 1 });
    expect(
      runSetup({ seed: 1, playerCount: 4, mode: "beginner", startingPlayer: 1 }).seats,
    ).toEqual([1, 2, 3, 0, 0, 3, 2, 1]);
  });

  it("3 players starting at seat 2: 2,0,1,1,0,2", () => {
    const { s, seats } = runSetup({
      seed: 3,
      playerCount: 3,
      mode: "variable",
      startingPlayer: 2,
    });
    expect(seats).toEqual([2, 0, 1, 1, 0, 2]);
    expect(s.phase).toEqual({ kind: "turn" });
    expect(s.turn).toEqual({ seat: 2, number: 1, rolled: false, devPlayed: false, dice: null });
  });

  it("ends with 2 settlements, 2 roads and 2 VP each; first turn to the starting player", () => {
    const { s, spots } = runSetup({
      seed: 7,
      playerCount: 4,
      mode: "variable",
      startingPlayer: 3,
    });
    for (let seat = 0; seat < 4; seat++) {
      expect(publicVp(s, seat)).toBe(2);
      expect(s.players[seat]?.pieces).toEqual({ roads: 13, settlements: 3, cities: 4 });
      expect(s.edges.filter((o) => o === seat)).toHaveLength(2);
    }
    expect(s.log.at(-1)).toEqual({ type: "turnStarted", seat: 3, number: 1 });
    expect(legalActions(s, 3).rollDice).toBe(true);
    expect(legalActions(s, 3).placeSettlement).toEqual([]);
    // The free placements are logged as free builds.
    const built = s.log.filter((e) => e.type === "built");
    expect(built).toHaveLength(16);
    expect(built.every((e) => e.type === "built" && e.free)).toBe(true);
    expect(new Set(spots).size).toBe(8);
  });

  it("starting resources come only from the second settlement", () => {
    const { s, spots } = runSetup({
      seed: 11,
      playerCount: 4,
      mode: "beginner",
      startingPlayer: 0,
    });
    const order = [0, 1, 2, 3, 3, 2, 1, 0];
    let bankTotal = 0;
    for (let seat = 0; seat < 4; seat++) {
      const second = spots[order.lastIndexOf(seat)]!;
      const expected: Record<string, number> = {};
      for (const h of STANDARD_TOPOLOGY.vertices[second]!.hexes) {
        const r = TERRAIN_RESOURCE[s.board.hexes[h]!.terrain];
        if (r) expected[r] = (expected[r] ?? 0) + 1;
      }
      const hand = s.players[seat]!.resources;
      for (const [r, n] of Object.entries(hand)) expect(n).toBe(expected[r] ?? 0);
      bankTotal += cardTotal(hand);
    }
    expect(cardTotal(s.bank)).toBe(95 - bankTotal);
    expect(s.log.filter((e) => e.type === "startingResources").map((e) => e.type)).toHaveLength(
      s.players.filter((p) => cardTotal(p.resources) > 0).length,
    );
  });

  it("no resources after round-1 settlements", () => {
    let s = createGame({ seed: 1, playerCount: 4, mode: "beginner", startingPlayer: 0 });
    for (let i = 0; i < 4; i++) [s] = placeFirstLegal(s);
    expect(s.players.every((p) => cardTotal(p.resources) === 0)).toBe(true);
    expect(cardTotal(s.bank)).toBe(95);
    expect(s.log.some((e) => e.type === "startingResources")).toBe(false);
  });

  it("a second settlement next to the desert only gets the other hexes", () => {
    let s = createGame({ seed: 1, playerCount: 3, mode: "beginner", startingPlayer: 0 });
    const desert = s.board.hexes.findIndex((h) => h.terrain === "desert");
    for (let i = 0; i < 3; i++) [s] = placeFirstLegal(s);
    // Round 2, seat 2 places on a free desert corner.
    const seat = s.turn.seat;
    expect(seat).toBe(2);
    const v = STANDARD_TOPOLOGY.hexes[desert]!.vertices.find((c) =>
      legalSetupSettlements(s, seat).includes(c),
    );
    expect(v).toBeDefined();
    s = step(s, { type: "placeSettlement", seat, vertex: v! });
    const ev = s.log.at(-1);
    const expected: Record<string, number> = {};
    for (const h of STANDARD_TOPOLOGY.vertices[v!]!.hexes) {
      const r = TERRAIN_RESOURCE[s.board.hexes[h]!.terrain];
      if (r) expected[r] = (expected[r] ?? 0) + 1;
    }
    expect(ev).toEqual({ type: "startingResources", seat, resources: expected });
    expect(cardTotal(s.players[seat]!.resources)).toBe(
      STANDARD_TOPOLOGY.vertices[v!]!.hexes.length - 1,
    );
  });
});

describe("setup placement rules", () => {
  it("the road must touch the settlement just placed", () => {
    let s = createGame({ seed: 1, playerCount: 4, mode: "beginner", startingPlayer: 0 });
    const v = legalSetupSettlements(s, 0)[0]!;
    s = step(s, { type: "placeSettlement", seat: 0, vertex: v });
    const touching = STANDARD_TOPOLOGY.vertices[v]!.edges;
    expect(legalSetupRoads(s, 0)).toEqual([...touching].sort((a, b) => a - b));
    const far = STANDARD_TOPOLOGY.edges.find((e) => !e.vertices.includes(v))!.id;
    expect(failCode(s, { type: "placeRoad", seat: 0, edge: far })).toBe("illegal_placement");
    expect(failCode(s, { type: "placeRoad", seat: 0, edge: 999 })).toBe("illegal_placement");
    // Settlement step is over until the road is placed.
    expect(legalSetupSettlements(s, 0)).toEqual([]);
    expect(failCode(s, { type: "placeSettlement", seat: 0, vertex: 40 })).toBe("wrong_phase");
  });

  it("the second road must touch the second settlement, not the first", () => {
    let s = createGame({ seed: 1, playerCount: 3, mode: "beginner", startingPlayer: 0 });
    let first = -1;
    for (let i = 0; i < 3; i++) {
      const seat = s.turn.seat;
      let v: number;
      [s, v] = placeFirstLegal(s);
      if (seat === 2) first = v;
    }
    expect(s.turn.seat).toBe(2);
    const second = legalSetupSettlements(s, 2).at(-1)!;
    s = step(s, { type: "placeSettlement", seat: 2, vertex: second });
    const freeNearFirst = STANDARD_TOPOLOGY.vertices[first]!.edges.find(
      (e) => s.edges[e] === null,
    )!;
    expect(failCode(s, { type: "placeRoad", seat: 2, edge: freeNearFirst })).toBe(
      "illegal_placement",
    );
    expect(
      legalSetupRoads(s, 2).every((e) => STANDARD_TOPOLOGY.edges[e]!.vertices.includes(second)),
    ).toBe(true);
  });

  it("enforces the Distance Rule in setup, against own and others' settlements", () => {
    let s = createGame({ seed: 1, playerCount: 4, mode: "beginner", startingPlayer: 0 });
    const v = 20;
    s = step(s, { type: "placeSettlement", seat: 0, vertex: v });
    s = step(s, { type: "placeRoad", seat: 0, edge: legalSetupRoads(s, 0)[0]! });
    const neighbor = STANDARD_TOPOLOGY.vertices[v]!.neighbors[0]!;
    expect(legalSetupSettlements(s, 1)).not.toContain(neighbor);
    expect(legalSetupSettlements(s, 1)).not.toContain(v);
    expect(failCode(s, { type: "placeSettlement", seat: 1, vertex: neighbor })).toBe(
      "illegal_placement",
    );
    expect(failCode(s, { type: "placeSettlement", seat: 1, vertex: v })).toBe("illegal_placement");
    expect(failCode(s, { type: "placeSettlement", seat: 1, vertex: -1 })).toBe("illegal_placement");
    // Seat 0's own second settlement (round 2) also can't sit next to its first.
    for (let i = 0; i < 6; i++) [s] = placeFirstLegal(s);
    expect(s.turn.seat).toBe(0);
    expect(legalSetupSettlements(s, 0)).not.toContain(neighbor);
    expect(failCode(s, { type: "placeSettlement", seat: 0, vertex: neighbor })).toBe(
      "illegal_placement",
    );
  });

  it("legal lists are gated to the placing seat and step, and are ascending", () => {
    const s = createGame({ seed: 1, playerCount: 4, mode: "beginner", startingPlayer: 2 });
    const spots = legalSetupSettlements(s, 2);
    expect(spots).toHaveLength(54);
    expect(spots).toEqual([...spots].sort((a, b) => a - b));
    expect(legalSetupSettlements(s, 1)).toEqual([]);
    expect(legalSetupRoads(s, 2)).toEqual([]);
    expect(canRollForOrder(s, 2)).toBe(false);
  });

  it("rejects wrong seats and wrong phases", () => {
    const s = createGame({ seed: 1, playerCount: 4, mode: "beginner", startingPlayer: 2 });
    expect(failCode(s, { type: "placeSettlement", seat: 1, vertex: 0 })).toBe("not_your_turn");
    expect(failCode(s, { type: "placeRoad", seat: 2, edge: 0 })).toBe("wrong_phase");
    expect(failCode(s, { type: "rollForOrder", seat: 2 })).toBe("wrong_phase");
    expect(failCode(s, { type: "rollDice", seat: 2 })).toBe("wrong_phase");
    const r = makeState({ seed: 1 });
    expect(failCode(r, { type: "placeSettlement", seat: 0, vertex: 0 })).toBe("wrong_phase");
    expect(failCode(r, { type: "placeRoad", seat: 0, edge: 0 })).toBe("wrong_phase");
    const { s: done } = runSetup({ seed: 1, playerCount: 3, mode: "beginner", startingPlayer: 0 });
    expect(failCode(done, { type: "placeSettlement", seat: 0, vertex: 0 })).toBe("wrong_phase");
  });
});

describe("roll for the starting player", () => {
  function rollAll(s: GameState): GameState {
    while (s.phase.kind === "rollForOrder") {
      const seat = s.turn.seat;
      expect(canRollForOrder(s, seat)).toBe(true);
      s = step(s, { type: "rollForOrder", seat });
    }
    return s;
  }

  it("contenders roll in seat order and the highest starts", () => {
    let s = makeState({ seed: 5 });
    expect(s.turn.seat).toBe(0);
    expect(failCode(s, { type: "rollForOrder", seat: 1 })).toBe("not_your_turn");
    expect(canRollForOrder(s, 1)).toBe(false);
    s = step(s, { type: "rollForOrder", seat: 0 });
    expect(s.turn.seat).toBe(1);
    expect(s.log.at(-1)?.type).toBe("orderRolled");
    s = rollAll(s);
    expect(s.phase.kind).toBe("setup");
    const start = s.log.find((e) => e.type === "startingPlayer");
    expect(start).toBeDefined();
    const seat = start!.type === "startingPlayer" ? start!.seat : -1;
    expect(s.turn.seat).toBe(seat);
    expect(setupPhase(s).order[0]).toBe(seat);
    // The winner had the (last round's) unique highest roll.
    const lastTie = s.log.map((e) => e.type).lastIndexOf("orderTied");
    const finalRolls = s.log
      .slice(lastTie + 1)
      .flatMap((e) => (e.type === "orderRolled" ? [[e.seat, e.dice[0] + e.dice[1]]] : []));
    const best = Math.max(...finalRolls.map(([, t]) => t!));
    expect(finalRolls.filter(([, t]) => t === best)).toEqual([[seat, best]]);
  });

  it("is deterministic for a seed", () => {
    expect(rollAll(makeState({ seed: 9 }))).toEqual(rollAll(makeState({ seed: 9 })));
  });

  it("re-rolls ties among the tied seats only", () => {
    // Arrange: seats 0..2 already rolled, with 0 and 2 tied at 10; seat 3 rolls next.
    let found: GameState | null = null;
    for (let seed = 1; seed < 500 && !found; seed++) {
      const s = makeState({ seed });
      s.phase = { kind: "rollForOrder", contenders: [0, 1, 2, 3], rolls: [10, 4, 10, null] };
      s.turn.seat = 3;
      const next = step(s, { type: "rollForOrder", seat: 3 });
      const ev = next.log.at(-1);
      if (ev?.type === "orderTied" && ev.seats.length === 2) found = next;
    }
    expect(found).not.toBeNull();
    let s = found!;
    expect(s.log.at(-1)).toEqual({ type: "orderTied", seats: [0, 2] });
    expect(s.phase).toEqual({
      kind: "rollForOrder",
      contenders: [0, 2],
      rolls: [null, 4, null, expect.any(Number)],
    });
    expect(s.turn.seat).toBe(0);
    s = step(s, { type: "rollForOrder", seat: 0 });
    expect(s.turn.seat).toBe(2);
    expect(failCode(s, { type: "rollForOrder", seat: 1 })).toBe("not_your_turn");
    expect(failCode(s, { type: "rollForOrder", seat: 3 })).toBe("not_your_turn");
    s = rollAll(s);
    const start = s.log.find((e) => e.type === "startingPlayer");
    expect(start?.type === "startingPlayer" && [0, 2].includes(start.seat)).toBe(true);
  });

  it("two seats tied at 12 always re-roll (3 players)", () => {
    const s = makeState({ seed: 1, playerCount: 3 });
    s.phase = { kind: "rollForOrder", contenders: [0, 1, 2], rolls: [12, 12, null] };
    s.turn.seat = 2;
    // Seat 2 can at best join the tie, so the roll never resolves.
    const next = step(s, { type: "rollForOrder", seat: 2 });
    expect(next.phase.kind).toBe("rollForOrder");
    if (next.phase.kind !== "rollForOrder") return;
    const { contenders } = next.phase;
    expect(contenders.slice(0, 2)).toEqual([0, 1]);
    expect(next.log.at(-1)).toEqual({ type: "orderTied", seats: contenders });
    expect(
      contenders.every((c) => next.phase.kind === "rollForOrder" && next.phase.rolls[c] === null),
    ).toBe(true);
    expect(next.turn.seat).toBe(0);
  });
});
