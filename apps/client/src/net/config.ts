/** WebSocket base URL (public, baked in at build time). `/ws` is appended by the connection. */
export const SERVER_URL: string =
  (import.meta.env["VITE_SERVER_URL"] as string | undefined) || "ws://localhost:8080";

/** Sent in `hello`. */
export const CLIENT_VERSION: string =
  (import.meta.env["VITE_APP_VERSION"] as string | undefined) || "0.0.0-dev";
