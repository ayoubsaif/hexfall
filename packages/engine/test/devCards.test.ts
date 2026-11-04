import { describe, expect, it } from "vite-plus/test";
import { legalActions } from "../src/game.ts";
import {
  canBuyDevCard,
  canRevealVictoryPoints,
  playableDevCards,
  roadBuildingRoads,
} from "../src/rules/devCards.ts";
import { connectedRoadEdges } from "../src/rules/placement.ts";
import { robberOptions } from "../src/rules/robber.ts";
import type { DevCard, GameState, Seat } from "../src/state.ts";
import { failCode, give, makePlayState, putBuilding, putRoadAt, step } from "../src/testing.ts";
import { TOPOLOGY } from "../src/topology.ts";

function withCards(s: GameState, seat: Seat, cards: DevCard[]): GameState {
  s.players[seat]!.devCards = [...cards];
  return s;
}

/** Ends turns (marking each next seat as rolled) until `seat` is active again, not rolled. */
function passTo(s: GameState, seat: Seat): GameState {
  let t = s;
  do {
    t.turn.rolled = true;
    t = step(t, { type: "endTurn", seat: t.turn.seat });
  } while (t.turn.seat !== seat);
  return t;
}

/** A vertex with three paths. */
const INNER = TOPOLOGY.vertices.find((v) => v.edges.length === 3)!;

describe("buying development cards", () => {
  it("pays the cost to the bank and takes the top card", () => {
    let s = makePlayState({ seat: 0 });
    give(s, 0, { ore: 1, wool: 1, grain: 1, brick: 1 });
    s.devDeck = ["victoryPoint", "monopoly", "knight"];
    expect(canBuyDevCard(s, 0)).toBe(true);
    expect(canBuyDevCard(s, 1)).toBe(false);
    s = step(s, { type: "buyDevCard", seat: 0 });
    const p = s.players[0]!;
    expect(p.devCards).toEqual(["knight"]);
    expect(p.boughtThisTurn).toEqual(["knight"]);
    expect(p.resources).toMatchObject({ ore: 0, wool: 0, grain: 0, brick: 1 });
    expect(s.bank).toMatchObject({ ore: 19, wool: 19, grain: 19, brick: 18 });
    expect(s.devDeck).toEqual(["victoryPoint", "monopoly"]);
    expect(s.log.at(-1)).toEqual({ type: "devCardBought", seat: 0, card: "knight" });
    expect(failCode(s, { type: "buyDevCard", seat: 0 })).toBe("insufficient_resources");
  });

  it("fails on an empty deck", () => {
    const s = makePlayState({ seat: 0 });
    give(s, 0, { ore: 1, wool: 1, grain: 1 });
    s.devDeck = [];
    expect(canBuyDevCard(s, 0)).toBe(false);
    expect(failCode(s, { type: "buyDevCard", seat: 0 })).toBe("deck_empty");
  });

  it("needs the roll and the active seat", () => {
    const s = makePlayState({ seat: 0, rolled: false });
    give(s, 0, { ore: 1, wool: 1, grain: 1 });
    give(s, 1, { ore: 1, wool: 1, grain: 1 });
    expect(canBuyDevCard(s, 0)).toBe(false);
    expect(failCode(s, { type: "buyDevCard", seat: 0 })).toBe("must_roll_first");
    expect(failCode(s, { type: "buyDevCard", seat: 1 })).toBe("not_your_turn");
  });
});

describe("playing development cards", () => {
  it("a card bought this turn is not playable until the next turn", () => {
    let s = makePlayState({ seat: 0 });
    give(s, 0, { ore: 1, wool: 1, grain: 1 });
    s.devDeck = ["knight"];
    s = step(s, { type: "buyDevCard", seat: 0 });
    expect(playableDevCards(s, 0)).toEqual([]);
    expect(failCode(s, { type: "playKnight", seat: 0 })).toBe("card_not_playable");
    s = passTo(s, 0);
    expect(s.players[0]!.boughtThisTurn).toEqual([]);
    expect(playableDevCards(s, 0)).toEqual(["knight"]);
    s = step(s, { type: "playKnight", seat: 0 });
    expect(s.players[0]!.knights).toBe(1);
  });

  it("an older copy stays playable alongside one bought this turn", () => {
    let s = withCards(makePlayState({ seat: 0 }), 0, ["monopoly"]);
    give(s, 0, { ore: 1, wool: 1, grain: 1 });
    s.devDeck = ["monopoly"];
    s = step(s, { type: "buyDevCard", seat: 0 });
    expect(playableDevCards(s, 0)).toEqual(["monopoly"]);
    s = step(s, { type: "playMonopoly", seat: 0, resource: "ore" });
    expect(s.players[0]!.devCards).toEqual(["monopoly"]);
    expect(s.players[0]!.boughtThisTurn).toEqual(["monopoly"]);
    expect(s.removedCards).toEqual(["monopoly"]);
  });

  it("allows only one card per turn", () => {
    let s = withCards(makePlayState({ seat: 0 }), 0, ["knight", "monopoly", "roadBuilding"]);
    expect(playableDevCards(s, 0)).toEqual(["knight", "roadBuilding", "monopoly"]);
    s = step(s, { type: "playMonopoly", seat: 0, resource: "wool" });
    expect(s.turn.devPlayed).toBe(true);
    expect(playableDevCards(s, 0)).toEqual([]);
    expect(failCode(s, { type: "playKnight", seat: 0 })).toBe("dev_card_already_played");
    expect(failCode(s, { type: "playRoadBuilding", seat: 0 })).toBe("dev_card_already_played");
    s = passTo(s, 0);
    expect(playableDevCards(s, 0)).toEqual(["knight", "roadBuilding"]);
  });

  it("rejects plays off-turn or without the card", () => {
    const s = withCards(makePlayState({ seat: 0 }), 1, ["knight"]);
    expect(failCode(s, { type: "playKnight", seat: 1 })).toBe("not_your_turn");
    expect(playableDevCards(s, 1)).toEqual([]);
    expect(failCode(s, { type: "playKnight", seat: 0 })).toBe("card_not_playable");
    expect(failCode(s, { type: "playMonopoly", seat: 0, resource: "ore" })).toBe(
      "card_not_playable",
    );
  });
});

describe("Knight", () => {
  it("can be played before the roll: robber moves, nobody discards, roll still due", () => {
    let s = withCards(makePlayState({ seat: 0, rolled: false }), 0, ["knight"]);
    give(s, 0, { ore: 5, wool: 5 });
    give(s, 1, { brick: 10 });
    s = step(s, { type: "playKnight", seat: 0 });
    expect(s.phase).toEqual({ kind: "moveRobber", source: "knight" });
    expect(s.players[0]!.knights).toBe(1);
    expect(s.players[0]!.devCards).toEqual([]);
    expect(s.removedCards).toEqual([]);
    expect(s.log.at(-1)).toEqual({ type: "devCardPlayed", seat: 0, card: "knight" });
    const opt = robberOptions(s, 0)[0]!;
    expect(opt.hex).not.toBe(s.robber);
    s = step(s, { type: "moveRobber", seat: 0, hex: opt.hex, victim: opt.victims[0] ?? null });
    expect(s.phase).toEqual({ kind: "turn" });
    expect(s.turn.rolled).toBe(false);
    expect(s.players[1]!.resources.brick).toBe(10);
    expect(legalActions(s, 0).rollDice).toBe(true);
  });
});

describe("Largest Army", () => {
  function knightTurn(s: GameState, seat: Seat): GameState {
    let t = passTo(s, seat);
    t.players[seat]!.devCards.push("knight");
    t = step(t, { type: "playKnight", seat });
    const opt = robberOptions(t, seat)[0]!;
    return step(t, { type: "moveRobber", seat, hex: opt.hex, victim: opt.victims[0] ?? null });
  }

  it("goes to the first player with 3 knights and moves only on strictly more", () => {
    let s = makePlayState({ seat: 3 });
    s = knightTurn(s, 0);
    s = knightTurn(s, 0);
    expect(s.largestArmy).toBeNull();
    s = knightTurn(s, 0);
    expect(s.largestArmy).toBe(0);
    expect(s.log).toContainEqual({ type: "largestArmy", from: null, to: 0, knights: 3 });
    s = knightTurn(s, 1);
    s = knightTurn(s, 1);
    s = knightTurn(s, 1);
    expect(s.players[1]!.knights).toBe(3);
    expect(s.largestArmy).toBe(0);
    s = knightTurn(s, 1);
    expect(s.largestArmy).toBe(1);
    expect(s.log).toContainEqual({ type: "largestArmy", from: 0, to: 1, knights: 4 });
    const awards = s.log.filter((e) => e.type === "largestArmy");
    expect(awards).toHaveLength(2);
    // The holder playing more knights emits nothing new.
    s = knightTurn(s, 1);
    expect(s.log.filter((e) => e.type === "largestArmy")).toHaveLength(2);
  });
});

describe("Road Building", () => {
  it("places two free roads, the second connecting to the first", () => {
    let s = withCards(makePlayState({ seat: 0 }), 0, ["roadBuilding"]);
    putBuilding(s, INNER.id, 0);
    s = step(s, { type: "playRoadBuilding", seat: 0 });
    expect(s.phase).toEqual({ kind: "roadBuilding", remaining: 2 });
    expect(s.removedCards).toEqual(["roadBuilding"]);
    expect(roadBuildingRoads(s, 0)).toEqual(connectedRoadEdges(s, 0));
    expect(roadBuildingRoads(s, 1)).toEqual([]);
    const first = INNER.edges[0]!;
    const [a, b] = TOPOLOGY.edges[first]!.vertices;
    const far = a === INNER.id ? b : a;
    const second = TOPOLOGY.vertices[far]!.edges.find((e) => e !== first)!;
    expect(failCode(s, { type: "buildRoad", seat: 0, edge: second })).toBe("illegal_placement");
    s = step(s, { type: "buildRoad", seat: 0, edge: first });
    expect(s.phase).toEqual({ kind: "roadBuilding", remaining: 1 });
    expect(legalActions(s, 0).buildRoad).toContain(second);
    s = step(s, { type: "buildRoad", seat: 0, edge: second });
    expect(s.phase).toEqual({ kind: "turn" });
    expect(s.edges[first]).toBe(0);
    expect(s.edges[second]).toBe(0);
    expect(s.players[0]!.pieces.roads).toBe(13);
    expect(s.players[0]!.resources).toMatchObject({ brick: 0, lumber: 0 });
    expect(s.log.filter((e) => e.type === "built")).toEqual([
      { type: "built", seat: 0, piece: "road", at: first, free: true },
      { type: "built", seat: 0, piece: "road", at: second, free: true },
    ]);
  });

  it("works before the roll", () => {
    let s = withCards(makePlayState({ seat: 0, rolled: false }), 0, ["roadBuilding"]);
    putBuilding(s, INNER.id, 0);
    s = step(s, { type: "playRoadBuilding", seat: 0 });
    s = step(s, { type: "buildRoad", seat: 0, edge: INNER.edges[0]! });
    expect(s.phase.kind).toBe("roadBuilding");
  });

  it("grants only one road with one left in supply", () => {
    let s = withCards(makePlayState({ seat: 0 }), 0, ["roadBuilding"]);
    putBuilding(s, INNER.id, 0);
    s.players[0]!.pieces.roads = 1;
    s = step(s, { type: "playRoadBuilding", seat: 0 });
    expect(s.phase).toEqual({ kind: "roadBuilding", remaining: 1 });
    s = step(s, { type: "buildRoad", seat: 0, edge: INNER.edges[0]! });
    expect(s.phase).toEqual({ kind: "turn" });
    expect(s.players[0]!.pieces.roads).toBe(0);
  });

  it("consumes the card without a phase when no road can be placed", () => {
    let s = withCards(makePlayState({ seat: 0 }), 0, ["roadBuilding"]);
    s = step(s, { type: "playRoadBuilding", seat: 0 });
    expect(s.phase).toEqual({ kind: "turn" });
    expect(s.players[0]!.devCards).toEqual([]);
    expect(s.turn.devPlayed).toBe(true);

    let t = withCards(makePlayState({ seat: 0 }), 0, ["roadBuilding"]);
    putBuilding(t, INNER.id, 0);
    t.players[0]!.pieces.roads = 0;
    t = step(t, { type: "playRoadBuilding", seat: 0 });
    expect(t.phase).toEqual({ kind: "turn" });
  });

  it("ends early when no legal path is left", () => {
    let s = withCards(makePlayState({ seat: 0 }), 0, ["roadBuilding"]);
    putBuilding(s, INNER.id, 0);
    const [open, ...blocked] = INNER.edges as [number, ...number[]];
    for (const e of blocked) putRoadAt(s, e, 1);
    const [a, b] = TOPOLOGY.edges[open]!.vertices;
    putBuilding(s, a === INNER.id ? b : a, 1);
    expect(connectedRoadEdges(s, 0)).toEqual([open]);
    s = step(s, { type: "playRoadBuilding", seat: 0 });
    expect(s.phase).toEqual({ kind: "roadBuilding", remaining: 2 });
    s = step(s, { type: "buildRoad", seat: 0, edge: open });
    expect(s.phase).toEqual({ kind: "turn" });
    expect(s.players[0]!.pieces.roads).toBe(14);
  });
});

describe("Year of Plenty", () => {
  it("takes two cards of the player's choice", () => {
    let s = withCards(makePlayState({ seat: 0, rolled: false }), 0, ["yearOfPlenty"]);
    s = step(s, { type: "playYearOfPlenty", seat: 0, resources: ["ore", "ore"] });
    expect(s.players[0]!.resources.ore).toBe(2);
    expect(s.bank.ore).toBe(17);
    expect(s.removedCards).toEqual(["yearOfPlenty"]);
    expect(s.log.at(-1)).toEqual({ type: "yearOfPlenty", seat: 0, resources: ["ore", "ore"] });
  });

  it("is limited by the bank", () => {
    const s = withCards(makePlayState({ seat: 0 }), 0, ["yearOfPlenty"]);
    give(s, 1, { brick: 19, grain: 19, lumber: 19, ore: 19, wool: 18 });
    expect(playableDevCards(s, 0)).toEqual(["yearOfPlenty"]);
    expect(failCode(s, { type: "playYearOfPlenty", seat: 0, resources: ["wool", "wool"] })).toBe(
      "invalid_action",
    );
    expect(failCode(s, { type: "playYearOfPlenty", seat: 0, resources: ["ore"] })).toBe(
      "bank_empty",
    );
    const t = step(s, { type: "playYearOfPlenty", seat: 0, resources: ["wool"] });
    expect(t.players[0]!.resources.wool).toBe(1);
    expect(t.bank.wool).toBe(0);
  });

  it("fails if the bank lacks a requested card, without consuming the card", () => {
    const s = withCards(makePlayState({ seat: 0 }), 0, ["yearOfPlenty"]);
    give(s, 1, { ore: 18 });
    expect(failCode(s, { type: "playYearOfPlenty", seat: 0, resources: ["ore", "ore"] })).toBe(
      "bank_empty",
    );
    expect(
      failCode(s, { type: "playYearOfPlenty", seat: 0, resources: ["ore", "gold" as never] }),
    ).toBe("invalid_action");
    const t = step(s, { type: "playYearOfPlenty", seat: 0, resources: ["ore", "brick"] });
    expect(t.players[0]!.resources).toMatchObject({ ore: 1, brick: 1 });
  });
});

describe("Monopoly", () => {
  it("takes all of the named resource from every other player", () => {
    let s = withCards(makePlayState({ seat: 1 }), 1, ["monopoly"]);
    give(s, 0, { wool: 2, ore: 1 });
    give(s, 1, { wool: 1 });
    give(s, 3, { wool: 3 });
    s = step(s, { type: "playMonopoly", seat: 1, resource: "wool" });
    expect(s.players.map((p) => p.resources.wool)).toEqual([0, 6, 0, 0]);
    expect(s.players[0]!.resources.ore).toBe(1);
    expect(s.removedCards).toEqual(["monopoly"]);
    expect(s.log.at(-1)).toEqual({
      type: "monopoly",
      seat: 1,
      resource: "wool",
      taken: [2, 0, 0, 3],
    });
  });

  it("rejects an invalid resource", () => {
    const s = withCards(makePlayState({ seat: 0 }), 0, ["monopoly"]);
    expect(failCode(s, { type: "playMonopoly", seat: 0, resource: "gold" as never })).toBe(
      "invalid_action",
    );
  });
});

describe("victory point cards", () => {
  /** Seat 0 with `vp` public VP from buildings (cities first). */
  function withPublicVp(vp: number, rolled = true): GameState {
    const s = makePlayState({ seat: 0, rolled });
    const spots = TOPOLOGY.vertices.filter((_, i) => i % 3 === 0).map((v) => v.id);
    let left = vp;
    let i = 0;
    while (left >= 2 && s.players[0]!.pieces.cities > 0) {
      putBuilding(s, spots[i++]!, 0, "city");
      left -= 2;
    }
    while (left > 0) {
      putBuilding(s, spots[i++]!, 0, "settlement");
      left--;
    }
    return s;
  }

  it("cannot be revealed below 10", () => {
    const s = withCards(withPublicVp(7), 0, ["victoryPoint", "knight"]);
    expect(canRevealVictoryPoints(s, 0)).toBe(false);
    expect(failCode(s, { type: "revealVictoryPoints", seat: 0 })).toBe("cannot_reveal");
    const t = withCards(withPublicVp(9), 0, ["knight"]);
    expect(failCode(t, { type: "revealVictoryPoints", seat: 0 })).toBe("cannot_reveal");
  });

  it("revealing to 10 wins, also on the turn bought and before the roll", () => {
    let s = withPublicVp(9, false);
    s.devDeck = ["victoryPoint"];
    s.turn.rolled = true;
    give(s, 0, { ore: 1, wool: 1, grain: 1 });
    s = step(s, { type: "buyDevCard", seat: 0 });
    expect(s.phase.kind).toBe("turn");
    expect(canRevealVictoryPoints(s, 0)).toBe(true);
    expect(canRevealVictoryPoints(s, 1)).toBe(false);
    expect(failCode(s, { type: "revealVictoryPoints", seat: 1 })).toBe("not_your_turn");
    s = step(s, { type: "revealVictoryPoints", seat: 0 });
    expect(s.players[0]!.revealedVp).toBe(1);
    expect(s.players[0]!.devCards).toEqual([]);
    expect(s.players[0]!.boughtThisTurn).toEqual([]);
    expect(s.phase).toEqual({ kind: "ended" });
    expect(s.winner).toBe(0);
    expect(s.log).toContainEqual({ type: "vpRevealed", seat: 0, count: 1 });

    let t = withCards(withPublicVp(8, false), 0, ["victoryPoint", "victoryPoint"]);
    t = step(t, { type: "revealVictoryPoints", seat: 0 });
    expect(t.players[0]!.revealedVp).toBe(2);
    expect(t.winner).toBe(0);
  });

  it("does not count toward the one-card limit", () => {
    let s = withCards(withPublicVp(9), 0, ["knight", "victoryPoint"]);
    s = step(s, { type: "playKnight", seat: 0 });
    const opt = robberOptions(s, 0)[0]!;
    s = step(s, { type: "moveRobber", seat: 0, hex: opt.hex, victim: opt.victims[0] ?? null });
    expect(s.turn.devPlayed).toBe(true);
    expect(canRevealVictoryPoints(s, 0)).toBe(true);
    s = step(s, { type: "revealVictoryPoints", seat: 0 });
    expect(s.winner).toBe(0);

    // Revealing doesn't use up the turn's card play either (checked before the win ends it).
    const t = withCards(withPublicVp(9), 0, ["victoryPoint", "knight"]);
    expect(playableDevCards(t, 0)).toEqual(["knight"]);
    expect(legalActions(t, 0).revealVictoryPoints).toBe(true);
  });

  it("is not revealable during a sub-phase", () => {
    const s = withCards(withPublicVp(9), 0, ["victoryPoint"]);
    s.phase = { kind: "moveRobber", source: "seven" };
    expect(canRevealVictoryPoints(s, 0)).toBe(false);
    expect(failCode(s, { type: "revealVictoryPoints", seat: 0 })).toBe("wrong_phase");
  });
});
