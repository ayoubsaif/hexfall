import { useConnectionStore } from "../store/connection.ts";
import type { ConnectionListener } from "./connection.ts";

/** Listener that copies connection events into the zustand stores (the only writer). */
export function storeListener(store = useConnectionStore): ConnectionListener {
  return {
    status: (status, attempts) => store.setState({ status, attempts }),
    welcome: ({ serverVersion, protocolVersion }) =>
      store.setState({ serverVersion, protocolVersion }),
    latency: (latencyMs) => store.setState({ latencyMs }),
  };
}
