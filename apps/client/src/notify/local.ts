// Local notification from the open tab when Web Push is not active (specs/turn-notifications
// "Local notification fallback"). Never shown when a push subscription covers this seat.
import type { WaitKind } from "@hexfall/protocol";
import { usePrefsStore } from "../store/prefs.ts";
import { useRoomStore } from "../store/room.ts";
import { useNotifyStore } from "./store.ts";
import { notifySupport } from "./support.ts";
import { NOTIFY_BADGE, NOTIFY_ICON, notificationText } from "./text.ts";

/** Shows the turn notification from this page if every condition holds. Returns whether it did. */
export function showLocalTurnNotice(kind: WaitKind): boolean {
  const room = useRoomStore.getState().room;
  if (!room || !usePrefsStore.getState().notify) return false;
  if (useNotifyStore.getState().pushActive) return false;
  if (!notifySupport().notification || Notification.permission !== "granted") return false;
  if (typeof document === "undefined" || !document.hidden) return false;
  try {
    const { title, body } = notificationText(kind, room);
    const n = new Notification(title, { body, tag: room, icon: NOTIFY_ICON, badge: NOTIFY_BADGE });
    n.onclick = () => {
      window.focus();
      n.close();
    };
    return true;
  } catch {
    // Some browsers (Android Chrome) only allow notifications from a service worker.
    return false;
  }
}
