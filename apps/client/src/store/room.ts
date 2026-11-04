import type { ErrorCode, RoomStatus, SeatInfo } from "@hexfall/protocol";
import { create } from "zustand";

/** A room request the start screen or lobby is waiting on. */
export type RoomRequest = "create" | "join" | "leave" | "start";

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
