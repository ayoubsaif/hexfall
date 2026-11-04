import { useEffect } from "react";
import { storeListener } from "./bindStore.ts";
import { CLIENT_VERSION, SERVER_URL } from "./config.ts";
import { Connection } from "./connection.ts";

// One connection per page. Mounts are ref-counted and the final close is
// deferred by a tick, so StrictMode's mount -> unmount -> mount reuses the
// same socket instead of opening a second one.
let current: Connection | null = null;
let refs = 0;
let pendingClose: ReturnType<typeof setTimeout> | null = null;

type Factory = () => Connection;
const defaultFactory: Factory = () =>
  new Connection({
    serverUrl: SERVER_URL,
    clientVersion: CLIENT_VERSION,
    listener: storeListener(),
  });
let factory: Factory = defaultFactory;

export function acquireConnection(): Connection {
  refs += 1;
  if (pendingClose !== null) {
    clearTimeout(pendingClose);
    pendingClose = null;
  }
  if (!current) {
    current = factory();
    current.start();
  }
  return current;
}

export function releaseConnection(): void {
  refs = Math.max(0, refs - 1);
  if (refs > 0 || pendingClose !== null) return;
  pendingClose = setTimeout(() => {
    pendingClose = null;
    if (refs === 0 && current) {
      current.close();
      current = null;
    }
  }, 0);
}

/** The live connection, if any (for sending intents). */
export function getConnection(): Connection | null {
  return current;
}

/** Test hook: replace how the connection is built. Pass nothing to restore the default. */
export function setConnectionFactory(f?: Factory): void {
  factory = f ?? defaultFactory;
}

/** Starts the single app connection on mount and closes it on unmount. */
export function useConnection(): void {
  useEffect(() => {
    acquireConnection();
    return releaseConnection;
  }, []);
}
