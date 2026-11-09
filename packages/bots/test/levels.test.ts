import { describe, expect, it } from "vite-plus/test";
import {
  STANDARD_TOPOLOGY,
  applyAction,
  createGame,
  legalActions,
  playerView,
  type Action,
  type GameState,
  type Seat,
} from "@hexfall/engine";
import { BOT_LEVELS, BotRng, chooseAction, toBotLevel, type BotLevel } from "../src/index.ts";
import { producedBy, vertexValue } from "../src/eval.ts";

function act(s: GameState, seat: Seat, level: BotLevel, seed: number | string = 1) {
  return chooseAction(playerView(s, seat), legalActions(s, seat), new BotRng(seed), {
    trade: false,
    level,
  });
}

describe("toBotLevel", () => {
  it("keeps the three levels and falls back to normal", () => {
    for (const l of BOT_LEVELS) expect(toBotLevel(l)).toBe(l);
    expect(toBotLevel(undefined)).toBe("normal");
    expect(toBotLevel("insane")).toBe("normal");
    expect(toBotLevel(2)).toBe("normal");
  });
});

describe("move choice by level", () => {
  const start = () => createGame({ seed: 4, playerCount: 3, mode: "variable", startingPlayer: 0 });
  /** First setup settlement for seat 0 (a starting player skips roll-for-order). */
  function setupState(): GameState {
    const s = start();
    expect(s.phase.kind).toBe("setup");
    return s;
  }
  /** Score of each vertex, and the top score among legal ones. */
  function scorer(s: GameState): { value: (v: number) => number; top: number } {
    const view = playerView(s, 0);
    const owned = producedBy(view, 0);
    const value = (v: number) => vertexValue(view, v, owned);
    return { value, top: Math.max(...legalActions(s, 0).placeSettlement.map(value)) };
  }
  function picks(level: BotLevel): number[] {
    const s = setupState();
    expect(legalActions(s, 0).placeSettlement.length).toBeGreaterThan(10);
    return Array.from({ length: 60 }, (_, i) => {
      const a = act(s, 0, level, `pick:${i}`);
      expect(a?.type).toBe("placeSettlement");
      return a?.type === "placeSettlement" ? a.vertex : -1;
    });
  }

  it("Hard always places on a best-scored vertex", () => {
    const { value, top } = scorer(setupState());
    for (const v of picks("hard")) expect(value(v)).toBe(top);
  });

  it("Easy sometimes places somewhere weaker, but mostly on a best vertex", () => {
    const { value, top } = scorer(setupState());
    const off = picks("easy").filter((v) => value(v) < top).length;
    expect(off).toBeGreaterThan(5);
    expect(off).toBeLessThan(40);
  });

  it("is deterministic for the same seed at every level", () => {
    const s = setupState();
    for (const l of BOT_LEVELS) expect(act(s, 0, l, "same")).toEqual(act(s, 0, l, "same"));
  });
});

describe("robber targeting by level", () => {
  /** Seat 0 moves the robber; seats 1 (3 VP) and 2 (7 VP) both sit on one hex. */
  function robberState(): { s: GameState; hex: number } {
    const s = createGame({ seed: 9, playerCount: 3, mode: "variable", startingPlayer: 0 });
    s.phase = { kind: "moveRobber", source: "knight" };
    s.turn = { seat: 0, number: 5, rolled: true, devPlayed: true, dice: [3, 4] };
    const hex = STANDARD_TOPOLOGY.hexes.findIndex(
      (h, i) => i !== s.robber && h.vertices.length === 6,
    )!;
    const [a, , c] = STANDARD_TOPOLOGY.hexes[hex]!.vertices;
    s.vertices[a!] = { owner: 1, kind: "settlement" };
    s.vertices[c!] = { owner: 2, kind: "settlement" };
    // Extra VP for seat 2 far away, plus a card each so both can be robbed.
    for (const v of [0, 30, 50]) if (!s.vertices[v]) s.vertices[v] = { owner: 2, kind: "city" };
    for (const seat of [1, 2]) {
      s.players[seat]!.resources.wool = 2;
      s.bank.wool -= 2;
    }
    return { s, hex };
  }

  it("Hard robs the leader when the leader can be robbed", () => {
    const { s } = robberState();
    const view = playerView(s, 0);
    expect(view.players[2]!.publicVp).toBeGreaterThan(view.players[1]!.publicVp);
    for (let i = 0; i < 10; i++) {
      const a = act(s, 0, "hard", `rob:${i}`)!;
      expect(a.type).toBe("moveRobber");
      if (a.type === "moveRobber") {
        const opt = legalActions(s, 0).moveRobber.find((o) => o.hex === a.hex)!;
        if (opt.victims.includes(2)) expect(a.victim).toBe(2);
        // Hard places the robber where the leader can be robbed.
        expect(opt.victims).toContain(2);
      }
    }
  });

  it("Hard robs the leader on a hex where both qualify", () => {
    const { s, hex } = robberState();
    const legal = legalActions(s, 0);
    legal.moveRobber = legal.moveRobber.filter((o) => o.hex === hex);
    expect([...legal.moveRobber[0]!.victims].sort((x, y) => x - y)).toEqual([1, 2]);
    const a = chooseAction(playerView(s, 0), legal, new BotRng(1), { trade: false, level: "hard" });
    expect(a).toMatchObject({ type: "moveRobber", hex, victim: 2 });
  });

  it("Easy picks a victim at random", () => {
    const { s, hex } = robberState();
    const legal = legalActions(s, 0);
    legal.moveRobber = legal.moveRobber.filter((o) => o.hex === hex);
    const victims = new Set<Seat | null>();
    for (let i = 0; i < 30; i++) {
      const a = chooseAction(playerView(s, 0), legal, new BotRng(`easy:${i}`), {
        trade: false,
        level: "easy",
      });
      if (a?.type === "moveRobber") victims.add(a.victim);
    }
    expect(victims).toEqual(new Set([1, 2]));
  });
});

describe("bots-only games at every level", () => {
  function play(seed: number, levels: readonly BotLevel[]) {
    const n = levels.length as 3 | 4;
    let s = createGame({ seed, playerCount: n, mode: "variable" });
    const rngs = levels.map((_, i) => new BotRng(seed * 31 + i));
    let steps = 0;
    while (s.phase.kind !== "ended" && steps < 30000) {
      let a: Action | null = null;
      for (let seat = 0; seat < n && !a; seat++) {
        a = chooseAction(playerView(s, seat), legalActions(s, seat), rngs[seat]!, {
          trade: true,
          level: levels[seat]!,
        });
      }
      if (!a) throw new Error(`stall at step ${steps} in ${s.phase.kind}`);
      const r = applyAction(s, a);
      if (!r.ok) throw new Error(`rejected ${JSON.stringify(a)}: ${r.code} ${r.message}`);
      s = r.state;
      steps++;
    }
    return s;
  }

  const tables: [number, BotLevel[]][] = [
    [1, ["easy", "easy", "easy"]],
    [2, ["easy", "easy", "easy", "easy"]],
    [3, ["hard", "hard", "hard"]],
    [4, ["hard", "hard", "hard", "hard"]],
    [5, ["easy", "normal", "hard"]],
    [6, ["hard", "normal", "easy", "normal"]],
  ];
  for (const [seed, levels] of tables) {
    it(`seed ${seed}: ${levels.join(", ")}`, () => {
      const s = play(seed, levels);
      expect(s.phase.kind).toBe("ended");
      expect(s.winner).not.toBeNull();
    });
  }
});
