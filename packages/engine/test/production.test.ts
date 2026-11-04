import { describe, expect, it } from "vite-plus/test";
import { cardTotal } from "../src/rules/common.ts";
import { canRollDice, produce } from "../src/rules/production.ts";
import type { GameState } from "../src/state.ts";
import { failCode, makePlayState, makeState, putBuilding, step } from "../src/testing.ts";
import { TOPOLOGY, type HexId } from "../src/topology.ts";

/** Hex ids carrying `token` on the board, ascending. */
function hexesWith(s: GameState, token: number): HexId[] {
  return s.board.hexes.flatMap((h, id) => (h.token === token ? [id] : []));
}

function hexWith(s: GameState, token: number): HexId {
  const h = hexesWith(s, token)[0];
  if (h === undefined) throw new Error(`no hex with ${token}`);
  return h;
}

function corner(hex: HexId, i: number): number {
  const v = TOPOLOGY.hexes[hex]?.vertices[i];
  if (v === undefined) throw new Error("bad corner");
  return v;
}

function diceTotal(s: GameState): number {
  return s.turn.dice ? s.turn.dice[0] + s.turn.dice[1] : 0;
}

/** A seed whose first rollDice from makePlayState totals `want` (or anything but 7). */
function seedRolling(want: number | "not7"): number {
  for (let seed = 1; seed < 2000; seed++) {
    const t = diceTotal(
      step(makePlayState({ seed, rolled: false }), { type: "rollDice", seat: 0 }),
    );
    if (want === "not7" ? t !== 7 : t === want) return seed;
  }
  throw new Error("no seed");
}

describe("rollDice", () => {
  it("rolls once, logs and marks the turn rolled", () => {
    const s = makePlayState({ seed: seedRolling("not7"), rolled: false });
    expect(canRollDice(s, 0)).toBe(true);
    expect(canRollDice(s, 1)).toBe(false);
    const next = step(s, { type: "rollDice", seat: 0 });
    expect(next.turn.rolled).toBe(true);
    expect(next.log.find((e) => e.type === "diceRolled")).toEqual({
      type: "diceRolled",
      seat: 0,
      dice: next.turn.dice,
      total: diceTotal(next),
    });
    expect(next.phase.kind).toBe("turn");
    expect(canRollDice(next, 0)).toBe(false);
    expect(failCode(next, { type: "rollDice", seat: 0 })).toBe("already_rolled");
  });

  it("is deterministic for a seed", () => {
    const a = step(makePlayState({ seed: 42, rolled: false }), { type: "rollDice", seat: 0 });
    const b = step(makePlayState({ seed: 42, rolled: false }), { type: "rollDice", seat: 0 });
    expect(a.turn.dice).toEqual(b.turn.dice);
    expect(a.rng).toEqual(b.rng);
  });

  it("rejects other seats and other phases", () => {
    const s = makePlayState({ rolled: false });
    expect(failCode(s, { type: "rollDice", seat: 1 })).toBe("not_your_turn");
    expect(canRollDice(makeState({ seed: 1 }), 0)).toBe(false);
    expect(failCode(makeState({ seed: 1 }), { type: "rollDice", seat: 0 })).toBe("wrong_phase");
  });

  it("a rolled 7 produces nothing and starts the robber", () => {
    const s = makePlayState({ seed: seedRolling(7), rolled: false });
    for (const hex of TOPOLOGY.hexes) putBuilding(s, corner(hex.id, 0), 1);
    const bank = { ...s.bank };
    const next = step(s, { type: "rollDice", seat: 0 });
    expect(next.bank).toEqual(bank);
    expect(next.log.some((e) => e.type === "produced")).toBe(false);
    expect(next.phase).toEqual({ kind: "moveRobber", source: "seven" });
  });

  it("a non-7 roll pays production", () => {
    const seed = seedRolling("not7");
    const arrange = (g: GameState) => {
      for (const hex of TOPOLOGY.hexes) putBuilding(g, corner(hex.id, 0), 1);
    };
    const s = makePlayState({ seed, rolled: false });
    arrange(s);
    const next = step(s, { type: "rollDice", seat: 0 });
    const ref = makePlayState({ seed });
    arrange(ref);
    produce(ref, diceTotal(next));
    expect(next.players[1]?.resources).toEqual(ref.players[1]?.resources);
    expect(cardTotal(next.players[1]!.resources)).toBeGreaterThan(0);
  });
});

describe("produce", () => {
  it("pays 1 per settlement and 2 per city", () => {
    const s = makePlayState();
    const h = hexWith(s, 2);
    expect(s.board.hexes[h]?.terrain).toBe("pasture");
    putBuilding(s, corner(h, 0), 0, "settlement");
    putBuilding(s, corner(h, 3), 1, "city");
    produce(s, 2);
    expect(s.players[0]?.resources.wool).toBe(1);
    expect(s.players[1]?.resources.wool).toBe(2);
    expect(s.bank.wool).toBe(16);
    expect(s.log).toEqual([
      { type: "produced", seat: 0, resources: { wool: 1 } },
      { type: "produced", seat: 1, resources: { wool: 2 } },
    ]);
  });

  it("pays each of a player's buildings on the same hex", () => {
    const s = makePlayState();
    const h = hexWith(s, 2);
    putBuilding(s, corner(h, 0), 2);
    putBuilding(s, corner(h, 2), 2, "city");
    putBuilding(s, corner(h, 4), 2);
    produce(s, 2);
    expect(s.players[2]?.resources.wool).toBe(4);
    expect(s.log).toEqual([{ type: "produced", seat: 2, resources: { wool: 4 } }]);
  });

  it("pays every hex with the number and nothing for other numbers", () => {
    const s = makePlayState();
    const hs = hexesWith(s, 8); // beginner: mountains 8 and forest 8
    expect(hs).toHaveLength(2);
    for (const h of hs) putBuilding(s, corner(h, 0), 0);
    // Number 2's only hex is untouched by these corners.
    const two = hexWith(s, 2);
    const touched = hs.flatMap((h) => TOPOLOGY.vertices[corner(h, 0)]?.hexes ?? []);
    expect(touched).not.toContain(two);
    produce(s, 2);
    expect(cardTotal(s.players[0]!.resources)).toBe(0);
    produce(s, 8);
    expect(s.players[0]?.resources).toMatchObject({ ore: 1, lumber: 1 });
  });

  it("the robber's hex produces nothing", () => {
    const s = makePlayState();
    const h = hexWith(s, 2);
    putBuilding(s, corner(h, 0), 0, "city");
    s.robber = h;
    produce(s, 2);
    expect(cardTotal(s.players[0]!.resources)).toBe(0);
    expect(s.bank.wool).toBe(19);
    expect(s.log).toEqual([]);
  });

  it("shortage with several players: nobody gets that resource", () => {
    const s = makePlayState();
    const h = hexWith(s, 2);
    putBuilding(s, corner(h, 0), 0);
    putBuilding(s, corner(h, 3), 1, "city");
    s.bank.wool = 2; // 3 owed
    produce(s, 2);
    expect(s.players[0]?.resources.wool).toBe(0);
    expect(s.players[1]?.resources.wool).toBe(0);
    expect(s.bank.wool).toBe(2);
    expect(s.log).toEqual([{ type: "shortage", resource: "wool" }]);
  });

  it("shortage with one player: they get what remains", () => {
    const s = makePlayState();
    const h = hexWith(s, 2);
    putBuilding(s, corner(h, 0), 1, "city");
    putBuilding(s, corner(h, 3), 1, "city");
    s.bank.wool = 3; // 4 owed
    produce(s, 2);
    expect(s.players[1]?.resources.wool).toBe(3);
    expect(s.bank.wool).toBe(0);
    expect(s.log).toEqual([
      { type: "shortage", resource: "wool" },
      { type: "produced", seat: 1, resources: { wool: 3 } },
    ]);
  });

  it("shortage with one player and an empty bank pays nothing", () => {
    const s = makePlayState();
    const h = hexWith(s, 2);
    putBuilding(s, corner(h, 0), 1);
    s.bank.wool = 0;
    produce(s, 2);
    expect(s.players[1]?.resources.wool).toBe(0);
    expect(s.log).toEqual([{ type: "shortage", resource: "wool" }]);
  });

  it("an exactly sufficient bank pays in full", () => {
    const s = makePlayState();
    const h = hexWith(s, 2);
    putBuilding(s, corner(h, 0), 0);
    putBuilding(s, corner(h, 3), 1, "city");
    s.bank.wool = 3;
    produce(s, 2);
    expect(s.players[0]?.resources.wool).toBe(1);
    expect(s.players[1]?.resources.wool).toBe(2);
    expect(s.bank.wool).toBe(0);
    expect(s.log.some((e) => e.type === "shortage")).toBe(false);
  });

  it("a shortage leaves other resources unaffected", () => {
    const s = makePlayState();
    const hs = hexesWith(s, 8);
    const ore = hs.find((h) => s.board.hexes[h]?.terrain === "mountains")!;
    const lumber = hs.find((h) => s.board.hexes[h]?.terrain === "forest")!;
    putBuilding(s, corner(ore, 0), 0);
    putBuilding(s, corner(ore, 3), 1);
    putBuilding(s, corner(lumber, 0), 0);
    putBuilding(s, corner(lumber, 3), 1);
    s.bank.ore = 1;
    produce(s, 8);
    expect(s.players[0]?.resources).toMatchObject({ ore: 0, lumber: 1 });
    expect(s.players[1]?.resources).toMatchObject({ ore: 0, lumber: 1 });
    expect(s.bank.ore).toBe(1);
    expect(s.bank.lumber).toBe(17);
    expect(s.log[0]).toEqual({ type: "shortage", resource: "ore" });
  });

  it("a total of 7 produces nothing", () => {
    const s = makePlayState();
    for (const hex of TOPOLOGY.hexes) putBuilding(s, corner(hex.id, 0), 0, "city");
    produce(s, 7);
    expect(cardTotal(s.players[0]!.resources)).toBe(0);
    expect(s.log).toEqual([]);
  });
});
