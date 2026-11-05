// Face remap for the physics dice (openspec change physics-dice-3d, task 2.2).
import { Quaternion, Vector3 } from "three";
import { describe, expect, it } from "vite-plus/test";
import {
  CUBE_ROTATIONS,
  UNIT_AXES,
  applyRotation,
  remapFor,
  rotationQuaternion,
  upAxis,
  valueUp,
} from "../../../src/scene/dice/faces.ts";
import { DIE_FACE_AXES, DIE_VALUES } from "../../../src/theme/die.ts";

describe("cube rotations", () => {
  it("are the 24 distinct proper rotations, identity first", () => {
    expect(CUBE_ROTATIONS).toHaveLength(24);
    expect(new Set(CUBE_ROTATIONS.map((m) => m.join())).size).toBe(24);
    expect(CUBE_ROTATIONS[0]).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  });

  it("match their quaternion form", () => {
    for (const m of CUBE_ROTATIONS) {
      const q = rotationQuaternion(m);
      for (const a of UNIT_AXES) {
        const v = new Vector3(...a).applyQuaternion(q);
        const expected = applyRotation(m, a);
        expect(v.x).toBeCloseTo(expected[0], 9);
        expect(v.y).toBeCloseTo(expected[1], 9);
        expect(v.z).toBeCloseTo(expected[2], 9);
      }
    }
  });
});

describe("upAxis", () => {
  it("finds the local axis pointing up and its tilt", () => {
    expect(upAxis({ x: 0, y: 0, z: 0, w: 1 })).toEqual({ axis: [0, 1, 0], tilt: 0 });
    // Turned 90° about X: local −Z now points up.
    const q = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2);
    const r = upAxis(q);
    expect(r.axis).toEqual([0, 0, -1]);
    expect(r.tilt).toBeCloseTo(0, 6);
    const tilted = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), 0.2);
    expect(upAxis(tilted).tilt).toBeCloseTo(0.2, 6);
  });
});

describe("remapFor (spec: Dice land on the server's roll)", () => {
  it("shows every value on every up axis", () => {
    for (const value of DIE_VALUES) {
      for (const up of UNIT_AXES) {
        const m = remapFor(value, up);
        expect(applyRotation(m, DIE_FACE_AXES[value]).map((c) => c + 0)).toEqual([...up]);
      }
    }
  });

  it("gives valueUp the value for any body orientation", () => {
    for (const body of CUBE_ROTATIONS) {
      const q = rotationQuaternion(body);
      const up = upAxis(q).axis;
      for (const value of DIE_VALUES) expect(valueUp(q, remapFor(value, up))).toBe(value);
    }
  });
});
