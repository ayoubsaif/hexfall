// Touchpad and touchscreen camera input on top of OrbitControls (specs/camera-gestures).
// Wheel: touchpad scroll, pinch and mouse wheel zoom around the fixed board center. The listener lives on the canvas
// only (passive: false) so the page never scrolls or zooms under the board. Touch: tracks
// multi-touch so a two-finger release never counts as a pick.
import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { Spherical, Vector3 } from "three";
import {
  type Pair,
  applyTwoFinger,
  classifyWheel,
  twoFingerDelta,
  zoomFactor,
} from "./gestures.ts";

interface Controls {
  target: Vector3;
  minDistance: number;
  maxDistance: number;
  minPolarAngle: number;
  maxPolarAngle: number;
  minAzimuthAngle: number;
  maxAzimuthAngle: number;
  update: () => void;
}

/** Time of the last gesture that used two or more pointers (ms, performance.now clock). */
let lastMultiTouch = -Infinity;
/** True for 250 ms after a multi-touch gesture, so its release is not a tap. */
export function wasMultiTouch(now = performance.now()): boolean {
  return now - lastMultiTouch < 250;
}

export function useGestures(): void {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as Controls | null;

  useEffect(() => {
    const el = gl.domElement;
    el.style.touchAction = "none";
    const onWheel = (e: WheelEvent) => {
      if (!controls) return;
      e.preventDefault();
      const kind = classifyWheel(e);
      const offset = camera.position.clone().sub(controls.target);
      const len = Math.min(
        controls.maxDistance,
        Math.max(controls.minDistance, offset.length() * zoomFactor(e.deltaY, kind === "pinch")),
      );
      camera.position.copy(controls.target).add(offset.setLength(len));
      controls.update();
    };
    // Touch: one finger orbits the center (OrbitControls). Two fingers are handled
    // here: pinch zooms, twist turns the map, dragging both up or down tilts the view.
    const pointers = new Map<number, { x: number; y: number }>();
    const pair = (): Pair | null => {
      if (pointers.size !== 2) return null;
      const [a, b] = [...pointers.values()] as [{ x: number; y: number }, { x: number; y: number }];
      return { ax: a.x, ay: a.y, bx: b.x, by: b.y };
    };
    const down = (e: PointerEvent) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size > 1) lastMultiTouch = performance.now();
    };
    const move = (e: PointerEvent) => {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      const before = pair();
      p.x = e.clientX;
      p.y = e.clientY;
      const after = pair();
      if (!controls || e.pointerType !== "touch" || !before || !after) return;
      lastMultiTouch = performance.now();
      const offset = camera.position.clone().sub(controls.target);
      const s = new Spherical().setFromVector3(offset);
      const next = applyTwoFinger(
        { distance: s.radius, polar: s.phi, azimuth: s.theta },
        twoFingerDelta(before, after),
        {
          minDistance: controls.minDistance,
          maxDistance: controls.maxDistance,
          minPolar: controls.minPolarAngle,
          maxPolar: controls.maxPolarAngle,
          minAzimuth: controls.minAzimuthAngle,
          maxAzimuth: controls.maxAzimuthAngle,
        },
      );
      s.set(next.distance, next.polar, next.azimuth);
      camera.position.copy(controls.target).add(offset.setFromSpherical(s));
      controls.update();
    };
    const up = (e: PointerEvent) => {
      if (pointers.size > 1) lastMultiTouch = performance.now();
      pointers.delete(e.pointerId);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.style.touchAction = "";
    };
  }, [gl, camera, controls]);
}
