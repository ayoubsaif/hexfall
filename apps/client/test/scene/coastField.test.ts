import { beginnerBoard } from "@hexfall/engine/geometry";
import { describe, expect, it } from "vite-plus/test";
import { boardLayout } from "../../src/scene/layout.ts";
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
    expect(Math.max(...vals) - Math.min(...vals)).toBeGreaterThan(0.5);
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
