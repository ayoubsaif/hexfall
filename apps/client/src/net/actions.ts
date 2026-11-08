// Intents the UI sends to the server (design.md decision 7). Components call these;
// only the session (net/session.ts) talks to the connection and writes server stores.
// The session registers its implementation with `setSessionApi` when the app starts.
import type { AvatarId, BotLevel, ClientAction, TurnTimerPreset } from "@hexfall/protocol";

export type BoardModeChoice = "beginner" | "variable";

export interface SessionApi {
  /** Sends a game action (no seat). Returns false if not sent (offline or another action in flight). */
  act(action: ClientAction): boolean;
  createRoom(name: string, avatar?: AvatarId): boolean;
  joinRoom(room: string, name: string, avatar?: AvatarId): boolean;
  /** Lobby: change your avatar. */
  setAvatar(avatar: AvatarId): boolean;
  leaveRoom(): boolean;
  startGame(mode: BoardModeChoice, startingPlayer?: number, turnTimer?: TurnTimerPreset): boolean;
  /** Says something to the room (in-game chat). False when not sent. */
  chat(text: string): boolean;
  /** Host only, lobby: seat a bot / remove the bot in `seat`. */
  addBot(): boolean;
  removeBot(seat: number): boolean;
  /** Host only, lobby: set the difficulty of the bot in `seat`. */
  setBotLevel(seat: number, level: BotLevel): boolean;
  /** Start screen: create a room, seat `opponents` bots and start the game at once. */
  /** Create a room, seat `opponents` bots at `level` (Normal if absent) and start at once. */
  playSolo(name: string, opponents: 2 | 3, avatar?: AvatarId, level?: BotLevel): boolean;
  /** After a Replaced close: reconnect here and take the seat back. */
  playHere(): void;
  /** After game over: forget the seat and get a fresh, unseated connection. */
  /** Back to the start screen; `keepSeat` keeps the seat saved (paused game) instead of forgetting it. */
  backToStart(opts?: { keepSeat?: boolean }): void;
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
  setAvatar: () => false,
  leaveRoom: () => false,
  startGame: () => false,
  chat: () => false,
  addBot: () => false,
  removeBot: () => false,
  setBotLevel: () => false,
  playSolo: () => false,
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
export const createRoom = (name: string, avatar?: AvatarId): boolean =>
  api.createRoom(name, avatar);
export const joinRoom = (room: string, name: string, avatar?: AvatarId): boolean =>
  api.joinRoom(room, name, avatar);
export const setAvatar = (avatar: AvatarId): boolean => api.setAvatar(avatar);
export const leaveRoom = (): boolean => api.leaveRoom();
export const startGame = (
  mode: BoardModeChoice,
  startingPlayer?: number,
  turnTimer?: TurnTimerPreset,
): boolean => api.startGame(mode, startingPlayer, turnTimer);
export const sendChat = (text: string): boolean => api.chat(text);
export const addBot = (): boolean => api.addBot();
export const removeBot = (seat: number): boolean => api.removeBot(seat);
export const setBotLevel = (seat: number, level: BotLevel): boolean => api.setBotLevel(seat, level);
export const playSolo = (...args: Parameters<SessionApi["playSolo"]>): boolean =>
  api.playSolo(...args);
export const playHere = (): void => api.playHere();
export const backToStart = (...args: Parameters<SessionApi["backToStart"]>): void =>
  api.backToStart(...args);
export const pauseGame = (): boolean => api.pauseGame();
export const resumeGame = (): boolean => api.resumeGame();
export const endGame = (): boolean => api.endGame();
export const lookupSeats = (): boolean => api.lookupSeats();
export const continueGame = (room: string): boolean => api.continueGame(room);
export const forgetGame = (room: string): void => api.forgetGame(room);
export const endSavedGame = (room: string): boolean => api.endSavedGame(room);
