// Viewer preferences kept per browser (specs/game-audio "Mute setting", specs/turn-notifications
// "Notification opt-in", specs/client-settings "Preferences storage"). Each field is validated
// on its own, so older records keep their values. Storage errors never break the settings: the
// choice then lasts for this page session only.
import { AVATAR_IDS, type AvatarId } from "@hexfall/protocol";
import { create } from "zustand";

export const GRAPHICS_MODES = ["classic", "realistic"] as const;
export type GraphicsMode = (typeof GRAPHICS_MODES)[number];
export const GRAPHICS_QUALITIES = ["auto", "low", "medium", "high"] as const;
export type GraphicsQuality = (typeof GRAPHICS_QUALITIES)[number];

export interface Prefs {
  graphicsMode: GraphicsMode;
  graphicsQuality: GraphicsQuality;
  /** Game sounds on (default) or muted. */
  sound: boolean;
  /** Turn notifications wanted (default off; also needs browser permission). */
  notify: boolean;
  /** Master volume of game sounds, 0..1 in steps of 0.05 (default 0.6). */
  volume: number;
  /** Motion choice; "system" follows `prefers-reduced-motion`. */
  motion: MotionPref;
  /** Plain wheel events over the board: "auto" detects touchpads (pan), "zoom" always zooms. */
  wheel: WheelPref;
  /** Last avatar picked (player-avatars); sent when creating or joining a room. */
  avatar: AvatarId | null;
}

export type WheelPref = "auto" | "zoom";
export const WHEEL_PREFS: readonly WheelPref[] = ["auto", "zoom"];

export type MotionPref = "system" | "reduce" | "full";
export const MOTION_PREFS: readonly MotionPref[] = ["system", "reduce", "full"];
export const VOLUME_STEP = 0.05;

/** Clamps to 0..1 and snaps to the 0.05 grid; null when not a finite number. */
export function normalizeVolume(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const clamped = Math.min(1, Math.max(0, value));
  return Math.round(clamped / VOLUME_STEP) / (1 / VOLUME_STEP);
}

export const PREFS_STORAGE_KEY = "hexfall.prefs";
export const DEFAULT_PREFS: Prefs = {
  graphicsMode: "realistic",
  graphicsQuality: "auto",
  sound: true,
  notify: false,
  volume: 0.6,
  motion: "system",
  wheel: "auto",
  avatar: null,
};

export type PrefsStorage = Pick<Storage, "getItem" | "setItem">;

function defaultStorage(): PrefsStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function readPrefs(storage: PrefsStorage | null = defaultStorage()): Prefs {
  try {
    const raw = storage?.getItem(PREFS_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object") return { ...DEFAULT_PREFS };
    const p = parsed as Partial<Record<keyof Prefs, unknown>>;
    return {
      graphicsMode: GRAPHICS_MODES.includes(p.graphicsMode as GraphicsMode)
        ? (p.graphicsMode as GraphicsMode)
        : DEFAULT_PREFS.graphicsMode,
      graphicsQuality: GRAPHICS_QUALITIES.includes(p.graphicsQuality as GraphicsQuality)
        ? (p.graphicsQuality as GraphicsQuality)
        : DEFAULT_PREFS.graphicsQuality,
      sound: typeof p.sound === "boolean" ? p.sound : DEFAULT_PREFS.sound,
      notify: typeof p.notify === "boolean" ? p.notify : DEFAULT_PREFS.notify,
      volume: normalizeVolume(p.volume) ?? DEFAULT_PREFS.volume,
      motion: MOTION_PREFS.includes(p.motion as MotionPref)
        ? (p.motion as MotionPref)
        : DEFAULT_PREFS.motion,
      wheel: WHEEL_PREFS.includes(p.wheel as WheelPref)
        ? (p.wheel as WheelPref)
        : DEFAULT_PREFS.wheel,
      avatar: AVATAR_IDS.includes(p.avatar as AvatarId) ? (p.avatar as AvatarId) : null,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function writePrefs(prefs: Prefs, storage: PrefsStorage | null = defaultStorage()): void {
  try {
    storage?.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Blocked storage: keep the in-memory choice only.
  }
}

export const usePrefsStore = create<Prefs>()(() => readPrefs());

export function setPref<K extends keyof Prefs>(key: K, value: Prefs[K]): void {
  usePrefsStore.setState({ [key]: value } as Pick<Prefs, K>);
  writePrefs(usePrefsStore.getState());
}
