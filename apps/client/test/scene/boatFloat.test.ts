// Harbor boats float on water (openspec narrow-beach-floating-boats, specs/sea-shore).
import { beginnerBoard } from "@hexfall/engine/geometry";
import { describe, expect, it } from "vite-plus/test";
import {
  FLOAT_DEPTH,
  HULL_HALF,
  LAND_CENTERS,
  MAX_PUSH,
  boatDistance,
} from "../../src/scene/boatFloat.ts";
import { sampleCoast } from "../../src/scene/coastField.ts";
import { beachHeight } from "../../src/scene/coastTerrain.ts";
import { boardLayout } from "../../src/scene/layout.ts";
import { BOB_HEIGHT, bobAt } from "../../src/scene/HarborBoat.tsx";
import { JETTY_LENGTH } from "../../src/theme/index.ts";

const START = JETTY_LENGTH + 0.135;

/** The same geometry HarborMarker uses: edge midpoint, sea direction and hull direction. */
const harbors = boardLayout(beginnerBoard()).harbors.map((h) => {
  const mid = [(h.ends[0][0] + h.ends[1][0]) / 2, (h.ends[0][1] + h.ends[1][1]) / 2] as const;
  const ol = Math.hypot(h.position[0] - mid[0], h.position[1] - mid[1]);
  const out = [(h.position[0] - mid[0]) / ol, (h.position[1] - mid[1]) / ol] as const;
  const ex = h.ends[1][0] - h.ends[0][0];
  const ez = h.ends[1][1] - h.ends[0][1];
  const el = Math.hypot(ex, ez);
  return { mid, out, along: [ex / el, ez / el] as const };
});

describe("boatDistance", () => {
  it("puts every harbor boat's centre and hull ends over water", () => {
    expect(harbors).toHaveLength(9);
    for (const { mid, out, along } of harbors) {
      const d = boatDistance(LAND_CENTERS, mid, out, along, START);
      expect(d).toBeGreaterThanOrEqual(START);
      expect(d).toBeLessThan(START + MAX_PUSH);
      for (const k of [-1, 0, 1]) {
        const x = mid[0] + out[0] * d + along[0] * HULL_HALF * k;
        const z = mid[1] + out[1] * d + along[1] * HULL_HALF * k;
        expect(beachHeight(sampleCoast(LAND_CENTERS, x, z).shore)).toBeLessThanOrEqual(
          -FLOAT_DEPTH,
        );
      }
    }
  });

  it("is deterministic", () => {
    const { mid, out, along } = harbors[0]!;
    expect(boatDistance(LAND_CENTERS, mid, out, along, START)).toBe(
      boatDistance(LAND_CENTERS, mid, out, along, START),
    );
  });
});

describe("bobAt", () => {
  it("stays small and puts boats out of step", () => {
    for (let t = 0; t < 20; t += 0.37) {
      const b = bobAt(t, 2, -3);
      expect(Math.abs(b.y)).toBeLessThanOrEqual(BOB_HEIGHT);
      expect(Math.abs(b.roll)).toBeLessThan(0.05);
    }
    expect(bobAt(1, 2, -3).y).not.toBeCloseTo(bobAt(1, -4, 1).y, 4);
  });
});
