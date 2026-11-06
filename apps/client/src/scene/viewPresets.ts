// Pure camera poses for the view presets. Row 1 of the board is on top in every view.
import type { ViewPreset } from "../store/view.ts";

export interface Pose {
  /** Degrees above the board plane. */
  elevation: number;
  /** Degrees turned around the island from the +Z side. */
  azimuth: number;
}

/** Straight down is degenerate for the orbit math, so "top" stops a hair short of it. */
export const POSES: Record<Exclude<ViewPreset, "free">, Pose> = {
  top: { elevation: 89, azimuth: 0 },
  diagonal: { elevation: 32, azimuth: 40 },
};

export function poseToPosition(pose: Pose, distance: number): [number, number, number] {
  const e = (pose.elevation * Math.PI) / 180;
  const a = (pose.azimuth * Math.PI) / 180;
  return [
    distance * Math.cos(e) * Math.sin(a),
    distance * Math.sin(e),
    distance * Math.cos(e) * Math.cos(a),
  ];
}

/** Ease-out for the camera glide. */
export function easeOut(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return 1 - (1 - c) ** 3;
}
