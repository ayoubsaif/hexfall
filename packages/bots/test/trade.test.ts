import { describe, expect, it } from "vite-plus/test";
import {
  RESOURCES,
  applyAction,
  createGame,
  legalActions,
  playerView,
  type GameState,
  type ResourceBundle,
  type Seat,
} from "@hexfall/engine";
import { BotRng, chooseAction, judgeOffer } from "../src/index.ts";

/** Turn phase, seat 0 (the human) active and rolled; seat 1 owns a settlement on vertex 20. */
function base(active: Seat = 0, rolled = true): GameState {
  const s = createGame({ seed: 9, playerCount: 3, mode: "variable", startingPlayer: 0 });
  s.phase = { kind: "turn" };
  s.turn = { seat: active, number: 5, rolled, devPlayed: false, dice: rolled ? [3, 4] : null };
  s.vertices[20] = { owner: 1, kind: "settlement" };
  s.players[1]!.pieces.settlements = 4;
  return s;
}

function hand(s: GameState, seat: Seat, b: ResourceBundle): void {
  const p = s.players[seat]!;
  for (const r of RESOURCES) {
    s.bank[r] += p.resources[r] - (b[r] ?? 0);
    p.resources[r] = b[r] ?? 0;
  }
}

/** Seat `from` offers `give` for `get` to `to`; returns the state with the open offer. */
function offer(
  s: GameState,
  from: Seat,
  to: Seat[],
  give: ResourceBundle,
  get: ResourceBundle,
): GameState {
  const r = applyAction(s, { type: "proposeTrade", seat: from, to, give, get });
  if (!r.ok) throw new Error(`${r.code}: ${r.message}`);
  return r.state;
}

function judge(s: GameState, seat: Seat): boolean {
  return judgeOffer(playerView(s, seat), seat, s.offers[0]!);
}

function act(s: GameState, seat: Seat, trade: boolean) {
  return chooseAction(playerView(s, seat), legalActions(s, seat), new BotRng(1), { trade });
}

describe("judgeOffer", () => {
  it("accepts a card that completes a settlement", () => {
    const s = base();
    hand(s, 0, { grain: 2 });
    hand(s, 1, { brick: 1, lumber: 1, wool: 1, ore: 2 });
    const t = offer(s, 0, [1], { grain: 1 }, { ore: 1 });
    expect(judge(t, 1)).toBe(true);
  });

  it("rejects trading a needed card for a useless one", () => {
    const s = base();
    hand(s, 0, { wool: 2 });
    hand(s, 1, { brick: 1, lumber: 1, wool: 1, grain: 1 });
    // The bot can build a settlement; it would give grain for a second wool.
    const t = offer(s, 0, [1], { wool: 1 }, { grain: 1 });
    expect(judge(t, 1)).toBe(false);
  });

  it("rejects an offer that breaks an affordable city", () => {
    const s = base();
    hand(s, 0, { wool: 2 });
    hand(s, 1, { ore: 3, grain: 2 });
    const t = offer(s, 0, [1], { wool: 2 }, { ore: 1 });
    expect(judge(t, 1)).toBe(false);
  });

  it("rejects a proposer with 8 public VP", () => {
    const s = base();
    for (const v of [0, 8, 30, 40]) s.vertices[v] = { owner: 0, kind: "city" };
    s.players[0]!.pieces.cities = 0;
    hand(s, 0, { grain: 2 });
    hand(s, 1, { brick: 1, lumber: 1, wool: 1, ore: 2 });
    const t = offer(s, 0, [1], { grain: 1 }, { ore: 1 });
    expect(judge(t, 1)).toBe(false);
  });

  it("accepts two cards for one when no build is hurt", () => {
    const s = base();
    hand(s, 0, { grain: 2 });
    hand(s, 1, { ore: 1, wool: 3 });
    const t = offer(s, 0, [1], { grain: 2 }, { wool: 1 });
    expect(judge(t, 1)).toBe(true);
  });

  it("gives the same answer for the same input", () => {
    const s = base();
    hand(s, 0, { grain: 2 });
    hand(s, 1, { brick: 1, lumber: 1, wool: 1, ore: 2 });
    const t = offer(s, 0, [1], { grain: 1 }, { ore: 1 });
    expect(judge(t, 1)).toBe(judge(t, 1));
  });
});

describe("chooseAction with offers", () => {
  function goodOffer(active: Seat = 0, rolled = true): GameState {
    const s = base(active, rolled);
    hand(s, 0, { grain: 2 });
    hand(s, 1, { brick: 1, lumber: 1, wool: 1, ore: 2 });
    return offer(s, 0, [1], { grain: 1 }, { ore: 1 });
  }

  it("still rejects every offer when trading is off", () => {
    const t = goodOffer();
    expect(act(t, 1, false)).toEqual({ type: "rejectTrade", seat: 1, offerId: t.offers[0]!.id });
  });

  it("accepts a good offer when trading is on", () => {
    const t = goodOffer();
    expect(act(t, 1, true)).toEqual({ type: "acceptTrade", seat: 1, offerId: t.offers[0]!.id });
  });

  it("rejects an offer it cannot pay", () => {
    const s = base();
    hand(s, 0, { grain: 2 });
    hand(s, 1, { brick: 1, lumber: 1, wool: 1 });
    const t = offer(s, 0, [1], { grain: 1 }, { ore: 1 });
    expect(act(t, 1, true)).toEqual({ type: "rejectTrade", seat: 1, offerId: t.offers[0]!.id });
  });

  it("answers an offer to the active bot before rolling", () => {
    const s = base(1, false);
    s.turn.rolled = true; // proposals need a rolled turn
    hand(s, 0, { grain: 2 });
    hand(s, 1, { brick: 1, lumber: 1, wool: 1, ore: 2 });
    const t = offer(s, 0, [1], { grain: 1 }, { ore: 1 });
    t.turn.rolled = false;
    const a = act(t, 1, true);
    expect(a?.type).toBe("acceptTrade");
  });
});
