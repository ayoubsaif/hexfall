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
