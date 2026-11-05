// Saved games list on the start screen (specs/saved-games). Written only by the network
// session from `seatsInfo`; entries the server reports gone or ended never get here.
import type { ErrorCode, SeatInfoEntry } from "@hexfall/protocol";
import { create } from "zustand";

export type SavedGame = Exclude<SeatInfoEntry, { status: "gone" }> & {
  /** Local time the seat was last used (seat storage), for ordering. */
  usedAt: number;
};

export interface SavedGamesState {
  entries: SavedGame[];
  /** A lookup was sent and its answer has not arrived. */
  loading: boolean;
  /** Room the host is ending from the list, until the server answers. */
  ending: string | null;
  /** Last failed end from the list. */
  error: { room: string; code: ErrorCode; message: string } | null;
}

export const useSavedGamesStore = create<SavedGamesState>()(() => ({
  entries: [],
  loading: false,
  ending: null,
  error: null,
}));

const RANK: Record<SavedGame["status"], number> = { paused: 0, playing: 0, lobby: 1, ended: 2 };

/** Paused and playing first, then lobby; most recently used first within each. */
export function sortSaved(entries: readonly SavedGame[]): SavedGame[] {
  return [...entries].sort((a, b) => RANK[a.status] - RANK[b.status] || b.usedAt - a.usedAt);
}
