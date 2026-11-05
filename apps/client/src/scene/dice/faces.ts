// Face logic for the physics dice (openspec change physics-dice-3d, design decision 2).
// The physics body is a cube, so turning the die model inside it by one of the cube's 24
// rotations changes nothing in the simulation, only which value is painted on which side.
// After a throw is simulated, the side that landed up gets the server's value this way.
import { Matrix4, Quaternion, Vector3 } from "three";
import { type Axis, DIE_FACE_AXES, type DieValue } from "../../theme/die.ts";

/** A rotation of the cube as a row-major 3×3 matrix of -1/0/1 entries. */
export type CubeRotation = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

const PERMUTATIONS: readonly (readonly [number, number, number])[] = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
];

function det(m: CubeRotation): number {
  return (
    m[0] * (m[4] * m[8] - m[5] * m[7]) -
    m[1] * (m[3] * m[8] - m[5] * m[6]) +
    m[2] * (m[3] * m[7] - m[4] * m[6])
  );
}

/** The 24 proper rotations of a cube, identity first, in a fixed order. */
export const CUBE_ROTATIONS: readonly CubeRotation[] = (() => {
  const out: CubeRotation[] = [];
  for (const p of PERMUTATIONS) {
    for (let signs = 0; signs < 8; signs++) {
      const m = [0, 0, 0, 0, 0, 0, 0, 0, 0];
      for (let row = 0; row < 3; row++) m[row * 3 + p[row]!] = signs & (1 << row) ? -1 : 1;
      const r = m as unknown as CubeRotation;
      if (det(r) === 1) out.push(r);
    }
  }
  return out;
})();

export function applyRotation(m: CubeRotation, v: Axis): [number, number, number] {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

const sameAxis = (a: Axis, b: Axis) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

/** The six signed unit axes, in the order +X, −X, +Y, −Y, +Z, −Z. */
export const UNIT_AXES: readonly Axis[] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

export interface UpResult {
  /** The body's local axis that points most nearly straight up. */
  axis: Axis;
  /** Angle between that axis and world up, in radians. */
  tilt: number;
}

/** Which local axis of a body with world orientation `q` points up. */
export function upAxis(q: { x: number; y: number; z: number; w: number }): UpResult {
  // World up expressed in body coordinates: q⁻¹ · (0, 1, 0).
  const up = new Vector3(0, 1, 0).applyQuaternion(new Quaternion(q.x, q.y, q.z, q.w).invert());
  let best = UNIT_AXES[0]!;
  let bestDot = -Infinity;
  for (const a of UNIT_AXES) {
    const d = a[0] * up.x + a[1] * up.y + a[2] * up.z;
    if (d > bestDot) {
      bestDot = d;
      best = a;
    }
  }
  return { axis: best, tilt: Math.acos(Math.min(1, Math.max(-1, bestDot))) };
}

/**
 * The first cube rotation (in CUBE_ROTATIONS order) that carries the model axis of `value`
 * onto the body axis `up`. Used as the model's fixed rotation inside its physics body.
 */
export function remapFor(value: DieValue, up: Axis): CubeRotation {
  const from = DIE_FACE_AXES[value];
  const r = CUBE_ROTATIONS.find((m) => sameAxis(applyRotation(m, from), up));
  if (!r) throw new Error(`remapFor: no rotation from ${from.join()} to ${up.join()}`);
  return r;
}

/** A cube rotation as a three.js quaternion (for the model inside the body). */
export function rotationQuaternion(m: CubeRotation): Quaternion {
  // Matrix4.set takes rows, matching CubeRotation's row-major layout.
  return new Quaternion().setFromRotationMatrix(
    new Matrix4().set(m[0], m[1], m[2], 0, m[3], m[4], m[5], 0, m[6], m[7], m[8], 0, 0, 0, 0, 1),
  );
}

/** The value facing up for a body orientation and a model rotation inside it. */
export function valueUp(
  q: { x: number; y: number; z: number; w: number },
  model: CubeRotation,
): DieValue {
  const { axis } = upAxis(q);
  for (const v of [1, 2, 3, 4, 5, 6] as const) {
    if (sameAxis(applyRotation(model, DIE_FACE_AXES[v]), axis)) return v;
  }
  throw new Error("valueUp: model rotation is not a cube rotation");
}
