import type { z } from "zod";
import { PROTOCOL_VERSION } from "./envelope.ts";
import { ClientMessage, ServerMessage } from "./messages.ts";

export type DecodeResult<T> =
  | { ok: true; message: T }
  | { ok: false; error: "bad_frame" | "version_mismatch"; detail: string };

function decode<T>(schema: z.ZodType<T>, raw: string): DecodeResult<T> {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, error: "bad_frame", detail: "not JSON" };
  }
  if (typeof data === "object" && data !== null && "v" in data && data.v !== PROTOCOL_VERSION) {
    return {
      ok: false,
      error: "version_mismatch",
      detail: `expected v=${PROTOCOL_VERSION}, got v=${String(data.v)}`,
    };
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success) return { ok: false, error: "bad_frame", detail: parsed.error.message };
  return { ok: true, message: parsed.data };
}

export const decodeClientMessage = (raw: string) => decode(ClientMessage, raw);
export const decodeServerMessage = (raw: string) => decode(ServerMessage, raw);

type Payload<M, T> = M extends { type: T; payload: infer P } ? P : never;

/** Builds a frame string with the current protocol version. */
export function encode<M extends ClientMessage | ServerMessage, T extends M["type"]>(
  type: T,
  payload: Payload<M, T>,
  seq: number,
  re?: number,
): string {
  return JSON.stringify(
    re === undefined
      ? { v: PROTOCOL_VERSION, type, seq, payload }
      : { v: PROTOCOL_VERSION, type, seq, re, payload },
  );
}

export const encodeClient = <T extends ClientMessage["type"]>(
  type: T,
  payload: Payload<ClientMessage, T>,
  seq: number,
  re?: number,
) => encode<ClientMessage, T>(type, payload, seq, re);
export const encodeServer = <T extends ServerMessage["type"]>(
  type: T,
  payload: Payload<ServerMessage, T>,
  seq: number,
  re?: number,
) => encode<ServerMessage, T>(type, payload, seq, re);
