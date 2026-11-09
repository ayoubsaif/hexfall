// Frames the whole island (sea ring plus harbor piers and boats) on load and on resize. The canvas
// is a full-screen background behind the HUD, and the board is fitted to the whole screen.
import { STANDARD_TOPOLOGY, hexToWorld, type Topology } from "@hexfall/engine/geometry";
import { useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo } from "react";
import { PerspectiveCamera } from "three";
import { DEFAULT_ZOOM } from "../store/view.ts";

function farthestSea(topo: Topology): number {
  let far = 0;
  for (const { q, r } of topo.seaRing) far = Math.max(far, Math.hypot(...hexToWorld(q, r, topo)));
  return far;
}

/** Radius of the sphere that holds the standard sea ring and harbor boats, masts included. */
export const FIT_RADIUS = 6.3;
/** Margin past the farthest sea-ring cell centre (a hex circumradius plus the boats' masts),
 * tuned so the standard island keeps its framing. */
export const FIT_MARGIN = FIT_RADIUS - farthestSea(STANDARD_TOPOLOGY);

/** Radius of the sphere that holds a board's sea ring and harbor boats, masts included. */
export function fitRadius(topo: Topology = STANDARD_TOPOLOGY): number {
  return farthestSea(topo) + FIT_MARGIN;
}
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

/** Places the default camera whenever the view resizes; returns the fit distance. */
export function useFitCamera(
  elevation = FIT_ELEVATION,
  topo: Topology = STANDARD_TOPOLOGY,
): number {
  const camera = useThree((s) => s.camera);
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const controls = useThree((s) => s.controls) as { update?: () => void } | null;
  const aspect = width > 0 && height > 0 ? width / height : 1;
  const distance = useMemo(() => fitDistance(aspect, fitRadius(topo)), [aspect, topo]);

  useLayoutEffect(() => {
    if (camera instanceof PerspectiveCamera) {
      // Full-screen framing: no view offset (a hot reload can keep an old one), the
      // canvas's own aspect, and the fit field of view.
      if (camera.view?.enabled) camera.clearViewOffset();
      camera.fov = FIT_FOV;
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    }
    // Start at the default zoom (closer than the full fit); 100 % stays the fit distance.
    camera.position.set(...fitPosition(distance / (DEFAULT_ZOOM / 100), elevation));
    camera.lookAt(0, 0, 0);
    controls?.update?.();
  }, [aspect, camera, controls, distance, elevation]);

  return distance;
}
