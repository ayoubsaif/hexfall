// Reports when the board has finished loading (store/sceneReady.ts). "Finished" means: the theme
// manifest resolved, the canvas drew a frame, and the three.js loading manager (textures, models,
// water and coast maps) has been idle for SETTLE_MS. A hung load cannot trap the player: after
// MAX_WAIT_MS the board is shown anyway.
import { useProgress } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useState } from "react";
import { resetSceneReady, setSceneProgress, setSceneReady } from "../store/sceneReady.ts";
import { useTheme } from "../theme/index.ts";

export const SETTLE_MS = 600;
export const MAX_WAIT_MS = 20_000;

export function ReadyProbe() {
  const themeReady = useTheme().status === "ready";
  const active = useProgress((s) => s.active);
  const progress = useProgress((s) => s.progress);
  const total = useProgress((s) => s.total);
  const [drew, setDrew] = useState(false);
  useFrame(() => {
    if (!drew) setDrew(true);
  });
  useEffect(() => {
    setSceneProgress(total > 0 ? Math.min(1, progress / 100) : undefined);
  }, [progress, total]);
  useEffect(() => {
    if (!themeReady || !drew || active) return;
    const id = setTimeout(() => setSceneReady(true), SETTLE_MS);
    return () => clearTimeout(id);
  }, [themeReady, drew, active]);
  useEffect(() => {
    const id = setTimeout(() => setSceneReady(true), MAX_WAIT_MS);
    return () => {
      clearTimeout(id);
      // Leaving the room (or hot reload): the next entry shows the splash again.
      resetSceneReady();
    };
  }, []);
  return null;
}
