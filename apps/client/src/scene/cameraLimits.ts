// Camera limits that keep the view on the board: the orbit target cannot be panned far from
// the island centre, and the camera cannot drop so low that the horizon or the edge of the sea
// plane shows (specs/board-view, "Default camera framing").
import { Vector3 } from "three";

/** Farthest the orbit target may be panned from the island centre, in hex radii. */
export const MAX_PAN = 4;
/** Lowest camera elevation above the board plane, in degrees. Keeps the horizon out of frame. */
export const MIN_ELEVATION_DEG = 30;
/** OrbitControls polar angle (from straight up) that corresponds to MIN_ELEVATION_DEG. */
export const MAX_POLAR = ((90 - MIN_ELEVATION_DEG) * Math.PI) / 180;

/**
 * The offset to add to both the orbit target and the camera so the target sits within `max`
 * of the origin on the board plane (height is pinned to 0). Zero when already inside.
 * Moving both keeps the view direction unchanged, so clamping never turns the camera.
 */
export function panCorrection(target: Vector3, max = MAX_PAN): Vector3 {
  const flat = new Vector3(target.x, 0, target.z);
  const clamped = flat.length() > max ? flat.setLength(max) : flat;
  return new Vector3(clamped.x - target.x, -target.y, clamped.z - target.z);
}
