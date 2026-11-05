// When the dice play their throw (openspec physics-dice-3d, specs board-dice "When the dice
// animate"): only for a new roll that arrived as an incremental update, never for a snapshot
// (join, resume), never under reduced motion, and never twice for one roll. Shared by the
// board dice and the HUD tray, so both agree on every roll.
import { useState } from "react";
import { prefersReducedMotion } from "../hud/cards/useCountChange.ts";
import { useGameStore } from "../store/game.ts";
import type { DiceRoll } from "./status.ts";

/** Longest throw on the board, from the roll arriving to the dice resting (ms). */
export const THROW_MS = 4000;

export type ThrowMode = "animate" | "static";

export interface DiceThrow {
  /** Use as the dice's React key so the throw restarts on every new roll. */
  key: number;
  mode: ThrowMode;
}

export function useDiceThrow(roll: DiceRoll | null): DiceThrow {
  const source = useGameStore((s) => s.source);
  const index = roll?.index ?? null;
  const [prev, setPrev] = useState(index);
  const [state, setState] = useState<DiceThrow>({ key: 0, mode: "static" });
  if (index !== prev) {
    // Adjusting state during render (React's documented pattern for derived changes).
    const next: DiceThrow = {
      key: state.key + 1,
      mode: index !== null && source === "update" && !prefersReducedMotion() ? "animate" : "static",
    };
    setPrev(index);
    setState(next);
    return next;
  }
  return state;
}
