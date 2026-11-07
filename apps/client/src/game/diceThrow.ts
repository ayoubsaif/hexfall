// When the dice play their throw (openspec physics-dice-3d, specs board-dice "When the dice
// animate"): only for a new roll that arrived as an incremental update, never for a snapshot
// (join, resume), never under reduced motion, and never twice for one roll. Shared by the
// board dice and the HUD tray, so both agree on every roll.
import { DICE_THROW_MS } from "@hexfall/protocol";
import { useState } from "react";
import { prefersReducedMotion } from "../hud/cards/useCountChange.ts";
import { useGameStore } from "../store/game.ts";
import type { DiceRoll } from "./status.ts";

/** Longest throw on the board, from the roll arriving to the dice resting (ms). */
export const THROW_MS = DICE_THROW_MS;

export type ThrowMode = "animate" | "static";

/** Why the dice show the roll the way they do: a live update, a snapshot, or reduced motion. */
export type ThrowReason = "update" | "snapshot" | "reduced";

export interface DiceThrow {
  /** Use as the dice's React key so the throw restarts on every new roll. */
  key: number;
  mode: ThrowMode;
  reason: ThrowReason;
}

export function useDiceThrow(roll: DiceRoll | null): DiceThrow {
  const source = useGameStore((s) => s.source);
  const index = roll?.index ?? null;
  const [prev, setPrev] = useState(index);
  const [state, setState] = useState<DiceThrow>({ key: 0, mode: "static", reason: "snapshot" });
  if (index !== prev) {
    // Adjusting state during render (React's documented pattern for derived changes).
    const reason: ThrowReason =
      source !== "update" ? "snapshot" : prefersReducedMotion() ? "reduced" : "update";
    const next: DiceThrow = {
      key: state.key + 1,
      mode: index !== null && reason === "update" ? "animate" : "static",
      reason,
    };
    setPrev(index);
    setState(next);
    return next;
  }
  return state;
}
