import { describe, expect, it } from "vite-plus/test";
import { DEV_DECK, applyAction, createGame } from "../src/game.ts";
import { cardTotal } from "../src/rules/common.ts";
import { RuleError } from "../src/rules/errors.ts";
import type { DevCard, GameState } from "../src/state.ts";
import { failCode, makePlayState, step } from "../src/testing.ts";

function deepFreeze<T>(v: T): T {
  if (v !== null && typeof v === "object" && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const x of Object.values(v)) deepFreeze(x);
  }
  return v;
}

function countBy(cards: readonly DevCard[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of cards) out[c] = (out[c] ?? 0) + 1;
  return out;
}

describe("createGame", () => {
  it("sets up the components (AGENTS.md §1, §4)", () => {
    const s = createGame({ seed: 7, playerCount: 3, mode: "variable" });
    expect(cardTotal(s.bank)).toBe(95);
    expect(Object.values(s.bank)).toEqual([19, 19, 19, 19, 19]);
    expect(s.devDeck).toHaveLength(25);
    expect(countBy(s.devDeck)).toEqual({
      knight: 14,
      roadBuilding: 2,
      yearOfPlenty: 2,
      monopoly: 2,
      victoryPoint: 5,
    });
    expect(s.players).toHaveLength(3);
    for (const p of s.players) {
      expect(p.pieces).toEqual({ roads: 15, settlements: 5, cities: 4 });
      expect(cardTotal(p.resources)).toBe(0);
      expect(p.devCards).toEqual([]);
    }
    expect(s.board.hexes[s.robber]?.terrain).toBe("desert");
    expect(s.vertices).toHaveLength(54);
    expect(s.edges).toHaveLength(72);
    expect(s.longestRoad).toBeNull();
    expect(s.largestArmy).toBeNull();
    expect(s.phase.kind).toBe("rollForOrder");
    expect(s.log[0]).toEqual({ type: "gameCreated", playerCount: 3, mode: "variable" });
  });

  it("rejects bad configs", () => {
    for (const playerCount of [2, 5, 0]) {
      expect(() =>
        createGame({ seed: 1, playerCount: playerCount as 3, mode: "beginner" }),
      ).toThrow(RuleError);
    }
    expect(() =>
      createGame({ seed: 1, playerCount: 3, mode: "beginner", startingPlayer: 3 }),
    ).toThrow(RuleError);
    expect(() => createGame({ seed: 1, playerCount: 3, mode: "odd" as "beginner" })).toThrow(
      RuleError,
    );
  });

  it("is deterministic and JSON round-trips", () => {
    const a = createGame({ seed: "abc", playerCount: 4, mode: "variable" });
    const b = createGame({ seed: "abc", playerCount: 4, mode: "variable" });
    expect(a).toEqual(b);
    expect(JSON.parse(JSON.stringify(a))).toEqual(a);
    expect(createGame({ seed: "abd", playerCount: 4, mode: "variable" }).devDeck).not.toEqual(
      a.devDeck,
    );
  });

  it("pins the seeded deck order (replay contract)", () => {
    const s = createGame({ seed: 42, playerCount: 4, mode: "beginner" });
    expect(s.devDeck.slice(-5)).toMatchInlineSnapshot(`
      [
        "knight",
        "roadBuilding",
        "knight",
        "knight",
        "knight",
      ]
    `);
    expect([...s.devDeck].sort()).toEqual([...DEV_DECK].sort());
  });
});

describe("applyAction", () => {
  it("never mutates its input", () => {
    const s = deepFreeze(makePlayState());
    const r = applyAction(s, { type: "endTurn", seat: 0 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.state.turn.seat).toBe(1);
      expect(r.state.turn.number).toBe(2);
      expect(r.events.map((e) => e.type)).toEqual(["turnEnded", "turnStarted"]);
    }
  });

  it("rejects bad seats and unknown actions", () => {
    const s = makePlayState();
    expect(failCode(s, { type: "endTurn", seat: 4 })).toBe("invalid_action");
    expect(failCode(s, { type: "nope", seat: 0 } as never)).toBe("invalid_action");
  });

  it("end turn needs the active player after the roll", () => {
    expect(failCode(makePlayState(), { type: "endTurn", seat: 1 })).toBe("not_your_turn");
    expect(failCode(makePlayState({ rolled: false }), { type: "endTurn", seat: 0 })).toBe(
      "must_roll_first",
    );
  });

  it("end turn clears offers and bought-this-turn, and wraps seats", () => {
    let s: GameState = makePlayState({ playerCount: 3, seat: 2 });
    s.players[2]!.boughtThisTurn = ["knight"];
    s.players[2]!.devCards = ["knight"];
    s.offers = [{ id: 1, from: 2, to: [0], give: { ore: 1 }, get: { wool: 1 }, rejectedBy: [] }];
    s = step(s, { type: "endTurn", seat: 2 });
    expect(s.turn).toEqual({ seat: 0, number: 2, rolled: false, devPlayed: false, dice: null });
    expect(s.players[2]!.boughtThisTurn).toEqual([]);
    expect(s.players[2]!.devCards).toEqual(["knight"]);
    expect(s.offers).toEqual([]);
  });

  it("rejects everything once the game has ended", () => {
    const s = makePlayState();
    s.phase = { kind: "ended" };
    expect(failCode(s, { type: "endTurn", seat: 0 })).toBe("game_over");
  });

  it("a player with 10 public VP wins when their turn starts", () => {
    const s = makePlayState({ seat: 0 });
    // Seat 1 holds 10 VP from cities (set directly), gained off-turn.
    for (const v of [0, 3, 6, 9, 12]) s.vertices[v] = { owner: 1, kind: "city" };
    const r = step(s, { type: "endTurn", seat: 0 });
    expect(r.phase.kind).toBe("ended");
    expect(r.winner).toBe(1);
    expect(r.log.at(-1)).toEqual({ type: "gameWon", seat: 1, vp: 10 });
  });
});
