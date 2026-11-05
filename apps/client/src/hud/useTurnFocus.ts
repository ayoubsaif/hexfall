// When the your-turn focus opens and resets (specs/game-hud "Your-turn focus"; design decision 8;
// openspec physics-dice-3d, design decision 9).
import { useEffect, useRef } from "react";
import { setTurnFocus } from "../store/ui.ts";
import { useLegal, useView } from "./state.ts";

/** True while the viewer must roll (dice or roll for order) in an unfinished game. */
export function useRollWait(): boolean {
  const legal = useLegal();
  const view = useView();
  return !!legal && !!view && view.winner === null && (legal.rollDice || legal.rollForOrder);
}

/**
 * Opens the focus when the viewer's roll becomes legal (false → true, which includes the first
 * view after a resume) and closes it as soon as the roll leaves the legal set: the viewer's
 * roll arrived (the dice are then thrown on the board, which the focus would dim), a Knight was
 * played before the roll, or the game ended. Call once (TurnFocus does).
 */
export function useTurnFocus(): void {
  const waiting = useRollWait();
  const was = useRef(false);

  useEffect(() => {
    const prev = was.current;
    was.current = waiting;
    if (waiting && !prev) {
      setTurnFocus("open");
      return;
    }
    if (waiting || !prev) return;
    setTurnFocus("closed");
  }, [waiting]);
}
