// Board style setting: "3d" draws the diorama look (3D procedural props for tiles, sea,
// token and harbors); "flat" draws flat shapes, painted with theme images when mapped
// (lighter, aimed at mobile). Piece (model) keys are unaffected by the style.
import { create } from "zustand";

export type BoardStyle = "flat" | "3d";

export const BOARD_STYLES: readonly BoardStyle[] = ["flat", "3d"];

/** localStorage key holding the viewer's chosen style. */
export const BOARD_STYLE_STORAGE_KEY = "hexfall.boardStyle";

/** Viewports whose smaller side is below this (CSS px) default to "flat". */
export const SMALL_SCREEN_MIN_SIDE = 768;

export function isBoardStyle(value: unknown): value is BoardStyle {
  return value === "flat" || value === "3d";
}

/**
 * Initial style: a valid stored value wins; otherwise "flat" on a coarse pointer
 * (touch) or a small screen, else "3d".
 */
export function resolveInitialStyle(env: {
  stored: unknown;
  coarsePointer: boolean;
  smallScreen: boolean;
}): BoardStyle {
  if (isBoardStyle(env.stored)) return env.stored;
  return env.coarsePointer || env.smallScreen ? "flat" : "3d";
}

/** Minimal storage surface (localStorage in the browser, a fake in tests). */
export type StyleStorage = Pick<Storage, "getItem" | "setItem">;

function defaultStorage(): StyleStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // Accessing localStorage itself can throw (blocked site data).
  }
}

/** Reads the stored style; any storage error reads as "nothing stored". */
export function readStoredStyle(storage: StyleStorage | null = defaultStorage()): unknown {
  try {
    return storage?.getItem(BOARD_STYLE_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

/** Persists the style; returns false (and keeps going) when storage is unavailable. */
export function writeStoredStyle(
  style: BoardStyle,
  storage: StyleStorage | null = defaultStorage(),
): boolean {
  try {
    if (!storage) return false;
    storage.setItem(BOARD_STYLE_STORAGE_KEY, style);
    return true;
  } catch {
    return false;
  }
}

function mediaMatches(query: string): boolean {
  try {
    return typeof matchMedia === "function" && matchMedia(query).matches;
  } catch {
    return false;
  }
}

/** Reads the environment (storage, pointer, viewport) and resolves the initial style. */
export function detectInitialStyle(storage: StyleStorage | null = defaultStorage()): BoardStyle {
  const w = typeof innerWidth === "number" ? innerWidth : Infinity;
  const h = typeof innerHeight === "number" ? innerHeight : Infinity;
  return resolveInitialStyle({
    stored: readStoredStyle(storage),
    coarsePointer: mediaMatches("(pointer: coarse)"),
    smallScreen: Math.min(w, h) < SMALL_SCREEN_MIN_SIDE,
  });
}

interface BoardStyleState {
  style: BoardStyle;
  setStyle: (style: BoardStyle) => void;
}

export const useBoardStyleStore = create<BoardStyleState>()((set) => ({
  style: detectInitialStyle(),
  setStyle: (style) => {
    if (!isBoardStyle(style)) return;
    writeStoredStyle(style);
    set({ style });
  },
}));

/** The active board style and its setter (the setter persists the choice). */
export function useBoardStyle(): BoardStyleState {
  const style = useBoardStyleStore((s) => s.style);
  const setStyle = useBoardStyleStore((s) => s.setStyle);
  return { style, setStyle };
}
