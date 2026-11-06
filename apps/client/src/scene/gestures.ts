// Pure camera-gesture rules (openspec improve-touch-camera-and-hud-layout, specs/camera-gestures):
// which wheel events are a touchpad pan, a pinch or a mouse-wheel zoom, and the tap threshold.

export type WheelKind = "pan" | "pinch" | "zoom";
export type WheelMode = "auto" | "zoom";

export interface WheelLike {
  deltaX: number;
  deltaY: number;
  deltaMode: number;
  ctrlKey: boolean;
}

/**
 * Classifies a wheel event. Pinch on a touchpad arrives with `ctrlKey`. A touchpad two-finger
 * scroll has pixel deltas that are fractional, have a horizontal part, or are small; a notched
 * mouse wheel reports lines or large whole steps (100, 120 ...). In "zoom" mode every plain
 * wheel event zooms.
 */
export function classifyWheel(e: WheelLike, mode: WheelMode = "auto"): WheelKind {
  if (e.ctrlKey) return "pinch";
  if (mode === "zoom") return "zoom";
  if (e.deltaMode !== 0) return "zoom";
  const whole = Number.isInteger(e.deltaY) && Number.isInteger(e.deltaX);
  if (e.deltaX !== 0 || !whole || Math.abs(e.deltaY) < 50) return "pan";
  return "zoom";
}

/** Pointer travel (px) above which a press is a camera drag, not a tap. */
export const DRAG_PX = { mouse: 3, pen: 3, touch: 6 } as const;

export function dragThreshold(pointerType: string | undefined): number {
  return pointerType === "touch" ? DRAG_PX.touch : DRAG_PX.mouse;
}

/** Zoom factor for a wheel delta: positive deltaY zooms out. Pinch events are smaller steps. */
export function zoomFactor(deltaY: number, pinch: boolean): number {
  const k = pinch ? 0.01 : 0.0015;
  return Math.exp(deltaY * k);
}

/** Two touch points on screen (CSS px). */
export interface Pair {
  ax: number;
  ay: number;
  bx: number;
  by: number;
}

/** What a two-finger move did: pinch scale, twist (rad, clockwise on screen) and midpoint drop (px). */
export interface TwoFingerDelta {
  scale: number;
  twist: number;
  dy: number;
}

/** Wraps an angle difference into (-PI, PI] so a twist across the atan2 seam is small. */
function wrap(a: number): number {
  return a - 2 * Math.PI * Math.round(a / (2 * Math.PI));
}

/** Compares two finger positions: pinch, twist and vertical drag of the midpoint. */
export function twoFingerDelta(prev: Pair, next: Pair): TwoFingerDelta {
  const d0 = Math.hypot(prev.bx - prev.ax, prev.by - prev.ay);
  const d1 = Math.hypot(next.bx - next.ax, next.by - next.ay);
  const a0 = Math.atan2(prev.by - prev.ay, prev.bx - prev.ax);
  const a1 = Math.atan2(next.by - next.ay, next.bx - next.ax);
  return {
    scale: d0 > 0 && d1 > 0 ? d1 / d0 : 1,
    twist: wrap(a1 - a0),
    dy: (next.ay + next.by) / 2 - (prev.ay + prev.by) / 2,
  };
}

/** Radians of tilt per pixel of two-finger vertical drag. */
export const TILT_PER_PX = 0.005;
/** Twist below this (rad) is ignored, so a pinch or a tilt does not also spin the map. */
export const TWIST_DEADZONE = 0.004;

export interface OrbitLimits {
  minDistance: number;
  maxDistance: number;
  minPolar: number;
  maxPolar: number;
  minAzimuth: number;
  maxAzimuth: number;
}

/**
 * New orbit (distance, polar angle from straight up, azimuth) after a two-finger move,
 * Google Maps style: pinch zooms, twist turns the map, dragging both fingers up tilts toward
 * the horizon and down toward top-down. Every value stays within the limits.
 */
export function applyTwoFinger(
  orbit: { distance: number; polar: number; azimuth: number },
  d: TwoFingerDelta,
  lim: OrbitLimits,
): { distance: number; polar: number; azimuth: number } {
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const twist = Math.abs(d.twist) < TWIST_DEADZONE ? 0 : d.twist;
  return {
    distance: clamp(orbit.distance / d.scale, lim.minDistance, lim.maxDistance),
    polar: clamp(orbit.polar - d.dy * TILT_PER_PX, lim.minPolar, lim.maxPolar),
    // A clockwise twist turns the map clockwise: the camera orbits the other way.
    azimuth: clamp(orbit.azimuth + twist, lim.minAzimuth, lim.maxAzimuth),
  };
}
