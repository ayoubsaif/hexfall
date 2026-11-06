// Where the dice are thrown (openspec dice-center-fade, design decisions 1 and 3): on the land
// at the middle of the island, over the center hex and the ring around it, so the throw is in
// view from every camera angle. The physics runs in local units (die edge DIE_EDGE); the whole
// dice group is drawn scaled by DICE_SCALE. No physics import here, so the main bundle can use it.

/** Half sizes of the dice area (the physics walls), in local units before DICE_SCALE. */
export const DICE_AREA = { halfX: 1.1, halfZ: 0.8 } as const;

/** Scale of the board dice group: a world die edge of DIE_EDGE × 1.5 = 0.45. */
export const DICE_SCALE = 1.5;

/**
 * Extra size for the dice while the camera is at or below the default zoom, so they stay easy
 * to read: 1.35 x at 100 % zoom or less, easing to 1 x from 150 % up (already zoomed in).
 */
export function diceZoomBoost(zoomPercent: number): number {
  const t = Math.min(1, Math.max(0, (150 - zoomPercent) / 50));
  return 1 + 0.35 * t;
}

/** Lift above the land surface so die shadows do not fight with tile tops. */
export const DICE_LIFT = 0.01;

/** The four corners of the area on the table, in world X/Z (centered on the origin). */
export function areaCorners(): [number, number][] {
  const x = DICE_AREA.halfX * DICE_SCALE;
  const z = DICE_AREA.halfZ * DICE_SCALE;
  return [
    [-x, -z],
    [x, -z],
    [x, z],
    [-x, z],
  ];
}
