// Dice area at the island center (openspec dice-center-fade, task 1.3; spec board-dice "Dice
// on the board", scenario "Dice thrown in the middle").
import { beginnerBoard } from "@hexfall/engine/geometry";
import { PerspectiveCamera, Spherical, Vector3 } from "three";
import { describe, expect, it } from "vite-plus/test";
import { areaCorners, DICE_SCALE } from "../../../src/scene/dice/area.ts";
import { boardLayout } from "../../../src/scene/layout.ts";
import { FIT_FOV, fitDistance, fitPosition } from "../../../src/scene/useFitCamera.ts";
import { DIE_EDGE } from "../../../src/theme/die.ts";

const ASPECTS: [string, number][] = [
  ["16:9", 16 / 9],
  ["9:16", 9 / 16],
];
/** Mirrors Scene.tsx: OrbitControls min distance and the iso azimuth limit. */
const MIN_DISTANCE = 0.45;
const MAX_TURN = (25 * Math.PI) / 180;

function camera(aspect: number, elevationDeg: number, zoom: number, azimuth: number) {
  const cam = new PerspectiveCamera(FIT_FOV, aspect, 0.1, 200);
  const elevation = (elevationDeg * Math.PI) / 180;
  const [, y, z] = fitPosition(fitDistance(aspect) * zoom, elevation);
  const s = new Spherical().setFromCartesianCoords(0, y, z);
  s.theta = azimuth;
  cam.position.setFromSpherical(s);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  return cam;
}

describe("dice area", () => {
  it("draws the die at a world edge of 0.45", () => {
    expect(DIE_EDGE * DICE_SCALE).toBeCloseTo(0.45, 9);
  });

  it.each(ASPECTS)("is in view at %s for default, turned and zoomed cameras", (_n, aspect) => {
    for (const elevation of [55, 60]) {
      for (const zoom of [1, MIN_DISTANCE]) {
        for (const azimuth of [0, -MAX_TURN, MAX_TURN]) {
          const cam = camera(aspect, elevation, zoom, azimuth);
          for (const [x, z] of areaCorners()) {
            for (const y of [0, DIE_EDGE * DICE_SCALE]) {
              const p = new Vector3(x, y, z).project(cam);
              expect(Math.abs(p.x)).toBeLessThan(1);
              expect(Math.abs(p.y)).toBeLessThan(1);
            }
          }
        }
      }
    }
  });

  it("stays over the center hex and its ring, clear of coast hexes and harbors", () => {
    const layout = boardLayout(beginnerBoard());
    const inradius = Math.sqrt(3) / 2;
    // Every corner lies inside the center hex or a hex of the first ring (centers at √3).
    for (const [x, z] of areaCorners()) {
      const near = [...layout.tiles].sort(
        (a, b) =>
          Math.hypot(a.position[0] - x, a.position[1] - z) -
          Math.hypot(b.position[0] - x, b.position[1] - z),
      )[0]!;
      expect(Math.hypot(...near.position)).toBeLessThan(2);
      expect(Math.hypot(near.position[0] - x, near.position[1] - z)).toBeLessThan(inradius);
    }
    const reach = Math.max(...areaCorners().map(([x, z]) => Math.hypot(x, z)));
    for (const h of layout.harbors) expect(Math.hypot(...h.position)).toBeGreaterThan(reach);
  });
});

import { diceZoomBoost } from "../../../src/scene/dice/area.ts";

describe("dice zoom boost", () => {
  it("is larger at the default zoom and 1 when already zoomed in", () => {
    expect(diceZoomBoost(100)).toBeCloseTo(1.35);
    expect(diceZoomBoost(67)).toBeCloseTo(1.35);
    expect(diceZoomBoost(150)).toBe(1);
    expect(diceZoomBoost(222)).toBe(1);
    expect(diceZoomBoost(125)).toBeGreaterThan(1);
  });
});
