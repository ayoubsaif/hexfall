import { describe, expect, it } from "vite-plus/test";
import { beginnerBoard, type HarborType } from "../src/board.ts";
import { harborsOf, maritimeRates, tradeOptions } from "../src/rules/trade.ts";
import type { GameState } from "../src/state.ts";
import { failCode, give, makePlayState, putBuilding, step } from "../src/testing.ts";
import { STANDARD_TOPOLOGY } from "../src/topology.ts";

const HARBORS = beginnerBoard().harbors;

/** An intersection of the first beginner harbor slot of this type. */
function slotVertex(type: HarborType, end: 0 | 1 = 0): number {
  const slot = HARBORS.indexOf(type);
  const edge = STANDARD_TOPOLOGY.harborSlots[slot]!;
  return STANDARD_TOPOLOGY.edges[edge]!.vertices[end];
}

function offerState(): GameState {
  const s = makePlayState({ seat: 0 });
  give(s, 0, { ore: 2, brick: 1 });
  give(s, 1, { wool: 2 });
  give(s, 2, { wool: 1 });
  return s;
}

describe("domestic trade", () => {
  it("rejects gifts", () => {
    const s = offerState();
    expect(failCode(s, { type: "proposeTrade", seat: 0, give: { ore: 1 }, get: {}, to: [1] })).toBe(
      "invalid_trade",
    );
    expect(
      failCode(s, { type: "proposeTrade", seat: 0, give: { ore: 0 }, get: { wool: 1 }, to: [1] }),
    ).toBe("invalid_trade");
  });

  it("rejects like-for-like", () => {
    const s = offerState();
    expect(
      failCode(s, { type: "proposeTrade", seat: 0, give: { ore: 2 }, get: { ore: 1 }, to: [1] }),
    ).toBe("invalid_trade");
  });

  it("rejects malformed bundles and bad addressees", () => {
    const s = offerState();
    const bad = { type: "proposeTrade", seat: 0, give: { ore: -1 }, get: { wool: 1 }, to: [1] };
    expect(failCode(s, bad as never)).toBe("invalid_trade");
    const devCardBundle = {
      type: "proposeTrade",
      seat: 0,
      give: { knight: 1 },
      get: { wool: 1 },
      to: [1],
    };
    expect(failCode(s, devCardBundle as never)).toBe("invalid_trade");
    for (const to of [[], [0], [1, 1], [7]]) {
      expect(
        failCode(s, { type: "proposeTrade", seat: 0, give: { ore: 1 }, get: { wool: 1 }, to }),
      ).toBe("invalid_trade");
    }
  });

  it("requires the proposer to hold the offered cards", () => {
    const s = offerState();
    expect(
      failCode(s, { type: "proposeTrade", seat: 0, give: { ore: 3 }, get: { wool: 1 }, to: [1] }),
    ).toBe("insufficient_resources");
  });

  it("rejects non-active to non-active offers", () => {
    const s = offerState();
    expect(
      failCode(s, { type: "proposeTrade", seat: 1, give: { wool: 1 }, get: { ore: 1 }, to: [2] }),
    ).toBe("invalid_trade");
    expect(
      failCode(s, {
        type: "proposeTrade",
        seat: 1,
        give: { wool: 1 },
        get: { ore: 1 },
        to: [0, 2],
      }),
    ).toBe("invalid_trade");
  });

  it("allows non-active to active offers, accepted by the active player", () => {
    let s = offerState();
    s = step(s, { type: "proposeTrade", seat: 1, give: { wool: 2 }, get: { ore: 1 }, to: [0] });
    expect(s.offers).toHaveLength(1);
    const id = s.offers[0]!.id;
    expect(tradeOptions(s, 0)).toEqual({ accept: [id], reject: [id], cancel: [] });
    expect(tradeOptions(s, 1)).toEqual({ accept: [], reject: [], cancel: [id] });
    s = step(s, { type: "acceptTrade", seat: 0, offerId: id });
    expect(s.players[0]!.resources).toMatchObject({ wool: 2, ore: 1 });
    expect(s.players[1]!.resources).toMatchObject({ wool: 0, ore: 1 });
  });

  it("accept executes the swap and removes the offer", () => {
    let s = offerState();
    s = step(s, {
      type: "proposeTrade",
      seat: 0,
      give: { ore: 2, brick: 0 },
      get: { wool: 1 },
      to: [1, 2],
    });
    const offer = s.offers[0]!;
    expect(offer.give).toEqual({ ore: 2 });
    expect(s.log.at(-1)).toMatchObject({ type: "tradeOffered", offer: { id: offer.id } });
    s = step(s, { type: "acceptTrade", seat: 2, offerId: offer.id });
    expect(s.offers).toEqual([]);
    expect(s.players[0]!.resources).toMatchObject({ ore: 0, wool: 1, brick: 1 });
    expect(s.players[2]!.resources).toMatchObject({ ore: 2, wool: 0 });
    expect(s.log.at(-1)).toEqual({
      type: "tradeAccepted",
      offerId: offer.id,
      from: 0,
      by: 2,
      give: { ore: 2 },
      get: { wool: 1 },
    });
    expect(failCode(s, { type: "acceptTrade", seat: 1, offerId: offer.id })).toBe("unknown_offer");
  });

  it("accept fails if a side lacks the cards", () => {
    let s = offerState();
    s = step(s, { type: "proposeTrade", seat: 0, give: { ore: 1 }, get: { wool: 2 }, to: [1, 2] });
    const id = s.offers[0]!.id;
    // Seat 2 holds only 1 wool.
    expect(failCode(s, { type: "acceptTrade", seat: 2, offerId: id })).toBe(
      "insufficient_resources",
    );
    expect(tradeOptions(s, 2)).toEqual({ accept: [], reject: [id], cancel: [] });
    // The proposer no longer holds the offered ore.
    s.players[0]!.resources.ore = 0;
    expect(failCode(s, { type: "acceptTrade", seat: 1, offerId: id })).toBe(
      "insufficient_resources",
    );
    // Seat 3 was not addressed.
    expect(failCode(s, { type: "acceptTrade", seat: 3, offerId: id })).toBe("invalid_trade");
  });

  it("removes an offer once every addressee rejects it", () => {
    let s = offerState();
    s = step(s, { type: "proposeTrade", seat: 0, give: { ore: 1 }, get: { wool: 1 }, to: [1, 2] });
    const id = s.offers[0]!.id;
    s = step(s, { type: "rejectTrade", seat: 1, offerId: id });
    expect(s.offers[0]!.rejectedBy).toEqual([1]);
    expect(failCode(s, { type: "rejectTrade", seat: 1, offerId: id })).toBe("invalid_trade");
    expect(failCode(s, { type: "acceptTrade", seat: 1, offerId: id })).toBe("invalid_trade");
    s = step(s, { type: "rejectTrade", seat: 2, offerId: id });
    expect(s.offers).toEqual([]);
    expect(s.log.at(-1)).toEqual({ type: "tradeRejected", offerId: id, seat: 2 });
  });

  it("lets only the proposer cancel", () => {
    let s = offerState();
    s = step(s, { type: "proposeTrade", seat: 0, give: { ore: 1 }, get: { wool: 1 }, to: [1] });
    const id = s.offers[0]!.id;
    expect(failCode(s, { type: "cancelTrade", seat: 1, offerId: id })).toBe("invalid_trade");
    s = step(s, { type: "cancelTrade", seat: 0, offerId: id });
    expect(s.offers).toEqual([]);
    expect(s.log.at(-1)).toEqual({ type: "tradeCancelled", offerId: id });
    expect(failCode(s, { type: "cancelTrade", seat: 0, offerId: id })).toBe("unknown_offer");
  });

  it("rejects offers before the roll", () => {
    const s = makePlayState({ seat: 0, rolled: false });
    give(s, 0, { ore: 1 });
    expect(
      failCode(s, { type: "proposeTrade", seat: 0, give: { ore: 1 }, get: { wool: 1 }, to: [1] }),
    ).toBe("must_roll_first");
  });

  it("clears offers at end of turn", () => {
    let s = offerState();
    s = step(s, { type: "proposeTrade", seat: 0, give: { ore: 1 }, get: { wool: 1 }, to: [1] });
    s = step(s, { type: "proposeTrade", seat: 2, give: { wool: 1 }, get: { brick: 1 }, to: [0] });
    expect(s.offers.map((o) => o.id)).toEqual([1, 2]);
    s = step(s, { type: "endTurn", seat: 0 });
    expect(s.offers).toEqual([]);
  });
});

describe("maritime trade", () => {
  it("defaults to 4:1", () => {
    let s = makePlayState({ seat: 0 });
    give(s, 0, { brick: 5 });
    expect(maritimeRates(s, 0)).toEqual({ brick: 4, grain: 4, lumber: 4, ore: 4, wool: 4 });
    s = step(s, { type: "maritimeTrade", seat: 0, give: "brick", get: "ore", count: 1 });
    expect(s.players[0]!.resources).toMatchObject({ brick: 1, ore: 1 });
    expect(s.bank).toMatchObject({ brick: 18, ore: 18 });
    expect(s.log.at(-1)).toEqual({
      type: "maritimeTrade",
      seat: 0,
      give: "brick",
      giveCount: 4,
      get: "ore",
      getCount: 1,
    });
    expect(
      failCode(s, { type: "maritimeTrade", seat: 0, give: "brick", get: "ore", count: 1 }),
    ).toBe("insufficient_resources");
  });

  it("uses 3:1 with a generic harbor", () => {
    let s = makePlayState({ seat: 0 });
    putBuilding(s, slotVertex("generic", 1), 0);
    expect(harborsOf(s, 0)).toEqual(["generic"]);
    expect(maritimeRates(s, 0)).toEqual({ brick: 3, grain: 3, lumber: 3, ore: 3, wool: 3 });
    give(s, 0, { wool: 6 });
    s = step(s, { type: "maritimeTrade", seat: 0, give: "wool", get: "grain", count: 2 });
    expect(s.players[0]!.resources).toMatchObject({ wool: 0, grain: 2 });
  });

  it("special harbor improves only its resource", () => {
    let s = makePlayState({ seat: 0 });
    putBuilding(s, slotVertex("ore"), 0, "city");
    expect(harborsOf(s, 0)).toEqual(["ore"]);
    expect(maritimeRates(s, 0)).toEqual({ brick: 4, grain: 4, lumber: 4, ore: 2, wool: 4 });
    give(s, 0, { ore: 4, wool: 3 });
    s = step(s, { type: "maritimeTrade", seat: 0, give: "ore", get: "brick", count: 2 });
    expect(s.players[0]!.resources).toMatchObject({ ore: 0, brick: 2 });
    expect(
      failCode(s, { type: "maritimeTrade", seat: 0, give: "wool", get: "brick", count: 1 }),
    ).toBe("insufficient_resources");
  });

  it("combines generic and special harbors; opponents' harbors don't count", () => {
    const s = makePlayState({ seat: 0 });
    putBuilding(s, slotVertex("generic"), 0);
    putBuilding(s, slotVertex("wool"), 0);
    expect(maritimeRates(s, 0)).toEqual({ brick: 3, grain: 3, lumber: 3, ore: 3, wool: 2 });
    expect(harborsOf(s, 1)).toEqual([]);
    expect(maritimeRates(s, 1)).toEqual({ brick: 4, grain: 4, lumber: 4, ore: 4, wool: 4 });
  });

  it("a harbor settlement built this turn is usable immediately", () => {
    let s = makePlayState({ seat: 0 });
    give(s, 0, { grain: 2 });
    expect(
      failCode(s, { type: "maritimeTrade", seat: 0, give: "grain", get: "ore", count: 1 }),
    ).toBe("insufficient_resources");
    // Built mid-turn (placed directly; harbor ownership is read live).
    putBuilding(s, slotVertex("grain"), 0);
    s = step(s, { type: "maritimeTrade", seat: 0, give: "grain", get: "ore", count: 1 });
    expect(s.players[0]!.resources).toMatchObject({ grain: 0, ore: 1 });
  });

  it("fails when the bank lacks the requested card", () => {
    const s = makePlayState({ seat: 0 });
    give(s, 0, { brick: 4 });
    give(s, 1, { ore: 19 });
    expect(
      failCode(s, { type: "maritimeTrade", seat: 0, give: "brick", get: "ore", count: 1 }),
    ).toBe("bank_empty");
  });

  it("validates give, get and count", () => {
    const s = makePlayState({ seat: 0 });
    give(s, 0, { brick: 8 });
    const base = { type: "maritimeTrade", seat: 0 } as const;
    expect(failCode(s, { ...base, give: "brick", get: "brick", count: 1 })).toBe("invalid_trade");
    expect(failCode(s, { ...base, give: "brick", get: "ore", count: 0 })).toBe("invalid_trade");
    expect(failCode(s, { ...base, give: "brick", get: "ore", count: 1.5 })).toBe("invalid_trade");
    expect(failCode(s, { ...base, give: "gold" as never, get: "ore", count: 1 })).toBe(
      "invalid_trade",
    );
  });

  it("rejects maritime trade by a non-active player or before the roll", () => {
    const s = makePlayState({ seat: 0 });
    give(s, 1, { brick: 4 });
    expect(
      failCode(s, { type: "maritimeTrade", seat: 1, give: "brick", get: "ore", count: 1 }),
    ).toBe("not_your_turn");
    const t = makePlayState({ seat: 0, rolled: false });
    give(t, 0, { brick: 4 });
    expect(
      failCode(t, { type: "maritimeTrade", seat: 0, give: "brick", get: "ore", count: 1 }),
    ).toBe("must_roll_first");
  });
});
