// Notification text for a wait kind (the service worker keeps its own copy of these strings,
// see public/sw.js; a test keeps both in sync).
import type { WaitKind } from "@hexfall/protocol";
import { i18n } from "../i18n/index.ts";

export const NOTIFY_ICON = "/icons/icon-192.png";
export const NOTIFY_BADGE = "/icons/badge-96.png";

export function notificationText(kind: WaitKind, room: string): { title: string; body: string } {
  return {
    title: i18n.t(`common.alerts.push.title.${kind}`, { room }),
    body: i18n.t(`common.alerts.push.body.${kind}`),
  };
}
