// Where the dice are thrown (openspec dice-center-fade, design decisions 1 and 3): on the land
// at the middle of the island, over the center hex and the ring around it, so the throw is in
// view from every camera angle. The physics runs in local units (die edge DIE_SIZE); the whole
// dice group is drawn scaled by DICE_SCALE, so the physics, the drawn dice and the board pieces
// they collide with share one frame. No physics import here, so the main bundle can use it.
import { DIE_EDGE } from "../../theme/die.ts";

/** Half sizes of the dice area (the physics walls), in local units before DICE_SCALE. */
export const DICE_AREA = { halfX: 1.1, halfZ: 0.8 } as const;

/** Scale of the board dice group (simulation units to world units). */
export const DICE_SCALE = 1.5;

/**
 * Edge of a die in the simulation, local units: small table dice, a world edge of
 * 0.18 × 1.5 = 0.27 (about a settlement's width). The `dice.die` model is drawn at its
 * contract edge DIE_EDGE and scaled by DIE_MODEL_SCALE to match.
 */
export const DIE_SIZE = 0.18;
export const DIE_MODEL_SCALE = DIE_SIZE / DIE_EDGE;

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
