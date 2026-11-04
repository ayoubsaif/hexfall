// Turn timer: pure helpers (change floating-hud-turn-timer, design.md decision 2).
// The deadline is never stored: it is `anchor + duration(waitKind)`, where the anchor
// is the `at` of the last action that restarted the timer (or the game's start time).
import type { Action, GameState, Seat } from "@hexfall/engine";
import { TURN_TIMER_PRESETS, type TimerInfo, type TurnTimerPreset } from "@hexfall/protocol";
import type { ActionRecord } from "../store/types.ts";

export type WaitKind = "roll" | "action";

/** What the game waits for: a dice roll (or roll for order), any other move, or nothing. */
export function waitKind(s: GameState): WaitKind | null {
  switch (s.phase.kind) {
    case "rollForOrder":
      return "roll";
    case "turn":
      return s.turn.rolled ? "action" : "roll";
    case "ended":
      return null;
    default:
      return "action";
  }
}

/** Seats the game is waiting for (the seats a timeout would act for). */
export function waitingSeats(s: GameState): Seat[] {
  const phase = s.phase;
  switch (phase.kind) {
    case "rollForOrder":
      return phase.contenders.filter((c) => phase.rolls[c] === null);
    case "discard": {
      const out: Seat[] = [];
      phase.owed.forEach((n, seat) => {
        if (n > 0) out.push(seat);
      });
      return out;
    }
    case "ended":
      return [];
    default:
      return [s.turn.seat];
  }
}

/**
 * Whether accepting `action` (taking `before` to `after`) restarts the deadline: the phase
 * or the active player changed, or the actor was a seat the game was waiting for. A
 * timeout always restarts it.
 */
export function restartsTimer(before: GameState, action: Action, after: GameState): boolean {
  if (action.type === "timeout") return true;
  if (before.phase.kind !== after.phase.kind || before.turn.seat !== after.turn.seat) return true;
  if (action.seat === before.turn.seat) return true;
  return before.phase.kind === "discard" && (before.phase.owed[action.seat] ?? 0) > 0;
}

/** The anchor after applying `record`. Records without `at` (stored before the timer) use `fallback`. */
export function nextAnchor(
  anchor: number,
  before: GameState,
  record: ActionRecord,
  after: GameState,
  fallback: number,
): number {
  return restartsTimer(before, record.action, after) ? (record.at ?? fallback) : anchor;
}

/** Full duration of the current wait, or null when there is no countdown. */
export function durationOf(s: GameState, preset: TurnTimerPreset): number | null {
  if (preset === "off") return null;
  const kind = waitKind(s);
  return kind === null ? null : TURN_TIMER_PRESETS[preset][kind];
}

/** Server-clock deadline for the current wait, or null when there is none. */
export function deadlineOf(s: GameState, anchor: number, preset: TurnTimerPreset): number | null {
  const d = durationOf(s, preset);
  return d === null ? null : anchor + d;
}

/** The countdown as sent to clients, measured at `now`. */
export function timerInfo(
  s: GameState,
  anchor: number,
  preset: TurnTimerPreset,
  now: number,
): TimerInfo {
  const kind = waitKind(s);
  const durationMs = durationOf(s, preset);
  if (kind === null || durationMs === null) return null;
  return {
    kind,
    durationMs,
    remainingMs: Math.min(durationMs, Math.max(0, Math.round(anchor + durationMs - now))),
    seats: waitingSeats(s),
  };
}
