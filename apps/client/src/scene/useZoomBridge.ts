// Keeps the HUD zoom bar and the camera in step (specs/camera-gestures "Zoom controls"):
// publishes the camera's zoom as a percent of the fitted view, and moves the camera when the
// bar asks for a zoom. 100 % is the fit distance; more is closer.
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { Vector3 } from "three";
import { publishZoom, useViewStore } from "../store/view.ts";

interface Controls {
  target: Vector3;
  update: () => void;
}

export function useZoomBridge(fit: number): void {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as Controls | null;
  const nonce = useViewStore((s) => s.zoomNonce);

  useFrame(() => {
    if (!controls || fit <= 0) return;
    const dist = camera.position.distanceTo(controls.target);
    if (dist > 0) publishZoom((fit / dist) * 100);
  });

  useEffect(() => {
    if (nonce === 0 || !controls || fit <= 0) return;
    const percent = useViewStore.getState().zoomRequest;
    const dir = camera.position.clone().sub(controls.target);
    if (dir.lengthSq() === 0) return;
    camera.position.copy(controls.target).add(dir.setLength(fit / (percent / 100)));
    controls.update();
  }, [nonce, fit, camera, controls]);
}
