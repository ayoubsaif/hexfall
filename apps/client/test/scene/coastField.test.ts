import { beginnerBoard } from "@hexfall/engine/geometry";
import { describe, expect, it } from "vite-plus/test";
import { boardLayout } from "../../src/scene/layout.ts";
import { beachHeight } from "../../src/scene/coastTerrain.ts";
import {
  FIELD_MAX,
  bakeCoastField,
  hexSdf,
  landDistance,
  sampleCoast,
} from "../../src/scene/coastField.ts";

const land = boardLayout(beginnerBoard()).tiles.map((t) => t.position);

describe("hexSdf", () => {
  it("is negative inside, zero on the outline and positive outside", () => {
    expect(hexSdf(0, 0)).toBeLessThan(0);
    expect(hexSdf(0, 1)).toBeCloseTo(0, 6); // corner toward +Z
    expect(hexSdf(0, 2)).toBeGreaterThan(0);
  });
});

describe("landDistance", () => {
  it("is inside the island at the centre and grows with distance from it", () => {
    expect(landDistance(land, 0, 0)).toBeLessThan(0);
    expect(landDistance(land, 8, 0)).toBeGreaterThan(landDistance(land, 6, 0));
  });
});

describe("sampleCoast", () => {
  it("is deterministic", () => {
    expect(sampleCoast(land, 3.3, -4.1)).toEqual(sampleCoast(land, 3.3, -4.1));
  });

  it("makes the beach width vary along the coast instead of a fixed offset", () => {
    // Walk a circle just outside the island: the shore distance at the same raw distance varies.
    const vals: number[] = [];
    for (let a = 0; a < 360; a += 10) {
      const r = 5.6;
      const x = r * Math.cos((a * Math.PI) / 180);
      const z = r * Math.sin((a * Math.PI) / 180);
      const raw = landDistance(land, x, z);
      vals.push(sampleCoast(land, x, z).shore - raw);
    }
    // Smaller than before (narrow beach) but still uneven.
    expect(Math.max(...vals) - Math.min(...vals)).toBeGreaterThan(0.2);
  });
});

describe("narrow beach (specs/sea-shore)", () => {
  /** Raw land distance where the beach first drops below sea level, along rays from the centre. */
  function waterlines(): number[] {
    const out: number[] = [];
    for (let a = 0; a < 360; a += 3) {
      const dx = Math.cos((a * Math.PI) / 180);
      const dz = Math.sin((a * Math.PI) / 180);
      let r = 0;
      while (landDistance(land, r * dx, r * dz) < 0) r += 0.01;
      for (; r < 9; r += 0.01) {
        const s = sampleCoast(land, r * dx, r * dz);
        if (beachHeight(s.shore) < 0) {
          out.push(landDistance(land, r * dx, r * dz));
          break;
        }
      }
    }
    return out;
  }

  it("keeps the waterline close to the outer hexagons", () => {
    const w = waterlines();
    expect(w.length).toBe(120);
    expect(w.reduce((a, b) => a + b, 0) / w.length).toBeLessThanOrEqual(0.35);
    expect(Math.max(...w)).toBeLessThanOrEqual(0.7);
  });

  it("keeps the beach dry right outside the land", () => {
    for (let a = 0; a < 360; a += 2) {
      const dx = Math.cos((a * Math.PI) / 180);
      const dz = Math.sin((a * Math.PI) / 180);
      for (let r = 0; r < 7; r += 0.01) {
        const d = landDistance(land, r * dx, r * dz);
        if (d >= 0 && d <= 0.05)
          expect(beachHeight(sampleCoast(land, r * dx, r * dz).shore)).toBeGreaterThan(0);
      }
    }
  });
});

describe("bakeCoastField", () => {
  const size = 32;
  const f = bakeCoastField(land, size, 9);

  it("has four channels per texel", () => {
    expect(f.length).toBe(size * size * 4);
  });

  it("is land (negative shore) at the centre and open sea at the corner", () => {
    const centre = f[((size / 2) * size + size / 2) * 4]!;
    const corner = f[0]!;
    expect(centre).toBeLessThan(0);
    expect(corner).toBeGreaterThan(3);
    expect(corner).toBeLessThanOrEqual(FIELD_MAX);
  });
});
