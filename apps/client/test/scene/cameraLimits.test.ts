import { Vector3 } from "three";
import { describe, expect, it } from "vite-plus/test";
import {
  MAX_PAN,
  MAX_POLAR,
  MIN_ELEVATION_DEG,
  panCorrection,
} from "../../src/scene/cameraLimits.ts";

describe("panCorrection", () => {
  it("is zero inside the pan limit on the board plane", () => {
    expect(panCorrection(new Vector3(0, 0, 0)).length()).toBeCloseTo(0, 9);
  });

  it("pulls a far target back to the limit, along the same direction", () => {
    const t = new Vector3(30, 0, 40);
    const moved = t.clone().add(panCorrection(t));
    expect(moved.length()).toBeCloseTo(MAX_PAN, 6);
    expect(moved.toArray()).toEqual([0, 0, 0]);
  });

  it("pins the target height to the board plane", () => {
    const t = new Vector3(0, 2.5, 0);
    expect(t.clone().add(panCorrection(t)).y).toBeCloseTo(0, 9);
  });
});

describe("elevation limit", () => {
  it("keeps the camera above the minimum elevation, so the horizon stays out of frame", () => {
    // Half the vertical field of view (45 deg) plus a margin must stay below the horizon.
    expect(MIN_ELEVATION_DEG).toBeGreaterThan(22.5);
    expect(MAX_POLAR).toBeCloseTo(((90 - MIN_ELEVATION_DEG) * Math.PI) / 180, 9);
  });
});
