// In-game chat lines (openspec change in-game-chat). Server truth, kept in memory only: the
// server holds the last CHAT_HISTORY lines per room and replays them when a seat joins or resumes.
import { CHAT_HISTORY, type ChatEntry } from "@hexfall/protocol";
import { create } from "zustand";

export interface ChatState {
  entries: ChatEntry[];
  /** Lines from other players received while the chat was not on screen. */
  unread: number;
}

export const initialChatState: ChatState = { entries: [], unread: 0 };

export const useChatStore = create<ChatState>()(() => ({ ...initialChatState }));

export function resetChat(): void {
  useChatStore.setState({ ...initialChatState }, true);
}

/** `mine`: the viewer's seat, whose own lines never count as unread. */
export function addChatLine(entry: ChatEntry, mine: number | null): void {
  useChatStore.setState((s) => {
    if (s.entries.some((e) => e.id === entry.id)) return s;
    return {
      entries: [...s.entries, entry].slice(-CHAT_HISTORY),
      unread: entry.seat === mine ? s.unread : s.unread + 1,
    };
  });
}

export function setChatHistory(entries: readonly ChatEntry[]): void {
  useChatStore.setState({ entries: entries.slice(-CHAT_HISTORY), unread: 0 });
}

export function markChatRead(): void {
  if (useChatStore.getState().unread !== 0) useChatStore.setState({ unread: 0 });
}
