// The die's coordinate contract (specs/asset-theming "Model coordinate contract"): origin at
// the center, an edge of DIE_EDGE units, and each value on a fixed local axis. The themed
// GLB (tools/obj-to-glb.mjs checks its pips) and the procedural fallback both follow it, so
// the face remap in scene/dice works the same on either.

export type DieValue = 1 | 2 | 3 | 4 | 5 | 6;

export const DIE_VALUES: readonly DieValue[] = [1, 2, 3, 4, 5, 6];

/** Edge of the die in hex-circumradius units. */
export const DIE_EDGE = 0.3;

export type Axis = readonly [number, number, number];

/** Local outward axis of the side showing each value: +Y=1, +Z=2, +X=3, −X=4, −Z=5, −Y=6. */
export const DIE_FACE_AXES: Readonly<Record<DieValue, Axis>> = {
  1: [0, 1, 0],
  2: [0, 0, 1],
  3: [1, 0, 0],
  4: [-1, 0, 0],
  5: [0, 0, -1],
  6: [0, -1, 0],
};

/** Source colors of Dice.mtl (linear Kd 0.64/0.017/0.019 and 0.8) as sRGB hex. */
export const DIE_BODY_COLOR = "#d12326";
export const DIE_PIP_COLOR = "#e7e7e7";

/** Pip spots on a unit face, in [-1, 1]²: classic die layouts. */
const SPOTS: Readonly<Record<DieValue, readonly (readonly [number, number])[]>> = {
  1: [[0, 0]],
  2: [
    [-1, -1],
    [1, 1],
  ],
  3: [
    [-1, -1],
    [0, 0],
    [1, 1],
  ],
  4: [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ],
  5: [
    [-1, -1],
    [1, -1],
    [0, 0],
    [-1, 1],
    [1, 1],
  ],
  6: [
    [-1, -1],
    [-1, 0],
    [-1, 1],
    [1, -1],
    [1, 0],
    [1, 1],
  ],
};

export interface Pip {
  position: [number, number, number];
  /** Outward axis of the side the pip sits on. */
  normal: Axis;
}

/** Where the fallback draws the pips of one value, in die-local coordinates. */
export function pipPositions(value: DieValue, edge = DIE_EDGE): Pip[] {
  const n = DIE_FACE_AXES[value];
  // Two in-plane axes perpendicular to n.
  const u: Axis = n[0] !== 0 ? [0, 1, 0] : [1, 0, 0];
  const v: Axis = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
  const half = edge / 2;
  const spread = edge * 0.25;
  return SPOTS[value].map(([a, b]) => ({
    position: [0, 1, 2].map((i) => n[i]! * half + u[i]! * a * spread + v[i]! * b * spread) as [
      number,
      number,
      number,
    ],
    normal: n,
  }));
}
