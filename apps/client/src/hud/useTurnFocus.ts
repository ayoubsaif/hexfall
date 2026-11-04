// When the your-turn focus opens and resets (specs/game-hud "Your-turn focus"; design decision 8).
import { useEffect, useRef } from "react";
import { useGameStore } from "../store/game.ts";
import { setTurnFocus, useUiStore } from "../store/ui.ts";
import { THROW_MS } from "./dice/DiceTray.tsx";
import { useLegal, useView } from "./state.ts";

/** How long an open focus may outlive the roll wait before it closes on its own. */
export const FOCUS_LINGER_MS = THROW_MS + 400;

/** True while the viewer must roll (dice or roll for order) in an unfinished game. */
export function useRollWait(): boolean {
  const legal = useLegal();
  const view = useView();
  return !!legal && !!view && view.winner === null && (legal.rollDice || legal.rollForOrder);
}

/**
 * Opens the focus when the viewer's roll becomes legal (false → true, which includes the first
 * view after a resume). When the roll leaves the legal set because the viewer's roll (their
 * own or the timer's) just arrived, an open focus stays while the throw plays: the dice tray
 * closes it when the dice rest, or it closes on its own after `FOCUS_LINGER_MS`. Any other
 * exit (a Knight played before the roll, game over) resets it at once. Call once (TurnFocus does).
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
    const { lastEvents, view } = useGameStore.getState();
    const viewer = view?.viewer ?? null;
    const rolled = lastEvents.some(
      (e) => (e.type === "diceRolled" || e.type === "orderRolled") && e.seat === viewer,
    );
    if (!rolled || useUiStore.getState().focus !== "open") {
      setTurnFocus("closed");
      return;
    }
    const id = setTimeout(() => {
      if (useUiStore.getState().focus === "open") setTurnFocus("closed");
    }, FOCUS_LINGER_MS);
    return () => clearTimeout(id);
  }, [waiting]);
}
