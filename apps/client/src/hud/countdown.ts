// Turn countdown (specs/game-hud "Turn countdown"; design decisions 4 and 5). The time left is
// the server's `remainingMs` added to the local receipt time, never a server timestamp. The
// value changes on whole seconds only, so nothing animates in between.
import type { Seat } from "@hexfall/engine";
import { useEffect, useState } from "react";
import type { T } from "../i18n/index.ts";
import { useGameStore } from "../store/game.ts";

/** At or below this many seconds the countdown turns to the warning color. */
export const WARNING_SECONDS = 10;

export interface Countdown {
  kind: "roll" | "action";
  /** Whole seconds left (rounded up), never negative. */
  secondsLeft: number;
  /** Time left as a share of the full duration, 0–1, stepped with `secondsLeft`. */
  fraction: number;
  warning: boolean;
  seats: Seat[];
}

/** Monotonic local clock (same source as `timerAt` in net/session.ts). */
export function localNow(): number {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

/** Pure: the countdown at local time `now`, or null without a timer. */
export function countdownAt(
  timer: {
    kind: "roll" | "action";
    durationMs: number;
    remainingMs: number;
    seats: Seat[];
  } | null,
  timerAt: number,
  now: number,
): Countdown | null {
  if (!timer) return null;
  const leftMs = Math.max(0, timer.remainingMs - (now - timerAt));
  const secondsLeft = Math.ceil(leftMs / 1000);
  const durationS = Math.max(1, Math.ceil(timer.durationMs / 1000));
  return {
    kind: timer.kind,
    secondsLeft,
    fraction: Math.min(1, secondsLeft / durationS),
    warning: secondsLeft <= WARNING_SECONDS,
    seats: timer.seats,
  };
}

/** "38 seconds left" / "1 second left", in the active language. */
export function countdownText(secondsLeft: number, t: T): string {
  return t("game.countdown", { count: secondsLeft });
}

/**
 * The live countdown. Re-renders at most once per second, on the second boundary, and
 * resets whenever a new snapshot or update arrives.
 */
export function useCountdown(): Countdown | null {
  const timer = useGameStore((s) => s.timer);
  const timerAt = useGameStore((s) => s.timerAt);
  const [now, setNow] = useState(localNow);

  useEffect(() => {
    setNow(localNow());
    if (!timer) return;
    let id: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      const t = localNow();
      const leftMs = timer.remainingMs - (t - timerAt);
      if (leftMs <= 0) return;
      // Wake on the next whole-second boundary of the remaining time (timers never fire early;
      // if one does, the next pass reschedules for the few ms left).
      const delay = leftMs % 1000 || 1000;
      id = setTimeout(() => {
        setNow(localNow());
        schedule();
      }, delay);
    };
    schedule();
    return () => clearTimeout(id);
  }, [timer, timerAt]);

  return countdownAt(timer, timerAt, now);
}
