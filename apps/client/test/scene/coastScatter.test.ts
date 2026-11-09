// Coast dressing layout (specs/coast-dressing).
import { STANDARD_TOPOLOGY, vertexPosition } from "@hexfall/engine/geometry";
import { describe, expect, it } from "vite-plus/test";
import { LAND_CENTERS } from "../../src/scene/boatFloat.ts";
import { landDistance, sampleCoast } from "../../src/scene/coastField.ts";
import {
  HARBOR_CLEAR,
  VERTEX_CLEAR,
  WATERLINE_SHORE,
  clearZones,
  coastScatter,
  propsAsRocks,
} from "../../src/scene/coastScatter.ts";
import { beachHeight } from "../../src/scene/coastTerrain.ts";

const layout = coastScatter();
const props = layout.props;
const zones = clearZones();
const rocks = props.filter((p) => p.key === "prop.boulder" || p.key === "prop.cliff");

function segDistance(px: number, pz: number, a: readonly number[], b: readonly number[]) {
  const dx = b[0]! - a[0]!,
    dz = b[1]! - a[1]!;
  const t = Math.max(0, Math.min(1, ((px - a[0]!) * dx + (pz - a[1]!) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(px - a[0]! - dx * t, pz - a[1]! - dz * t);
}

describe("coast scatter", () => {
  it("is deterministic", () => {
    expect(coastScatter()).toEqual(layout);
  });

  it("puts rocks, bushes and walls on the coast, and no trees", () => {
    const count = (k: string) => props.filter((p) => p.key === k).length;
    // A sparse coast: a handful of rocks, not a ring of them.
    expect(count("prop.boulder")).toBeGreaterThan(5);
    expect(count("prop.boulder") + count("prop.cliff")).toBeLessThan(30);
    expect(count("prop.cliff")).toBeGreaterThan(0);
    // Trees grow only on the forest hexes, never on the coast.
    expect(count("prop.tree")).toBe(0);
    expect(count("prop.bush")).toBeGreaterThan(5);
    expect(count("prop.wall")).toBeGreaterThan(2);
    // At least three rock shapes (variants are taken modulo the variant count; 3 is the minimum).
    expect(new Set(rocks.map((r) => `${r.key}:${r.variant % 3}`)).size).toBeGreaterThanOrEqual(3);
  });

  it("keeps every prop off land hexes, intersections, paths and harbor lanes", () => {
    for (const p of props) {
      expect(landDistance(LAND_CENTERS, p.x, p.z)).toBeGreaterThan(0);
      for (let v = 0; v < STANDARD_TOPOLOGY.vertices.length; v++) {
        const [vx, vz] = vertexPosition(v);
        expect(Math.hypot(p.x - vx, p.z - vz)).toBeGreaterThanOrEqual(VERTEX_CLEAR);
      }
      for (const [a, b] of zones.paths) expect(segDistance(p.x, p.z, a, b)).toBeGreaterThan(0.06);
      for (const [a, b] of zones.harborLanes)
        expect(segDistance(p.x, p.z, a, b)).toBeGreaterThanOrEqual(HARBOR_CLEAR);
    }
  });

  it("rests props on the beach or seabed", () => {
    for (const p of props)
      expect(p.ground).toBeCloseTo(beachHeight(sampleCoast(LAND_CENTERS, p.x, p.z).shore), 6);
  });

  it("puts trees and bushes on dry ground", () => {
    for (const p of props.filter((q) => q.key === "prop.tree" || q.key === "prop.bush"))
      expect(p.ground).toBeGreaterThan(0);
  });

  it("finds the waterline where the beach meets sea level", () => {
    expect(Math.abs(beachHeight(WATERLINE_SHORE))).toBeLessThan(1e-6);
  });

  it("feeds the rocks to the wave simulation", () => {
    expect(propsAsRocks(props)).toHaveLength(rocks.length);
  });
});
