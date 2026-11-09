// 3D mountains on mountain hexes (specs/mountain-peaks): one whole-hex mountain per mountain hex.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { STANDARD_TOPOLOGY, beginnerBoard, hexCenter } from "@hexfall/engine/geometry";
import { createRng, createVariableBoard } from "@hexfall/engine";
import { describe, expect, it } from "vite-plus/test";
import { ROBBER_TOKEN_OFFSET } from "../../src/scene/layout.ts";
import { MOUNTAIN_VARIANTS, hexMountain, mountainPeaks } from "../../src/scene/mountainPeaks.ts";
import { TOKEN_RADIUS } from "../../src/theme/index.ts";
import { DOME_AMPLITUDE, DOME_RADIUS, domeHeight } from "../../src/theme/relief.ts";

const read = (name: string) =>
  JSON.parse(
    // Tests run from apps/client.
    readFileSync(resolve(process.cwd(), "../../tools/blender", name), "utf8"),
  );
/** The mask numbers the Blender script used, and the height grids it measured on the result. */
const MASK = read("mountain-mask.json");
const HEIGHTS: { n: number; variant0: number[][]; variant1: number[][] } =
  read("mountain-heights.json");

const boards = [
  beginnerBoard(),
  createVariableBoard(createRng(7))[0],
  createVariableBoard(createRng(42))[0],
];

/** Absolute height of the mountain at hex-local (x, z), bilinear over the 33x33 grid. */
function heightAt(grid: number[][], x: number, z: number): number {
  const n = HEIGHTS.n;
  const fx = ((x + 1) / 2) * (n - 1),
    fz = ((z + 1) / 2) * (n - 1);
  const i = Math.max(0, Math.min(n - 2, Math.floor(fx))),
    j = Math.max(0, Math.min(n - 2, Math.floor(fz)));
  const u = Math.max(0, Math.min(1, fx - i)),
    v = Math.max(0, Math.min(1, fz - j));
  const r0 = grid[j]!,
    r1 = grid[j + 1]!;
  return (
    (r0[i]! * (1 - u) + r0[i + 1]! * u) * (1 - v) + (r1[i]! * (1 - u) + r1[i + 1]! * u) * v
  );
}

const CAMERA = (MASK.cameraDeg * Math.PI) / 180;
/** Grid cells are 1/16 wide, so bilinear sampling can miss a sharp ridge by a little. */
const SAMPLE_SLACK = 0.03;

/** True when the line from (x, y, z) towards the default camera (55 degrees down, from +z)
 * clears the mountain everywhere over the hex. */
function seen(grid: number[][], x: number, y: number, z: number): boolean {
  for (let s = 0.02; ; s += 0.01) {
    const zz = z + s * Math.cos(CAMERA),
      yy = y + s * Math.sin(CAMERA);
    if (zz > 1 || yy > 1.2) return true;
    if (Math.abs(x) <= 1 && zz >= -1 && heightAt(grid, x, zz) > yy + SAMPLE_SLACK) return false;
  }
}

const CORNERS = Array.from({ length: 6 }, (_, k) => {
  const a = ((90 + 60 * k) * Math.PI) / 180;
  return [Math.cos(a), Math.sin(a)] as const;
});

describe("mountain peaks", () => {
  it("puts exactly one mountain on every mountain hex and nothing on other hexes", () => {
    for (const board of boards) {
      const all = mountainPeaks(board);
      expect(all.every((p) => p.key === "prop.peak")).toBe(true);
      for (const info of STANDARD_TOPOLOGY.hexes) {
        const [cx, cz] = hexCenter(info.id);
        const here = all.filter((p) => Math.hypot(p.x - cx, p.z - cz) < 0.5);
        expect(here).toHaveLength(board.hexes[info.id]?.terrain === "mountains" ? 1 : 0);
      }
    }
  });

  it("centres the mountain on its hex, unturned and unscaled, in one of the two forms", () => {
    const variants = new Set<number>();
    for (const info of STANDARD_TOPOLOGY.hexes) {
      const [cx, cz] = hexCenter(info.id);
      const [peak, ...rest] = hexMountain(info.id);
      expect(rest).toHaveLength(0);
      expect(peak!.x).toBeCloseTo(cx);
      expect(peak!.z).toBeCloseTo(cz);
      expect(peak!.yaw).toBe(0);
      expect(peak!.scale).toBe(1);
      expect(peak!.ground).toBe(0);
      expect(peak!.variant).toBeLessThan(MOUNTAIN_VARIANTS);
      variants.add(peak!.variant);
    }
    expect(variants.size).toBe(MOUNTAIN_VARIANTS);
  });

  it("is deterministic", () => {
    for (const board of boards) expect(mountainPeaks(board)).toEqual(mountainPeaks(board));
  });

  it("was built with the client's chip, robber spot and dome", () => {
    expect(MASK.chip.radius).toBeCloseTo(TOKEN_RADIUS);
    expect(MASK.robber.x).toBeCloseTo(ROBBER_TOKEN_OFFSET[0]);
    expect(MASK.robber.z).toBeCloseTo(ROBBER_TOKEN_OFFSET[1]);
    expect(MASK.dome.amplitude).toBeCloseTo(DOME_AMPLITUDE["tile.mountains"]!);
    expect(MASK.dome.radius).toBeCloseTo(DOME_RADIUS);
  });

  for (const name of ["variant0", "variant1"] as const) {
    const grid = HEIGHTS[name];

    it(`${name}: is flat along the rim, at every corner and edge`, () => {
      for (let j = 0; j < HEIGHTS.n; j++)
        for (let i = 0; i < HEIGHTS.n; i++) {
          const x = -1 + (2 * i) / (HEIGHTS.n - 1),
            z = -1 + (2 * j) / (HEIGHTS.n - 1);
          if (Math.hypot(x, z) >= 0.86) expect(grid[j]![i]!).toBeLessThanOrEqual(0.002);
        }
    });

    it(`${name}: leaves the chip and robber on the ground in one clearing`, () => {
      const ground = (x: number, z: number) => domeHeight("tile.mountains", Math.hypot(x, z));
      const { robber } = MASK;
      for (let t = 0; t <= 1; t += 0.1) {
        const x = robber.x * t,
          z = robber.z * t;
        expect(heightAt(grid, x, z)).toBeLessThanOrEqual(ground(x, z) + 0.002);
      }
    });

    it(`${name}: never hides the chip, the robber or a city on any corner`, () => {
      const chipTop = domeHeight("tile.mountains", 0) + MASK.chip.top;
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        const x = Math.cos(a) * TOKEN_RADIUS,
          z = Math.sin(a) * TOKEN_RADIUS;
        expect(seen(grid, x, chipTop, z), `chip rim at ${k}`).toBe(true);
      }
      const [rx, rz] = ROBBER_TOKEN_OFFSET;
      const robberTop = domeHeight("tile.mountains", Math.hypot(rx, rz)) + MASK.robber.top;
      expect(seen(grid, rx, robberTop, rz), "robber").toBe(true);
      // Every corner of the hex, and the nearest corners of the hexes behind it.
      const corners = [...CORNERS, [0, -2] as const, [Math.sqrt(3), -1] as const, [-Math.sqrt(3), -1] as const];
      for (const [x, z] of corners)
        expect(seen(grid, x, MASK.cityTop, z), `city at ${x.toFixed(2)},${z.toFixed(2)}`).toBe(true);
    });
  }
});
