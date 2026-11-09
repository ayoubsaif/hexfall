// Camera view presets (specs/board-view "View presets"): the free orbit view, a straight-down
// view centered on the island, and a diagonal view from the side.
import { create } from "zustand";

export type ViewPreset = "free" | "top" | "diagonal";

/** Zoom is shown in percent of the fitted view: 100 % = the whole island fits the screen. */
export const ZOOM_MIN = 85;
/** Zoom the board starts at and the view presets return to (a bit closer than the full fit). */
export const DEFAULT_ZOOM = 115;
export const ZOOM_MAX = 222; // camera at 0.45 x the fit distance (Scene minDistance)

export function clampZoom(percent: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(percent)));
}

const SOFT_KEY = "hexfall.softTiles";
const readSoft = (): boolean => {
  try {
    return localStorage.getItem(SOFT_KEY) !== "0";
  } catch {
    return true;
  }
};

interface ViewState {
  /** Land textures are softened (less contrast) so pieces and the robber stand out. */
  softTiles: boolean;
  preset: ViewPreset;
  /** Bumped on every request, so choosing the same preset again recenters. */
  nonce: number;
  /** The camera's current zoom (percent), published by the scene. */
  zoom: number;
  /** A zoom the user asked for (percent); `zoomNonce` bumps on every request. */
  zoomRequest: number;
  zoomNonce: number;
}

export const useViewStore = create<ViewState>()(() => ({
  softTiles: readSoft(),
  preset: "free",
  nonce: 0,
  zoom: DEFAULT_ZOOM,
  zoomRequest: DEFAULT_ZOOM,
  zoomNonce: 0,
}));

/** Scene -> store: the camera's zoom changed (wheel, pinch, preset glide). */
export function publishZoom(percent: number): void {
  const zoom = clampZoom(percent);
  if (useViewStore.getState().zoom !== zoom) useViewStore.setState({ zoom });
}

/** HUD -> scene: move the camera to `percent` zoom. */
export function requestZoom(percent: number): void {
  useViewStore.setState((s) => ({ zoomRequest: clampZoom(percent), zoomNonce: s.zoomNonce + 1 }));
}

export function setViewPreset(preset: ViewPreset): void {
  useViewStore.setState((s) => ({ preset, nonce: s.nonce + 1 }));
}

export function toggleSoftTiles(): void {
  const softTiles = !useViewStore.getState().softTiles;
  useViewStore.setState({ softTiles });
  try {
    localStorage.setItem(SOFT_KEY, softTiles ? "1" : "0");
  } catch {
    /* Not persisted; the choice still applies for this visit. */
  }
}
