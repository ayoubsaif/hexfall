// Random legal play (tasks 5.2): every listed move must be accepted, and card
// and piece totals must be conserved at every step.
import { describe, expect, it } from "vite-plus/test";
import type { Resource } from "../src/board.ts";
import { applyAction, createGame, legalActions } from "../src/game.ts";
import { createRng, nextInt, type RngState } from "../src/rng.ts";
import { RESOURCES, cardTotal } from "../src/rules/common.ts";
import type { Action, GameState, PhaseKind, ResourceBundle, Seat } from "../src/state.ts";

/** Test-local RNG for choosing moves (separate from the game RNG). */
class Picker {
  private rng: RngState;
  constructor(seed: number) {
    this.rng = createRng(seed);
  }
  int(n: number): number {
    const [x, next] = nextInt(this.rng, n);
    this.rng = next;
    return x;
  }
  pick<T>(xs: readonly T[]): T {
    return xs[this.int(xs.length)] as T;
  }
}

function randomDiscard(s: GameState, seat: Seat, n: number, p: Picker): ResourceBundle {
  const hand = { ...s.players[seat]!.resources };
  const out: ResourceBundle = {};
  for (let i = 0; i < n; i++) {
    const r = p.pick(RESOURCES.filter((x) => hand[x] > 0));
    hand[r]--;
    out[r] = (out[r] ?? 0) + 1;
  }
  return out;
}

interface Weighted {
  action: Action;
  weight: number;
}

/** Expands legalActions for every seat into concrete actions with play weights. */
function candidates(s: GameState, p: Picker): Weighted[] {
  const out: Weighted[] = [];
  const add = (action: Action, weight = 1) => out.push({ action, weight });
  for (let seat = 0; seat < s.playerCount; seat++) {
    const L = legalActions(s, seat);
    if (L.rollForOrder) add({ type: "rollForOrder", seat });
    for (const vertex of L.placeSettlement) add({ type: "placeSettlement", seat, vertex });
    for (const edge of L.placeRoad) add({ type: "placeRoad", seat, edge });
    if (L.rollDice) add({ type: "rollDice", seat }, 5);
    if (L.discard > 0) add({ type: "discard", seat, cards: randomDiscard(s, seat, L.discard, p) });
    for (const o of L.moveRobber) {
      if (o.victims.length === 0) add({ type: "moveRobber", seat, hex: o.hex, victim: null });
      for (const victim of o.victims) add({ type: "moveRobber", seat, hex: o.hex, victim });
    }
    for (const edge of L.buildRoad) add({ type: "buildRoad", seat, edge }, 2);
    for (const vertex of L.buildSettlement) add({ type: "buildSettlement", seat, vertex }, 40);
    for (const vertex of L.buildCity) add({ type: "buildCity", seat, vertex }, 40);
    if (L.buyDevCard) add({ type: "buyDevCard", seat }, 10);
    for (const card of L.playDevCard) {
      if (card === "knight") add({ type: "playKnight", seat }, 5);
      if (card === "roadBuilding") add({ type: "playRoadBuilding", seat }, 5);
      if (card === "monopoly") add({ type: "playMonopoly", seat, resource: p.pick(RESOURCES) }, 5);
      if (card === "yearOfPlenty") {
        const bank = { ...s.bank };
        const want = Math.min(2, cardTotal(bank));
        const resources: Resource[] = [];
        for (let i = 0; i < want; i++) {
          const r = p.pick(RESOURCES.filter((x) => bank[x] > 0));
          bank[r]--;
          resources.push(r);
        }
        add({ type: "playYearOfPlenty", seat, resources }, 5);
      }
    }
    if (L.revealVictoryPoints) add({ type: "revealVictoryPoints", seat }, 100);
    if (L.proposeTrade && s.offers.length < 3) {
      const hand = s.players[seat]!.resources;
      const have = RESOURCES.filter((r) => hand[r] > 0);
      if (have.length > 0) {
        const giveR = p.pick(have);
        const getR = p.pick(RESOURCES.filter((r) => r !== giveR));
        const others = Array.from({ length: s.playerCount }, (_, i) => i).filter((i) => i !== seat);
        const to = seat === s.turn.seat ? others : [s.turn.seat];
        add({ type: "proposeTrade", seat, give: { [giveR]: 1 }, get: { [getR]: 1 }, to }, 1);
      }
    }
    for (const offerId of L.acceptTrade) add({ type: "acceptTrade", seat, offerId }, 3);
    for (const offerId of L.rejectTrade) add({ type: "rejectTrade", seat, offerId }, 1);
    for (const offerId of L.cancelTrade) add({ type: "cancelTrade", seat, offerId }, 1);
    if (L.maritime) {
      const hand = s.players[seat]!.resources;
      for (const give of RESOURCES) {
        if (hand[give] < L.maritime[give]) continue;
        for (const get of RESOURCES) {
          if (get !== give && s.bank[get] > 0) {
            add({ type: "maritimeTrade", seat, give, get, count: 1 }, 2);
          }
        }
      }
    }
    if (L.endTurn) add({ type: "endTurn", seat }, 3);
    if (L.passSpecialBuild) add({ type: "passSpecialBuild", seat }, 3);
  }
  return out;
}

function choose(ws: Weighted[], p: Picker): Action {
  const total = ws.reduce((n, w) => n + w.weight, 0);
  let x = p.int(total);
  for (const w of ws) {
    x -= w.weight;
    if (x < 0) return w.action;
  }
  throw new Error("unreachable");
}

function checkInvariants(s: GameState): void {
  for (const r of RESOURCES) {
    const held = s.players.reduce((n, pl) => n + pl.resources[r], 0);
    expect(s.bank[r] + held, `resource ${r}`).toBe(s.bankPerResource);
    expect(s.bank[r]).toBeGreaterThanOrEqual(0);
  }
  const devTotal =
    s.devDeck.length +
    s.removedCards.length +
    s.players.reduce((n, pl) => n + pl.devCards.length + pl.knights + pl.revealedVp, 0);
  expect(devTotal).toBe(s.playerCount >= 5 ? 34 : 25);
  s.players.forEach((pl, seat) => {
    const roads = s.edges.filter((o) => o === seat).length;
    const settlements = s.vertices.filter((b) => b?.owner === seat && b.kind === "settlement");
    const cities = s.vertices.filter((b) => b?.owner === seat && b.kind === "city");
    expect(pl.pieces.roads + roads).toBe(15);
    expect(pl.pieces.settlements + settlements.length).toBe(5);
    expect(pl.pieces.cities + cities.length).toBe(4);
  });
}

interface PlayResult {
  state: GameState;
  applied: number;
  actions: Action[];
  /** Phase in which each applied timeout fired. */
  timedOut: PhaseKind[];
}

/**
 * Random legal play. With `timeoutPct` > 0, each step is a system `timeout`
 * with that chance (turn timer, floating-hud-turn-timer task 1.5).
 */
function play(
  seed: number,
  playerCount: 3 | 4 | 5 | 6,
  mode: "beginner" | "variable",
  steps: number,
  timeoutPct = 0,
): PlayResult {
  let s = createGame({ seed, playerCount, mode });
  const p = new Picker(seed * 7919 + 1);
  const actions: Action[] = [];
  const timedOut: PhaseKind[] = [];
  let applied = 0;
  for (; applied < steps && s.phase.kind !== "ended"; applied++) {
    const ws = candidates(s, p);
    expect(ws.length, `no legal action at step ${applied} in ${s.phase.kind}`).toBeGreaterThan(0);
    const isTimeout = timeoutPct > 0 && p.int(100) < timeoutPct;
    const action: Action = isTimeout ? { type: "timeout" } : choose(ws, p);
    const r = applyAction(s, action);
    if (!r.ok) {
      throw new Error(
        `step ${applied}: listed ${JSON.stringify(action)} rejected: ${r.code} ${r.message}`,
      );
    }
    if (isTimeout) {
      timedOut.push(s.phase.kind);
      expect(r.events[0]).toMatchObject({ type: "timedOut", phase: s.phase.kind });
    }
    actions.push(action);
    s = r.state;
    checkInvariants(s);
  }
  return { state: s, applied, actions, timedOut };
}

/** Re-applies a recorded action list from the seed. */
function replay(
  seed: number,
  playerCount: 3 | 4 | 5 | 6,
  mode: "beginner" | "variable",
  actions: Action[],
): GameState {
  let s = createGame({ seed, playerCount, mode });
  for (const a of actions) {
    const r = applyAction(s, a);
    if (!r.ok) throw new Error(`replay rejected ${JSON.stringify(a)}: ${r.code}`);
    s = r.state;
  }
  return s;
}

describe("fuzz: random legal play", () => {
  const cases: [number, 3 | 4, "beginner" | "variable"][] = [
    [1, 4, "variable"],
    [2, 3, "variable"],
    [3, 4, "beginner"],
    [4, 3, "beginner"],
    [5, 4, "variable"],
    [6, 4, "variable"],
  ];
  for (const [seed, n, mode] of cases) {
    it(`seed ${seed}, ${n} players, ${mode}`, () => {
      const { state } = play(seed, n, mode, 3000);
      expect(state.phase.kind === "ended" || state.turn.number > 20).toBe(true);
    });
  }

  it("replays identically from the same seed", () => {
    const a = play(11, 4, "variable", 400).state;
    const b = play(11, 4, "variable", 400).state;
    expect(a).toEqual(b);
  });
});

describe("fuzz: 5–6 player games (Special Building Phase)", () => {
  const cases: [number, 5 | 6][] = [
    [41, 5],
    [42, 6],
    [43, 5],
    [44, 6],
  ];
  for (const [seed, n] of cases) {
    it(`seed ${seed}, ${n} players, played to the end`, () => {
      const { state, actions } = play(seed, n, "variable", 20000);
      expect(state.phase.kind).toBe("ended");
      expect(state.winner).not.toBeNull();
      expect(actions.some((a) => a.type === "passSpecialBuild")).toBe(true);
      expect(state.log.some((e) => e.type === "specialBuildOpened")).toBe(true);
    });
  }

  it("times out in Special Building Phase windows and replays identically", () => {
    const run = play(45, 6, "variable", 20000, 15);
    expect(run.timedOut).toContain("specialBuild");
    expect(run.state.phase.kind).toBe("ended");
    expect(replay(45, 6, "variable", run.actions)).toEqual(run.state);
  });
});

describe("fuzz: random play with turn-timer timeouts", () => {
  const cases: [number, 3 | 4, "beginner" | "variable"][] = [
    [21, 4, "variable"],
    [22, 3, "variable"],
    [23, 4, "beginner"],
    [24, 3, "beginner"],
  ];
  for (const [seed, n, mode] of cases) {
    it(`seed ${seed}, ${n} players, ${mode}, 10% timeouts`, () => {
      const { state, timedOut } = play(seed, n, mode, 6000, 10);
      expect(timedOut.length).toBeGreaterThan(0);
      expect(state.phase.kind).toBe("ended");
      expect(state.winner).not.toBeNull();
    });
  }

  it("replays a game with timeouts in every phase to deep-equal states", () => {
    const seed = 31;
    const run = play(seed, 4, "variable", 6000, 30);
    const phases = new Set(run.timedOut);
    for (const k of [
      "rollForOrder",
      "setup",
      "turn",
      "discard",
      "moveRobber",
      "roadBuilding",
    ] as const) {
      expect(phases.has(k), `no timeout during ${k}`).toBe(true);
    }
    const a = replay(seed, 4, "variable", run.actions);
    const b = replay(seed, 4, "variable", run.actions);
    expect(a).toEqual(b);
    expect(a).toEqual(run.state);
  });
});
