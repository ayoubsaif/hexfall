// One socket's protocol session (design.md decisions 1, 2, 8, 9): decodes frames,
// rate-limits, routes requests to the RoomService one at a time, and owns the
// outgoing `seq` counter. Socket-free, so it is unit-tested with plain callbacks.
import {
  CloseCode,
  PROTOCOL_VERSION,
  decodeClientMessage,
  encodeServer,
  type ClientMessage,
  type ErrorCode,
} from "@hexfall/protocol";
import type { Conn, Outgoing, RoomService, ServiceResult } from "./rooms/service.ts";

/** Token bucket (decision 9): 20 messages/s sustained, bursts up to 40. */
export const RATE_REFILL_PER_SEC = 20;
export const RATE_CAPACITY = 40;

export interface SessionOptions {
  service: RoomService;
  /** Writes one encoded frame to the socket. */
  send: (raw: string) => void;
  /** Closes the socket. */
  close: (code: number, reason: string) => void;
  /** Unique per socket. */
  id: string;
  /** Clock (ms) for the rate limiter. Default Date.now. */
  now?: () => number;
  serverVersion: string;
  /** VAPID public key sent in `welcome`, or null when push is off. */
  pushKey?: string | null;
  log?: (msg: string) => void;
}

export interface Session {
  /** Handles one text frame. Resolves when this frame has been fully processed. */
  handle(raw: string): Promise<void>;
  /** Handles one binary frame (unsupported: answered with `bad_frame`). */
  handleBinary(): void;
  /** The socket closed: after queued requests finish, tells the service once. */
  closed(): void;
}

export function createSession(opts: SessionOptions): Session {
  const { service, id } = opts;
  const now = opts.now ?? (() => Date.now());
  const log = opts.log ?? ((msg: string) => console.log(`[session ${id}] ${msg}`));

  let seq = 0;
  /** closed() was called: new frames are ignored. */
  let closing = false;
  /** disconnect() ran: nothing more is sent. */
  let isClosed = false;
  let tokens = RATE_CAPACITY;
  let refilledAt = now();
  /** Serializes request handling per socket. */
  let chain: Promise<void> = Promise.resolve();

  const sendOut = (msg: Outgoing): void => {
    if (isClosed) return;
    // `Outgoing` is a union over types; encodeServer checks type/payload pairing.
    const frame = (encodeServer as (t: string, p: unknown, s: number, r?: number) => string)(
      msg.type,
      msg.payload,
      seq++,
      msg.re,
    );
    opts.send(frame);
  };

  const conn: Conn = {
    id,
    send: sendOut,
    close: (code, reason) => opts.close(code, reason),
  };

  const sendError = (code: ErrorCode, message: string, re?: number): void =>
    sendOut(
      re === undefined
        ? { type: "error", payload: { code, message } }
        : { type: "error", payload: { code, message }, re },
    );

  function takeToken(): boolean {
    const t = now();
    const elapsed = Math.max(0, t - refilledAt) / 1000;
    tokens = Math.min(RATE_CAPACITY, tokens + elapsed * RATE_REFILL_PER_SEC);
    refilledAt = t;
    if (tokens < 1) return false;
    tokens -= 1;
    return true;
  }

  async function route(msg: ClientMessage): Promise<void> {
    const req = { conn, seq: msg.seq };
    let result: ServiceResult;
    switch (msg.type) {
      case "hello":
        sendOut({
          type: "welcome",
          payload: {
            serverVersion: opts.serverVersion,
            protocolVersion: PROTOCOL_VERSION,
            pushKey: opts.pushKey ?? null,
          },
          re: msg.seq,
        });
        return;
      case "ping":
        sendOut({ type: "pong", payload: { t: msg.payload.t }, re: msg.seq });
        return;
      case "createRoom":
        result = await service.createRoom(req, msg.payload.name, msg.payload.avatar);
        break;
      case "joinRoom":
        result = await service.joinRoom(
          req,
          msg.payload.room,
          msg.payload.name,
          msg.payload.avatar,
        );
        break;
      case "resumeRoom":
        result = await service.resumeRoom(req, msg.payload.room, msg.payload.token);
        break;
      case "leaveRoom":
        result = await service.leaveRoom(req);
        break;
      case "startGame": {
        const { mode, startingPlayer, turnTimer } = msg.payload;
        result = await service.startGame(req, {
          mode,
          ...(startingPlayer !== undefined ? { startingPlayer } : {}),
          ...(turnTimer !== undefined ? { turnTimer } : {}),
        });
        break;
      }
      case "setAvatar":
        result = await service.setAvatar(req, msg.payload.avatar);
        break;
      case "addBot":
        result = await service.addBot(req);
        break;
      case "removeBot":
        result = await service.removeBot(req, msg.payload.seat);
        break;
      case "gameAction":
        result = await service.gameAction(req, msg.payload.action);
        break;
      case "pushSubscribe":
        result = await service.pushSubscribe(req, msg.payload.subscription, msg.payload.lang);
        break;
      case "pushUnsubscribe":
        result = await service.pushUnsubscribe(req, msg.payload.endpoint);
        break;
      case "visibility":
        service.setVisibility(conn, msg.payload.visible);
        return;
      case "pauseGame":
        result = await service.pauseGame(req);
        break;
      case "resumeGame":
        result = await service.resumeGame(req);
        break;
      case "endGame":
        result = await service.endGame(req);
        break;
      case "lookupSeats":
        result = await service.lookupSeats(req, msg.payload.seats);
        break;
      case "endSavedGame":
        result = await service.endSavedGame(req, msg.payload.room, msg.payload.token);
        break;
    }
    if (result.ok) return;
    if ("error" in result) {
      sendError(result.error.code, result.error.message, msg.seq);
    } else {
      sendOut({
        type: "actionRejected",
        payload: { code: result.rejected.code, message: result.rejected.message },
        re: msg.seq,
      });
    }
  }

  async function process(raw: string): Promise<void> {
    const decoded = decodeClientMessage(raw);
    if (!decoded.ok) {
      sendError(decoded.error, decoded.detail);
      if (decoded.error === "version_mismatch") {
        opts.close(CloseCode.VersionMismatch, "protocol version mismatch");
      }
      return;
    }
    const msg = decoded.message;
    try {
      await route(msg);
    } catch (err) {
      log(
        `internal error on ${msg.type}: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`,
      );
      sendError("internal", "internal server error", msg.seq);
    }
  }

  function enqueue(task: () => Promise<void>): Promise<void> {
    const run = chain.then(task, task);
    chain = run.catch(() => {});
    return run;
  }

  return {
    handle(raw) {
      if (closing) return Promise.resolve();
      if (!takeToken()) {
        const re = peekSeq(raw);
        sendError("rate_limited", "too many messages", re);
        return Promise.resolve();
      }
      return enqueue(() => process(raw));
    },
    handleBinary() {
      if (closing) return;
      if (!takeToken()) {
        sendError("rate_limited", "too many messages");
        return;
      }
      sendError("bad_frame", "binary frames are not supported");
    },
    closed() {
      if (closing) return;
      closing = true;
      // Let in-flight and queued requests finish first so a late bind is undone.
      void enqueue(async () => {
        isClosed = true;
        service.disconnect(conn);
      });
    },
  };
}

/** Reads a top-level `seq` that appears before any nested object, without parsing. */
function peekSeq(raw: string): number | undefined {
  const m = /^\s*\{[^{}]*?"seq"\s*:\s*(\d{1,15})\s*[,}]/.exec(raw.slice(0, 512));
  return m ? Number(m[1]) : undefined;
}
