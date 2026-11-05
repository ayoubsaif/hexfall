// Intents the UI sends to the server (design.md decision 7). Components call these;
// only the session (net/session.ts) talks to the connection and writes server stores.
// The session registers its implementation with `setSessionApi` when the app starts.
import type { ClientAction, TurnTimerPreset } from "@hexfall/protocol";

export type BoardModeChoice = "beginner" | "variable";

export interface SessionApi {
  /** Sends a game action (no seat). Returns false if not sent (offline or another action in flight). */
  act(action: ClientAction): boolean;
  createRoom(name: string): boolean;
  joinRoom(room: string, name: string): boolean;
  leaveRoom(): boolean;
  startGame(mode: BoardModeChoice, startingPlayer?: number, turnTimer?: TurnTimerPreset): boolean;
  /** After a Replaced close: reconnect here and take the seat back. */
  playHere(): void;
  /** After game over: forget the seat and get a fresh, unseated connection. */
  backToStart(): void;
  /** Host only (pause-and-resume-games). */
  pauseGame(): boolean;
  resumeGame(): boolean;
  endGame(): boolean;
  /** Saved games list: ask the server about every saved seat. */
  lookupSeats(): boolean;
  /** Resume a saved seat from the list. */
  continueGame(room: string): boolean;
  /** Forget a saved seat locally. */
  forgetGame(room: string): void;
  /** Host only: end a saved game from the list. */
  endSavedGame(room: string): boolean;
}

const offline: SessionApi = {
  act: () => false,
  createRoom: () => false,
  joinRoom: () => false,
  leaveRoom: () => false,
  startGame: () => false,
  playHere: () => {},
  backToStart: () => {},
  pauseGame: () => false,
  resumeGame: () => false,
  endGame: () => false,
  lookupSeats: () => false,
  continueGame: () => false,
  forgetGame: () => {},
  endSavedGame: () => false,
};

let api: SessionApi = offline;

/** Registers the live session (or restores the offline stub when called without one). */
export function setSessionApi(next?: SessionApi): void {
  api = next ?? offline;
}

export const act = (action: ClientAction): boolean => api.act(action);
export const createRoom = (name: string): boolean => api.createRoom(name);
export const joinRoom = (room: string, name: string): boolean => api.joinRoom(room, name);
export const leaveRoom = (): boolean => api.leaveRoom();
export const startGame = (
  mode: BoardModeChoice,
  startingPlayer?: number,
  turnTimer?: TurnTimerPreset,
): boolean => api.startGame(mode, startingPlayer, turnTimer);
export const playHere = (): void => api.playHere();
export const backToStart = (): void => api.backToStart();
export const pauseGame = (): boolean => api.pauseGame();
export const resumeGame = (): boolean => api.resumeGame();
export const endGame = (): boolean => api.endGame();
export const lookupSeats = (): boolean => api.lookupSeats();
export const continueGame = (room: string): boolean => api.continueGame(room);
export const forgetGame = (room: string): void => api.forgetGame(room);
export const endSavedGame = (room: string): boolean => api.endSavedGame(room);
