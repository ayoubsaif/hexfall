import { Quaternion, Vector3, type Group } from "three";
// Shared turn for the number-token chips (specs/board-view "Number tokens"): every chip
// spins about the vertical axis by the camera's horizontal direction, so its number is
// upright from the viewer's side. Pure, so it is unit-testable.

/** Horizontal offsets below this (camera straight above the target) keep the last yaw. */
export const YAW_EPSILON = 1e-4;

interface XYZ {
  readonly x: number;
  readonly z: number;
}

/**
 * Rotation about +Y that points a chip's local +Z (the label's bottom edge) toward the
 * camera's side of the target. 0 when the camera is due south (+Z) of the target.
 */
export function cameraYaw(camera: XYZ, target: XYZ, previous: number): number {
  const dx = camera.x - target.x;
  const dz = camera.z - target.z;
  if (Math.hypot(dx, dz) < YAW_EPSILON) return previous;
  return Math.atan2(dx, dz);
}

/** Sets every chip group's turn to `yaw`, touching only groups that differ. */
export function turnChips(groups: Iterable<{ rotation: { y: number } }>, yaw: number): void {
  for (const g of groups) if (g.rotation.y !== yaw) g.rotation.y = yaw;
}

/** Face and lettering follow camera pitch as well as yaw. Lift only enough to keep
 * the tilted disc's lowest rim on its original supporting surface. */
export function faceChips(groups: Iterable<Group>, camera: Quaternion): void {
  const orientation = camera
    .clone()
    .multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2));
  const normal = new Vector3(0, 1, 0).applyQuaternion(orientation);
  const tilt = Math.sqrt(Math.max(0, 1 - normal.y * normal.y));
  for (const group of groups) {
    group.quaternion.copy(orientation);
    group.position.y = 0.3 * group.scale.x * tilt;
  }
}
