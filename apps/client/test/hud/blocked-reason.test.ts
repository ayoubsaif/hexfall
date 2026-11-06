import { COSTS } from "@hexfall/engine/geometry";
import { describe, expect, it } from "vite-plus/test";
import { blockedReason } from "../../src/hud/actions/ActionButtons.tsx";

const full = { brick: 1, lumber: 1, wool: 1, grain: 1, ore: 0 };

describe("blockedReason", () => {
  it("asks for the roll first", () => {
    expect(
      blockedReason("settlement", { rolled: false, left: 3, hand: full }, COSTS.settlement),
    ).toBe("rollFirst");
  });
  it("no pieces left", () => {
    expect(
      blockedReason("settlement", { rolled: true, left: 0, hand: full }, COSTS.settlement),
    ).toBe("pieces");
  });
  it("missing cards", () => {
    expect(blockedReason("city", { rolled: true, left: 4, hand: full }, COSTS.city)).toBe("cards");
  });
  it("cards and pieces fine: no legal spot, named by the build kind", () => {
    expect(
      blockedReason("settlement", { rolled: true, left: 3, hand: full }, COSTS.settlement),
    ).toBe("settlement");
    expect(blockedReason("road", { rolled: true, left: 10, hand: full }, COSTS.road)).toBe("road");
  });
});
