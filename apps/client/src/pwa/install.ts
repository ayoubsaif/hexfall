// Android/Chromium "install app" prompt (openspec change pwa-install-and-offline-cache).
// Chrome fires `beforeinstallprompt` once the manifest and service worker qualify; we keep the
// event and let the welcome page offer a one-tap install. Not shown when already installed.
import { useSyncExternalStore } from "react";

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const isStandalone = (): boolean =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (navigator as { standalone?: boolean }).standalone === true);

export function installInstallPrompt(target: Window = window): void {
  target.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    emit();
  });
  target.addEventListener("appinstalled", () => {
    deferred = null;
    emit();
  });
}

/** Shows the browser's install dialog; the event is single-use. */
export async function promptInstall(): Promise<boolean> {
  const event = deferred;
  if (!event) return false;
  deferred = null;
  emit();
  await event.prompt();
  return (await event.userChoice).outcome === "accepted";
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => void listeners.delete(cb);
};

/** True while an install prompt is available and the app is not already installed. */
export const useCanInstall = (): boolean =>
  useSyncExternalStore(
    subscribe,
    () => deferred !== null && !isStandalone(),
    () => false,
  );

/** For tests. */
export function setDeferredInstall(e: InstallPromptEvent | null): void {
  deferred = e;
  emit();
}
