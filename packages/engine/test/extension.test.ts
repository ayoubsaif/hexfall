// 5–6 player extension and the victory target (change add-5-6-player-extension).
import { describe, expect, it } from "vite-plus/test";
import {
  LARGE_DEV_DECK,
  applyAction,
  createGame,
  legalActions,
  rulesProfile,
} from "../src/game.ts";
import { cardTotal, publicVp } from "../src/rules/common.ts";
import { produce } from "../src/rules/production.ts";
import { legalSetupRoads, legalSetupSettlements } from "../src/rules/setup.ts";
import type { DevCard, GameState, Seat } from "../src/state.ts";
import { failCode, give, makePlayState, putBuilding, putRoadAt, step } from "../src/testing.ts";
import { LARGE_TOPOLOGY, topologyOf, type HexId, type VertexId } from "../src/topology.ts";
import { playerView } from "../src/view.ts";

function countBy(cards: readonly DevCard[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of cards) out[c] = (out[c] ?? 0) + 1;
  return out;
}

const T = LARGE_TOPOLOGY;

/** Gives the seat exactly `vp` public VP with cities/settlements on spread-out free spots. */
function giveVp(s: GameState, seat: Seat, vp: number, maxCities = 4): void {
  const topo = topologyOf(s.board);
  let left = vp;
  for (const info of topo.vertices) {
    if (left <= 0) break;
    if (s.vertices[info.id] || info.neighbors.some((x) => s.vertices[x])) continue;
    if (info.neighbors.some((x) => topo.vertices[x]!.neighbors.some((y) => s.vertices[y])))
      continue;
    if (left >= 2 && s.players[seat]!.pieces.cities > 4 - maxCities) {
      putBuilding(s, info.id, seat, "city");
      left -= 2;
    } else {
      putBuilding(s, info.id, seat, "settlement");
      left -= 1;
    }
  }
  expect(publicVp(s, seat)).toBe(vp);
}

describe("game creation with 5–6 players (task 3.1, 3.2)", () => {
  it("creates 3, 5 and 6 player games", () => {
    expect(createGame({ seed: 1, playerCount: 3, mode: "variable" }).players).toHaveLength(3);
    expect(createGame({ seed: 1, playerCount: 5, mode: "variable" }).players).toHaveLength(5);
    expect(createGame({ seed: 1, playerCount: 6, mode: "variable" }).players).toHaveLength(6);
  });

  it("sets up the 6-player components", () => {
    const s = createGame({ seed: 7, playerCount: 6, mode: "variable" });
    expect(s.board.layout).toBe("large");
    expect(s.board.hexes).toHaveLength(30);
    expect(cardTotal(s.bank)).toBe(120);
    expect(s.bankPerResource).toBe(24);
    expect(s.devDeck).toHaveLength(34);
    expect(countBy(s.devDeck)).toEqual({
      knight: 20,
      roadBuilding: 3,
      yearOfPlenty: 3,
      monopoly: 3,
      victoryPoint: 5,
    });
    expect(countBy([...LARGE_DEV_DECK])).toEqual(countBy(s.devDeck));
    for (const p of s.players) expect(p.pieces).toEqual({ roads: 15, settlements: 5, cities: 4 });
    expect(s.vertices).toHaveLength(80);
    expect(s.edges).toHaveLength(109);
    expect(s.board.hexes[s.robber]?.terrain).toBe("desert");
  });

  it("rejects the beginner board for 5 players and bad player counts", () => {
    expect(() => createGame({ seed: 1, playerCount: 5, mode: "beginner" })).toThrow();
    expect(() => createGame({ seed: 1, playerCount: 7 as 6, mode: "variable" })).toThrow();
    expect(() => rulesProfile(2)).toThrow();
    expect(rulesProfile(4)).toMatchObject({ layout: "standard", bankPerResource: 19 });
    expect(rulesProfile(5)).toMatchObject({ layout: "large", bankPerResource: 24 });
  });

  it("defaults the victory target to 10 and rejects targets outside 8–15", () => {
    expect(createGame({ seed: 1, playerCount: 3, mode: "variable" }).victoryTarget).toBe(10);
    expect(
      createGame({ seed: 1, playerCount: 3, mode: "variable", victoryTarget: 8 }).victoryTarget,
    ).toBe(8);
    expect(
      createGame({ seed: 1, playerCount: 3, mode: "variable", victoryTarget: 15 }).victoryTarget,
    ).toBe(15);
    for (const victoryTarget of [7, 16, 20, 10.5]) {
      expect(() =>
        createGame({ seed: 1, playerCount: 3, mode: "variable", victoryTarget }),
      ).toThrow();
    }
  });

  it("puts the victory target in every view, and reads old states as 10", () => {
    const s = createGame({ seed: 1, playerCount: 6, mode: "variable", victoryTarget: 12 });
    expect(playerView(s, 3).victoryTarget).toBe(12);
    const old = JSON.parse(JSON.stringify(s)) as Partial<GameState>;
    delete old.victoryTarget;
    expect(playerView(old as GameState, 0).victoryTarget).toBe(10);
  });
});

describe("bank of 24 (task 3.3)", () => {
  it("applies the shortage rule against the larger bank", () => {
    const s = makePlayState({ playerCount: 6 });
    const h = s.board.hexes.findIndex((x) => x.token === 9 && x.terrain !== "desert") as HexId;
    const res = {
      forest: "lumber",
      pasture: "wool",
      fields: "grain",
      hills: "brick",
      mountains: "ore",
    }[s.board.hexes[h]!.terrain as "forest"] as "lumber";
    const corners = T.hexes[h]!.vertices;
    putBuilding(s, corners[0]!, 0, "city");
    putBuilding(s, corners[3]!, 1, "city");
    expect(s.bank[res]).toBe(24);
    produce(s, 9);
    const got0 = s.players[0]!.resources[res];
    expect(got0).toBeGreaterThanOrEqual(2);
    const s2 = makePlayState({ playerCount: 6 });
    putBuilding(s2, corners[0]!, 0, "city");
    putBuilding(s2, corners[3]!, 1, "city");
    s2.bank[res] = 3; // at least 4 owed
    produce(s2, 9);
    expect(s2.players[0]!.resources[res]).toBe(0);
    expect(s2.players[1]!.resources[res]).toBe(0);
    expect(s2.log).toContainEqual({ type: "shortage", resource: res });
  });
});

describe("victory target (task 3.4)", () => {
  it("does not end a target-12 game at 10 VP", () => {
    const s = makePlayState({ playerCount: 3, mode: "variable", victoryTarget: 12 });
    giveVp(s, 0, 9);
    // A settlement next to an own road.
    const spot = legalSettlementWithRoad(s, 0);
    give(s, 0, { brick: 1, lumber: 1, wool: 1, grain: 1 });
    const after = step(s, { type: "buildSettlement", seat: 0, vertex: spot });
    expect(publicVp(after, 0)).toBe(10);
    expect(after.phase.kind).toBe("turn");
    expect(after.winner).toBeNull();
  });

  it("ends a target-10 game at 10 VP on the active player's turn", () => {
    const s = makePlayState({ playerCount: 3, mode: "variable" });
    giveVp(s, 0, 9);
    const spot = legalSettlementWithRoad(s, 0);
    give(s, 0, { brick: 1, lumber: 1, wool: 1, grain: 1 });
    const after = step(s, { type: "buildSettlement", seat: 0, vertex: spot });
    expect(after.winner).toBe(0);
  });

  it("reveals VP cards against the target", () => {
    const s = makePlayState({ playerCount: 3, mode: "variable", victoryTarget: 13 });
    giveVp(s, 0, 11);
    s.players[0]!.devCards.push("victoryPoint");
    expect(legalActions(s, 0).revealVictoryPoints).toBe(false);
    expect(failCode(s, { type: "revealVictoryPoints", seat: 0 })).toBe("cannot_reveal");
    s.players[0]!.devCards.push("victoryPoint");
    expect(legalActions(s, 0).revealVictoryPoints).toBe(true);
    expect(step(s, { type: "revealVictoryPoints", seat: 0 }).winner).toBe(0);
  });
});

/** Puts an own road next to a free, distance-legal intersection and returns it. */
function legalSettlementWithRoad(s: GameState, seat: Seat): VertexId {
  const topo = topologyOf(s.board);
  for (const info of [...topo.vertices].reverse()) {
    if (s.vertices[info.id] || info.neighbors.some((x) => s.vertices[x])) continue;
    const edge = info.edges.find((e) => s.edges[e] === null);
    if (edge === undefined) continue;
    putRoadAt(s, edge, seat);
    return info.id;
  }
  throw new Error("no settlement spot");
}

describe("setup with 6 players (task 3.6)", () => {
  it("snakes 4,5,0,1,2,3,3,2,1,0,5,4 from seat 4", () => {
    let s = createGame({ seed: 3, playerCount: 6, mode: "variable", startingPlayer: 4 });
    const seats: Seat[] = [];
    while (s.phase.kind === "setup") {
      const seat = s.turn.seat;
      seats.push(seat);
      const v = legalSetupSettlements(s, seat)[0]!;
      s = step(s, { type: "placeSettlement", seat, vertex: v });
      s = step(s, { type: "placeRoad", seat, edge: legalSetupRoads(s, seat)[0]! });
    }
    expect(seats).toEqual([4, 5, 0, 1, 2, 3, 3, 2, 1, 0, 5, 4]);
    expect(s.turn.seat).toBe(4);
    for (let seat = 0; seat < 6; seat++) expect(publicVp(s, seat)).toBe(2);
  });

  it("snakes 5 players from seat 0", () => {
    const s = createGame({ seed: 3, playerCount: 5, mode: "variable", startingPlayer: 0 });
    expect(s.phase.kind === "setup" && s.phase.order).toEqual([0, 1, 2, 3, 4, 4, 3, 2, 1, 0]);
  });
});

// ---- Special Building Phase (group 4)

function endTurnOf(s: GameState, seat: Seat): GameState {
  return step(s, { type: "endTurn", seat });
}

function sbp(s: GameState) {
  if (s.phase.kind !== "specialBuild") throw new Error(`not in specialBuild: ${s.phase.kind}`);
  return s.phase;
}

describe("Special Building Phase (task 4.1)", () => {
  it("opens windows clockwise from the left of the ender in a 5-player game", () => {
    let s = endTurnOf(makePlayState({ playerCount: 5, seat: 2 }), 2);
    const windows: Seat[] = [];
    while (s.phase.kind === "specialBuild") {
      const cur = sbp(s).current;
      windows.push(cur);
      expect(legalActions(s, cur).passSpecialBuild).toBe(true);
      for (let other = 0; other < 5; other++) {
        if (other !== cur) expect(legalActions(s, other).passSpecialBuild).toBe(false);
      }
      s = step(s, { type: "passSpecialBuild", seat: cur });
    }
    expect(windows).toEqual([3, 4, 0, 1]);
    expect(s.phase.kind).toBe("turn");
    expect(s.turn).toMatchObject({ seat: 3, rolled: false, number: 2 });
  });

  it("starts the next turn directly with 4 players", () => {
    const s = endTurnOf(makePlayState({ playerCount: 4, seat: 1 }), 1);
    expect(s.phase.kind).toBe("turn");
    expect(s.turn.seat).toBe(2);
  });

  it("opens seat 0's window after seat 5 in a 6-player game", () => {
    const s = endTurnOf(makePlayState({ playerCount: 6, seat: 5 }), 5);
    expect(sbp(s)).toEqual({
      kind: "specialBuild",
      current: 0,
      queue: [1, 2, 3, 4],
      afterTurnOf: 5,
    });
  });

  it("only lets the window's seat pass", () => {
    const s = endTurnOf(makePlayState({ playerCount: 5, seat: 0 }), 0);
    expect(failCode(s, { type: "passSpecialBuild", seat: 2 })).toBe("not_your_turn");
    expect(failCode(makePlayState({ playerCount: 5 }), { type: "passSpecialBuild", seat: 0 })).toBe(
      "wrong_phase",
    );
  });
});

describe("building in a window (task 4.2)", () => {
  it("builds a road, pays the bank and recomputes Longest Road", () => {
    let s = endTurnOf(makePlayState({ playerCount: 5, seat: 2 }), 2);
    // Seat 3 has a 4-road chain; the 5th road in the window takes Longest Road.
    const chain = roadChain(s, 5);
    chain.slice(0, 4).forEach((e) => putRoadAt(s, e, 3));
    give(s, 3, { brick: 1, lumber: 1 });
    expect(legalActions(s, 3).buildRoad).toContain(chain[4]);
    expect(legalActions(s, 4).buildRoad).toEqual([]);
    const bankBefore = s.bank.brick;
    s = step(s, { type: "buildRoad", seat: 3, edge: chain[4]! });
    expect(s.edges[chain[4]!]).toBe(3);
    expect(s.bank.brick).toBe(bankBefore + 1);
    expect(s.longestRoad).toBe(3);
  });

  it("builds settlements and cities and buys cards, but not for other seats", () => {
    let s = endTurnOf(makePlayState({ playerCount: 6, seat: 0 }), 0);
    const v = T.vertices.find((x) => x.neighbors.length === 3)!.id;
    putBuilding(s, v, 1, "settlement");
    give(s, 1, { ore: 4, grain: 3, wool: 1 });
    expect(legalActions(s, 1).buildCity).toEqual([v]);
    expect(legalActions(s, 1).buyDevCard).toBe(true);
    expect(failCode(s, { type: "buildCity", seat: 2, vertex: v })).toBe("not_your_turn");
    s = step(s, { type: "buildCity", seat: 1, vertex: v });
    s = step(s, { type: "buyDevCard", seat: 1 });
    expect(s.vertices[v]).toEqual({ owner: 1, kind: "city" });
    expect(s.players[1]!.devCards).toHaveLength(1);
    expect(s.phase.kind).toBe("specialBuild");
  });
});

describe("refused in a window (task 4.3)", () => {
  const base = (): GameState => {
    const s = endTurnOf(makePlayState({ playerCount: 5, seat: 0 }), 0);
    give(s, 1, { ore: 4, wool: 4 });
    s.players[1]!.devCards.push("knight", "monopoly", "victoryPoint");
    return s;
  };
  const code = "not_allowed_in_special_build";

  it("refuses domestic and maritime trade", () => {
    const s = base();
    expect(
      failCode(s, { type: "proposeTrade", seat: 1, give: { ore: 1 }, get: { wool: 1 }, to: [2] }),
    ).toBe(code);
    expect(
      failCode(s, { type: "maritimeTrade", seat: 1, give: "ore", get: "wool", count: 1 }),
    ).toBe(code);
    expect(legalActions(s, 1).maritime).toBeNull();
    expect(legalActions(s, 1).proposeTrade).toBe(false);
  });

  it("refuses card plays and VP reveals", () => {
    const s = base();
    expect(failCode(s, { type: "playKnight", seat: 1 })).toBe(code);
    expect(failCode(s, { type: "playMonopoly", seat: 1, resource: "ore" })).toBe(code);
    expect(failCode(s, { type: "revealVictoryPoints", seat: 1 })).toBe(code);
    expect(legalActions(s, 1).playDevCard).toEqual([]);
    expect(legalActions(s, 1).revealVictoryPoints).toBe(false);
  });

  it("refuses rolling and ending a turn", () => {
    const s = base();
    expect(failCode(s, { type: "rollDice", seat: 1 })).toBe(code);
    expect(failCode(s, { type: "endTurn", seat: 1 })).toBe(code);
    expect(legalActions(s, 1).endTurn).toBe(false);
    expect(legalActions(s, 1).rollDice).toBe(false);
  });
});

describe("cards and victory around windows (task 4.4)", () => {
  it("lets a card bought in a window be played on the buyer's next turn", () => {
    let s = endTurnOf(makePlayState({ playerCount: 5, seat: 2 }), 2);
    // Seat 4's window comes second; force the top card to be a Knight.
    s.devDeck.push("knight");
    s = step(s, { type: "passSpecialBuild", seat: 3 });
    give(s, 4, { ore: 1, wool: 1, grain: 1 });
    s = step(s, { type: "buyDevCard", seat: 4 });
    for (const seat of [4, 0, 1]) s = step(s, { type: "passSpecialBuild", seat });
    // Turns of 3 then 4.
    expect(s.turn.seat).toBe(3);
    s.turn.rolled = true;
    s = endTurnOf(s, 3);
    for (const seat of [4, 0, 1, 2]) s = step(s, { type: "passSpecialBuild", seat });
    expect(s.turn.seat).toBe(4);
    expect(legalActions(s, 4).playDevCard).toContain("knight");
    expect(step(s, { type: "playKnight", seat: 4 }).phase.kind).toBe("moveRobber");
  });

  it("does not let a player win in a window, but on their own turn", () => {
    let s = endTurnOf(makePlayState({ playerCount: 5, seat: 2 }), 2);
    // Seat 3 (first window, next to play) gets to 10 public VP by building a city.
    giveVp(s, 3, 9, 3);
    const v = s.vertices.findIndex((b) => b?.owner === 3 && b.kind === "settlement");
    expect(v).toBeGreaterThanOrEqual(0);
    give(s, 3, { ore: 3, grain: 2 });
    s = step(s, { type: "buildCity", seat: 3, vertex: v });
    expect(publicVp(s, 3)).toBe(10);
    expect(s.winner).toBeNull();
    expect(s.phase.kind).toBe("specialBuild");
    for (const seat of [3, 4, 0]) s = step(s, { type: "passSpecialBuild", seat });
    expect(s.winner).toBeNull();
    s = step(s, { type: "passSpecialBuild", seat: 1 });
    expect(s.winner).toBe(3);
    expect(s.log.at(-1)).toMatchObject({ type: "gameWon", seat: 3, vp: 10 });
  });
});

describe("window log and timer (task 4.5)", () => {
  it("logs opened windows, builds and passes", () => {
    let s = endTurnOf(makePlayState({ playerCount: 5, seat: 2 }), 2);
    expect(s.log.slice(-2)).toEqual([
      { type: "turnEnded", seat: 2 },
      { type: "specialBuildOpened", seat: 3 },
    ]);
    give(s, 3, { ore: 1, wool: 1, grain: 1 });
    s = step(s, { type: "buyDevCard", seat: 3 });
    const r = applyAction(s, { type: "passSpecialBuild", seat: 3 });
    expect(r.ok && r.events).toEqual([
      { type: "specialBuildPassed", seat: 3 },
      { type: "specialBuildOpened", seat: 4 },
    ]);
    // Purchases stay redacted for others.
    const view = playerView(s, 0);
    expect(view.log.find((e) => e.type === "devCardBought")).toMatchObject({ card: null });
  });

  it("passes the window on a timeout", () => {
    const s = endTurnOf(makePlayState({ playerCount: 6, seat: 0 }), 0);
    const r = applyAction(s, { type: "timeout" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.events).toEqual([
      { type: "timedOut", phase: "specialBuild", seats: [1] },
      { type: "specialBuildPassed", seat: 1 },
      { type: "specialBuildOpened", seat: 2 },
    ]);
  });
});

/** A simple path of `n` connected empty edges on the large board, avoiding buildings. */
function roadChain(s: GameState, n: number): number[] {
  for (const start of T.edges) {
    const chain = [start.id];
    const used = new Set(chain);
    let end = start.vertices[1];
    while (chain.length < n) {
      const next = T.vertices[end]!.edges.find((e) => !used.has(e) && s.edges[e] === null);
      if (next === undefined) break;
      chain.push(next);
      used.add(next);
      const [a, b] = T.edges[next]!.vertices;
      end = a === end ? b : a;
    }
    if (chain.length === n && new Set(chain.flatMap((e) => T.edges[e]!.vertices)).size === n + 1) {
      return chain;
    }
  }
  throw new Error("no chain");
}
