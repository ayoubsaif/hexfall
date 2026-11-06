import { describe, expect, it } from "vite-plus/test";
import { classifyWheel, dragThreshold, zoomFactor } from "../../src/scene/gestures.ts";

const ev = (deltaX: number, deltaY: number, deltaMode = 0, ctrlKey = false) => ({
  deltaX,
  deltaY,
  deltaMode,
  ctrlKey,
});

describe("classifyWheel", () => {
  it("Mac trackpad two-finger scroll pans", () => {
    expect(classifyWheel(ev(3.5, 12.25))).toBe("pan");
  });
  it("Windows precision touchpad small whole deltas pan", () => {
    expect(classifyWheel(ev(0, 8))).toBe("pan");
  });
  it("notched wheel (120 px or lines) zooms", () => {
    expect(classifyWheel(ev(0, 120))).toBe("zoom");
    expect(classifyWheel(ev(0, 3, 1))).toBe("zoom");
  });
  it("pinch (ctrlKey) zooms as pinch", () => {
    expect(classifyWheel(ev(0, -10, 0, true))).toBe("pinch");
  });
  it("zoom mode makes plain wheel always zoom", () => {
    expect(classifyWheel(ev(2.5, 6.5), "zoom")).toBe("zoom");
  });
});

describe("thresholds and zoom", () => {
  it("touch needs more travel than a mouse", () => {
    expect(dragThreshold("touch")).toBe(6);
    expect(dragThreshold("mouse")).toBe(3);
  });
  it("positive delta zooms out, negative in", () => {
    expect(zoomFactor(100, false)).toBeGreaterThan(1);
    expect(zoomFactor(-10, true)).toBeLessThan(1);
  });
});
