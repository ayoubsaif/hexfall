// 3D mountains on mountain hexes (specs/mountain-peaks).
import {
  STANDARD_TOPOLOGY,
  beginnerBoard,
  hexCenter,
  vertexPosition,
} from "@hexfall/engine/geometry";
import { createRng, createVariableBoard } from "@hexfall/engine";
import { describe, expect, it } from "vite-plus/test";
import { PATH_CLEAR, VERTEX_CLEAR } from "../../src/scene/coastScatter.ts";
import { CHIP_CLEAR, ROBBER_CLEAR } from "../../src/scene/forestTrees.ts";
import { ROBBER_TOKEN_OFFSET } from "../../src/scene/layout.ts";
import {
  MAX_STONES,
  MIN_STONES,
  MOUNTAIN_CHIP_CLEAR,
  PEAK_KINDS,
  STONE_VARIANT_BASE,
  hexMountain,
  mountainPeaks,
} from "../../src/scene/mountainPeaks.ts";

const CITY_HEIGHT = 0.368;
const CAMERA_TAN = Math.tan((55 * Math.PI) / 180);

function segDistance(px: number, pz: number, a: readonly number[], b: readonly number[]) {
  const dx = b[0]! - a[0]!,
    dz = b[1]! - a[1]!;
  const t = Math.max(0, Math.min(1, ((px - a[0]!) * dx + (pz - a[1]!) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(px - a[0]! - dx * t, pz - a[1]! - dz * t);
}

const boards = [
  beginnerBoard(),
  createVariableBoard(createRng(7))[0],
  createVariableBoard(createRng(42))[0],
];

const near = (hex: number, items: readonly { x: number; z: number }[]) => {
  const [cx, cz] = hexCenter(hex);
  return items.filter((t) => Math.hypot(t.x - cx, t.z - cz) < 0.87);
};

describe("mountain peaks", () => {
  it("puts one mountain, one ore cluster and 3 to 4 grey stone clusters on every mountain hex and none elsewhere", () => {
    for (const board of boards) {
      const all = mountainPeaks(board);
      const peaks = all.filter((p) => p.key === "prop.peak");
      const ore = all.filter((p) => p.key === "prop.ore" && p.variant < STONE_VARIANT_BASE);
      const stones = all.filter(
        (p) => p.key === "prop.ore" && p.variant >= STONE_VARIANT_BASE && p.scale >= 1,
      );
      for (const info of STANDARD_TOPOLOGY.hexes) {
        if (board.hexes[info.id]?.terrain === "mountains") {
          expect(near(info.id, peaks)).toHaveLength(1);
          expect(near(info.id, ore)).toHaveLength(1);
          expect(near(info.id, stones).length).toBeGreaterThanOrEqual(MIN_STONES);
          expect(near(info.id, stones).length).toBeLessThanOrEqual(MAX_STONES);
        } else {
          expect(near(info.id, peaks)).toHaveLength(0);
          expect(near(info.id, ore)).toHaveLength(0);
          expect(near(info.id, stones)).toHaveLength(0);
        }
      }
    }
  });

  it("stands the mountain in the middle, straight behind the chip, without touching it", () => {
    for (const info of STANDARD_TOPOLOGY.hexes) {
      const [cx, cz] = hexCenter(info.id);
      const peak = hexMountain(info.id).find((p) => p.key === "prop.peak")!;
      expect(peak.x).toBeCloseTo(cx);
      expect(peak.z).toBeLessThan(cz); // away from the default camera
      expect(cz - peak.z).toBeGreaterThanOrEqual(MOUNTAIN_CHIP_CLEAR + peak.radius);
      // Big: taller than a city.
      expect(PEAK_KINDS[peak.variant]!.height * peak.scale).toBeGreaterThan(CITY_HEIGHT);
    }
  });

  it("keeps every prop's footprint clear of the chip, the robber spot, corners and edges", () => {
    for (const info of STANDARD_TOPOLOGY.hexes) {
      const [cx, cz] = hexCenter(info.id);
      for (const p of hexMountain(info.id)) {
        const chip = p.key === "prop.peak" ? MOUNTAIN_CHIP_CLEAR : CHIP_CLEAR;
        expect(Math.hypot(p.x - cx, p.z - cz)).toBeGreaterThanOrEqual(chip + p.radius);
        const rx = cx + ROBBER_TOKEN_OFFSET[0],
          rz = cz + ROBBER_TOKEN_OFFSET[1];
        expect(Math.hypot(p.x - rx, p.z - rz)).toBeGreaterThanOrEqual(ROBBER_CLEAR + p.radius);
        for (const v of info.vertices) {
          const [vx, vz] = vertexPosition(v);
          expect(Math.hypot(p.x - vx, p.z - vz)).toBeGreaterThanOrEqual(VERTEX_CLEAR);
        }
        for (const e of info.edges) {
          const [a, b] = STANDARD_TOPOLOGY.edges[e]!.vertices;
          expect(segDistance(p.x, p.z, vertexPosition(a), vertexPosition(b))).toBeGreaterThan(
            PATH_CLEAR + p.radius - 1e-9,
          );
        }
      }
    }
  });

  it("never hides a piece on the hex corners from the default camera", () => {
    // Looking 55° down from +z, the mountain covers the ground behind it only within
    // height / tan(55°); every corner behind it must lie farther away than that.
    for (const info of STANDARD_TOPOLOGY.hexes)
      for (const p of hexMountain(info.id).filter((q) => q.key === "prop.peak")) {
        const h = PEAK_KINDS[p.variant]!.height * p.scale;
        for (const v of info.vertices) {
          const [vx, vz] = vertexPosition(v);
          if (vz < p.z && Math.abs(vx - p.x) < p.radius)
            expect(p.z - vz).toBeGreaterThan(h / CAMERA_TAN);
        }
      }
  });

  it("is deterministic", () => {
    for (const board of boards) expect(mountainPeaks(board)).toEqual(mountainPeaks(board));
  });
});
