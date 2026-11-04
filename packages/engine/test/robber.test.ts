import { describe, expect, it } from "vite-plus/test";
import type { Resource } from "../src/board.ts";
import { legalActions } from "../src/game.ts";
import { nextInt } from "../src/rng.ts";
import { RESOURCES, cardTotal } from "../src/rules/common.ts";
import { discardOwed, robberOptions, startSeven } from "../src/rules/robber.ts";
import type { GameState, ResourceBundle } from "../src/state.ts";
import { failCode, give, makePlayState, putBuilding, step } from "../src/testing.ts";
import { TOPOLOGY, type HexId } from "../src/topology.ts";

function corner(hex: HexId, i: number): number {
  const v = TOPOLOGY.hexes[hex]?.vertices[i];
  if (v === undefined) throw new Error("bad corner");
  return v;
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

let sevenSeedCache: number | null = null;
/** A seed whose first rollDice from makePlayState is a 7. */
function sevenSeed(): number {
  if (sevenSeedCache !== null) return sevenSeedCache;
  for (let seed = 1; seed < 2000; seed++) {
    const s = step(makePlayState({ seed, rolled: false }), { type: "rollDice", seat: 0 });
    if (s.turn.dice && s.turn.dice[0] + s.turn.dice[1] === 7) return (sevenSeedCache = seed);
  }
  throw new Error("no seed rolls 7");
}

/** Phase moveRobber (after a 7) with seat 0 active, rolled. */
function robberState(): GameState {
  const s = makePlayState();
  s.phase = { kind: "moveRobber", source: "seven" };
  return s;
}

/** A hex other than the robber's. */
function otherHex(s: GameState): HexId {
  return s.robber === 0 ? 1 : 0;
}

describe("discard after a 7", () => {
  it("thresholds: 7/8/9/11 cards discard 0/4/4/5", () => {
    const s = makePlayState({ seed: sevenSeed(), rolled: false });
    give(s, 0, cards(7));
    give(s, 1, cards(8));
    give(s, 2, cards(9));
    give(s, 3, cards(11));
    const next = step(s, { type: "rollDice", seat: 0 });
    expect(next.phase).toEqual({ kind: "discard", owed: [0, 4, 4, 5] });
    expect([0, 1, 2, 3].map((seat) => discardOwed(next, seat))).toEqual([0, 4, 4, 5]);
    expect(legalActions(next, 3).discard).toBe(5);
    expect(robberOptions(next, 0)).toEqual([]);
  });

  it("the roller discards too", () => {
    const s = makePlayState({ seed: sevenSeed(), rolled: false });
    give(s, 0, cards(10));
    const next = step(s, { type: "rollDice", seat: 0 });
    expect(next.phase).toEqual({ kind: "discard", owed: [5, 0, 0, 0] });
  });

  it("nobody over 7 goes straight to the robber move", () => {
    const s = makePlayState();
    give(s, 1, cards(7));
    startSeven(s);
    expect(s.phase).toEqual({ kind: "moveRobber", source: "seven" });
    expect(discardOwed(s, 1)).toBe(0);
  });

  it("the robber cannot move before every discard is done", () => {
    let s = makePlayState();
    give(s, 1, cards(8));
    give(s, 2, cards(9));
    startSeven(s);
    expect(failCode(s, { type: "moveRobber", seat: 0, hex: otherHex(s), victim: null })).toBe(
      "wrong_phase",
    );
    s = step(s, { type: "discard", seat: 2, cards: { brick: 2, grain: 2 } });
    expect(s.phase).toEqual({ kind: "discard", owed: [0, 4, 0, 0] });
    expect(failCode(s, { type: "moveRobber", seat: 0, hex: otherHex(s), victim: null })).toBe(
      "wrong_phase",
    );
    const bankBrick = s.bank.brick;
    s = step(s, { type: "discard", seat: 1, cards: { brick: 2, lumber: 2 } });
    expect(s.phase).toEqual({ kind: "moveRobber", source: "seven" });
    expect(s.bank.brick).toBe(bankBrick + 2);
    expect(cardTotal(s.players[1]!.resources)).toBe(4);
    expect(s.log.filter((e) => e.type === "discarded")).toEqual([
      { type: "discarded", seat: 2, resources: { brick: 2, grain: 2 } },
      { type: "discarded", seat: 1, resources: { brick: 2, lumber: 2 } },
    ]);
  });

  it("rejects bad discards", () => {
    const s = makePlayState();
    give(s, 1, { brick: 8 });
    startSeven(s);
    expect(failCode(s, { type: "discard", seat: 1, cards: { brick: 3 } })).toBe("invalid_discard");
    expect(failCode(s, { type: "discard", seat: 1, cards: { brick: 5 } })).toBe("invalid_discard");
    expect(failCode(s, { type: "discard", seat: 1, cards: { ore: 4 } })).toBe("invalid_discard");
    expect(failCode(s, { type: "discard", seat: 1, cards: { brick: -1, ore: 5 } })).toBe(
      "invalid_discard",
    );
    expect(failCode(s, { type: "discard", seat: 0, cards: {} })).toBe("invalid_discard");
    const after = step(s, { type: "discard", seat: 1, cards: { brick: 4 } });
    expect(failCode(after, { type: "discard", seat: 1, cards: { brick: 4 } })).toBe("wrong_phase");
    expect(failCode(makePlayState(), { type: "discard", seat: 0, cards: {} })).toBe("wrong_phase");
  });
});

describe("moving the robber", () => {
  it("lists every other hex", () => {
    const s = robberState();
    const opts = robberOptions(s, 0);
    expect(opts).toHaveLength(18);
    expect(opts.map((o) => o.hex)).not.toContain(s.robber);
    expect(robberOptions(s, 1)).toEqual([]);
    expect(robberOptions(makePlayState(), 0)).toEqual([]);
  });

  it("must change hex", () => {
    const s = robberState();
    expect(failCode(s, { type: "moveRobber", seat: 0, hex: s.robber, victim: null })).toBe(
      "illegal_robber_hex",
    );
    expect(failCode(s, { type: "moveRobber", seat: 0, hex: 19, victim: null })).toBe(
      "illegal_robber_hex",
    );
    expect(failCode(s, { type: "moveRobber", seat: 1, hex: otherHex(s), victim: null })).toBe(
      "not_your_turn",
    );
  });

  it("victim must be null when no opponent is there", () => {
    const s = robberState();
    const hex = otherHex(s);
    expect(failCode(s, { type: "moveRobber", seat: 0, hex, victim: 1 })).toBe("illegal_victim");
    const next = step(s, { type: "moveRobber", seat: 0, hex, victim: null });
    expect(next.robber).toBe(hex);
    expect(next.phase).toEqual({ kind: "turn" });
    expect(next.log).toEqual([{ type: "robberMoved", seat: 0, hex }]);
  });

  it("victim must be a candidate and required when one exists", () => {
    const s = robberState();
    const hex = otherHex(s);
    putBuilding(s, corner(hex, 0), 1);
    putBuilding(s, corner(hex, 3), 2, "city");
    expect(robberOptions(s, 0).find((o) => o.hex === hex)?.victims).toEqual([1, 2]);
    expect(failCode(s, { type: "moveRobber", seat: 0, hex, victim: null })).toBe("illegal_victim");
    expect(failCode(s, { type: "moveRobber", seat: 0, hex, victim: 3 })).toBe("illegal_victim");
    expect(failCode(s, { type: "moveRobber", seat: 0, hex, victim: 0 })).toBe("illegal_victim");
    step(s, { type: "moveRobber", seat: 0, hex, victim: 2 });
  });

  it("cannot steal from oneself", () => {
    const s = robberState();
    const hex = otherHex(s);
    putBuilding(s, corner(hex, 0), 0);
    give(s, 0, cards(3));
    expect(robberOptions(s, 0).find((o) => o.hex === hex)?.victims).toEqual([]);
    expect(failCode(s, { type: "moveRobber", seat: 0, hex, victim: 0 })).toBe("illegal_victim");
    const next = step(s, { type: "moveRobber", seat: 0, hex, victim: null });
    expect(cardTotal(next.players[0]!.resources)).toBe(3);
  });

  it("an empty-handed victim gives nothing", () => {
    const s = robberState();
    const hex = otherHex(s);
    putBuilding(s, corner(hex, 0), 1);
    const next = step(s, { type: "moveRobber", seat: 0, hex, victim: 1 });
    expect(next.log).toEqual([
      { type: "robberMoved", seat: 0, hex },
      { type: "stole", thief: 0, victim: 1, resource: null },
    ]);
    expect(next.rng).toEqual(s.rng);
  });

  it("the stolen card moves from victim to thief", () => {
    const s = robberState();
    const hex = otherHex(s);
    putBuilding(s, corner(hex, 0), 1);
    give(s, 1, { ore: 1 });
    give(s, 0, { wool: 2 });
    const next = step(s, { type: "moveRobber", seat: 0, hex, victim: 1 });
    expect(next.players[1]?.resources.ore).toBe(0);
    expect(next.players[0]?.resources).toMatchObject({ ore: 1, wool: 2 });
    expect(next.log.at(-1)).toEqual({ type: "stole", thief: 0, victim: 1, resource: "ore" });
  });

  it("steals uniformly over the expanded hand, deterministically per seed", () => {
    const hand: ResourceBundle = { brick: 2, grain: 1, ore: 3, wool: 1 };
    const expanded: Resource[] = [];
    for (const r of RESOURCES) for (let i = 0; i < (hand[r] ?? 0); i++) expanded.push(r);
    const seen = new Set<Resource>();
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
      const s = makePlayState({ seed });
      s.phase = { kind: "moveRobber", source: "seven" };
      const hex = otherHex(s);
      putBuilding(s, corner(hex, 0), 3);
      give(s, 3, hand);
      const [idx] = nextInt(s.rng, expanded.length);
      const want = expanded[idx]!;
      const a = step(s, { type: "moveRobber", seat: 0, hex, victim: 3 });
      const b = step(s, { type: "moveRobber", seat: 0, hex, victim: 3 });
      expect(a).toEqual(b);
      expect(a.log.at(-1)).toEqual({ type: "stole", thief: 0, victim: 3, resource: want });
      expect(a.players[0]?.resources[want]).toBe(1);
      expect(cardTotal(a.players[3]!.resources)).toBe(6);
      expect(cardTotal(a.players[0]!.resources)).toBe(1);
      seen.add(want);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it("returns to the turn with the rolled flag unchanged (Knight before the roll)", () => {
    const s = makePlayState({ rolled: false });
    s.phase = { kind: "moveRobber", source: "knight" };
    const next = step(s, { type: "moveRobber", seat: 0, hex: otherHex(s), victim: null });
    expect(next.phase).toEqual({ kind: "turn" });
    expect(next.turn.rolled).toBe(false);
    expect(legalActions(next, 0).rollDice).toBe(true);
  });

  it("a full 7 sequence: roll, discard, move, steal, then trade/build", () => {
    let s = makePlayState({ seed: sevenSeed(), rolled: false });
    const hex = otherHex(s);
    putBuilding(s, corner(hex, 0), 2);
    give(s, 2, { grain: 9 });
    s = step(s, { type: "rollDice", seat: 0 });
    expect(s.phase).toEqual({ kind: "discard", owed: [0, 0, 4, 0] });
    s = step(s, { type: "discard", seat: 2, cards: { grain: 4 } });
    s = step(s, { type: "moveRobber", seat: 0, hex, victim: 2 });
    expect(s.players[0]?.resources.grain).toBe(1);
    expect(s.players[2]?.resources.grain).toBe(4);
    expect(s.phase.kind).toBe("turn");
    expect(s.turn.rolled).toBe(true);
    expect(legalActions(s, 0).endTurn).toBe(true);
  });
});
