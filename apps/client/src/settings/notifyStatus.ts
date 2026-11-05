// Notification state shown in words in the Notifications section (specs/client-settings
// "Notifications section"). Pure, so every combination is unit-tested.
import type { NotifySupport } from "../notify/support.ts";

export type NotifyStatus = "on-push" | "on-tab-only" | "off" | "blocked" | "unsupported";

export interface NotifyStatusInput {
  support: NotifySupport;
  permission: NotificationPermission | "unsupported";
  /** The player turned notifications on (prefs). */
  wanted: boolean;
  /** The server sent a VAPID key (push is configured). */
  pushKey: string | null;
  /** A push subscription is registered for the current seat. */
  pushActive: boolean;
  /** The player sits in a room (push is only registered while seated). */
  seated: boolean;
  /** iOS/iPadOS browser. */
  ios: boolean;
  /** Running as an installed home-screen app. */
  standalone: boolean;
}

export interface NotifyStatusResult {
  status: NotifyStatus;
  /** Explain that adding the game to the home screen enables notifications. */
  iosHint: boolean;
}

export function notifyStatus(input: NotifyStatusInput): NotifyStatusResult {
  const { support, permission } = input;
  const iosHint = input.ios && !input.standalone;
  if (!support.notification || permission === "unsupported") {
    return { status: "unsupported", iosHint };
  }
  if (permission === "denied") return { status: "blocked", iosHint: false };
  if (!input.wanted || permission !== "granted") return { status: "off", iosHint };
  // Push works when the server has a key and the browser has Web Push; while seated the
  // subscription must also have been registered.
  const push = input.pushKey !== null && support.push && (input.pushActive || !input.seated);
  return { status: push ? "on-push" : "on-tab-only", iosHint: false };
}

/** iOS / iPadOS (iPadOS reports a Mac platform with touch). */
export function isIos(nav: Navigator | undefined = globalThis.navigator): boolean {
  if (!nav) return false;
  return (
    /iPad|iPhone|iPod/.test(nav.userAgent) ||
    (nav.platform === "MacIntel" && (nav.maxTouchPoints ?? 0) > 1)
  );
}

/** Installed home-screen app (iOS `navigator.standalone`, or the standalone display mode). */
export function isStandalone(g: typeof globalThis = globalThis): boolean {
  const nav = g.navigator as (Navigator & { standalone?: boolean }) | undefined;
  if (nav?.standalone === true) return true;
  return typeof g.matchMedia === "function" && g.matchMedia("(display-mode: standalone)").matches;
}
