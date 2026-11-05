// The die contract and its procedural fallback (openspec change physics-dice-3d, task 1.5).
import { describe, expect, it } from "vite-plus/test";
import { DIE_EDGE, DIE_FACE_AXES, DIE_VALUES, pipPositions } from "../../src/theme/die.ts";

const dot = (a: readonly number[], b: readonly number[]) =>
  a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;

describe("die contract", () => {
  it("puts the six values on six distinct axes with opposite sides summing to 7", () => {
    for (const v of DIE_VALUES) {
      const opposite = DIE_FACE_AXES[(7 - v) as 1];
      expect(dot(DIE_FACE_AXES[v], opposite)).toBe(-1);
    }
    expect(new Set(DIE_VALUES.map((v) => DIE_FACE_AXES[v].join())).size).toBe(6);
  });

  it("draws each value's pips on its own side, as many pips as the value", () => {
    for (const v of DIE_VALUES) {
      const pips = pipPositions(v);
      expect(pips).toHaveLength(v);
      for (const p of pips) {
        // On the face plane of that side, inside the flat part of the face.
        expect(dot(p.position, DIE_FACE_AXES[v])).toBeCloseTo(DIE_EDGE / 2, 9);
        for (const c of p.position) expect(Math.abs(c)).toBeLessThanOrEqual(DIE_EDGE / 2 + 1e-9);
      }
    }
  });
});
