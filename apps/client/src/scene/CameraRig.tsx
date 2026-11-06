// Glides the camera to a view preset when one is chosen (store/view.ts). The orbit controls
// stay live afterwards. Reduced motion jumps straight there.
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Vector3 } from "three";
import { useViewStore } from "../store/view.ts";
import { useReducedMotion } from "./motion.ts";
import { fitPosition } from "./useFitCamera.ts";
import { POSES, easeOut, poseToPosition } from "./viewPresets.ts";

const GLIDE_MS = 450;

export function CameraRig({ distance, elevation }: { distance: number; elevation?: number }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as {
    target: Vector3;
    update: () => void;
  } | null;
  const reduced = useReducedMotion();
  const nonce = useViewStore((s) => s.nonce);
  const glide = useRef<{ from: Vector3; to: Vector3; start: number | null } | null>(null);

  useEffect(() => {
    if (nonce === 0) return;
    const { preset } = useViewStore.getState();
    const toArr =
      preset === "free"
        ? fitPosition(distance, elevation)
        : poseToPosition(POSES[preset], distance);
    const to = new Vector3(...toArr);
    if (reduced) {
      camera.position.copy(to);
      controls?.target.set(0, 0, 0);
      camera.lookAt(0, 0, 0);
      controls?.update();
      return;
    }
    glide.current = { from: camera.position.clone(), to, start: null };
  }, [nonce, distance, elevation, reduced, camera, controls]);

  useFrame(({ clock }) => {
    const g = glide.current;
    if (!g) return;
    const now = clock.elapsedTime * 1000;
    g.start ??= now;
    const t = easeOut((now - g.start) / GLIDE_MS);
    // Interpolate on the sphere (direction and length) so the glide arcs over the board.
    const from = g.from.clone();
    const dir = from.clone().normalize().lerp(g.to.clone().normalize(), t).normalize();
    const len = from.length() + (g.to.length() - from.length()) * t;
    camera.position.copy(dir.multiplyScalar(len));
    controls?.target.lerp(new Vector3(0, 0, 0), t);
    camera.lookAt(controls?.target ?? new Vector3());
    controls?.update();
    if (t >= 1) glide.current = null;
  });
  return null;
}
