import type { GameEvent } from "@hexfall/engine";
import { describe, expect, it } from "vite-plus/test";
import {
  MAX_PER_BATCH,
  MAX_PER_TRANSFER,
  STAGGER_MS,
  flightsForEvents,
} from "../../src/game/cardFlights.ts";

const bank = { kind: "bank" };
const seat = (s: number) => ({ kind: "seat", seat: s });
const res = (resource: string) => ({ kind: "resource", resource });
const short = (events: GameEvent[], viewer: number | null = 0) =>
  flightsForEvents(events, viewer).map(({ from, to, face }) => ({ from, to, face }));

describe("flightsForEvents", () => {
  it("flies production from the bank to the seat, one card each, staggered", () => {
    const f = flightsForEvents([{ type: "produced", seat: 1, resources: { grain: 2, ore: 1 } }], 0);
    expect(f.map((x) => [x.from, x.to, x.face])).toEqual([
      [bank, seat(1), res("grain")],
      [bank, seat(1), res("grain")],
      [bank, seat(1), res("ore")],
    ]);
    expect(f.map((x) => x.delay)).toEqual([0, STAGGER_MS, 2 * STAGGER_MS]);
  });

  it("covers starting resources and Year of Plenty", () => {
    expect(
      short([
        { type: "startingResources", seat: 0, resources: { wool: 1 } },
        { type: "yearOfPlenty", seat: 2, resources: ["brick", "brick"] },
      ]),
    ).toEqual([
      { from: bank, to: seat(0), face: res("wool") },
      { from: bank, to: seat(2), face: res("brick") },
      { from: bank, to: seat(2), face: res("brick") },
    ]);
  });

  it("sends discards and paid builds to the bank, free builds nothing", () => {
    expect(
      short([
        { type: "discarded", seat: 1, resources: { ore: 1 } },
        { type: "built", seat: 0, piece: "road", at: 3, free: false },
        { type: "built", seat: 0, piece: "road", at: 4, free: true },
      ]),
    ).toEqual([
      { from: seat(1), to: bank, face: res("ore") },
      { from: seat(0), to: bank, face: res("brick") },
      { from: seat(0), to: bank, face: res("lumber") },
    ]);
  });

  it("pays for a dev card and shows it only when the view has it", () => {
    const own = short([{ type: "devCardBought", seat: 0, card: "knight" }]);
    expect(own).toHaveLength(4);
    expect(own[3]).toEqual({ from: bank, to: seat(0), face: { kind: "dev", card: "knight" } });
    const other = short([{ type: "devCardBought", seat: 1, card: null }]);
    expect(other[3]).toEqual({ from: bank, to: seat(1), face: { kind: "back" } });
  });

  it("sends a played dev card to the bank", () => {
    expect(short([{ type: "devCardPlayed", seat: 2, card: "monopoly" }])).toEqual([
      { from: seat(2), to: bank, face: { kind: "dev", card: "monopoly" } },
    ]);
  });

  it("steals: face for thief/victim, back for others, nothing from an empty hand", () => {
    expect(short([{ type: "stole", thief: 0, victim: 1, resource: "wool" }], 0)).toEqual([
      { from: seat(1), to: seat(0), face: res("wool") },
    ]);
    expect(short([{ type: "stole", thief: 1, victim: 2, resource: null }], 0)).toEqual([
      { from: seat(2), to: seat(1), face: { kind: "back" } },
    ]);
    expect(short([{ type: "stole", thief: 0, victim: 1, resource: null }], 0)).toEqual([]);
    expect(short([{ type: "stole", thief: 2, victim: 0, resource: null }], 0)).toEqual([]);
  });

  it("monopoly flies from each victim, capped per transfer", () => {
    const f = short([{ type: "monopoly", seat: 0, resource: "ore", taken: [0, 9, 1] }]);
    expect(f.filter((x) => x.from.kind === "seat" && x.from.seat === 1)).toHaveLength(
      MAX_PER_TRANSFER,
    );
    expect(f.at(-1)).toEqual({ from: seat(2), to: seat(0), face: res("ore") });
  });

  it("trades fly both ways", () => {
    expect(
      short([
        {
          type: "tradeAccepted",
          offerId: 1,
          from: 0,
          by: 2,
          give: { brick: 1 },
          get: { wool: 1 },
        },
        { type: "maritimeTrade", seat: 1, give: "ore", giveCount: 2, get: "grain", getCount: 1 },
      ]),
    ).toEqual([
      { from: seat(0), to: seat(2), face: res("brick") },
      { from: seat(2), to: seat(0), face: res("wool") },
      { from: seat(1), to: bank, face: res("ore") },
      { from: seat(1), to: bank, face: res("ore") },
      { from: bank, to: seat(1), face: res("grain") },
    ]);
  });

  it("caps a batch and ignores events without cards", () => {
    const big: GameEvent[] = [0, 1, 2, 3].map((s) => ({
      type: "produced",
      seat: s,
      resources: { brick: 6, grain: 6 },
    }));
    expect(flightsForEvents(big, 0)).toHaveLength(MAX_PER_BATCH);
    expect(flightsForEvents([{ type: "turnEnded", seat: 0 }], 0)).toEqual([]);
  });
});
