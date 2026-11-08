// RoomService: rooms, seats, actions and presence over abstract connections
// (design.md decisions 2, 5-8). Owner: rooms agent (bodies). The exported types and
// signatures are the contract the session layer codes against.
import type { RuleErrorCode } from "@hexfall/engine";
import {
  MAX_LOOKUP_SEATS,
  type ClientAction,
  type PushSubscriptionJSON,
  type ErrorCode,
  type PayloadOf,
  type AvatarId,
  type BotLevel,
  type SeatInfoEntry,
  type ServerMessage,
  type ServerMessageType,
  type TurnTimerPreset,
} from "@hexfall/protocol";
import type { TurnNotifier } from "../push/notify.ts";
import type { PushStore } from "../push/store.ts";
import { StoreUnavailableError, type RoomMeta, type RoomStore } from "../store/types.ts";
import { firstFreeAvatar } from "./avatars.ts";
import {
  generateCode,
  generateToken,
  hashToken,
  normalizeCode,
  tokenMatches,
  validateName,
} from "./codes.ts";
import { BAD_TOKEN_MESSAGE, Room, fail, type RoomDeps } from "./room.ts";

/** A server message without envelope; the session adds `v` and `seq`. */
export type Outgoing = {
  [K in ServerMessageType]: { type: K; payload: PayloadOf<ServerMessage, K>; re?: number };
}[ServerMessageType];

/** One client connection as seen by the room layer. */
export interface Conn {
  /** Unique per socket. */
  readonly id: string;
  /** Page visibility reported by the client; unset counts as visible (game-server "Connection visibility"). */
  visible?: boolean;
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
  /** Web Push, only when the server has VAPID keys (game-server "Push configuration"). */
  push?: { store: PushStore; notifier: TurnNotifier };
}

export interface RoomService {
  createRoom(req: Request, name: string, avatar?: AvatarId): Promise<ServiceResult>;
  joinRoom(req: Request, room: string, name: string, avatar?: AvatarId): Promise<ServiceResult>;
  setAvatar(req: Request, avatar: AvatarId): Promise<ServiceResult>;
  resumeRoom(req: Request, room: string, token: string): Promise<ServiceResult>;
  leaveRoom(req: Request): Promise<ServiceResult>;
  startGame(req: Request, opts: StartOptions): Promise<ServiceResult>;
  /** Host only, lobby only: seat a bot / remove the bot in `seat`. */
  addBot(req: Request, level?: BotLevel): Promise<ServiceResult>;
  removeBot(req: Request, seat: number): Promise<ServiceResult>;
  /** Host only, lobby only: set the level of the bot in `seat`. */
  setBotLevel(req: Request, seat: number, level: BotLevel): Promise<ServiceResult>;
  gameAction(req: Request, action: ClientAction): Promise<ServiceResult>;
  /** In-game chat line from a seated connection (memory only). */
  chat(req: Request, text: string): Promise<ServiceResult>;
  /** Host only: pause / resume / end the game early (pause-and-resume-games). */
  pauseGame(req: Request): Promise<ServiceResult>;
  resumeGame(req: Request): Promise<ServiceResult>;
  endGame(req: Request): Promise<ServiceResult>;
  /**
   * Answers `seatsInfo` with the status of each room a token holds a seat in. Reads stored
   * metadata only: no seat, no presence change, no expiry refresh (saved-games).
   */
  lookupSeats(
    req: Request,
    seats: readonly { room: string; token: string }[],
  ): Promise<ServiceResult>;
  /**
   * The host ends a game from the saved games list (seat proven by token, not taken).
   * Answers `seatsInfo` with that one room.
   */
  endSavedGame(req: Request, room: string, token: string): Promise<ServiceResult>;
  /** Stores a Web Push subscription for the connection's seat (no-op when push is off). */
  pushSubscribe(req: Request, sub: PushSubscriptionJSON, lang: string): Promise<ServiceResult>;
  pushUnsubscribe(req: Request, endpoint: string): Promise<ServiceResult>;
  /** The connection's page became visible or hidden. */
  setVisibility(conn: Conn, visible: boolean): void;
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

  const push = opts.push ?? null;
  /** Runs a push-store cleanup in the background; failures are only logged. */
  const cleanup = (what: string, p: Promise<void>) =>
    void p.catch((e: unknown) => log(`push ${what} failed: ${String(e)}`));

  const deps: RoomDeps = {
    store,
    log,
    bind(conn, room) {
      bound.set(conn.id, room);
      conn.visible = true;
      cancelIdle(room);
    },
    unbind(conn) {
      const room = bound.get(conn.id);
      bound.delete(conn.id);
      if (room) armIdle(room);
    },
    deleted(room) {
      if (push) cleanup("clearRoom", push.store.clearRoom(room.code));
      cancelIdle(room);
      room.disarm();
      if (rooms.get(room.code) === room) rooms.delete(room.code);
    },
    settled(room) {
      armIdle(room);
    },
    seatLeft(room, tokenHash) {
      if (push) cleanup("clearHolder", push.store.clearHolder(room.code, tokenHash));
    },
    expiryChanged(room, ttlMs) {
      if (push) cleanup("touch", push.store.touch(room.code, ttlMs));
    },
    waitsChanged(room, before, after) {
      if (!push) return;
      push.notifier.waitsChanged({
        room: room.code,
        before,
        after,
        holders: room.meta.seats.map((s) => s.tokenHash),
        visible: (seat) => {
          const c = room.conns[seat];
          return c != null && c.visible !== false;
        },
        deadline: room.deadline(),
        now: now(),
      });
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

  /** One saved-games entry; a missing room and a wrong token look the same. */
  async function lookupOne(rawCode: string, token: string): Promise<SeatInfoEntry> {
    const code = normalizeCode(rawCode);
    const gone: SeatInfoEntry = { room: code ?? rawCode, status: "gone" };
    if (!code) return gone;
    const stored = await store.loadMeta(code);
    if (!stored) return gone;
    const { meta, ttlMs, lastActionAt } = stored;
    let seat = -1;
    for (const [i, s] of meta.seats.entries()) {
      if (tokenMatches(token, s.tokenHash)) seat = i;
    }
    if (seat < 0) return gone;
    // A room already in memory gives the turn and a natural game end; never load one for this.
    const held = rooms.get(code);
    const live = held && !held.deleted && held.meta.rev === meta.rev ? held : null;
    return {
      room: code,
      status: live ? live.status() : meta.status,
      seat,
      host: meta.host,
      names: meta.seats.map((s) => s.name),
      bots: meta.seats.map((s) => s.bot === true),
      turn: live?.state && meta.status !== "lobby" ? live.state.turn.number : null,
      pausedAt: meta.status === "paused" ? (meta.pausedAt ?? null) : null,
      expiresAt: now() + ttlMs,
      createdAt: meta.createdAt,
      startedAt: meta.startedAt ?? null,
      lastActiveAt: lastActive(meta, lastActionAt),
    };
  }

  function disconnect(conn: Conn): void {
    if (claiming.has(conn.id)) closedWhileClaiming.add(conn.id);
    const room = bound.get(conn.id);
    if (!room) return;
    bound.delete(conn.id);
    room.detach(conn);
    armIdle(room);
  }

  return {
    createRoom(req, rawName, avatar) {
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
            seats: [
              {
                name: name.name,
                tokenHash: hashToken(token),
                avatar: avatar ?? firstFreeAvatar([]),
              },
            ],
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

    joinRoom(req, rawCode, name, avatar) {
      return claim("joinRoom", req.conn, async () => {
        const code = normalizeCode(rawCode);
        if (!code) return fail("room_not_found", "no room with that code");
        const room = await getRoom(code);
        if (!room) return fail("room_not_found", "no room with that code");
        return room.join(req, name, avatar);
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

    setAvatar(req, avatar) {
      return seated("setAvatar", req.conn, (room) => room.setAvatar(req, avatar));
    },

    addBot(req, level) {
      return seated("addBot", req.conn, (room) => room.addBot(req, level));
    },

    removeBot(req, seat) {
      return seated("removeBot", req.conn, (room) => room.removeBot(req, seat));
    },

    setBotLevel(req, seat, level) {
      return seated("setBotLevel", req.conn, (room) => room.setBotLevel(req, seat, level));
    },

    gameAction(req, action) {
      return seated("gameAction", req.conn, (room) => room.act(req, action));
    },

    chat(req, text) {
      return seated("chat", req.conn, async (room) => room.chat(req, text));
    },

    pauseGame(req) {
      return seated("pauseGame", req.conn, (room) => room.pause(req));
    },

    resumeGame(req) {
      return seated("resumeGame", req.conn, (room) => room.resumeGame(req));
    },

    endGame(req) {
      return seated("endGame", req.conn, (room) => room.end(req));
    },

    lookupSeats(req, seats) {
      return guard("lookupSeats", async () => {
        if (seats.length > MAX_LOOKUP_SEATS) {
          return fail("bad_frame", `at most ${MAX_LOOKUP_SEATS} rooms per lookup`);
        }
        const entries: SeatInfoEntry[] = [];
        for (const { room, token } of seats) entries.push(await lookupOne(room, token));
        req.conn.send({ type: "seatsInfo", payload: { rooms: entries }, re: req.seq });
        return { ok: true };
      });
    },

    endSavedGame(req, rawCode, token) {
      return guard("endSavedGame", async () => {
        const code = normalizeCode(rawCode);
        const room = code ? await getRoom(code) : null;
        if (!code || !room) return fail("bad_token", BAD_TOKEN_MESSAGE);
        const r = await room.endWithToken(req, token);
        if (!r.ok) {
          return "error" in r && r.error.code === "room_not_found"
            ? fail("bad_token", BAD_TOKEN_MESSAGE)
            : r;
        }
        const entry = await lookupOne(code, token);
        req.conn.send({ type: "seatsInfo", payload: { rooms: [entry] }, re: req.seq });
        return { ok: true };
      });
    },

    pushSubscribe(req, sub, lang) {
      return seated("pushSubscribe", req.conn, async (room) => {
        if (!push) return { ok: true };
        const holder = room.meta.seats[room.seatOf(req.conn)]?.tokenHash;
        if (!holder) return fail("no_seat", "this connection holds no seat");
        await push.store.add(room.code, holder, { ...sub, lang });
        return { ok: true };
      });
    },

    pushUnsubscribe(req, endpoint) {
      return seated("pushUnsubscribe", req.conn, async (room) => {
        if (!push) return { ok: true };
        const holder = room.meta.seats[room.seatOf(req.conn)]?.tokenHash;
        if (!holder) return fail("no_seat", "this connection holds no seat");
        await push.store.remove(room.code, holder, endpoint);
        return { ok: true };
      });
    },

    setVisibility(conn, visible) {
      conn.visible = visible;
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

/** Latest known activity: last move, pause, resume, early end or start (not the lobby). */
function lastActive(meta: RoomMeta, lastActionAt: number | null): number | null {
  const lastPause = meta.pauses?.at(-1);
  const times = [
    lastActionAt,
    meta.pausedAt,
    lastPause ? lastPause.at + lastPause.ms : undefined,
    meta.result?.at,
    meta.startedAt,
  ].filter((t): t is number => typeof t === "number");
  return times.length > 0 ? Math.max(...times) : null;
}

const DEFAULT_IDLE_EVICT_MS = 10 * 60 * 1000;
const CREATE_ATTEMPTS = 10;
