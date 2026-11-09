import { describe, expect, it } from "vite-plus/test";
import * as geometry from "../src/geometry.ts";
import { COSTS as RULE_COSTS, RESOURCES as RULE_RESOURCES } from "../src/rules/common.ts";

describe("geometry subpath (client allow-list)", () => {
  it("exports the cost data the rules use", () => {
    expect(geometry.COSTS).toBe(RULE_COSTS);
    expect(geometry.RESOURCES).toBe(RULE_RESOURCES);
    expect(geometry.COSTS.city).toEqual({ ore: 3, grain: 2 });
    expect(Object.isFrozen(geometry.COSTS.road)).toBe(true);
  });

  it("exports only pure geometry helpers and static data", () => {
    const fns = Object.entries(geometry)
      .filter(([, v]) => typeof v === "function")
      .map(([k]) => k)
      .sort();
    expect(fns).toEqual([
      "beginnerBoard",
      "edgeMidpoint",
      "edgeOutward",
      "hexAt",
      "hexCenter",
      "hexRing",
      "hexToWorld",
      "topologyFor",
      "topologyOf",
      "vertexPosition",
    ]);
  });
});
