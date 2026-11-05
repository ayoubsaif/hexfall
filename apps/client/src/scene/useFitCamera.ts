// Frames the whole island (sea ring plus harbor badges) on load and on resize. The canvas
// is a full-screen background behind the HUD, and the board is fitted to the whole screen.
import { useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo } from "react";
import { PerspectiveCamera, Vector3 } from "three";
import { areaCorners, diceAreaPlacement } from "./dice/area.ts";

/** Radius of the circle that holds the sea ring and harbor badges. */
export const FIT_RADIUS = 6.3;
export const FIT_FOV = 45;
/** Camera elevation above the board plane, from the +Z side so row 1 is on top. */
export const FIT_ELEVATION = (55 * Math.PI) / 180;

/** Distance at which a sphere of `radius` fits the narrower view dimension. */
export function fitDistance(aspect: number, radius = FIT_RADIUS, fovDeg = FIT_FOV): number {
  const halfV = (fovDeg * Math.PI) / 360;
  // In portrait the horizontal field of view is the limiting one.
  const half = aspect < 1 ? Math.atan(Math.tan(halfV) * aspect) : halfV;
  return radius / Math.sin(half);
}

export function fitPosition(distance: number, elevation = FIT_ELEVATION): [number, number, number] {
  return [0, distance * Math.sin(elevation), distance * Math.cos(elevation)];
}

/** How far inside the screen edge the dice area must stay (normalized device coordinates). */
const DICE_MARGIN = 0.94;

/**
 * Fit distance that also keeps the dice area in view (openspec physics-dice-3d, design
 * decision 5): starts at `fitDistance` and backs off in small steps until every corner of
 * the area, at table and die height, projects inside the screen.
 */
export function fitDistanceWithDice(aspect: number, elevation = FIT_ELEVATION): number {
  const corners = areaCorners(diceAreaPlacement(aspect));
  const cam = new PerspectiveCamera(FIT_FOV, aspect, 0.1, 500);
  const p = new Vector3();
  let distance = fitDistance(aspect);
  for (let i = 0; i < 40; i++) {
    cam.position.set(...fitPosition(distance, elevation));
    cam.lookAt(0, 0, 0);
    cam.updateMatrixWorld();
    cam.updateProjectionMatrix();
    const inside = corners.every(([x, z]) =>
      [-0.3, 0.3].every((y) => {
        p.set(x, y, z).project(cam);
        return Math.abs(p.x) <= DICE_MARGIN && Math.abs(p.y) <= DICE_MARGIN;
      }),
    );
    if (inside) return distance;
    distance *= 1.03;
  }
  return distance;
}

/** Places the default camera whenever the view resizes; returns the fit distance. */
export function useFitCamera(elevation = FIT_ELEVATION): number {
  const camera = useThree((s) => s.camera);
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const controls = useThree((s) => s.controls) as { update?: () => void } | null;
  const aspect = width > 0 && height > 0 ? width / height : 1;
  const distance = useMemo(() => fitDistanceWithDice(aspect, elevation), [aspect, elevation]);

  useLayoutEffect(() => {
    if (camera instanceof PerspectiveCamera) {
      // Full-screen framing: no view offset (a hot reload can keep an old one), the
      // canvas's own aspect, and the fit field of view.
      if (camera.view?.enabled) camera.clearViewOffset();
      camera.fov = FIT_FOV;
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    }
    camera.position.set(...fitPosition(distance, elevation));
    camera.lookAt(0, 0, 0);
    controls?.update?.();
  }, [aspect, camera, controls, distance, elevation]);

  return distance;
}
