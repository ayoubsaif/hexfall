import { z } from "zod";
import { envelopeShape } from "./envelope.ts";

const msg = <T extends string, P extends z.ZodType>(type: T, payload: P) =>
  z.object({ ...envelopeShape, type: z.literal(type), payload });

// ---- client -> server
export const HelloMessage = msg("hello", z.object({ clientVersion: z.string().min(1) }));
export const PingMessage = msg("ping", z.object({ t: z.number() }));

export const ClientMessage = z.discriminatedUnion("type", [HelloMessage, PingMessage]);
export type ClientMessage = z.infer<typeof ClientMessage>;

// ---- server -> client
export const WelcomeMessage = msg(
  "welcome",
  z.object({ serverVersion: z.string(), protocolVersion: z.number().int() }),
);
export const PongMessage = msg("pong", z.object({ t: z.number() }));
export const ErrorCode = z.enum(["bad_frame", "version_mismatch", "internal"]);
export type ErrorCode = z.infer<typeof ErrorCode>;
export const ErrorMessage = msg("error", z.object({ code: ErrorCode, message: z.string() }));

export const ServerMessage = z.discriminatedUnion("type", [
  WelcomeMessage,
  PongMessage,
  ErrorMessage,
]);
export type ServerMessage = z.infer<typeof ServerMessage>;

export type ClientMessageType = ClientMessage["type"];
export type ServerMessageType = ServerMessage["type"];
