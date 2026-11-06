// Touchpad and touchscreen camera input on top of OrbitControls (specs/camera-gestures).
// Wheel: touchpad two-finger scroll pans, pinch / wheel zooms. The listener lives on the canvas
// only (passive: false) so the page never scrolls or zooms under the board. Touch: tracks
// multi-touch so a two-finger release never counts as a pick.
import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { Vector3 } from "three";
import { usePrefsStore } from "../store/prefs.ts";
import { classifyWheel, zoomFactor } from "./gestures.ts";

interface Controls {
  target: Vector3;
  minDistance: number;
  maxDistance: number;
  update: () => void;
}

/** Time of the last gesture that used two or more pointers (ms, performance.now clock). */
let lastMultiTouch = -Infinity;
/** True for 250 ms after a multi-touch gesture, so its release is not a tap. */
export function wasMultiTouch(now = performance.now()): boolean {
  return now - lastMultiTouch < 250;
}

const PAN_LIMIT = 0.6; // of the camera distance, so the board never leaves the view
const _right = new Vector3();
const _up = new Vector3();

export function useGestures(): void {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as Controls | null;
  const wheelMode = usePrefsStore((s) => s.wheel);

  useEffect(() => {
    const el = gl.domElement;
    el.style.touchAction = "none";
    const onWheel = (e: WheelEvent) => {
      if (!controls) return;
      e.preventDefault();
      const kind = classifyWheel(e, wheelMode);
      const offset = camera.position.clone().sub(controls.target);
      if (kind === "pan") {
        const dist = offset.length();
        const perPx = (2 * dist * Math.tan((((camera as { fov?: number }).fov ?? 45) * Math.PI) / 360)) / el.clientHeight;
        camera.updateMatrixWorld();
        _right.setFromMatrixColumn(camera.matrixWorld, 0);
        _up.setFromMatrixColumn(camera.matrixWorld, 1);
        const move = _right.multiplyScalar(e.deltaX * perPx).add(_up.multiplyScalar(-e.deltaY * perPx));
        const next = controls.target.clone().add(move);
        if (next.length() > dist * PAN_LIMIT) next.setLength(dist * PAN_LIMIT);
        camera.position.add(next.clone().sub(controls.target));
        controls.target.copy(next);
      } else {
        const len = Math.min(
          controls.maxDistance,
          Math.max(controls.minDistance, offset.length() * zoomFactor(e.deltaY, kind === "pinch")),
        );
        camera.position.copy(controls.target).add(offset.setLength(len));
      }
      controls.update();
    };
    const pointers = new Set<number>();
    const down = (e: PointerEvent) => {
      pointers.add(e.pointerId);
      if (pointers.size > 1) lastMultiTouch = performance.now();
    };
    const up = (e: PointerEvent) => {
      if (pointers.size > 1) lastMultiTouch = performance.now();
      pointers.delete(e.pointerId);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.style.touchAction = "";
    };
  }, [gl, camera, controls, wheelMode]);
}
