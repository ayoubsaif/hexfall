// Turn chime and dice sound triggers (specs/game-audio "Turn chime", "Dice sound").
// Driven by game store writes, not renders, so each server message is seen exactly once.
import type { GameEvent } from "@hexfall/engine";
import { useEffect } from "react";
import { playSound } from "../audio/sounds.ts";
import { useGameStore, type GameStoreState } from "../store/game.ts";
import { viewerWait, type WaitKind } from "./wait.ts";

const isRoll = (e: GameEvent) => e.type === "diceRolled" || e.type === "orderRolled";

/** The seat whose turn it is, or null before a game or after it ended. */
function activeSeat(view: GameStoreState["view"]): number | null {
  return view && view.phase.kind !== "ended" ? view.turn.seat : null;
}

const NO_HANDLERS: GameAlertHandlers = {};

export interface GameAlertHandlers {
  /** A wait on the viewer began (after the first view, never from a snapshot). */
  onWaitStart?: (kind: WaitKind) => void;
}

/**
 * Subscribes to the game store. Plays the dice sound for every update write that adds a
 * roll; plays the chime (and calls `onWaitStart`) when the viewer's wait goes from none to
 * some kind, and a quieter sound when the turn passes to another player. Snapshots only record the current wait. Mount once while in a game.
 */
export function useGameAlerts({ onWaitStart }: GameAlertHandlers = NO_HANDLERS): void {
  useEffect(() => {
    const first = useGameStore.getState();
    let wait = viewerWait(first.view, first.legal);
    let active = activeSeat(first.view);
    const onWrite = (s: GameStoreState, prev: GameStoreState) => {
      const next = viewerWait(s.view, s.legal);
      const fresh = s.lastEvents !== prev.lastEvents || s.version !== prev.version;
      if (fresh && s.source === "update") {
        if (s.lastEvents.some(isRoll)) playSound("dice");
        if (next && !wait) {
          playSound("chime");
          onWaitStart?.(next);
        }
      }
      const seat = activeSeat(s.view);
      // The turn passed to another player: a quiet cue (the viewer's own turn gets the chime).
      if (
        fresh &&
        s.source === "update" &&
        seat !== null &&
        active !== null &&
        seat !== active &&
        seat !== s.view?.viewer
      ) {
        playSound("turnSoft");
      }
      active = seat;
      wait = next;
    };
    return useGameStore.subscribe(onWrite);
  }, [onWaitStart]);
}
