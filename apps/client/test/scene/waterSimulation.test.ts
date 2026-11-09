import { beginnerBoard } from "@hexfall/engine/geometry";
import { describe, expect, it, vi } from "vite-plus/test";
import { boardLayout } from "../../src/scene/layout.ts";
import { beachGeometry, beachHeight } from "../../src/scene/coastTerrain.ts";
import { coastScatter, propsAsRocks } from "../../src/scene/coastScatter.ts";
import { landDistance } from "../../src/scene/coastField.ts";
import {
  bathymetry,
  bedHeight,
  SIM_DEPTH,
  SIM_DT,
  SIM_DX,
  SIM_GRAVITY,
  SIM_MAX_STEPS,
  supportsWaterSimulation,
  WaterSimulation,
  WaterStepper,
} from "../../src/scene/waterSimulation.ts";
import { Color, type WebGLRenderer } from "three";

const layout = boardLayout(beginnerBoard());
const land = layout.tiles.map((t) => t.position);

describe("physical coast", () => {
  it("slopes from dry berm to submerged shelf and stays below playable land", () => {
    expect(beachHeight(-0.18)).toBeGreaterThan(0);
    expect(beachHeight(1.5)).toBeLessThan(0);
    for (let d = -0.18; d < 1.5; d += 0.03) {
      expect(beachHeight(d + 0.03)).toBeLessThanOrEqual(beachHeight(d));
      for (const sea of [-0.16, -0.02])
        expect(sea + bedHeight(d, sea)).toBeLessThanOrEqual(-0.005 + 1e-9);
    }
    const geometry = beachGeometry(land, -0.16);
    const p = geometry.getAttribute("position");
    expect(geometry.index!.count).toBeGreaterThan(0);
    for (let i = 0; i < p.count; i++) expect(p.getY(i)).toBeLessThan(0);
    geometry.dispose();
  });
  it("uses the coast dressing's rocks as wave obstacles", () => {
    const rocks = propsAsRocks(coastScatter(land).props);
    expect(rocks.length).toBeGreaterThan(5);
    for (const r of rocks) expect(landDistance(land, r.x, r.z)).toBeGreaterThan(0);
    const field = bathymetry(land, rocks, -0.16, 64);
    expect(field.length).toBe(64 * 64 * 4);
  });
  it("makes land and rocks closed cells and open ocean finite depth", () => {
    const size = 32;
    const field = bathymetry(land, [], -0.16, size);
    const center = (16 * size + 16) * 4;
    expect(field[center + 1]).toBe(0);
    expect(field[1]).toBeGreaterThan(0);
    const rock = { x: -8.71875, z: -8.71875, radius: 0.2, height: 0.4, yaw: 0 };
    const withRock = bathymetry(land, [rock], -0.16, size);
    expect(withRock[1]).toBe(0);
    expect(withRock[0]).toBeGreaterThan(field[0]!);
    for (let i = 1; i < field.length; i += 4) {
      expect(field[i]).toBeGreaterThanOrEqual(0);
      expect(field[i]).toBeLessThanOrEqual(SIM_DEPTH);
    }
  });
});

describe("water timestep", () => {
  it("satisfies the 2D wave CFL bound at maximum depth", () => {
    expect((Math.sqrt(SIM_GRAVITY * SIM_DEPTH) * SIM_DT) / SIM_DX).toBeLessThan(1 / Math.sqrt(2));
  });
  it("is frame-rate independent at 30, 60 and 120 FPS", () => {
    for (const fps of [30, 60, 120]) {
      const clock = new WaterStepper();
      const step = vi.fn();
      for (let i = 0; i < fps; i++) clock.advance(1 / fps, false, step);
      expect(step).toHaveBeenCalledTimes(120);
      expect(clock.time).toBeCloseTo(1, 10);
    }
  });
  it("bounds catch-up and drops paused/reduced-motion time", () => {
    const clock = new WaterStepper();
    const step = vi.fn();
    expect(clock.advance(10, false, step)).toBe(SIM_MAX_STEPS);
    const time = clock.time;
    clock.advance(3, true, step);
    clock.advance(Number.NaN, false, step);
    expect(clock.time).toBe(time);
    expect(clock.advance(SIM_DT, false, step)).toBe(1);
  });
});

describe("simulation lifecycle", () => {
  it("requires renderable floating point targets", () => {
    expect(
      supportsWaterSimulation({
        capabilities: { isWebGL2: true },
        extensions: { has: () => false },
      } as unknown as WebGLRenderer),
    ).toBe(false);
  });
  it("freezes, restores renderer state even on failure, and releases GPU allocations", () => {
    const solver = new WaterSimulation([], [], -0.16);
    const originalTarget = {};
    const renderer = {
      getRenderTarget: () => originalTarget,
      getClearColor: (color: Color) => color.set("red"),
      getClearAlpha: () => 0.7,
      autoClear: false,
      xr: { enabled: true },
      setRenderTarget: vi.fn(),
      setClearColor: vi.fn(),
      clear: vi.fn(),
      render: vi.fn(),
    };
    solver.advance(renderer as unknown as WebGLRenderer, 1, true);
    expect(renderer.render).not.toHaveBeenCalled();
    solver.advance(renderer as unknown as WebGLRenderer, SIM_DT, false);
    expect(renderer.render).toHaveBeenCalledTimes(1);
    renderer.render.mockImplementation(() => {
      throw new Error("lost context");
    });
    expect(() => solver.advance(renderer as unknown as WebGLRenderer, SIM_DT, false)).toThrow(
      "lost context",
    );
    expect(renderer.setRenderTarget).toHaveBeenLastCalledWith(originalTarget);
    expect(renderer.setClearColor).toHaveBeenLastCalledWith(new Color("red"), 0.7);
    expect(renderer.autoClear).toBe(false);
    expect(renderer.xr.enabled).toBe(true);
    const bedDisposed = vi.fn();
    solver.bed.addEventListener("dispose", bedDisposed);
    solver.dispose();
    expect(bedDisposed).toHaveBeenCalledOnce();
  });
});
