// The AO pass skips see-through overlays so chip labels cast no square shadow (specs/ambient-look).
import { Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry } from "three";
import { describe, expect, it } from "vite-plus/test";
import { isOverlay } from "../../src/scene/PostFx.tsx";

const plane = new PlaneGeometry(1, 1);

describe("AO overlays", () => {
  it("treats a transparent quad that writes no depth as an overlay", () => {
    const label = new Mesh(plane, new MeshBasicMaterial({ transparent: true, depthWrite: false }));
    expect(isOverlay(label)).toBe(true);
  });

  it("keeps solid and depth-writing meshes in the AO pass", () => {
    expect(isOverlay(new Mesh(plane, new MeshStandardMaterial()))).toBe(false);
    expect(isOverlay(new Mesh(plane, new MeshBasicMaterial({ transparent: true })))).toBe(false);
    expect(isOverlay(new Group())).toBe(false);
  });

  it("ignores meshes that are already hidden", () => {
    const label = new Mesh(plane, new MeshBasicMaterial({ transparent: true, depthWrite: false }));
    label.visible = false;
    expect(isOverlay(label)).toBe(false);
  });
});
