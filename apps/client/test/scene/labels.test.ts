import { describe, expect, it } from "vite-plus/test";
import { INK, TOKEN_RED, harborLabel, tokenLabel } from "../../src/scene/labels.ts";
import { fitDistance } from "../../src/scene/useFitCamera.ts";

describe("tokenLabel", () => {
  it("shows the value with 6 − |7 − n| pips", () => {
    const pips = [2, 3, 4, 5, 6, 8, 9, 10, 11, 12].map((n) => tokenLabel(n).pips);
    expect(pips).toEqual([1, 2, 3, 4, 5, 5, 4, 3, 2, 1]);
    expect(tokenLabel(9)).toEqual({ text: "9", pips: 4, color: INK });
  });

  it("6 and 8 are red, every other number is ink", () => {
    for (const n of [6, 8]) expect(tokenLabel(n).color).toBe(TOKEN_RED);
    for (const n of [2, 3, 4, 5, 9, 10, 11, 12]) expect(tokenLabel(n).color).toBe(INK);
  });
});

describe("harborLabel", () => {
  it("is only the trade rate: 3:1 for generic, 2:1 for specials, no icon", () => {
    expect(harborLabel("generic")).toEqual({ rate: "3:1" });
    for (const h of ["brick", "grain", "lumber", "ore", "wool"] as const) {
      expect(harborLabel(h)).toEqual({ rate: "2:1" });
    }
  });
});

describe("fitDistance", () => {
  it("fits radius 6.3 to the vertical fov in landscape", () => {
    expect(fitDistance(16 / 9)).toBeCloseTo(6.3 / Math.sin((22.5 * Math.PI) / 180));
  });

  it("backs off further in portrait, where horizontal fov limits", () => {
    const portrait = fitDistance(9 / 16);
    expect(portrait).toBeGreaterThan(fitDistance(16 / 9));
    const halfH = Math.atan(Math.tan((22.5 * Math.PI) / 180) * (9 / 16));
    expect(portrait).toBeCloseTo(6.3 / Math.sin(halfH));
  });
});

import { NUMBER_SIZE, numberWeight } from "../../src/scene/NumberToken.tsx";

describe("number token typography", () => {
  it("uses one size and five weights from light to extra bold", () => {
    expect(NUMBER_SIZE).toBe(0.64);
    expect([1, 2, 3, 4, 5].map(numberWeight)).toEqual([300, 400, 500, 700, 900]);
  });
});
