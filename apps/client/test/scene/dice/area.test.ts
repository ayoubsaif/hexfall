// Dice area placement (openspec physics-dice-3d, task 3.6; spec board-dice "Dice visible at load").
import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vite-plus/test";
import { areaCorners, diceAreaPlacement } from "../../../src/scene/dice/area.ts";
import {
  FIT_FOV,
  FIT_RADIUS,
  fitDistance,
  fitDistanceWithDice,
  fitPosition,
} from "../../../src/scene/useFitCamera.ts";
import { DIE_EDGE } from "../../../src/theme/die.ts";

function camera(aspect: number, elevationDeg: number) {
  const cam = new PerspectiveCamera(FIT_FOV, aspect, 0.1, 200);
  const elevation = (elevationDeg * Math.PI) / 180;
  cam.position.set(...fitPosition(fitDistanceWithDice(aspect, elevation), elevation));
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  return cam;
}

const ASPECTS: [string, number][] = [
  ["16:9", 16 / 9],
  ["4:3", 4 / 3],
  ["9:16", 9 / 16],
];

describe("dice area", () => {
  it.each(ASPECTS)("is fully in view at %s, flat and raised boards", (_name, aspect) => {
    for (const elevation of [55, 60]) {
      const cam = camera(aspect, elevation);
      for (const [x, z] of areaCorners(diceAreaPlacement(aspect))) {
        for (const y of [-0.3, DIE_EDGE]) {
          const p = new Vector3(x, y, z).project(cam);
          expect(Math.abs(p.x)).toBeLessThan(1);
          expect(Math.abs(p.y)).toBeLessThan(1);
        }
      }
    }
  });

  it("does not zoom out at 16:9 or 9:16, where the area already fits", () => {
    for (const aspect of [16 / 9, 9 / 16]) {
      expect(fitDistanceWithDice(aspect)).toBeCloseTo(fitDistance(aspect), 9);
    }
  });

  it.each(ASPECTS)("stays outside the island's fit circle at %s", (_name, aspect) => {
    const p = diceAreaPlacement(aspect);
    const corners = areaCorners(p);
    // Corners and edge midpoints (the inner edge's midpoint is the nearest point).
    const points = corners.flatMap((c, i) => {
      const n = corners[(i + 1) % 4]!;
      return [c, [(c[0] + n[0]) / 2, (c[1] + n[1]) / 2] as [number, number]];
    });
    for (const [x, z] of points) expect(Math.hypot(x, z)).toBeGreaterThan(FIT_RADIUS);
  });
});
