// RoomService: rooms, seats, actions and presence over abstract connections
// (design.md decisions 2, 5-8). Owner: rooms agent (bodies). The exported types and
// signatures are the contract the session layer codes against.
import type { RuleErrorCode } from "@hexfall/engine";
import type {
  ClientAction,
  ErrorCode,
  PayloadOf,
  ServerMessage,
  ServerMessageType,
  TurnTimerPreset,
} from "@hexfall/protocol";
import { StoreUnavailableError, type RoomMeta, type RoomStore } from "../store/types.ts";
import { generateCode, generateToken, hashToken, normalizeCode, validateName } from "./codes.ts";
import { BAD_TOKEN_MESSAGE, Room, fail, type RoomDeps } from "./room.ts";

/** A server message without envelope; the session adds `v` and `seq`. */
export type Outgoing = {
  [K in ServerMessageType]: { type: K; payload: PayloadOf<ServerMessage, K>; re?: number };
}[ServerMessageType];

/** One client connection as seen by the room layer. */
export interface Conn {
  /** Unique per socket. */
  readonly id: string;
  send(msg: Outgoing): void;
  close(code: number, reason: string): void;
}

/** The request being handled: replies to it carry `re: seq`. */
export interface Request {
  conn: Conn;
  seq: number;
}

/**
 * Outcome of a request. On success every reply was already sent through `conn.send`
 * (with `re`). On failure nothing was sent: the session sends `error` (for `error`)
 * or `actionRejected` (for `rejected`) with `re`.
 */
export type ServiceResult =
  | { ok: true }
  | { ok: false; error: { code: ErrorCode; message: string } }
  | { ok: false; rejected: { code: RuleErrorCode; message: string } };

export interface StartOptions {
  mode: "beginner" | "variable";
  startingPlayer?: number;
  /** Default "off". */
  turnTimer?: TurnTimerPreset;
}

/** Timer functions (injected by tests; default setTimeout/clearTimeout, unref'd). */
export interface TimerFns {
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
}

export interface RoomServiceOptions {
  store: RoomStore;
  /** Server clock (ms). Default Date.now. */
  now?: () => number;
  /** Turn timer scheduling. Default setTimeout/clearTimeout. */
  timers?: TimerFns;
  /** Evict a room from memory after this long with no connections. Default 10 min. */
  idleEvictMs?: number;
  log?: (msg: string) => void;
}

export interface RoomService {
  createRoom(req: Request, name: string): Promise<ServiceResult>;
  joinRoom(req: Request, room: string, name: string): Promise<ServiceResult>;
  resumeRoom(req: Request, room: string, token: string): Promise<ServiceResult>;
  leaveRoom(req: Request): Promise<ServiceResult>;
  startGame(req: Request, opts: StartOptions): Promise<ServiceResult>;
  gameAction(req: Request, action: ClientAction): Promise<ServiceResult>;
  /** The socket closed: mark the seat disconnected and broadcast presence. */
  disconnect(conn: Conn): void;
  /** Rooms currently held in memory (for /healthz). */
  loadedRooms(): number;
  /** Stops timers (eviction). */
  close(): void;
}

export function createRoomService(opts: RoomServiceOptions): RoomService {
  const { store } = opts;
  const now = opts.now ?? (() => Date.now());
  const idleEvictMs = opts.idleEvictMs ?? DEFAULT_IDLE_EVICT_MS;
  const log = opts.log ?? (() => {});
  const turnTimers: TimerFns = opts.timers ?? {
    setTimer(fn, ms) {
      const t = setTimeout(fn, ms);
      t.unref?.();
      return t;
    },
    clearTimer(handle) {
      clearTimeout(handle as ReturnType<typeof setTimeout>);
    },
  };

  const rooms = new Map<string, Room>();
  const loading = new Map<string, Promise<Room | null>>();
  /** conn id -> the room it holds a seat in. */
  const bound = new Map<string, Room>();
  /** conn ids with a create/join/resume in flight. */
  const claiming = new Set<string>();
  /** conn ids that closed while claiming a seat. */
  const closedWhileClaiming = new Set<string>();
  const timers = new Map<Room, ReturnType<typeof setTimeout>>();

  const cancelIdle = (room: Room) => {
    const t = timers.get(room);
    if (t !== undefined) {
      clearTimeout(t);
      timers.delete(room);
    }
  };
  const armIdle = (room: Room) => {
    if (timers.has(room) || room.deleted || rooms.get(room.code) !== room) return;
    if (room.connectedCount() > 0 || room.pending > 0) return;
    const t = setTimeout(() => {
      timers.delete(room);
      if (room.connectedCount() > 0 || room.pending > 0) return;
      if (rooms.get(room.code) === room) rooms.delete(room.code);
      // Evicted: its timer stops; a rebuild re-arms it from the stored anchor.
      room.disarm();
    }, idleEvictMs);
    t.unref?.();
    timers.set(room, t);
  };

  const deps: RoomDeps = {
    store,
    log,
    bind(conn, room) {
      bound.set(conn.id, room);
      cancelIdle(room);
    },
    unbind(conn) {
      const room = bound.get(conn.id);
      bound.delete(conn.id);
      if (room) armIdle(room);
    },
    deleted(room) {
      cancelIdle(room);
      room.disarm();
      if (rooms.get(room.code) === room) rooms.delete(room.code);
    },
    settled(room) {
      armIdle(room);
    },
    now,
    setTimer: (fn, ms) => turnTimers.setTimer(fn, ms),
    clearTimer: (handle) => turnTimers.clearTimer(handle),
  };

  /** The loaded room for `code`, loading (and rebuilding) it once if needed. */
  const getRoom = (code: string): Promise<Room | null> => {
    const have = rooms.get(code);
    if (have) return Promise.resolve(have);
    const inFlight = loading.get(code);
    if (inFlight) return inFlight;
    const p = (async () => {
      try {
        const loaded = await store.loadRoom(code);
        if (!loaded) return null;
        const existing = rooms.get(code);
        if (existing) return existing;
        const room = Room.fromLoaded(deps, loaded);
        rooms.set(code, room);
        armIdle(room);
        return room;
      } finally {
        loading.delete(code);
      }
    })();
    loading.set(code, p);
    return p;
  };

  /** Turns thrown errors into results: store outage -> unavailable, else internal. */
  const guard = async (what: string, fn: () => Promise<ServiceResult>): Promise<ServiceResult> => {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof StoreUnavailableError) {
        return fail("unavailable", "the room store is unavailable, try again");
      }
      log(`${what} failed: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`);
      return fail("internal", "internal server error");
    }
  };

  /** create/join/resume: the connection must not hold (or be claiming) a seat. */
  const claim = async (
    what: string,
    conn: Conn,
    fn: () => Promise<ServiceResult>,
  ): Promise<ServiceResult> => {
    if (bound.has(conn.id) || claiming.has(conn.id)) {
      return fail("already_in_room", "this connection already holds a seat");
    }
    claiming.add(conn.id);
    try {
      return await guard(what, fn);
    } finally {
      claiming.delete(conn.id);
      if (closedWhileClaiming.delete(conn.id)) disconnect(conn);
    }
  };

  /** leave/start/act: run against the room the connection is seated in. */
  const seated = (
    what: string,
    conn: Conn,
    fn: (room: Room) => Promise<ServiceResult>,
  ): Promise<ServiceResult> => {
    const room = bound.get(conn.id);
    if (!room) return Promise.resolve(fail("no_seat", "this connection holds no seat"));
    return guard(what, () => fn(room));
  };

  function disconnect(conn: Conn): void {
    if (claiming.has(conn.id)) closedWhileClaiming.add(conn.id);
    const room = bound.get(conn.id);
    if (!room) return;
    bound.delete(conn.id);
    room.detach(conn);
    armIdle(room);
  }

  return {
    createRoom(req, rawName) {
      return claim("createRoom", req.conn, async () => {
        const name = validateName(rawName);
        if (!name.ok) return fail("bad_name", name.message);
        const token = generateToken();
        for (let attempt = 0; attempt < CREATE_ATTEMPTS; attempt++) {
          const code = generateCode();
          if (rooms.has(code) || loading.has(code)) continue;
          const meta: RoomMeta = {
            code,
            rev: 0,
            status: "lobby",
            createdAt: now(),
            host: 0,
            seats: [{ name: name.name, tokenHash: hashToken(token) }],
            config: null,
          };
          const w = await store.createMeta(meta);
          if (!w.ok) {
            if (w.reason === "exists") continue;
            if (w.reason !== "unavailable") log(`createRoom ${code}: ${w.reason}`);
            return fail("unavailable", "the room store is unavailable, try again");
          }
          if (rooms.has(code)) continue;
          const room = new Room(deps, meta, null, 0);
          rooms.set(code, room);
          room.attachCreator(req, token);
          return { ok: true };
        }
        log(`createRoom: no free code after ${CREATE_ATTEMPTS} attempts`);
        return fail("unavailable", "could not allocate a room code, try again");
      });
    },

    joinRoom(req, rawCode, name) {
      return claim("joinRoom", req.conn, async () => {
        const code = normalizeCode(rawCode);
        if (!code) return fail("room_not_found", "no room with that code");
        const room = await getRoom(code);
        if (!room) return fail("room_not_found", "no room with that code");
        return room.join(req, name);
      });
    },

    resumeRoom(req, rawCode, token) {
      return claim("resumeRoom", req.conn, async () => {
        const code = normalizeCode(rawCode);
        if (!code) return fail("bad_token", BAD_TOKEN_MESSAGE);
        const room = await getRoom(code);
        if (!room) return fail("bad_token", BAD_TOKEN_MESSAGE);
        const r = await room.resume(req, token);
        // A room deleted while this request was queued must look like any unknown room.
        if (!r.ok && "error" in r && r.error.code === "room_not_found") {
          return fail("bad_token", BAD_TOKEN_MESSAGE);
        }
        return r;
      });
    },

    leaveRoom(req) {
      return seated("leaveRoom", req.conn, (room) => room.leave(req));
    },

    startGame(req, startOpts) {
      return seated("startGame", req.conn, (room) => room.start(req, startOpts));
    },

    gameAction(req, action) {
      return seated("gameAction", req.conn, (room) => room.act(req, action));
    },

    disconnect,

    loadedRooms() {
      return rooms.size;
    },

    close() {
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
      for (const room of rooms.values()) room.disarm();
    },
  };
}

const DEFAULT_IDLE_EVICT_MS = 10 * 60 * 1000;
const CREATE_ATTEMPTS = 10;
