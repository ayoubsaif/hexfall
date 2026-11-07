// Sail turn about the mast: the labelled +X face points at the camera, hull frame only.
import { Matrix4, Vector3 } from "three";
import { describe, expect, it } from "vite-plus/test";
import {
  MAX_TILT,
  TILT_SHARE,
  sailHeading,
  sailTilt,
  sailTurn,
  turnAbout,
} from "../../src/scene/sailYaw.ts";

const face = (angle: number) =>
  new Vector3(1, 0, 0).applyMatrix4(new Matrix4().makeRotationY(angle));

describe("sail turn", () => {
  it("leaves the sail unturned when the camera is due +X of the mast", () => {
    expect(sailTurn(sailHeading({ x: 10, z: 0 }, { x: 0, z: 0 }, 0))).toBeCloseTo(0);
  });

  it("points the labelled face toward the camera from every side", () => {
    for (const [x, z] of [
      [0, 5],
      [-3, 0],
      [2, -2],
      [-1, 4],
    ] as const) {
      const pivot = { x: 0.25, z: 0 };
      const f = face(sailTurn(sailHeading({ x, z }, pivot, 0)));
      const d = new Vector3(x - pivot.x, 0, z - pivot.z).normalize();
      expect(f.dot(d)).toBeCloseTo(1);
    }
  });

  it("keeps the previous heading when the camera is right above the mast", () => {
    expect(sailHeading({ x: 0.25, z: 0 }, { x: 0.25, z: 0 }, 1.3)).toBe(1.3);
  });

  it("turns about the mast axis, which stays fixed", () => {
    const out = turnAbout(new Matrix4(), new Matrix4(), { x: 0.25, y: 0, z: -0.1 }, 1.1);
    const onAxis = new Vector3(0.25, 3, -0.1).applyMatrix4(out);
    expect(onAxis.x).toBeCloseTo(0.25);
    expect(onAxis.y).toBeCloseTo(3);
    expect(onAxis.z).toBeCloseTo(-0.1);
    const off = new Vector3(1.25, 0, -0.1).applyMatrix4(out);
    expect(Math.hypot(off.x - 0.25, off.z + 0.1)).toBeCloseTo(1);
  });

  it("applies the turn on top of the node's own matrix", () => {
    const original = new Matrix4().makeTranslation(0.5, 2, 0);
    const out = turnAbout(new Matrix4(), original, { x: 0, y: 0, z: 0 }, Math.PI / 2);
    const p = new Vector3().applyMatrix4(out);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(2);
    expect(p.z).toBeCloseTo(-0.5);
  });

  it("leans back by a share of the camera elevation, capped", () => {
    const foot = { x: 0, y: 1, z: 0 };
    // Camera 30° above the foot: lean TILT_SHARE of it.
    const t = sailTilt({ x: Math.sqrt(3), y: 2, z: 0 }, foot);
    expect(t).toBeCloseTo((30 * Math.PI * TILT_SHARE) / 180);
    expect(sailTilt({ x: 0.01, y: 50, z: 0 }, foot)).toBe(MAX_TILT);
    expect(sailTilt({ x: 5, y: 0, z: 0 }, foot)).toBe(0);
  });

  it("leans about the sail foot so the face looks up toward the camera", () => {
    const out = turnAbout(new Matrix4(), new Matrix4(), { x: 0, y: 1, z: 0 }, 0, 0.3);
    const foot = new Vector3(0, 1, 0).applyMatrix4(out);
    expect(foot.y).toBeCloseTo(1);
    const top = new Vector3(0, 2, 0).applyMatrix4(out);
    expect(top.x).toBeLessThan(0);
    const normal = new Vector3(1, 0, 0).transformDirection(out);
    expect(normal.y).toBeCloseTo(Math.sin(0.3));
  });
});
