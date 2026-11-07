// Whether the 3D board has finished loading its assets (openspec change settlecoast-parchment-ui,
// "Splash screen"): the splash stays up until then, so the board never pops in piece by piece.
// Written by scene/BoardCanvas.tsx once the three.js loading manager has been idle for a moment.
import { create } from "zustand";

export interface SceneReadyState {
  ready: boolean;
  /** 0..1 over everything the loading manager has seen, or undefined before any load starts. */
  progress: number | undefined;
}

export const useSceneReady = create<SceneReadyState>()(() => ({
  ready: false,
  progress: undefined,
}));

export function setSceneReady(ready: boolean): void {
  if (useSceneReady.getState().ready !== ready) useSceneReady.setState({ ready });
}

export function setSceneProgress(progress: number | undefined): void {
  if (useSceneReady.getState().progress !== progress) useSceneReady.setState({ progress });
}

export function resetSceneReady(): void {
  useSceneReady.setState({ ready: false, progress: undefined });
}
