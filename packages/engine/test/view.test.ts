import { describe, expect, it } from "vite-plus/test";
import { robberOptions } from "../src/rules/robber.ts";
import type { GameState } from "../src/state.ts";
import { give, makePlayState, putBuilding, step } from "../src/testing.ts";
import { STANDARD_TOPOLOGY } from "../src/topology.ts";
import { playerView } from "../src/view.ts";

function handState(): GameState {
  const s = makePlayState({ seat: 0 });
  give(s, 0, { ore: 2, wool: 1 });
  give(s, 1, { brick: 3 });
  s.players[0]!.devCards = ["knight", "victoryPoint"];
  s.players[0]!.boughtThisTurn = ["victoryPoint"];
  s.players[1]!.devCards = ["monopoly"];
  s.players[1]!.knights = 2;
  return s;
}

function keysDeep(x: unknown, out = new Set<string>()): Set<string> {
  if (x !== null && typeof x === "object") {
    for (const [k, v] of Object.entries(x)) {
      out.add(k);
      keysDeep(v, out);
    }
  }
  return out;
}

describe("playerView", () => {
  it("shows opponents' hands only as counts and the own hand in full", () => {
    const s = handState();
    const v = playerView(s, 1);
    expect(v.viewer).toBe(1);
    const p0 = v.players[0]!;
    expect(p0).toEqual({
      seat: 0,
      resourceCount: 3,
      devCardCount: 2,
      knights: 0,
      revealedVp: 0,
      publicVp: 0,
      pieces: { roads: 15, settlements: 5, cities: 4 },
    });
    const p1 = v.players[1]!;
    expect(p1.resources).toEqual({ brick: 3, grain: 0, lumber: 0, ore: 0, wool: 0 });
    expect(p1.devCards).toEqual(["monopoly"]);
    expect(p1.boughtThisTurn).toEqual([]);
    expect(p1.hiddenVp).toBe(0);
    expect(p1.knights).toBe(2);

    const own = playerView(s, 0).players[0]!;
    expect(own.devCards).toEqual(["knight", "victoryPoint"]);
    expect(own.boughtThisTurn).toEqual(["victoryPoint"]);
    expect(own.hiddenVp).toBe(1);
    expect(own.publicVp).toBe(0);
  });

  it("reports public VP from buildings and special cards", () => {
    const s = handState();
    putBuilding(s, 0, 1, "city");
    s.largestArmy = 1;
    s.players[1]!.revealedVp = 1;
    expect(playerView(s, 0).players[1]!.publicVp).toBe(5);
  });

  it("never exposes the RNG or the deck order", () => {
    const s = handState();
    s.removedCards = ["monopoly"];
    for (const viewer of [0, 1, null]) {
      const v = playerView(s, viewer);
      const keys = keysDeep(v);
      expect(keys.has("rng")).toBe(false);
      expect(keys.has("devDeck")).toBe(false);
      expect(keys.has("removedCards")).toBe(false);
      expect(v.devDeckCount).toBe(25);
      const json = JSON.stringify(v);
      expect(json).not.toContain('"rng"');
      expect(json).not.toContain('"devDeck"');
    }
  });

  it("gives a spectator no private information", () => {
    const s = handState();
    const v = playerView(s, null);
    expect(v.viewer).toBeNull();
    for (const p of v.players) {
      expect(p.resources).toBeUndefined();
      expect(p.devCards).toBeUndefined();
      expect(p.boughtThisTurn).toBeUndefined();
      expect(p.hiddenVp).toBeUndefined();
    }
    expect(v.players.map((p) => p.resourceCount)).toEqual([3, 3, 0, 0]);
  });

  it("redacts steals for everyone but thief and victim", () => {
    const s = handState();
    s.log.push({ type: "stole", thief: 0, victim: 1, resource: "brick" });
    s.log.push({ type: "stole", thief: 2, victim: 3, resource: null });
    const stole = (viewer: number | null) =>
      playerView(s, viewer).log.filter((e) => e.type === "stole");
    expect(stole(0)[0]).toEqual({ type: "stole", thief: 0, victim: 1, resource: "brick" });
    expect(stole(1)[0]).toEqual({ type: "stole", thief: 0, victim: 1, resource: "brick" });
    expect(stole(2)[0]).toEqual({ type: "stole", thief: 0, victim: 1, resource: null });
    expect(stole(null)[0]).toEqual({ type: "stole", thief: 0, victim: 1, resource: null });
    expect(s.log.at(-2)).toEqual({ type: "stole", thief: 0, victim: 1, resource: "brick" });
  });

  it("redacts a real Knight steal", () => {
    let s = makePlayState({ seat: 0 });
    s.players[0]!.devCards = ["knight"];
    give(s, 1, { ore: 1 });
    // Seat 1 on a corner of some hex other than the robber's.
    const hex = STANDARD_TOPOLOGY.hexes.find((h) => h.id !== s.robber)!;
    putBuilding(s, hex.vertices[0]!, 1);
    s = step(s, { type: "playKnight", seat: 0 });
    expect(robberOptions(s, 0).find((o) => o.hex === hex.id)!.victims).toEqual([1]);
    s = step(s, { type: "moveRobber", seat: 0, hex: hex.id, victim: 1 });
    const find = (viewer: number | null) =>
      playerView(s, viewer).log.find((e) => e.type === "stole");
    expect(find(0)).toMatchObject({ resource: "ore" });
    expect(find(1)).toMatchObject({ resource: "ore" });
    expect(find(2)).toMatchObject({ thief: 0, victim: 1, resource: null });
  });

  it("redacts purchases for everyone but the buyer", () => {
    let s = makePlayState({ seat: 0 });
    give(s, 0, { ore: 1, wool: 1, grain: 1 });
    s.devDeck = ["yearOfPlenty"];
    s = step(s, { type: "buyDevCard", seat: 0 });
    const bought = (viewer: number | null) =>
      playerView(s, viewer).log.find((e) => e.type === "devCardBought");
    expect(bought(0)).toEqual({ type: "devCardBought", seat: 0, card: "yearOfPlenty" });
    expect(bought(1)).toEqual({ type: "devCardBought", seat: 0, card: null });
    expect(bought(null)).toEqual({ type: "devCardBought", seat: 0, card: null });
    expect(playerView(s, 1).devDeckCount).toBe(0);
  });

  it("does not alias the state", () => {
    const s = handState();
    s.offers.push({ id: 1, from: 0, to: [1], give: { ore: 1 }, get: { brick: 1 }, rejectedBy: [] });
    s.log.push({ type: "tradeOffered", offer: { ...s.offers[0]! } });
    const before = JSON.stringify(s);
    const v = playerView(s, 0);
    v.players[0]!.resources!.ore = 99;
    v.players[0]!.devCards!.push("monopoly");
    v.players[0]!.pieces.roads = 0;
    // Board is readonly in the type; mutate anyway to prove it is a copy.
    const board = v.board as unknown as { hexes: { token: number }[]; harbors: string[] };
    board.hexes[0]!.token = 2;
    board.harbors.pop();
    v.vertices[0] = { owner: 3, kind: "city" };
    v.edges[0] = 3;
    v.bank.ore = 0;
    v.phase = { kind: "ended" };
    v.turn.rolled = false;
    v.offers[0]!.give.ore = 5;
    v.offers[0]!.to.push(2);
    const logged = v.log.find((e) => e.type === "tradeOffered");
    if (logged?.type === "tradeOffered") logged.offer.rejectedBy.push(1);
    expect(JSON.stringify(s)).toBe(before);
  });

  it("reveals every hand and hidden VP once the game has ended", () => {
    const s = handState();
    s.log.push({ type: "stole", thief: 0, victim: 1, resource: "brick" });
    s.log.push({ type: "devCardBought", seat: 0, card: "victoryPoint" });
    s.players[2]!.devCards = ["victoryPoint", "victoryPoint"];
    s.phase = { kind: "ended" };
    s.winner = 0;
    const v = playerView(s, 3);
    expect(v.players[0]!.hiddenVp).toBe(1);
    expect(v.players[2]!.hiddenVp).toBe(2);
    expect(v.players[1]!.resources).toMatchObject({ brick: 3 });
    expect(v.players[0]!.devCards).toEqual(["knight", "victoryPoint"]);
    expect(v.log).toContainEqual({ type: "stole", thief: 0, victim: 1, resource: "brick" });
    expect(v.log).toContainEqual({ type: "devCardBought", seat: 0, card: "victoryPoint" });
    expect(playerView(s, null).players[2]!.hiddenVp).toBe(2);
  });
});
