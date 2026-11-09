import type { GameEvent } from "@hexfall/engine";
import { describe as suite, expect, it } from "vite-plus/test";
import { DESCRIBED_TYPES, describe, toastFor, type Names } from "../../src/game/describe.ts";
import { fixedT } from "../../src/i18n/index.ts";

const tEn = fixedT("en");

const names: Names = (s) => ["Ana", "Ben", "Cy", "Dee"][s] ?? `Seat ${s + 1}`;

/** One sample per event type. A new engine event type fails to compile here. */
const SAMPLES: { [K in GameEvent["type"]]: Extract<GameEvent, { type: K }> } = {
  gameCreated: { type: "gameCreated", playerCount: 4, mode: "variable" },
  orderRolled: { type: "orderRolled", seat: 1, dice: [5, 6] },
  orderTied: { type: "orderTied", seats: [0, 2] },
  timedOut: { type: "timedOut", phase: "discard", seats: [1, 3] },
  startingPlayer: { type: "startingPlayer", seat: 2 },
  specialBuildOpened: { type: "specialBuildOpened", seat: 3 },
  specialBuildPassed: { type: "specialBuildPassed", seat: 3 },
  built: { type: "built", seat: 0, piece: "settlement", at: 12, free: true },
  startingResources: { type: "startingResources", seat: 3, resources: { ore: 1, wool: 2 } },
  diceRolled: { type: "diceRolled", seat: 0, dice: [3, 4], total: 7 },
  produced: { type: "produced", seat: 1, resources: { grain: 2, ore: 1 } },
  shortage: { type: "shortage", resource: "ore" },
  discarded: { type: "discarded", seat: 2, resources: { brick: 4 } },
  robberMoved: { type: "robberMoved", seat: 0, hex: 7 },
  stole: { type: "stole", thief: 0, victim: 1, resource: null },
  devCardBought: { type: "devCardBought", seat: 0, card: null },
  devCardPlayed: { type: "devCardPlayed", seat: 1, card: "monopoly" },
  yearOfPlenty: { type: "yearOfPlenty", seat: 2, resources: ["grain", "ore"] },
  monopoly: { type: "monopoly", seat: 1, resource: "wool", taken: [2, 0, 1, 0] },
  tradeOffered: {
    type: "tradeOffered",
    offer: { id: 1, from: 0, to: [1], give: { ore: 1 }, get: { wool: 1 }, rejectedBy: [] },
  },
  tradeAccepted: {
    type: "tradeAccepted",
    offerId: 1,
    from: 0,
    by: 1,
    give: { ore: 1 },
    get: { wool: 1 },
  },
  tradeRejected: { type: "tradeRejected", offerId: 1, seat: 1 },
  tradeCancelled: { type: "tradeCancelled", offerId: 1 },
  maritimeTrade: {
    type: "maritimeTrade",
    seat: 0,
    give: "ore",
    giveCount: 4,
    get: "brick",
    getCount: 1,
  },
  longestRoad: { type: "longestRoad", from: null, to: 2, length: 5 },
  largestArmy: { type: "largestArmy", from: 1, to: 3, knights: 3 },
  vpRevealed: { type: "vpRevealed", seat: 3, count: 2 },
  turnEnded: { type: "turnEnded", seat: 0 },
  turnStarted: { type: "turnStarted", seat: 1, number: 5 },
  gameWon: { type: "gameWon", seat: 3, vp: 10 },
};

suite("describe", () => {
  it("has a readable line for every event type", () => {
    const types = Object.keys(SAMPLES).sort();
    expect([...DESCRIBED_TYPES].sort()).toEqual(types);
    for (const e of Object.values(SAMPLES) as GameEvent[]) {
      const line = describe(e, names, tEn);
      expect(line.text.length, e.type).toBeGreaterThan(5);
      expect(line.text, e.type).not.toMatch(/undefined|NaN|\[object/);
    }
  });

  it("a redacted steal does not name the resource", () => {
    const text = describe({ type: "stole", thief: 0, victim: 1, resource: null }, names, tEn).text;
    expect(text).toBe("Ana stole a card from Ben.");
    expect(describe({ type: "stole", thief: 0, victim: 1, resource: "ore" }, names, tEn).text).toBe(
      "Ana stole 1 ore from Ben.",
    );
  });

  it("a dev card purchase names the card only when the event has it", () => {
    expect(describe(SAMPLES.devCardBought, names, tEn).text).toBe("Ana bought a development card.");
    expect(describe({ type: "devCardBought", seat: 0, card: "knight" }, names, tEn).text).toContain(
      "Knight",
    );
  });

  it("production lists counts", () => {
    expect(describe(SAMPLES.produced, names, tEn).text).toBe("Ben received 2 grain and 1 ore.");
  });

  it("mentions seats for color accents", () => {
    expect(describe(SAMPLES.stole, names, tEn).seats).toEqual([0, 1]);
    expect(describe(SAMPLES.shortage, names, tEn).seats).toEqual([]);
  });
});

suite("toastFor", () => {
  it("your turn only for the viewer", () => {
    expect(toastFor(SAMPLES.turnStarted, 1, names, tEn)).toEqual({
      text: "Your turn",
      tone: "good",
      seat: 1,
    });
    expect(toastFor(SAMPLES.turnStarted, 0, names, tEn)).toBeNull();
  });

  it("cards received and lost", () => {
    expect(toastFor(SAMPLES.produced, 1, names, tEn)?.text).toBe("You received 2 grain and 1 ore");
    expect(toastFor(SAMPLES.produced, 0, names, tEn)).toBeNull();
    expect(toastFor({ ...SAMPLES.stole, resource: "brick" }, 1, names, tEn)).toEqual({
      text: "Ana stole 1 brick from you",
      tone: "bad",
      seat: 0,
    });
    expect(toastFor({ ...SAMPLES.stole, resource: "brick" }, 0, names, tEn)?.tone).toBe("good");
    expect(toastFor(SAMPLES.stole, 2, names, tEn)).toBeNull();
    expect(toastFor(SAMPLES.monopoly, 0, names, tEn)?.text).toBe("Ben took your 2 wool");
    expect(toastFor(SAMPLES.monopoly, 1, names, tEn)?.text).toBe("You took 3 wool");
    expect(toastFor(SAMPLES.monopoly, 3, names, tEn)).toBeNull();
    expect(toastFor(SAMPLES.discarded, 2, names, tEn)?.tone).toBe("bad");
    expect(toastFor(SAMPLES.startingResources, 3, names, tEn)?.tone).toBe("good");
  });

  it("standings and table events for everyone", () => {
    expect(toastFor(SAMPLES.diceRolled, 3, names, tEn)?.text).toContain("7");
    expect(toastFor({ ...SAMPLES.diceRolled, total: 8, dice: [4, 4] }, 3, names, tEn)).toBeNull();
    expect(toastFor(SAMPLES.longestRoad, 0, names, tEn)?.text).toBe("Cy takes Longest Road");
    expect(toastFor(SAMPLES.longestRoad, 2, names, tEn)?.text).toBe("You take Longest Road");
    expect(toastFor({ ...SAMPLES.longestRoad, to: null }, 0, names, tEn)?.text).toContain(
      "set aside",
    );
    expect(toastFor(SAMPLES.largestArmy, 1, names, tEn)?.tone).toBe("bad");
    expect(toastFor(SAMPLES.shortage, 0, names, tEn)?.text).toContain("ore");
  });

  it("no toast for routine events", () => {
    expect(toastFor(SAMPLES.built, 0, names, tEn)).toBeNull();
    expect(toastFor(SAMPLES.turnEnded, 0, names, tEn)).toBeNull();
  });
});
