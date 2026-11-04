import { create } from "zustand";

export interface GameState {
  /** Last player view sent by the server. Always null in this change. */
  view: null;
}

/**
 * Game state as last reported by the server. Only network messages write to
 * this store: the client never mutates game state optimistically and never
 * decides legality (design.md decision 6).
 */
export const useGameStore = create<GameState>()(() => ({ view: null }));
