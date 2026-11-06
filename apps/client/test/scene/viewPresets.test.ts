// Camera view presets (openspec settlecoast-parchment-ui, task 8): pure poses and the store.
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { POSES, easeOut, poseToPosition } from "../../src/scene/viewPresets.ts";
import { setViewPreset, useViewStore } from "../../src/store/view.ts";
import { domeHeight } from "../../src/theme/relief.ts";

describe("view presets", () => {
  it("top view looks straight down, centered, with row 1 on top", () => {
    const [x, y, z] = poseToPosition(POSES.top, 10);
    expect(Math.abs(x)).toBeLessThan(1e-9);
    expect(y).toBeGreaterThan(9.9);
    expect(z).toBeGreaterThan(0);
    expect(Math.hypot(x, y, z)).toBeCloseTo(10);
  });

  it("diagonal view sits to the side and low, at the same distance", () => {
    const [x, y, z] = poseToPosition(POSES.diagonal, 10);
    expect(x).toBeGreaterThan(3);
    expect(y).toBeLessThan(6);
    expect(z).toBeGreaterThan(0);
    expect(Math.hypot(x, y, z)).toBeCloseTo(10);
  });

  it("eases from 0 to 1", () => {
    expect([easeOut(-1), easeOut(0), easeOut(1), easeOut(2)]).toEqual([0, 0, 1, 1]);
    expect(easeOut(0.5)).toBeGreaterThan(0.5);
  });
});

describe("view store", () => {
  beforeEach(() => useViewStore.setState({ preset: "free", nonce: 0 }));
  it("bumps the nonce on every request, even for the same preset", () => {
    setViewPreset("top");
    setViewPreset("top");
    expect(useViewStore.getState()).toMatchObject({ preset: "top", nonce: 2 });
  });
});

describe("terrain dome", () => {
  it("is tallest at the center and zero at the corners and edges", () => {
    expect(domeHeight("tile.mountains", 0)).toBeGreaterThan(domeHeight("tile.hills", 0));
    expect(domeHeight("tile.mountains", 0.5)).toBeLessThan(domeHeight("tile.mountains", 0));
    expect(domeHeight("tile.mountains", 0.9)).toBe(0);
    expect(domeHeight("tile.mountains", 1)).toBe(0);
    expect(domeHeight("sea", 0)).toBe(0);
  });
});
