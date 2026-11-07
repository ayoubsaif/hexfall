// Board framing with harbor boats (specs/board-view "Board framing"): at load, every boat's
// hull ends and mast top are inside the view at 16:9 and 9:16.
import { beginnerBoard } from "@hexfall/engine/geometry";
import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vite-plus/test";
import { boardLayout } from "../../src/scene/layout.ts";
import { FIT_FOV, fitDistance, fitPosition } from "../../src/scene/useFitCamera.ts";

/** Generous boat bounds: centre up to 0.75 beyond the marker, half-length 0.65, mast 1.0. */
const OUT = 0.75;
const HALF = 0.65;
const TOP = 1.0;

function camera(aspect: number, elevationDeg: number) {
  const cam = new PerspectiveCamera(FIT_FOV, aspect, 0.1, 200);
  cam.position.set(...fitPosition(fitDistance(aspect), (elevationDeg * Math.PI) / 180));
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  return cam;
}

describe("harbor boats in the default view", () => {
  const layout = boardLayout(beginnerBoard());
  for (const [name, aspect] of [
    ["16:9", 16 / 9],
    ["9:16", 9 / 16],
  ] as const) {
    for (const elevation of [55, 60]) {
      it(`keeps every hull and mast top in view at ${name}, ${elevation}°`, () => {
        const cam = camera(aspect, elevation);
        for (const h of layout.harbors) {
          const [x, z] = h.position;
          const r = Math.hypot(x, z);
          const cx = x * (1 + OUT / r);
          const cz = z * (1 + OUT / r);
          // Along the coast: perpendicular to the outward direction.
          const tx = -z / r;
          const tz = x / r;
          for (const s of [-1, 0, 1])
            for (const y of [-0.1, TOP]) {
              const p = new Vector3(cx + s * HALF * tx, y, cz + s * HALF * tz).project(cam);
              expect(Math.abs(p.x)).toBeLessThanOrEqual(1);
              expect(Math.abs(p.y)).toBeLessThanOrEqual(1);
            }
        }
      });
    }
  }
});
