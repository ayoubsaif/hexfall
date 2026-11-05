// Keeps the server informed about this page (openspec change turn-sound-and-push;
// specs/turn-notifications "Push subscription", "Visibility reporting"): its visibility and,
// when the player turned notifications on, the push subscription for the current seat.
import type { ClientMessage } from "@hexfall/protocol";
import { currentLanguage, i18n } from "../i18n/index.ts";
import { useConnectionStore } from "../store/connection.ts";
import { setPref, usePrefsStore } from "../store/prefs.ts";
import { useRoomStore } from "../store/room.ts";
import { useNotifyStore } from "./store.ts";
import { ensureSubscribed, pushManager } from "./subscription.ts";
import { notifyPermission, notifySupport } from "./support.ts";

type Sender = <T extends ClientMessage["type"]>(
  type: T,
  payload: Extract<ClientMessage, { type: T }>["payload"],
) => boolean;

/** Outgoing channel; main.tsx points it at the app connection. */
let send: Sender = () => false;
let getPushManager: () => Promise<PushManager | null> = pushManager;

/** Sets the outgoing channel (app start) or fakes (tests). */
export function setNotifyDeps(deps: {
  send?: Sender;
  pushManager?: () => Promise<PushManager | null>;
}): void {
  if (deps.send) send = deps.send;
  if (deps.pushManager) getPushManager = deps.pushManager;
}

const seated = () => useRoomStore.getState().seat !== null;
const hidden = () => typeof document !== "undefined" && document.hidden;

function reportVisibility(): void {
  if (seated()) send("visibility", { visible: !hidden() });
}

let syncing: Promise<void> = Promise.resolve();

/**
 * Brings the push subscription in line with the current preference, permission, server key
 * and seat. Serialized, so overlapping triggers never race. Never throws.
 */
export function syncPush(): Promise<void> {
  syncing = syncing.then(syncPushNow, syncPushNow);
  return syncing;
}

async function syncPushNow(): Promise<void> {
  const permission = notifyPermission();
  useNotifyStore.setState({ permission });
  const pushKey = useConnectionStore.getState().pushKey;
  const want = usePrefsStore.getState().notify && permission === "granted" && pushKey !== null;
  if (!want || !seated()) {
    useNotifyStore.setState({ pushActive: false });
    return;
  }
  try {
    const pm = await getPushManager();
    if (!pm) {
      useNotifyStore.setState({ pushActive: false });
      return;
    }
    const sub = await ensureSubscribed(pm, pushKey);
    const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth)
      throw new Error("bad subscription");
    const sent = send("pushSubscribe", {
      subscription: {
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      },
      lang: currentLanguage(),
    });
    useNotifyStore.setState({ pushActive: sent });
  } catch {
    // Push service or browser refused: the local fallback covers the open tab.
    useNotifyStore.setState({ pushActive: false });
  }
}

/** After every create/join/resume (wired from the session). Resolves when synced. */
export function onSeated(): Promise<void> {
  reportVisibility();
  return syncPush();
}

/** From the notifications control: asks for permission (only here) and turns alerts on. */
export async function enableNotifications(): Promise<void> {
  if (!notifySupport().notification) return;
  let permission = Notification.permission;
  if (permission === "default") permission = await Notification.requestPermission();
  useNotifyStore.setState({ permission });
  if (permission !== "granted") return;
  setPref("notify", true);
  await syncPush();
}

/** From the notifications control: stops pushes for this browser. */
export async function disableNotifications(): Promise<void> {
  setPref("notify", false);
  useNotifyStore.setState({ pushActive: false });
  try {
    const pm = await getPushManager();
    const sub = await pm?.getSubscription();
    if (sub) {
      send("pushUnsubscribe", { endpoint: sub.endpoint });
      await sub.unsubscribe();
    }
  } catch {
    // Nothing more to do: the server drops dead subscriptions on its own.
  }
}

let installed = false;

/** Visibility reports, language-change resubscribe and key changes. Call once at startup. */
export function installNotifySync(): void {
  if (installed || typeof document === "undefined") return;
  installed = true;
  document.addEventListener("visibilitychange", reportVisibility);
  i18n.on("languageChanged", () => void syncPush());
  let key = useConnectionStore.getState().pushKey;
  useConnectionStore.subscribe((s) => {
    if (s.pushKey === key) return;
    key = s.pushKey;
    void syncPush();
  });
}
