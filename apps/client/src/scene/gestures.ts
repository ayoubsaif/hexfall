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
