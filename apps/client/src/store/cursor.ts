// Board canvas cursor (specs/pointer-affordances "Board canvas cursor states"):
// grabbing while the camera is dragged > pointer over a pickable target > grab when idle.
import { create } from "zustand";

export type CanvasCursor = "grab" | "grabbing" | "pointer";

interface CursorState {
  dragging: boolean;
  overTarget: boolean;
}

export const useCursorStore = create<CursorState>()(() => ({ dragging: false, overTarget: false }));

export function resolveCursor(s: CursorState): CanvasCursor {
  if (s.dragging) return "grabbing";
  if (s.overTarget) return "pointer";
  return "grab";
}

export function setCameraDragging(dragging: boolean): void {
  useCursorStore.setState({ dragging });
}

export function setOverTarget(overTarget: boolean): void {
  useCursorStore.setState({ overTarget });
}
