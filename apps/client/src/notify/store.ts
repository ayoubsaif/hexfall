// Notification runtime state (not persisted; the user's choice lives in store/prefs.ts).
import { create } from "zustand";
import { notifyPermission } from "./support.ts";

export interface NotifyState {
  permission: NotificationPermission | "unsupported";
  /** A push subscription is registered with the server for the current seat. */
  pushActive: boolean;
}

export const useNotifyStore = create<NotifyState>()(() => ({
  permission: notifyPermission(),
  pushActive: false,
}));
