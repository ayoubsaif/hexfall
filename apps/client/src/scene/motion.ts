// Board motion (specs/board-interaction, "Board motion"; design.md decision 6).
// Timing and "what animates" are pure functions; components only drive them per frame.
import type { Board, GameEvent, HexId } from "@hexfall/engine";
import { useSyncExternalStore } from "react";
import type { WriteSource } from "../store/game.ts";

export const DROP_MS = 300;
export const DROP_HEIGHT = 0.6;
export const ROBBER_MS = 450;
export const ROBBER_ARC = 0.35;
export const GLOW_MS = 1200;

export interface MotionDurations {
  drop: number;
  robber: number;
  glow: number;
}

/** All durations are 0 when the user prefers reduced motion. */
export function motionDurations(reduced: boolean): MotionDurations {
  return reduced
    ? { drop: 0, robber: 0, glow: 0 }
    : { drop: DROP_MS, robber: ROBBER_MS, glow: GLOW_MS };
}

/** Progress 0..1 of an animation; a zero duration is always finished. */
export function progress(elapsedMs: number, durationMs: number): number {
  if (durationMs <= 0) return 1;
  return Math.min(1, Math.max(0, elapsedMs / durationMs));
}

export function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

/** Height above the resting place of a dropping piece. */
export function dropOffset(elapsedMs: number, durationMs: number): number {
  return DROP_HEIGHT * (1 - easeOutCubic(progress(elapsedMs, durationMs)));
}

export type XYZ = readonly [number, number, number];

/** Robber position along a straight line with a small arc. */
export function robberPath(
  from: readonly [number, number],
  to: readonly [number, number],
  elapsedMs: number,
  durationMs: number,
): XYZ {
  const t = progress(elapsedMs, durationMs);
  const e = t * t * (3 - 2 * t); // smoothstep
  return [
    from[0] + (to[0] - from[0]) * e,
    t >= 1 ? 0 : ROBBER_ARC * Math.sin(Math.PI * t),
    from[1] + (to[1] - from[1]) * e,
  ];
}

/** Glow strength 0..1: rises fast, then fades out over the duration. */
export function glowStrength(elapsedMs: number, durationMs: number): number {
  const t = progress(elapsedMs, durationMs);
  if (t >= 1) return 0;
  return t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
}

/**
 * Pieces that should drop in: keys new since the previous render, but only for an
 * incremental update. The first render and snapshots (join, resume) show the board as is.
 */
export function newPieceKeys(
  prev: ReadonlySet<string> | null,
  next: Iterable<string>,
  source: WriteSource | null,
): Set<string> {
  const out = new Set<string>();
  if (prev === null || source !== "update") return out;
  for (const k of next) if (!prev.has(k)) out.add(k);
  return out;
}

/** Whether a robber move should tween (not on the first render or a snapshot). */
export function shouldTweenRobber(
  prevHex: HexId | null,
  nextHex: HexId,
  source: WriteSource | null,
): boolean {
  return prevHex !== null && prevHex !== nextHex && source === "update";
}

/**
 * Hexes that produced on the latest roll: the latest write was an update containing a
 * non-7 dice roll; every hex with that number except the robber's hex.
 */
export function producingHexes(
  board: Board,
  robber: HexId,
  lastEvents: readonly GameEvent[],
  source: WriteSource | null,
): HexId[] {
  if (source !== "update") return [];
  const roll = lastEvents.find((e) => e.type === "diceRolled");
  if (!roll || roll.type !== "diceRolled" || roll.total === 7) return [];
  const out: HexId[] = [];
  board.hexes.forEach((h, id) => {
    if (h.token === roll.total && id !== robber) out.push(id);
  });
  return out;
}

// ---- reduced-motion preference

const QUERY = "(prefers-reduced-motion: reduce)";

function mediaQuery(): MediaQueryList | null {
  return typeof matchMedia === "function" ? matchMedia(QUERY) : null;
}

export function prefersReducedMotion(): boolean {
  return mediaQuery()?.matches ?? false;
}

function subscribe(onChange: () => void): () => void {
  const mq = mediaQuery();
  if (!mq) return () => {};
  if (typeof mq.addEventListener === "function") {
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }
  mq.addListener(onChange);
  return () => mq.removeListener(onChange);
}

/** Reactive `prefers-reduced-motion: reduce` (false when matchMedia is missing). */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, prefersReducedMotion, () => false);
}
