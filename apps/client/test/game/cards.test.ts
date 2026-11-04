import { describe, expect, it } from "vite-plus/test";
import {
  canAddYearOfPlenty,
  canGive,
  compact,
  emptyCounts,
  formatBundle,
  isValidDiscard,
  isValidMaritime,
  isValidYearOfPlenty,
  maritimeMax,
  total,
  yearOfPlentyCount,
} from "../../src/game/cards.ts";
import { fixedT } from "../../src/i18n/index.ts";

const tEn = fixedT("en");

const counts = (b: Partial<ReturnType<typeof emptyCounts>>) => ({ ...emptyCounts(), ...b });

describe("cards", () => {
  it("totals and compacts bundles", () => {
    expect(total(counts({ ore: 2, wool: 3 }))).toBe(5);
    expect(compact({ ore: 0, wool: 2 })).toEqual({ wool: 2 });
    expect(formatBundle({ grain: 2, ore: 1 }, tEn)).toBe("2 grain and 1 ore");
    expect(formatBundle({ brick: 1, grain: 1, ore: 1 }, tEn)).toBe("1 brick, 1 grain and 1 ore");
    expect(formatBundle({}, tEn)).toBe("nothing");
  });

  it("discard needs exactly the owed count from the hand", () => {
    const hand = counts({ brick: 5, ore: 4 });
    expect(isValidDiscard(hand, { brick: 3 }, 4)).toBe(false);
    expect(isValidDiscard(hand, { brick: 3, ore: 1 }, 4)).toBe(true);
    expect(isValidDiscard(hand, { wool: 4 }, 4)).toBe(false);
    expect(isValidDiscard(hand, { brick: 5 }, 4)).toBe(false);
    expect(isValidDiscard(hand, {}, 0)).toBe(false);
  });

  it("Year of Plenty is limited by the bank", () => {
    const full = counts({ brick: 19, grain: 19, lumber: 19, ore: 19, wool: 19 });
    expect(yearOfPlentyCount(full)).toBe(2);
    expect(isValidYearOfPlenty(full, ["grain", "grain"])).toBe(true);
    expect(isValidYearOfPlenty(full, ["grain"])).toBe(false);

    const thin = counts({ ore: 1 });
    expect(yearOfPlentyCount(thin)).toBe(1);
    expect(isValidYearOfPlenty(thin, ["ore"])).toBe(true);
    expect(canAddYearOfPlenty(thin, [], "grain")).toBe(false);
    expect(canAddYearOfPlenty(thin, ["ore"], "ore")).toBe(false);
    expect(yearOfPlentyCount(emptyCounts())).toBe(0);
    expect(isValidYearOfPlenty(emptyCounts(), [])).toBe(false);

    const oneOre = counts({ ore: 1, wool: 5 });
    expect(canAddYearOfPlenty(oneOre, ["ore"], "ore")).toBe(false);
    expect(isValidYearOfPlenty(oneOre, ["ore", "ore"])).toBe(false);
  });

  it("maritime: count × rate from the hand, count from the bank", () => {
    const rates = counts({ brick: 4, grain: 4, lumber: 4, ore: 2, wool: 4 });
    const hand = counts({ ore: 4, wool: 3 });
    const bank = counts({ brick: 1, grain: 19 });
    expect(canGive(hand, rates, "ore")).toBe(true);
    expect(canGive(hand, rates, "wool")).toBe(false);
    expect(maritimeMax(hand, bank, rates, "ore", "grain")).toBe(2);
    expect(maritimeMax(hand, bank, rates, "ore", "brick")).toBe(1);
    expect(maritimeMax(hand, bank, rates, "ore", "ore")).toBe(0);
    expect(isValidMaritime(hand, bank, rates, "ore", "grain", 2)).toBe(true);
    expect(isValidMaritime(hand, bank, rates, "ore", "grain", 3)).toBe(false);
    expect(isValidMaritime(hand, bank, rates, "ore", "grain", 0)).toBe(false);
  });
});
