// Registers the push-only service worker (specs/turn-notifications "Service worker").
import { notifySupport } from "./support.ts";

export const SW_URL = "/sw.js";

export function registerServiceWorker(): void {
  if (!notifySupport().serviceWorker) return;
  navigator.serviceWorker.register(SW_URL, { scope: "/" }).catch(() => {
    // No worker: no push; the local fallback still works while the tab is open.
  });
}
