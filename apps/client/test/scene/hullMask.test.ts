import { BoxGeometry, BufferAttribute, Group, Mesh } from "three";
import { describe, expect, it } from "vite-plus/test";
import {
  addHullMask,
  HULL_MASK_NAME,
  HULL_MASK_ORDER,
  hullOutline,
  SEA_ORDER,
} from "../../src/scene/hullMask.ts";

/** An open boat-like hull: a diamond rim at y=1 over a keel point at y=0. */
function hullPositions(): BufferAttribute {
  const rim = [
    [2, 1, 0],
    [0, 1, 1],
    [-2, 1, 0],
    [0, 1, -1],
  ];
  return new BufferAttribute(new Float32Array([...rim.flat(), 0, 0, 0, 0.5, 1, 0.2]), 3);
}

describe("hullOutline", () => {
  it("outlines the rim just inside the walls, just under the top", () => {
    const outline = hullOutline(hullPositions())!;
    expect(outline.y).toBeCloseTo(0.95);
    // The interior rim point is dropped; four inset corners remain.
    expect(outline.points).toHaveLength(4);
    const xs = outline.points.map(([x]) => x);
    expect(Math.max(...xs)).toBeLessThan(2);
    expect(Math.max(...xs)).toBeGreaterThan(1.8);
  });

  it("ignores degenerate hulls", () => {
    expect(hullOutline(new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0]), 3))).toBeNull();
  });
});

describe("addHullMask", () => {
  it("adds one depth-only lid under the hull, drawn before the sea", () => {
    const root = new Group();
    const hull = new Mesh(new BoxGeometry(2, 1, 1).translate(0, 0.5, 0));
    hull.name = "Boat Hull";
    root.add(hull);
    addHullMask(root);
    addHullMask(root);
    const lids = hull.children.filter((c) => c.name === HULL_MASK_NAME);
    expect(lids).toHaveLength(1);
    const lid = lids[0] as Mesh;
    expect(lid.renderOrder).toBe(HULL_MASK_ORDER);
    expect(HULL_MASK_ORDER).toBeLessThan(SEA_ORDER);
    expect((lid.material as { colorWrite: boolean }).colorWrite).toBe(false);
  });

  it("does nothing without a hull mesh", () => {
    const root = new Group();
    addHullMask(root);
    expect(root.children).toHaveLength(0);
  });
});
