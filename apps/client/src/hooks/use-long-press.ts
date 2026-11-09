// Press-and-hold on touch (openspec tutorial-mode-and-rules-guide, specs/hover-cards "Press and
// hold on touch"; design decision 2). Mouse and pen are ignored: they use hover. After the hold
// fires, the click that follows the release is swallowed so the trigger's tap action does not run.
import { type PointerEvent, type MouseEvent, useCallback, useEffect, useRef } from "react";

export const LONG_PRESS_MS = 450;
export const LONG_PRESS_SLOP_PX = 10;

interface Point {
  x: number;
  y: number;
}

/** Whether a finger moved from `a` to `b` beyond the slop. */
export function movedTooFar(a: Point, b: Point): boolean {
  return Math.hypot(b.x - a.x, b.y - a.y) > LONG_PRESS_SLOP_PX;
}

export interface LongPressHandlers {
  onPointerDown: (e: PointerEvent<HTMLElement>) => void;
  onPointerMove: (e: PointerEvent<HTMLElement>) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
  onClickCapture: (e: MouseEvent<HTMLElement>) => void;
  onContextMenu: (e: MouseEvent<HTMLElement>) => void;
}

/** Handlers to spread on the trigger; `onLongPress` runs once per hold. */
export function useLongPress(onLongPress: () => void, enabled = true): LongPressHandlers {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  const callback = useRef(onLongPress);
  callback.current = onLongPress;

  const clear = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
  }, []);

  useEffect(() => clear, [clear]);

  return {
    onPointerDown: (e) => {
      if (!enabled || e.pointerType !== "touch") return;
      clear();
      fired.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      timer.current = setTimeout(() => {
        timer.current = null;
        fired.current = true;
        callback.current();
      }, LONG_PRESS_MS);
    },
    onPointerMove: (e) => {
      const s = start.current;
      if (s && timer.current !== null && movedTooFar(s, { x: e.clientX, y: e.clientY })) clear();
    },
    onPointerUp: clear,
    onPointerCancel: clear,
    onClickCapture: (e) => {
      if (!fired.current) return;
      fired.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
    onContextMenu: (e) => {
      if (enabled && (timer.current !== null || fired.current)) e.preventDefault();
    },
  };
}
