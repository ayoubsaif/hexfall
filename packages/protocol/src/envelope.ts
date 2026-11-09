import { z } from "zod";

/** Bump on any breaking wire change. Client and server must match exactly. */
export const PROTOCOL_VERSION = 9;

/** WebSocket close codes used by the server. */
export const CloseCode = {
  /** Standard 1012 "Service Restart": client should reconnect with backoff. */
  ServerRestarting: 1012,
  /** Client speaks a different protocol version: client should ask the user to reload. */
  VersionMismatch: 4000,
  /** The seat was resumed from another connection; this one is no longer bound. */
  Replaced: 4001,
} as const;

/** Common envelope fields. `re` points at the `seq` of the message being answered. */
export const envelopeShape = {
  v: z.number().int(),
  seq: z.number().int().nonnegative(),
  re: z.number().int().nonnegative().optional(),
};
