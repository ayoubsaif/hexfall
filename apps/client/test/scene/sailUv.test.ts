// Planar sail UVs: (z, y) of a sail facing ±X mapped onto [0,1]², readable from +X.
import { BufferAttribute, BufferGeometry } from "three";
import { describe, expect, it } from "vite-plus/test";
import { ensureSailUVs, sailUVs } from "../../src/scene/sailUv.ts";

describe("sailUVs", () => {
  // Corners of a sail at x≈1: (z, y) = (+1, 2) (left seen from +X), (−1, 2), (+1, 4), (−1, 4).
  const positions = [1, 2, 1, 1.2, 2, -1, 0.9, 4, 1, 1, 4, -1];

  it("maps the bounding box onto the unit square", () => {
    expect(Array.from(sailUVs(positions))).toEqual([0, 0, 1, 0, 0, 1, 1, 1]);
  });

  it("reads left-to-right from +X: u grows toward −Z, v grows with y", () => {
    const uv = sailUVs([0, 0, 0.5, 0, 1, -0.5]);
    expect(uv[0]).toBe(0);
    expect(uv[2]).toBe(1);
    expect(uv[1]).toBe(0);
    expect(uv[3]).toBe(1);
  });

  it("adds UVs once and keeps existing ones", () => {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
    ensureSailUVs(g);
    const first = g.getAttribute("uv");
    expect(first.count).toBe(4);
    ensureSailUVs(g);
    expect(g.getAttribute("uv")).toBe(first);
  });
});
