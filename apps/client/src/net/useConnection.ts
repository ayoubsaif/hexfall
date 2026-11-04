import { useEffect } from "react";
import { setSessionApi } from "./actions.ts";
import { storeListener, withSession } from "./bindStore.ts";
import { CLIENT_VERSION, SERVER_URL } from "./config.ts";
import { Connection, type ConnectionOptions } from "./connection.ts";
import { SessionController, type SessionOptions } from "./session.ts";

// One connection per page. Mounts are ref-counted and the final close is
// deferred by a tick, so StrictMode's mount -> unmount -> mount reuses the
// same socket instead of opening a second one.
let current: Connection | null = null;
let refs = 0;
let pendingClose: ReturnType<typeof setTimeout> | null = null;

type Factory = () => Connection;
let currentSession: SessionController | null = null;

/** The app connection with its session: the session is the only writer of room and game state. */
const defaultFactory: Factory = () => {
  const { connection, session } = createSessionConnection({
    serverUrl: SERVER_URL,
    clientVersion: CLIENT_VERSION,
  });
  currentSession = session;
  setSessionApi(session);
  return connection;
};

/**
 * Builds a connection whose events feed both the connection store and a new session.
 * Does not start it or register the session (the app factory does both).
 */
export function createSessionConnection(
  opts: Omit<ConnectionOptions, "listener">,
  sessionOpts: Omit<SessionOptions, "connection"> = {},
): { connection: Connection; session: SessionController } {
  let session: SessionController | null = null;
  const connection = new Connection({
    ...opts,
    listener: withSession(storeListener(), () => session),
  });
  session = new SessionController({ ...sessionOpts, connection });
  return { connection, session };
}
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
      if (currentSession) setSessionApi();
      currentSession = null;
    }
  }, 0);
}

/** The live session, if the default factory built the connection. */
export function getSession(): SessionController | null {
  return currentSession;
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
