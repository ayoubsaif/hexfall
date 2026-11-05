// Reduced-motion resolution (specs/client-settings "Motion preference"). Motion is reduced when
// the viewer chose "reduce", or chose "system" and the browser prefers reduced motion. The
// choice is mirrored to `<html data-motion>` so the `motion-reduce` / `motion-safe` CSS
// variants (style.css) follow it too.
import { useSyncExternalStore } from "react";
import { type MotionPref, usePrefsStore } from "./prefs.ts";

const QUERY = "(prefers-reduced-motion: reduce)";

function mediaQuery(): MediaQueryList | null {
  return typeof matchMedia === "function" ? matchMedia(QUERY) : null;
}

/** Pure rule: the stored choice and whether the browser asks for reduced motion. */
export function resolveReducedMotion(pref: MotionPref, systemReduce: boolean): boolean {
  return pref === "reduce" || (pref === "system" && systemReduce);
}

export function prefersReducedMotion(): boolean {
  return resolveReducedMotion(usePrefsStore.getState().motion, mediaQuery()?.matches ?? false);
}

function subscribe(onChange: () => void): () => void {
  const unsubPrefs = usePrefsStore.subscribe((s, prev) => {
    if (s.motion !== prev.motion) onChange();
  });
  const mq = mediaQuery();
  if (!mq) return unsubPrefs;
  if (typeof mq.addEventListener === "function") {
    mq.addEventListener("change", onChange);
    return () => {
      unsubPrefs();
      mq.removeEventListener("change", onChange);
    };
  }
  mq.addListener(onChange);
  return () => {
    unsubPrefs();
    mq.removeListener(onChange);
  };
}

/** Reactive reduced-motion flag: re-renders on a preference or media change. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, prefersReducedMotion, () => false);
}

let unmirror: (() => void) | null = null;

/** Keeps `<html data-motion>` equal to the motion choice. Safe to call twice. */
export function installMotionAttribute(
  root: HTMLElement | null = globalThis.document?.documentElement ?? null,
): void {
  if (!root || unmirror) return;
  root.dataset.motion = usePrefsStore.getState().motion;
  unmirror = usePrefsStore.subscribe((s) => {
    root.dataset.motion = s.motion;
  });
}

/** Tests: stop mirroring. */
export function resetMotionAttributeForTests(): void {
  unmirror?.();
  unmirror = null;
}
