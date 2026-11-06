// Keeps the HUD zoom bar and the camera in step (specs/camera-gestures "Zoom controls"):
// publishes the camera's zoom as a percent of the fitted view, and moves the camera when the
// bar asks for a zoom. 100 % is the fit distance; more is closer.
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Vector3 } from "three";
import { publishZoom, useViewStore } from "../store/view.ts";

interface Controls {
  target: Vector3;
  update: () => void;
}

/** Glide speed: fraction of the remaining (log) distance covered per second, as 1 - e^-k·t. */
const GLIDE_RATE = 9;

export function useZoomBridge(fit: number): void {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as Controls | null;
  const nonce = useViewStore((s) => s.zoomNonce);
  /** Distance the glide is heading for, and the distance it last set (to spot outside moves). */
  const goal = useRef<number | null>(null);
  const last = useRef(0);

  useFrame((_, delta) => {
    if (!controls || fit <= 0) return;
    let dist = camera.position.distanceTo(controls.target);
    if (goal.current !== null && dist > 0) {
      // Wheel, pinch or a preset moved the camera meanwhile: drop the glide.
      if (Math.abs(dist - last.current) > last.current * 0.01 && last.current > 0) {
        goal.current = null;
      } else {
        // Ease in log space so zooming in and out feel alike at any distance.
        const k = 1 - Math.exp(-GLIDE_RATE * Math.min(delta, 0.1));
        let next = dist * Math.exp(Math.log(goal.current / dist) * k);
        if (Math.abs(next - goal.current) < goal.current * 0.001) {
          next = goal.current;
          goal.current = null;
        }
        const dir = camera.position.clone().sub(controls.target).setLength(next);
        camera.position.copy(controls.target).add(dir);
        controls.update();
        last.current = dist = next;
      }
    }
    if (dist > 0) publishZoom((fit / dist) * 100);
  });

  useEffect(() => {
    if (nonce === 0 || !controls || fit <= 0) return;
    const percent = useViewStore.getState().zoomRequest;
    goal.current = fit / (percent / 100);
    last.current = camera.position.distanceTo(controls.target);
  }, [nonce, fit, camera, controls]);
}
