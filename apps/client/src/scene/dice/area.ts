// Where the dice area sits on the table (openspec physics-dice-3d, design decision 5): beside
// the island at the viewer's front-right in landscape, in front of it (toward the viewer) in
// portrait, always outside the island's fit circle and inside the default camera view.
// No physics import here, so the main bundle can use it.
import { FIT_RADIUS } from "../useFitCamera.ts";

/** Half sizes of the dice area (the physics walls), in hex-circumradius units. */
export const DICE_AREA = { halfX: 1.3, halfZ: 0.8 } as const;

export interface AreaPlacement {
  /** Area center on the table plane. */
  x: number;
  z: number;
  /** Turn of the area about Y (radians). */
  yaw: number;
}

/** Gap between the island's fit circle and the nearest point of the dice area. */
const GAP = 0.35;

export function diceAreaPlacement(aspect: number): AreaPlacement {
  if (aspect >= 1) {
    // Right of the island, a little toward the viewer; the throw runs toward the island.
    return { x: FIT_RADIUS + GAP + DICE_AREA.halfX, z: 1.6, yaw: Math.PI };
  }
  // Portrait: in front of the island, the long side across the screen.
  return { x: 0, z: FIT_RADIUS + GAP + DICE_AREA.halfZ, yaw: 0 };
}

/** The four corners of the area on the table, in world X/Z. */
export function areaCorners(p: AreaPlacement): [number, number][] {
  const c = Math.cos(p.yaw);
  const s = Math.sin(p.yaw);
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([a, b]) => {
    const lx = a! * DICE_AREA.halfX;
    const lz = b! * DICE_AREA.halfZ;
    return [p.x + c * lx + s * lz, p.z - s * lx + c * lz];
  });
}
