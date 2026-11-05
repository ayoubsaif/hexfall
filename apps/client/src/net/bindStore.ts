import { useConnectionStore } from "../store/connection.ts";
import type { ConnectionListener } from "./connection.ts";

/** Listener that copies connection events into the zustand stores (the only writer). */
export function storeListener(store = useConnectionStore): ConnectionListener {
  return {
    status: (status, attempts) => store.setState({ status, attempts }),
    welcome: ({ serverVersion, protocolVersion, pushKey }) =>
      store.setState({ serverVersion, protocolVersion, pushKey }),
    latency: (latencyMs) => store.setState({ latencyMs }),
  };
}

/** The session callbacks a connection drives (see net/session.ts). */
export interface SessionSink {
  onStatus(status: Parameters<NonNullable<ConnectionListener["status"]>>[0]): void;
  onWelcome(): void;
  onMessage(msg: Parameters<NonNullable<ConnectionListener["message"]>>[0]): void;
}

/**
 * Extends `base` so the session also sees status changes, welcomes and messages.
 * `sink()` is read lazily because the session is built after the connection.
 */
export function withSession(
  base: ConnectionListener,
  sink: () => SessionSink | null,
): ConnectionListener {
  return {
    ...base,
    status: (status, attempts) => {
      base.status?.(status, attempts);
      sink()?.onStatus(status);
    },
    welcome: (info) => {
      base.welcome?.(info);
      sink()?.onWelcome();
    },
    message: (msg) => {
      base.message?.(msg);
      sink()?.onMessage(msg);
    },
  };
}
