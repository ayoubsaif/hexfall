// Zoom percent store (specs/camera-gestures "Zoom controls"): the board starts at 115 %.
import { describe, expect, it } from "vite-plus/test";
import { DEFAULT_ZOOM, ZOOM_MAX, ZOOM_MIN, clampZoom, useViewStore } from "../../src/store/view.ts";

describe("zoom", () => {
  it("starts at the 115 % default, inside the zoom range", () => {
    expect(DEFAULT_ZOOM).toBe(115);
    expect(useViewStore.getInitialState().zoom).toBe(115);
    expect(DEFAULT_ZOOM).toBeGreaterThanOrEqual(ZOOM_MIN);
    expect(DEFAULT_ZOOM).toBeLessThanOrEqual(ZOOM_MAX);
  });

  it("clamps requests to the range", () => {
    expect(clampZoom(10)).toBe(ZOOM_MIN);
    expect(clampZoom(1000)).toBe(ZOOM_MAX);
    expect(clampZoom(114.6)).toBe(115);
  });
});
