// The die contract and its procedural fallback (openspec change physics-dice-3d, task 1.5).
import { describe, expect, it } from "vite-plus/test";
import { Color } from "three";
import {
  DIE_BODY_COLOR,
  DIE_EDGE,
  DIE_FACE_AXES,
  DIE_PIP_COLOR,
  DIE_VALUES,
  PIP_DEPTH,
  PIP_RADIUS,
  pipPositions,
  SPHERE_RATIO,
} from "../../src/theme/die.ts";

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

describe("procedural die", () => {
  const luminance = (hex: string) => {
    const c = new Color(hex);
    return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  };

  it("is a classic light die with dark pips", () => {
    expect(luminance(DIE_BODY_COLOR)).toBeGreaterThan(0.75);
    expect(luminance(DIE_PIP_COLOR)).toBeLessThan(0.05);
  });

  it("has rounded corners and sinks every pip fully inside the flat part of its face", () => {
    const half = DIE_EDGE / 2;
    expect(SPHERE_RATIO).toBeGreaterThan(1); // the sphere cuts into the cube…
    expect(SPHERE_RATIO).toBeLessThan(Math.sqrt(3)); // …and trims all eight corners
    const disc = half * Math.sqrt(SPHERE_RATIO ** 2 - 1);
    expect(PIP_DEPTH).toBeGreaterThan(0);
    for (const v of DIE_VALUES) {
      const pips = pipPositions(v);
      for (const p of pips) {
        const n = DIE_FACE_AXES[v];
        const inPlane = p.position.map((c, i) => c - n[i]! * half);
        expect(Math.hypot(...inPlane) + PIP_RADIUS).toBeLessThan(disc);
        // Pips on one face never overlap.
        for (const q of pips) {
          if (q === p) continue;
          const gap = Math.hypot(...p.position.map((c, i) => c - q.position[i]!));
          expect(gap).toBeGreaterThan(2 * PIP_RADIUS);
        }
      }
    }
  });
});
