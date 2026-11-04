import type { GameEvent, LegalActions, PlayerView, RuleErrorCode } from "@hexfall/engine";
import type { ErrorCode, TimerInfo } from "@hexfall/protocol";
import { create } from "zustand";

/** How the current view arrived: a full snapshot (join/resume/start) or an incremental update. */
export type WriteSource = "snapshot" | "update";

export interface Rejection {
  /** Engine rule error, or a server error answering a game action (`unavailable`, `rate_limited`, `no_seat`). */
  code: RuleErrorCode | ErrorCode;
  message: string;
  /** Increases on every rejection so identical messages still re-show. */
  id: number;
}

export interface GameStoreState {
  /** Server state version of `view`; -1 before the first snapshot. */
  version: number;
  /** Last redacted view from the server (its `log` is not used; see `log`). */
  view: PlayerView | null;
  /** Legal moves for the own seat, as sent with `view`. */
  legal: LegalActions | null;
  /** The whole redacted log: snapshot log plus every update's events. */
  log: GameEvent[];
  /** Events added by the latest write (empty after a snapshot). */
  lastEvents: GameEvent[];
  source: WriteSource | null;
  /** An action was sent and no reply has arrived yet. */
  inFlight: boolean;
  /** Last rule rejection from the server. */
  rejection: Rejection | null;
  /** Turn countdown from the latest snapshot or update (null: timer off or game over). */
  timer: TimerInfo;
  /** Local `performance.now()` when `timer` arrived; the deadline is `timerAt + timer.remainingMs`. */
  timerAt: number;
}

export const initialGameState: GameStoreState = {
  version: -1,
  view: null,
  legal: null,
  log: [],
  lastEvents: [],
  source: null,
  inFlight: false,
  rejection: null,
  timer: null,
  timerAt: 0,
};

/**
 * Game state as last reported by the server. Only network messages write to
 * this store (`net/session.ts`): the client never mutates game state
 * optimistically and never decides legality.
 */
export const useGameStore = create<GameStoreState>()(() => ({ ...initialGameState }));

export function resetGame(): void {
  useGameStore.setState({ ...initialGameState }, true);
}
