import { create } from "zustand";
import type { ConnectionStatus } from "../net/connection.ts";

export interface ConnectionState {
  status: ConnectionStatus;
  /** Round-trip time of the last protocol ping, or null before the first pong. */
  latencyMs: number | null;
  serverVersion: string | null;
  protocolVersion: number | null;
  /** Reconnect attempts since the last `welcome`. */
  attempts: number;
}

export const initialConnectionState: ConnectionState = {
  status: "connecting",
  latencyMs: null,
  serverVersion: null,
  protocolVersion: null,
  attempts: 0,
};

/**
 * Connection status. Written only by the network layer (`net/`); components
 * read it through selectors and never call `setState`.
 */
export const useConnectionStore = create<ConnectionState>()(() => ({ ...initialConnectionState }));
