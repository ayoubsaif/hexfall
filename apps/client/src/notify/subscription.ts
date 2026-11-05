// The browser's push subscription for the server's VAPID key (specs/turn-notifications
// "Push subscription").

/** base64url → bytes (VAPID public key). */
export function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function sameKey(a: ArrayBuffer | null | undefined, b: Uint8Array): boolean {
  if (!a) return false;
  const x = new Uint8Array(a);
  return x.length === b.length && x.every((v, i) => v === b[i]);
}

/** The subscription for `pushKey`: reused when it matches, else replaced. */
export async function ensureSubscribed(
  pm: PushManager,
  pushKey: string,
): Promise<PushSubscription> {
  const key = keyBytes(pushKey);
  const existing = await pm.getSubscription();
  if (existing) {
    if (sameKey(existing.options.applicationServerKey, key)) return existing;
    await existing.unsubscribe().catch(() => false);
  }
  return pm.subscribe({ userVisibleOnly: true, applicationServerKey: key });
}

/** The service worker's push manager, or null when unavailable. */
export async function pushManager(): Promise<PushManager | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  if (typeof PushManager !== "function") return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager ?? null;
}
