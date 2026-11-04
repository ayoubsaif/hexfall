import { describe, expect, it } from "vite-plus/test";
import type { Pick, PickKind } from "../../src/game/pick.ts";
import { PICK_TARGET } from "../../src/game/pick.ts";
import { DRAG_THRESHOLD_PX, isDrag, pickOutcome } from "../../src/scene/picking.ts";

const pick = (kind: PickKind, ids: number[]): Pick => ({
  kind,
  target: PICK_TARGET[kind],
  targets: new Set(ids),
});
const noVictims = () => [];

describe("pickOutcome", () => {
  it("sends the vertex actions with the vertex", () => {
    for (const kind of ["placeSettlement", "buildSettlement", "buildCity"] as const) {
      expect(pickOutcome(pick(kind, [12]), 12, noVictims)).toEqual({
        kind: "send",
        action: { type: kind, vertex: 12 },
      });
    }
  });

  it("sends the road actions with the edge", () => {
    for (const kind of ["placeRoad", "buildRoad"] as const) {
      expect(pickOutcome(pick(kind, [40]), 40, noVictims)).toEqual({
        kind: "send",
        action: { type: kind, edge: 40 },
      });
    }
  });

  it("ignores a target that is not legal", () => {
    expect(pickOutcome(pick("buildRoad", [40]), 41, noVictims)).toEqual({ kind: "none" });
  });

  it("robber: no victims sends victim null, one sends it, several asks", () => {
    const p = pick("moveRobber", [3, 4, 5]);
    const victims = (hex: number) => ({ 3: [], 4: [2], 5: [1, 3] })[hex];
    expect(pickOutcome(p, 3, victims)).toEqual({
      kind: "send",
      action: { type: "moveRobber", hex: 3, victim: null },
    });
    expect(pickOutcome(p, 4, victims)).toEqual({
      kind: "send",
      action: { type: "moveRobber", hex: 4, victim: 2 },
    });
    expect(pickOutcome(p, 5, victims)).toEqual({ kind: "chooseVictim", hex: 5 });
  });
});

describe("isDrag", () => {
  it("treats more than 6 px of travel as a camera drag", () => {
    expect(DRAG_THRESHOLD_PX).toBe(6);
    expect(isDrag(0)).toBe(false);
    expect(isDrag(6)).toBe(false);
    expect(isDrag(7)).toBe(true);
  });
});
