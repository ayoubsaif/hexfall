// When the dice play their throw (specs/game-hud "Dice display"; openspec dice-tray-3d,
// design decision 3): only for a new roll that arrived as an incremental update, never for
// a snapshot (join, resume), never under reduced motion, and never twice for one roll.
import { useState } from "react";
import type { DiceRoll } from "../../game/status.ts";
import { useGameStore } from "../../store/game.ts";
import { prefersReducedMotion } from "../cards/useCountChange.ts";

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
