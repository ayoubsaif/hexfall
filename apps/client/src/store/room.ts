import type { EarlyResult, ErrorCode, RoomStatus, SeatInfo } from "@hexfall/protocol";
import { create } from "zustand";

/** A room request the start screen or lobby is waiting on. */
export type RoomRequest = "create" | "join" | "leave" | "start" | "pause" | "resume" | "end";

export interface FormError {
  /** The request that failed. */
  request: RoomRequest | "resume";
  code: ErrorCode;
  message: string;
}

export interface RoomStoreState {
  /** Room code of the room this client sits in, or null on the start screen. */
  room: string | null;
  /** Own seat, or null when not seated. */
  seat: number | null;
  host: number | null;
  status: RoomStatus | null;
  seats: SeatInfo[];
  /** Server ms when the host paused; null unless paused. */
  pausedAt: number | null;
  /** Set when the host ended the game early. */
  result: EarlyResult | null;
  /** Room code from an invite link, used to prefill the join form. */
  prefillRoom: string | null;
  /** Request in flight (create/join/leave/start), or null. */
  pending: RoomRequest | null;
  /** Last room error, shown next to the control that caused it. */
  error: FormError | null;
  /** One-off notice on the start screen (e.g. "seat could not be restored"). */
  notice: string | null;
}

export const initialRoomState: RoomStoreState = {
  room: null,
  seat: null,
  host: null,
  status: null,
  seats: [],
  pausedAt: null,
  result: null,
  prefillRoom: null,
  pending: null,
  error: null,
  notice: null,
};

/**
 * Room and lobby state. Written only by the network session (`net/session.ts`);
 * components read it through selectors.
 */
export const useRoomStore = create<RoomStoreState>()(() => ({ ...initialRoomState }));

/** Forgets the room (keeps the invite prefill and notice unless given). */
export function resetRoom(keep: Partial<RoomStoreState> = {}): void {
  const { prefillRoom, notice } = useRoomStore.getState();
  useRoomStore.setState({ ...initialRoomState, prefillRoom, notice, ...keep }, true);
}

/** No game actions possible: paused, or ended early by the host. */
export const isFrozen = (s: Pick<RoomStoreState, "status" | "result">): boolean =>
  s.status === "paused" || s.result !== null;

/**
 * Whether the 3D board should be mounted: only once a game runs, or as soon as the host
 * clicks Start. The start screen and the lobby never load the scene.
 */
export const boardVisible = (s: Pick<RoomStoreState, "room" | "status" | "pending">): boolean =>
  s.room !== null && ((s.status !== null && s.status !== "lobby") || s.pending === "start");
