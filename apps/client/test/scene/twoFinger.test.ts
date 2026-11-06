// Google Maps style two-finger touch camera (specs/camera-gestures).
import { describe, expect, it } from "vite-plus/test";
import {
  type OrbitLimits,
  type Pair,
  TILT_PER_PX,
  applyTwoFinger,
  twoFingerDelta,
} from "../../src/scene/gestures.ts";

const lim: OrbitLimits = {
  minDistance: 5,
  maxDistance: 30,
  minPolar: 0,
  maxPolar: 1,
  minAzimuth: -Infinity,
  maxAzimuth: Infinity,
};
const base = { distance: 10, polar: 0.5, azimuth: 0 };
const pair = (ax: number, ay: number, bx: number, by: number): Pair => ({ ax, ay, bx, by });
const start = pair(100, 200, 200, 200);

describe("twoFingerDelta", () => {
  it("pinch out is scale > 1, no twist, no drag", () => {
    const d = twoFingerDelta(start, pair(75, 200, 225, 200));
    expect(d.scale).toBeCloseTo(1.5);
    expect(d.twist).toBeCloseTo(0);
    expect(d.dy).toBeCloseTo(0);
  });
  it("clockwise twist is positive", () => {
    const d = twoFingerDelta(start, pair(100, 190, 200, 210)); // right finger moves down
    expect(d.twist).toBeGreaterThan(0);
  });
  it("both fingers down is dy > 0", () => {
    expect(twoFingerDelta(start, pair(100, 230, 200, 230)).dy).toBeCloseTo(30);
  });
  it("twist across the atan2 seam stays small", () => {
    const d = twoFingerDelta(pair(0, 0, -100, 1), pair(0, 0, -100, -1));
    expect(Math.abs(d.twist)).toBeLessThan(0.05);
  });
});

describe("applyTwoFinger", () => {
  it("pinch out zooms in (distance shrinks), pinch in zooms out", () => {
    const out = applyTwoFinger(base, { scale: 2, twist: 0, dy: 0 }, lim);
    expect(out.distance).toBeCloseTo(5);
    const inn = applyTwoFinger(base, { scale: 0.5, twist: 0, dy: 0 }, lim);
    expect(inn.distance).toBeCloseTo(20);
  });
  it("zoom stops at the limits", () => {
    expect(applyTwoFinger(base, { scale: 100, twist: 0, dy: 0 }, lim).distance).toBe(5);
    expect(applyTwoFinger(base, { scale: 0.001, twist: 0, dy: 0 }, lim).distance).toBe(30);
  });
  it("dragging up tilts toward the horizon, down toward top-down, within limits", () => {
    expect(applyTwoFinger(base, { scale: 1, twist: 0, dy: -40 }, lim).polar).toBeCloseTo(
      0.5 + 40 * TILT_PER_PX,
    );
    expect(applyTwoFinger(base, { scale: 1, twist: 0, dy: 40 }, lim).polar).toBeCloseTo(
      0.5 - 40 * TILT_PER_PX,
    );
    expect(applyTwoFinger(base, { scale: 1, twist: 0, dy: -1000 }, lim).polar).toBe(1);
    expect(applyTwoFinger(base, { scale: 1, twist: 0, dy: 1000 }, lim).polar).toBe(0);
  });
  it("twist turns the map; tiny twists are ignored; azimuth limits hold", () => {
    expect(applyTwoFinger(base, { scale: 1, twist: 0.3, dy: 0 }, lim).azimuth).toBeCloseTo(0.3);
    expect(applyTwoFinger(base, { scale: 1, twist: 0.001, dy: 0 }, lim).azimuth).toBe(0);
    const iso = { ...lim, minAzimuth: -0.2, maxAzimuth: 0.2 };
    expect(applyTwoFinger(base, { scale: 1, twist: 1, dy: 0 }, iso).azimuth).toBe(0.2);
  });
  it("one-axis gestures leave the other values alone", () => {
    const out = applyTwoFinger(base, { scale: 1, twist: 0, dy: 0 }, lim);
    expect(out).toEqual(base);
  });
});
