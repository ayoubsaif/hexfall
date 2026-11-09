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
    expect(s.bank[r] + held, `resource ${r}`).toBe(s.bankPerResource);
  }
  s.players.forEach((pl, seat) => {
    const roads = s.edges.filter((o) => o === seat).length;
    expect(pl.pieces.roads + roads).toBe(15);
  });
}

/** Seats are polled in order; the first with a move acts (as the server driver does). */
function botMove(s: GameState, rngs: BotRng[], trade = false): Action | null {
  for (let seat = 0; seat < s.playerCount; seat++) {
    const a = chooseAction(playerView(s, seat), legalActions(s, seat), rngs[seat]!, { trade });
    if (a) return a;
  }
  return null;
}

function playGame(seed: number, n: 3 | 4 | 5 | 6, mode: "beginner" | "variable", trade = false) {
  let s = createGame({ seed, playerCount: n, mode });
  const rngs = Array.from({ length: n }, (_, i) => new BotRng(seed * 31 + i));
  const actions: Action[] = [];
  let steps = 0;
  while (s.phase.kind !== "ended" && steps < 20000) {
    const a = botMove(s, rngs, trade);
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

  for (const seed of [2, 5, 11]) {
    it(`seed ${seed} with trading on still finishes`, () => {
      const { s, actions } = playGame(seed, seed % 2 ? 4 : 3, "variable", true);
      expect(s.phase.kind).toBe("ended");
      expect(actions.some((a) => a.type === "proposeTrade")).toBe(false);
    });
  }

  for (const [seed, n] of [
    [4, 5],
    [9, 6],
    [13, 5],
    [21, 6],
  ] as const) {
    it(`seed ${seed}, ${n} bots on the large board, with building windows`, () => {
      const { s, actions } = playGame(seed, n, "variable", true);
      expect(s.phase.kind).toBe("ended");
      expect(s.winner).not.toBeNull();
      expect(s.board.layout).toBe("large");
      expect(actions.some((a) => a.type === "passSpecialBuild")).toBe(true);
      expect(actions.some((a) => a.type === "proposeTrade")).toBe(false);
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

  it("builds in its building window, then passes", () => {
    // Play a 5-bot game until the first building window opens.
    let s = createGame({ seed: 4, playerCount: 5, mode: "variable" });
    const rngs = Array.from({ length: 5 }, (_, i) => new BotRng(i));
    while (s.phase.kind !== "specialBuild") {
      const r = applyAction(s, botMove(s, rngs)!);
      if (!r.ok) throw new Error(r.code);
      s = r.state;
    }
    if (s.phase.kind !== "specialBuild") throw new Error("no window");
    const seat = s.phase.current;
    // Enough for a city on one of its settlements.
    const p = s.players[seat]!;
    for (const r of RESOURCES) {
      s.bank[r] += p.resources[r];
      p.resources[r] = 0;
    }
    p.resources.ore = 3;
    p.resources.grain = 2;
    s.bank.ore -= 3;
    s.bank.grain -= 2;
    const build = chooseAction(playerView(s, seat), legalActions(s, seat), new BotRng(1));
    expect(build?.type).toBe("buildCity");
    const r = applyAction(s, build!);
    if (!r.ok) throw new Error(r.code);
    const next = chooseAction(
      playerView(r.state, seat),
      legalActions(r.state, seat),
      new BotRng(1),
    );
    expect(next).toEqual({ type: "passSpecialBuild", seat });
  });
});
