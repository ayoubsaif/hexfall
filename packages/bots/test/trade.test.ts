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
import { BOT_LEVELS, BotRng, chooseAction, judgeOffer, type BotLevel } from "../src/index.ts";

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

function judge(s: GameState, seat: Seat, level: BotLevel = "normal"): boolean {
  return judgeOffer(playerView(s, seat), seat, s.offers[0]!, level);
}

/** Answer at each level, in BOT_LEVELS order (easy, normal, hard). */
function judgeAll(s: GameState, seat: Seat): boolean[] {
  return BOT_LEVELS.map((l) => judge(s, seat, l));
}

/** Gives seat 0 `vp` public VP from cities and settlements on spread-out vertices. */
function setVp(s: GameState, vp: number): void {
  const spots = [0, 8, 30, 40, 50, 3, 45];
  for (let i = 0; i < Math.floor(vp / 2); i++) s.vertices[spots[i]!] = { owner: 0, kind: "city" };
  if (vp % 2) s.vertices[spots[Math.floor(vp / 2)]!] = { owner: 0, kind: "settlement" };
}

function act(s: GameState, seat: Seat, trade: boolean, level?: BotLevel) {
  return chooseAction(
    playerView(s, seat),
    legalActions(s, seat),
    new BotRng(1),
    level ? { trade, level } : { trade },
  );
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

  it("refuses a proposer at 8 VP only on Hard, and at 9 VP on Normal too", () => {
    const at = (vp: number) => {
      const s = base();
      setVp(s, vp);
      expect(playerView(s, 1).players[0]!.publicVp).toBe(vp);
      hand(s, 0, { grain: 1 });
      // The fourth ore is surplus; the grain completes a city.
      hand(s, 1, { ore: 4, grain: 1 });
      return judgeAll(offer(s, 0, [1], { grain: 1 }, { ore: 1 }), 1);
    };
    expect(at(7)).toEqual([true, true, true]);
    expect(at(8)).toEqual([true, true, false]);
    expect(at(9)).toEqual([true, false, false]);
  });

  it("scales the leader limit to the victory target (target 14: Hard at 12, Normal at 13)", () => {
    const at = (vp: number) => {
      const s = base();
      s.victoryTarget = 14;
      setVp(s, vp);
      expect(playerView(s, 1).players[0]!.publicVp).toBe(vp);
      hand(s, 0, { grain: 1 });
      hand(s, 1, { ore: 4, grain: 1 });
      return judgeAll(offer(s, 0, [1], { grain: 1 }, { ore: 1 }), 1);
    };
    expect(at(9)).toEqual([true, true, true]);
    expect(at(11)).toEqual([true, true, true]);
    expect(at(12)).toEqual([true, true, false]);
    expect(at(13)).toEqual([true, false, false]);
  });

  it("accepts two cards for one when no build is hurt", () => {
    const s = base();
    hand(s, 0, { grain: 2 });
    hand(s, 1, { ore: 1, wool: 3 });
    const t = offer(s, 0, [1], { grain: 2 }, { wool: 1 });
    expect(judge(t, 1)).toBe(true);
  });

  it("turns down a fair swap but takes a generous one for the same card", () => {
    const fair = base();
    hand(fair, 0, { ore: 1 });
    hand(fair, 1, { lumber: 3, ore: 1 });
    expect(judge(offer(fair, 0, [1], { ore: 1 }, { lumber: 1 }), 1)).toBe(false);
    const generous = base();
    hand(generous, 0, { ore: 2 });
    hand(generous, 1, { lumber: 3, ore: 1 });
    expect(judge(offer(generous, 0, [1], { ore: 2 }, { lumber: 1 }), 1)).toBe(true);
  });

  it("completes a settlement on Easy and Normal; Hard keeps the ore its city needs", () => {
    const s = base();
    hand(s, 0, { grain: 2 });
    hand(s, 1, { brick: 1, lumber: 1, wool: 1, ore: 2 });
    expect(judgeAll(offer(s, 0, [1], { grain: 1 }, { ore: 1 }), 1)).toEqual([true, true, false]);
  });

  it("Hard won't give its only brick, even for 2 cards that complete a city", () => {
    const s = base();
    hand(s, 0, { grain: 2 });
    // The brick is needed for a road or a settlement; the 2 grain would make a city affordable.
    hand(s, 1, { brick: 1, ore: 3, grain: 1 });
    expect(judgeAll(offer(s, 0, [1], { grain: 2 }, { brick: 1 }), 1)).toEqual([true, true, false]);
  });

  it("Hard gives surplus when it brings its best build closer", () => {
    const s = base();
    hand(s, 0, { grain: 1 });
    hand(s, 1, { ore: 4, grain: 1 });
    expect(judge(offer(s, 0, [1], { grain: 1 }, { ore: 1 }), 1, "hard")).toBe(true);
  });

  it("never breaks an affordable city, at any level", () => {
    const s = base();
    hand(s, 0, { wool: 2 });
    hand(s, 1, { ore: 3, grain: 2 });
    expect(judgeAll(offer(s, 0, [1], { wool: 2 }, { ore: 1 }), 1)).toEqual([false, false, false]);
  });

  it("rejects a spare card for one its best build needs, at any level", () => {
    const s = base();
    hand(s, 0, { wool: 1 });
    // One grain short of a city; the third wool is spare.
    hand(s, 1, { ore: 3, grain: 1, wool: 3 });
    expect(judgeAll(offer(s, 0, [1], { wool: 1 }, { grain: 1 }), 1)).toEqual([false, false, false]);
  });

  it("takes two spare cards for one spare card on Easy and Normal, not on Hard", () => {
    const s = base();
    hand(s, 0, { wool: 2 });
    hand(s, 1, { ore: 4, wool: 3 });
    expect(judgeAll(offer(s, 0, [1], { wool: 2 }, { ore: 1 }), 1)).toEqual([true, true, false]);
  });

  it("takes an even swap of spare cards only on Easy", () => {
    const s = base();
    hand(s, 0, { wool: 1 });
    hand(s, 1, { ore: 4, wool: 3 });
    expect(judgeAll(offer(s, 0, [1], { wool: 1 }, { ore: 1 }), 1)).toEqual([true, false, false]);
  });

  it("takes a fair swap toward a second plan on Normal, not on Hard", () => {
    const s = base();
    hand(s, 0, { wool: 1 });
    // Best plan: a city (one ore short). The wool brings a dev card and a settlement closer.
    hand(s, 1, { ore: 2, grain: 2, lumber: 2 });
    expect(judgeAll(offer(s, 0, [1], { wool: 1 }, { lumber: 1 }), 1)).toEqual([true, true, false]);
  });

  it("gives the same answer for the same input", () => {
    const s = base();
    hand(s, 0, { grain: 2 });
    hand(s, 1, { brick: 1, lumber: 1, wool: 1, ore: 2 });
    const t = offer(s, 0, [1], { grain: 1 }, { ore: 1 });
    expect(judge(t, 1)).toBe(judge(t, 1));
  });
});

describe("acceptance by level", () => {
  type Ratio = 1 | 2 | 3;
  /** 2,000 seeded bot hands of 3-7 cards; per hand one 1:1, one 2:1 and one 3:1 offer. */
  function probe(): Record<Ratio, Record<BotLevel, number>> & { offers: Record<Ratio, number> } {
    const rng = new BotRng("probe");
    const zero = () => ({ easy: 0, normal: 0, hard: 0 });
    const out = { 1: zero(), 2: zero(), 3: zero(), offers: { 1: 0, 2: 0, 3: 0 } };
    for (let i = 0; i < 2000; i++) {
      const bot: ResourceBundle = {};
      const size = 3 + rng.int(5);
      for (let k = 0; k < size; k++) {
        const r = rng.pick(RESOURCES);
        bot[r] = (bot[r] ?? 0) + 1;
      }
      const held = RESOURCES.filter((r) => (bot[r] ?? 0) > 0);
      const vp = rng.int(10);
      for (const ratio of [1, 2, 3] as const) {
        const asked = rng.pick(held);
        const others = RESOURCES.filter((r) => r !== asked);
        const give: ResourceBundle = {};
        for (let k = 0; k < ratio; k++) {
          const r = rng.pick(others);
          give[r] = (give[r] ?? 0) + 1;
        }
        const s = base();
        setVp(s, vp);
        hand(s, 1, bot);
        hand(s, 0, give);
        const t = offer(s, 0, [1], give, { [asked]: 1 });
        const [easy, normal, hard] = judgeAll(t, 1);
        const why = JSON.stringify({ bot, give, asked, vp });
        if (hard) expect(normal, why).toBe(true);
        if (normal) expect(easy, why).toBe(true);
        out.offers[ratio]++;
        out[ratio].easy += Number(easy);
        out[ratio].normal += Number(normal);
        out[ratio].hard += Number(hard);
      }
    }
    return out;
  }

  it("rises as the level falls at every ratio; each level accepts what the stricter one does", () => {
    const p = probe();
    for (const ratio of [1, 2, 3] as const) {
      expect(p[ratio].easy).toBeGreaterThan(p[ratio].normal);
      expect(p[ratio].normal).toBeGreaterThan(2 * p[ratio].hard);
    }
  });
});

describe("chooseAction with offers", () => {
  function goodOffer(active: Seat = 0, rolled = true): GameState {
    const s = base(active, rolled);
    hand(s, 0, { grain: 2 });
    hand(s, 1, { brick: 1, lumber: 1, wool: 1, ore: 2 });
    return offer(s, 0, [1], { grain: 1 }, { ore: 1 });
  }

  it("still rejects every offer when trading is off, at any level", () => {
    const t = goodOffer();
    for (const level of BOT_LEVELS) {
      expect(act(t, 1, false, level)).toEqual({
        type: "rejectTrade",
        seat: 1,
        offerId: t.offers[0]!.id,
      });
    }
  });

  it("judges with its level when trading is on", () => {
    const s = base();
    hand(s, 0, { wool: 1 });
    hand(s, 1, { ore: 4, wool: 3 });
    const t = offer(s, 0, [1], { wool: 1 }, { ore: 1 });
    const id = t.offers[0]!.id;
    expect(act(t, 1, true, "easy")).toEqual({ type: "acceptTrade", seat: 1, offerId: id });
    expect(act(t, 1, true, "hard")).toEqual({ type: "rejectTrade", seat: 1, offerId: id });
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
