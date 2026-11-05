// Browser support for turn notifications (specs/turn-notifications).

export interface NotifySupport {
  /** The Notification API exists (local notifications and the permission prompt). */
  notification: boolean;
  /** Service workers exist (needed to show and click push notifications). */
  serviceWorker: boolean;
  /** Web Push exists (PushManager). Missing on iOS Safari outside an installed app. */
  push: boolean;
}

export function notifySupport(g: typeof globalThis = globalThis): NotifySupport {
  const nav = (g as { navigator?: Navigator }).navigator;
  return {
    notification: typeof (g as { Notification?: unknown }).Notification === "function",
    serviceWorker: !!nav && "serviceWorker" in nav,
    push: typeof (g as { PushManager?: unknown }).PushManager === "function",
  };
}

/** Current permission, or "unsupported". */
export function notifyPermission(): NotificationPermission | "unsupported" {
  return notifySupport().notification ? Notification.permission : "unsupported";
}
