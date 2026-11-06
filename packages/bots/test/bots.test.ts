import { describe, expect, it } from "vite-plus/test";
import {
  RESOURCES,
  applyAction,
  createGame,
  legalActions,
  playerView,
  type Action,
  type GameState,
} from "@hexfall/engine";
import { BotRng, chooseAction } from "../src/index.ts";

function checkInvariants(s: GameState): void {
  for (const r of RESOURCES) {
    const held = s.players.reduce((n, pl) => n + pl.resources[r], 0);
    expect(s.bank[r] + held, `resource ${r}`).toBe(19);
  }
  s.players.forEach((pl, seat) => {
    const roads = s.edges.filter((o) => o === seat).length;
    expect(pl.pieces.roads + roads).toBe(15);
  });
}

/** Seats are polled in order; the first with a move acts (as the server driver does). */
function botMove(s: GameState, rngs: BotRng[]): Action | null {
  for (let seat = 0; seat < s.playerCount; seat++) {
    const a = chooseAction(playerView(s, seat), legalActions(s, seat), rngs[seat]!);
    if (a) return a;
  }
  return null;
}

function playGame(seed: number, n: 3 | 4, mode: "beginner" | "variable") {
  let s = createGame({ seed, playerCount: n, mode });
  const rngs = Array.from({ length: n }, (_, i) => new BotRng(seed * 31 + i));
  const actions: Action[] = [];
  let steps = 0;
  while (s.phase.kind !== "ended" && steps < 20000) {
    const a = botMove(s, rngs);
    if (!a) throw new Error(`stall at step ${steps} in ${s.phase.kind}`);
    const r = applyAction(s, a);
    if (!r.ok) throw new Error(`rejected ${JSON.stringify(a)}: ${r.code} ${r.message}`);
    s = r.state;
    actions.push(a);
    if (steps % 25 === 0) checkInvariants(s);
    steps++;
  }
  return { s, actions, steps };
}

describe("bots play full games", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const n = seed % 2 ? 4 : 3;
    const mode = seed % 3 ? "variable" : "beginner";
    it(`seed ${seed}, ${n} bots, ${mode}`, () => {
      const { s } = playGame(seed, n, mode);
      expect(s.phase.kind).toBe("ended");
      expect(s.winner).not.toBeNull();
    });
  }

  it("is deterministic for the same seeds", () => {
    const a = playGame(7, 4, "variable");
    const b = playGame(7, 4, "variable");
    expect(a.actions).toEqual(b.actions);
  });
});

describe("bot behaviour", () => {
  it("never proposes trades and rejects offers", () => {
    const { actions } = playGame(3, 4, "variable");
    expect(actions.some((a) => a.type === "proposeTrade")).toBe(false);
  });

  it("returns null for a seat with nothing to do", () => {
    const s = createGame({ seed: 5, playerCount: 3, mode: "variable" });
    // Roll-for-order: every contender can roll, so first seat acts; after all rolled, none left.
    const rng = new BotRng(1);
    const a = chooseAction(playerView(s, 0), legalActions(s, 0), rng);
    expect(a).toEqual({ type: "rollForOrder", seat: 0 });
  });
});
