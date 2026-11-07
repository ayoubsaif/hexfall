// Harbor sail turn (specs/board-view "Harbor markers"): the sail, with its yard and sheets,
// turns about the mast's vertical axis so its labelled face (+X in the hull frame) points
// toward the camera, and leans back from its foot by part of the camera's elevation so the
// label stays readable from above. Everything is in the hull frame, so the boat's own placement and the
// theme's transform drop out. Pure, so it is unit-testable.
import { Matrix4 } from "three";
import { cameraYaw } from "./chipYaw.ts";

interface XZ {
  readonly x: number;
  readonly z: number;
}

interface XYZ extends XZ {
  readonly y: number;
}

/** Share of the camera's elevation the sail leans back by, and the most it ever leans. */
export const TILT_SHARE = 0.4;
export const MAX_TILT = (25 * Math.PI) / 180;

/**
 * Camera heading as seen from the pivot, in the hull frame: the angle that turns +Z toward
 * the camera (as `cameraYaw`). Keeps `previous` when the camera is right above the pivot.
 */
export function sailHeading(cameraLocal: XZ, pivot: XZ, previous: number): number {
  return cameraYaw(cameraLocal, pivot, previous);
}

/** Rig turn for a heading: the sail faces +X, a quarter turn from the chip's +Z. */
export function sailTurn(heading: number): number {
  return heading - Math.PI / 2;
}

/**
 * Lean-back for a camera seen from the sail's foot (pivot), in the hull frame: a share of
 * the camera's elevation angle, never negative and never more than `MAX_TILT`.
 */
export function sailTilt(cameraLocal: XYZ, pivot: XYZ): number {
  const across = Math.hypot(cameraLocal.x - pivot.x, cameraLocal.z - pivot.z);
  const elevation = Math.atan2(cameraLocal.y - pivot.y, across);
  return Math.min(MAX_TILT, Math.max(0, elevation * TILT_SHARE));
}

const toPivot = new Matrix4();
const turn = new Matrix4();
const lean = new Matrix4();
const fromPivot = new Matrix4();

/**
 * Writes `T(pivot) · R_y(angle) · R_z(tilt) · T(−pivot) · original` into `out` (no
 * allocation). A positive tilt leans the top toward −X, so the +X face looks up.
 */
export function turnAbout(
  out: Matrix4,
  original: Matrix4,
  pivot: XYZ,
  angle: number,
  tilt = 0,
): Matrix4 {
  toPivot.makeTranslation(pivot.x, pivot.y, pivot.z);
  turn.makeRotationY(angle);
  lean.makeRotationZ(tilt);
  fromPivot.makeTranslation(-pivot.x, -pivot.y, -pivot.z);
  return out.copy(toPivot).multiply(turn).multiply(lean).multiply(fromPivot).multiply(original);
}
