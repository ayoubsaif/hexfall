// One room: lobby seats, start, the serial action queue, per-seat broadcasts and the
// turn timer (design.md decisions 5, 6 and 8; floating-hud-turn-timer decisions 2-4).
// Every store write happens before any broadcast.
import {
  applyAction,
  createGame,
  legalActions,
  playerView,
  type Action,
  type GameConfig,
  type GameState,
} from "@hexfall/engine";
import {
  CloseCode,
  type ClientAction,
  type RoomStatus,
  type TimerInfo,
  type TurnTimerPreset,
} from "@hexfall/protocol";
import {
  SNAPSHOT_EVERY,
  type ActionRecord,
  type GameConfigRecord,
  type LoadedRoom,
  type RoomMeta,
  type RoomStore,
  type Snapshot,
  type WriteResult,
} from "../store/types.ts";
import { generateSeed, generateToken, hashToken, tokenMatches, validateName } from "./codes.ts";
import type { Conn, Outgoing, Request, ServiceResult, StartOptions } from "./service.ts";
import { deadlineOf, nextAnchor, timerInfo } from "./timer.ts";

export const MAX_SEATS = 4;
export const MIN_PLAYERS = 3;
/** Delay before retrying a timeout whose store write failed. */
export const TIMEOUT_RETRY_MS = 5_000;

/** A stored room could not be rebuilt (bad snapshot or an action the engine refuses). */
export class ReplayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReplayError";
  }
}

export interface RoomDeps {
  store: RoomStore;
  log: (msg: string) => void;
  /** `conn` now holds a seat in `room`. */
  bind(conn: Conn, room: Room): void;
  /** `conn` no longer holds a seat. */
  unbind(conn: Conn): void;
  /** The room was deleted from the store (last player left, or it vanished). */
  deleted(room: Room): void;
  /** A queued operation finished (eviction bookkeeping). */
  settled(room: Room): void;
  /** Server clock (ms). */
  now(): number;
  /** Schedules `fn` after `ms` (setTimeout in production, a fake scheduler in tests). */
  setTimer(fn: () => void, ms: number): unknown;
  clearTimer(handle: unknown): void;
}

export const fail = (
  code: Extract<ServiceResult, { error: unknown }>["error"]["code"],
  message: string,
): ServiceResult => ({
  ok: false,
  error: { code, message },
});
const OK: ServiceResult = { ok: true };
const UNAVAILABLE = fail("unavailable", "the room store is unavailable, try again");

export function gameConfig(rec: GameConfigRecord): GameConfig {
  return {
    seed: rec.seed,
    mode: rec.mode,
    playerCount: rec.playerCount,
    ...(rec.startingPlayer !== undefined ? { startingPlayer: rec.startingPlayer } : {}),
  };
}

/** A rebuilt game and its turn timer anchor. */
export interface Rebuilt {
  state: GameState;
  anchor: number;
}

/**
 * Rebuilds a started game: snapshot (or a fresh game) plus the stored actions after it,
 * replaying the timer anchor alongside. Data stored before the timer (no `startedAt`,
 * snapshot `anchor` or record `at`) anchors at `loadTime`.
 */
export function rebuildState(loaded: LoadedRoom, loadTime: number): Rebuilt {
  const { meta, snapshot, actions } = loaded;
  if (!meta.config) throw new ReplayError(`room ${meta.code} is ${meta.status} but has no config`);
  let state: GameState;
  try {
    state = snapshot?.state ?? createGame(gameConfig(meta.config));
  } catch (e) {
    throw new ReplayError(`room ${meta.code}: cannot create game: ${String(e)}`);
  }
  let anchor = (snapshot ? snapshot.anchor : meta.startedAt) ?? loadTime;
  const base = snapshot?.version ?? 0;
  if (base + actions.length !== loaded.version) {
    throw new ReplayError(
      `room ${meta.code}: snapshot ${base} + ${actions.length} actions != version ${loaded.version}`,
    );
  }
  for (const [i, record] of actions.entries()) {
    const r = applyAction(state, record.action);
    if (!r.ok) {
      throw new ReplayError(
        `room ${meta.code}: replay of action ${base + i} (${record.action.type}) failed: ${r.code} ${r.message}`,
      );
    }
    anchor = nextAnchor(anchor, state, record, r.state, loadTime);
    state = r.state;
  }
  return { state, anchor };
}

export class Room {
  readonly code: string;
  meta: RoomMeta;
  state: GameState | null;
  /** Number of actions applied to `state`. */
  version: number;
  /** Index = seat; null when that seat has no live connection. */
  conns: (Conn | null)[];
  /** Deleted from the store; no further operations. */
  deleted = false;
  /** In-memory copy may be behind the store (conflict): reload before the next operation. */
  stale = false;
  /** Queued or running operations. */
  pending = 0;
  /** Turn timer anchor (server ms): the deadline is anchor + the current wait's duration. */
  anchor: number;
  private queue: Promise<unknown> = Promise.resolve();
  private readonly deps: RoomDeps;
  /** Pending timer handle (deadline or retry), if any. */
  private timerHandle: unknown = null;
  /** `version` when the pending timer was armed; a fire at any other version is dropped. */
  private armedVersion = -1;

  constructor(
    deps: RoomDeps,
    meta: RoomMeta,
    state: GameState | null,
    version: number,
    anchor = meta.startedAt ?? deps.now(),
  ) {
    this.deps = deps;
    this.code = meta.code;
    this.meta = meta;
    this.state = state;
    this.version = version;
    this.anchor = anchor;
    this.conns = meta.seats.map(() => null);
  }

  /**
   * Builds a room from stored data and arms its timer (a deadline that already passed
   * fires at once). Throws ReplayError if the game cannot be rebuilt.
   */
  static fromLoaded(deps: RoomDeps, loaded: LoadedRoom): Room {
    const now = deps.now();
    if (loaded.meta.status === "lobby") {
      return new Room(deps, loaded.meta, null, loaded.version, now);
    }
    const { state, anchor } = rebuildState(loaded, now);
    const room = new Room(deps, loaded.meta, state, loaded.version, anchor);
    room.arm();
    return room;
  }

  status(): RoomStatus {
    if (this.meta.status === "playing" && this.state?.phase.kind === "ended") return "ended";
    return this.meta.status;
  }

  /** The room's timer preset ("off" for rooms stored before the timer). */
  preset(): TurnTimerPreset {
    return this.meta.turnTimer ?? "off";
  }

  /** Server-clock deadline of the current wait, or null (timer off, lobby, game over). */
  deadline(): number | null {
    if (!this.state || this.meta.status === "lobby") return null;
    return deadlineOf(this.state, this.anchor, this.preset());
  }

  /** The countdown for a message built now. */
  timer(): TimerInfo {
    if (!this.state || this.meta.status === "lobby") return null;
    return timerInfo(this.state, this.anchor, this.preset(), this.deps.now());
  }

  seatOf(conn: Conn): number {
    return this.conns.findIndex((c) => c?.id === conn.id);
  }

  connectedCount(): number {
    return this.conns.filter((c) => c !== null).length;
  }

  /** Runs `fn` after every earlier operation of this room (strict arrival order). */
  run(fn: () => Promise<ServiceResult>): Promise<ServiceResult> {
    this.pending++;
    const p = this.queue.then(async () => {
      if (this.deleted) return fail("room_not_found", "the room no longer exists");
      if (this.stale) {
        const r = await this.reload();
        if (!r.ok) return r;
      }
      return fn();
    });
    this.queue = p.then(
      () => undefined,
      () => undefined,
    );
    return p.finally(() => {
      this.pending--;
      this.deps.settled(this);
    });
  }

  // ---- lobby

  /** Seats `conn` (first seat when the room was just created) and replies. */
  attachCreator(req: Request, token: string): void {
    this.conns[0] = req.conn;
    this.deps.bind(req.conn, this);
    this.send(req.conn, { type: "roomJoined", payload: { room: this.code, seat: 0, token } }, req);
    this.broadcastRoomState(req);
  }

  join(req: Request, rawName: string): Promise<ServiceResult> {
    return this.run(async () => {
      if (this.status() !== "lobby") return fail("game_started", "the game has already started");
      if (this.meta.seats.length >= MAX_SEATS) return fail("room_full", "the room is full");
      const name = validateName(
        rawName,
        this.meta.seats.map((s) => s.name),
      );
      if (!name.ok) return fail("bad_name", name.message);
      const token = generateToken();
      const seat = this.meta.seats.length;
      const next: RoomMeta = {
        ...this.meta,
        rev: this.meta.rev + 1,
        seats: [...this.meta.seats, { name: name.name, tokenHash: hashToken(token) }],
      };
      const w = await this.saveMeta(next);
      if (w) return w;
      this.conns[seat] = req.conn;
      this.deps.bind(req.conn, this);
      this.send(req.conn, { type: "roomJoined", payload: { room: this.code, seat, token } }, req);
      this.broadcastRoomState(req);
      return OK;
    });
  }

  resume(req: Request, token: string): Promise<ServiceResult> {
    return this.run(async () => {
      let seat = -1;
      for (const [i, s] of this.meta.seats.entries()) {
        if (tokenMatches(token, s.tokenHash)) seat = i;
      }
      if (seat < 0) return fail("bad_token", BAD_TOKEN_MESSAGE);
      const old = this.conns[seat];
      if (old) {
        this.conns[seat] = null;
        this.deps.unbind(old);
        try {
          old.close(CloseCode.Replaced, "seat resumed from another connection");
        } catch (e) {
          this.deps.log(`room ${this.code}: closing replaced connection failed: ${String(e)}`);
        }
      }
      this.conns[seat] = req.conn;
      this.deps.bind(req.conn, this);
      this.send(req.conn, { type: "roomJoined", payload: { room: this.code, seat } }, req);
      this.broadcastRoomState(req);
      if (this.state) this.sendSnapshot(seat, req);
      return OK;
    });
  }

  leave(req: Request): Promise<ServiceResult> {
    return this.run(async () => {
      const seat = this.seatOf(req.conn);
      if (seat < 0) return fail("no_seat", "this connection holds no seat");
      if (this.status() !== "lobby") return fail("game_started", "cannot leave after the start");
      const conn = req.conn;
      if (this.meta.seats.length === 1) {
        const w = await this.deps.store.deleteRoom(this.code);
        if (!w.ok) return this.writeFailed(w);
        this.conns = [];
        this.deleted = true;
        this.disarm();
        this.deps.unbind(conn);
        this.send(conn, { type: "roomLeft", payload: { room: this.code } }, req);
        this.deps.deleted(this);
        return OK;
      }
      const host = this.meta.host;
      const next: RoomMeta = {
        ...this.meta,
        rev: this.meta.rev + 1,
        seats: this.meta.seats.filter((_, i) => i !== seat),
        host: host === seat ? 0 : host > seat ? host - 1 : host,
      };
      const w = await this.saveMeta(next);
      if (w) return w;
      this.conns.splice(seat, 1);
      this.deps.unbind(conn);
      this.send(conn, { type: "roomLeft", payload: { room: this.code } }, req);
      this.broadcastRoomState();
      return OK;
    });
  }

  start(req: Request, opts: StartOptions): Promise<ServiceResult> {
    return this.run(async () => {
      const seat = this.seatOf(req.conn);
      if (seat < 0) return fail("no_seat", "this connection holds no seat");
      if (this.status() !== "lobby") return fail("game_started", "the game has already started");
      if (seat !== this.meta.host) return fail("not_host", "only the host can start the game");
      const count = this.meta.seats.length;
      if (count < MIN_PLAYERS || count > MAX_SEATS) {
        return fail(
          "not_enough_players",
          `need ${MIN_PLAYERS}-${MAX_SEATS} players, have ${count}`,
        );
      }
      const sp = opts.startingPlayer;
      if (sp !== undefined && (!Number.isInteger(sp) || sp < 0 || sp >= count)) {
        return fail("bad_frame", `startingPlayer must be a seat below ${count}`);
      }
      const config: GameConfigRecord = {
        seed: generateSeed(),
        mode: opts.mode,
        playerCount: count as 3 | 4,
        ...(sp !== undefined ? { startingPlayer: sp } : {}),
      };
      const state = createGame(gameConfig(config));
      const startedAt = this.deps.now();
      const next: RoomMeta = {
        ...this.meta,
        rev: this.meta.rev + 1,
        status: "playing",
        config,
        turnTimer: opts.turnTimer ?? "off",
        startedAt,
      };
      const w = await this.saveMeta(next);
      if (w) return w;
      this.state = state;
      this.version = 0;
      this.anchor = startedAt;
      this.broadcastRoomState(req);
      for (const [s, c] of this.conns.entries()) {
        if (c) this.sendSnapshot(s, c.id === req.conn.id ? req : undefined);
      }
      this.arm();
      return OK;
    });
  }

  // ---- game

  act(req: Request, action: ClientAction): Promise<ServiceResult> {
    return this.run(async () => {
      const seat = this.seatOf(req.conn);
      if (seat < 0) return fail("no_seat", "this connection holds no seat");
      return this.commit({ ...action, seat } as Action, this.deps.now(), { req, seat });
    });
  }

  /**
   * Applies `action` (accepted at server time `at`), stores it, tells every seat, then
   * re-arms the timer. Runs inside `run()`. `by` is the requesting player, if any.
   */
  private async commit(
    action: Action,
    at: number,
    by?: { req: Request; seat: number },
  ): Promise<ServiceResult> {
    const state = this.state;
    if (!state || this.meta.status === "lobby") {
      return {
        ok: false,
        rejected: { code: "wrong_phase", message: "the game has not started" },
      };
    }
    const r = applyAction(state, action);
    if (!r.ok) return { ok: false, rejected: { code: r.code, message: r.message } };
    const next = r.state;
    const version = this.version + 1;
    const ended = next.phase.kind === "ended";
    const record: ActionRecord = { action, at };
    const anchor = nextAnchor(this.anchor, state, record, next, at);
    const snapshot: Snapshot | undefined =
      version % SNAPSHOT_EVERY === 0 || ended ? { version, state: next, anchor } : undefined;
    const w = await this.deps.store.appendAction(this.code, this.version, record, snapshot);
    if (!w.ok) return this.writeFailed(w);
    const oldLen = state.log.length;
    this.state = next;
    this.version = version;
    this.anchor = anchor;
    if (ended && this.meta.status === "playing") {
      const meta: RoomMeta = { ...this.meta, rev: this.meta.rev + 1, status: "ended" };
      try {
        const m = await this.deps.store.saveMeta(meta, this.meta.rev);
        if (m.ok) this.meta = meta;
        else this.deps.log(`room ${this.code}: saving ended status failed: ${m.reason}`);
      } catch (e) {
        this.deps.log(`room ${this.code}: saving ended status failed: ${String(e)}`);
      }
    }
    const timer = this.timer();
    for (const [s, c] of this.conns.entries()) {
      if (!c) continue;
      const view = playerView(next, s);
      this.send(
        c,
        {
          type: "gameUpdate",
          payload: {
            version,
            view: { ...view, log: [] },
            events: view.log.slice(oldLen),
            logLength: next.log.length,
            legal: legalActions(next, s),
            timer,
          },
        },
        by && s === by.seat ? by.req : undefined,
      );
    }
    if (ended) this.broadcastRoomState();
    this.arm();
    return OK;
  }

  // ---- turn timer

  /** (Re)schedules the timer for the current deadline; clears it when there is none. */
  arm(): void {
    this.disarm();
    if (this.deleted) return;
    const deadline = this.deadline();
    if (deadline === null) return;
    this.schedule(Math.max(0, deadline - this.deps.now()));
  }

  /** Cancels any pending deadline or retry (delete, evict, shutdown). */
  disarm(): void {
    if (this.timerHandle !== null) {
      this.deps.clearTimer(this.timerHandle);
      this.timerHandle = null;
    }
  }

  private schedule(ms: number): void {
    this.armedVersion = this.version;
    // The callback returns the fire's promise (it never rejects) so a fake scheduler can
    // await it; setTimeout ignores it.
    this.timerHandle = this.deps.setTimer(() => {
      this.timerHandle = null;
      return this.fire();
    }, ms);
  }

  /** The deadline passed: apply `timeout` through the normal commit path, unless stale. */
  private fire(): Promise<ServiceResult> {
    const armed = this.armedVersion;
    const retry = () => {
      if (this.timerHandle === null && !this.deleted) this.schedule(TIMEOUT_RETRY_MS);
    };
    return this.run(async () => {
      // A player's action (or a reload) moved the game on: that path re-armed already.
      if (this.version !== armed) return OK;
      const deadline = this.deadline();
      if (deadline === null) return OK;
      const now = this.deps.now();
      if (now < deadline) {
        this.arm();
        return OK;
      }
      const r = await this.commit({ type: "timeout" }, now);
      if (!r.ok) {
        if ("error" in r) {
          // Store outage or conflict (a conflict reloads before the retry).
          this.deps.log(`room ${this.code}: timeout not stored (${r.error.message}); retrying`);
          retry();
        } else {
          this.deps.log(
            `room ${this.code}: engine refused timeout: ${r.rejected.code} ${r.rejected.message}`,
          );
        }
      }
      return r;
    }).catch((e: unknown) => {
      this.deps.log(
        `room ${this.code}: timeout failed: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`,
      );
      retry();
      return fail("internal", "timeout failed");
    });
  }

  // ---- presence

  /** The socket closed: free the seat's connection and tell the others. */
  detach(conn: Conn): void {
    const seat = this.seatOf(conn);
    if (seat < 0) return;
    this.conns[seat] = null;
    this.broadcastRoomState();
  }

  // ---- messages

  roomState(): Outgoing {
    return {
      type: "roomState",
      payload: {
        room: this.code,
        status: this.status(),
        host: this.meta.host,
        seats: this.meta.seats.map((s, seat) => ({
          seat,
          name: s.name,
          connected: this.conns[seat] != null,
        })),
      },
    };
  }

  /** roomState to every connected seat (`req`'s connection gets `re`). */
  broadcastRoomState(req?: Request): void {
    const msg = this.roomState();
    for (const c of this.conns) {
      if (c) this.send(c, msg, req && c.id === req.conn.id ? req : undefined);
    }
  }

  sendSnapshot(seat: number, req?: Request): void {
    const c = req?.conn ?? this.conns[seat];
    if (!c || !this.state) return;
    this.send(
      c,
      {
        type: "gameSnapshot",
        payload: {
          version: this.version,
          view: playerView(this.state, seat),
          legal: legalActions(this.state, seat),
          timer: this.timer(),
        },
      },
      req,
    );
  }

  private send(conn: Conn, msg: Outgoing, req?: Request): void {
    try {
      conn.send(req ? { ...msg, re: req.seq } : msg);
    } catch (e) {
      this.deps.log(`room ${this.code}: send to ${conn.id} failed: ${String(e)}`);
    }
  }

  // ---- store

  /** Writes `next` and swaps it in; returns an error result on failure. */
  private async saveMeta(next: RoomMeta): Promise<ServiceResult | null> {
    const w = await this.deps.store.saveMeta(next, this.meta.rev);
    if (!w.ok) return this.writeFailed(w);
    this.meta = next;
    return null;
  }

  private writeFailed(w: Extract<WriteResult, { ok: false }>): ServiceResult {
    if (w.reason !== "unavailable") {
      this.deps.log(`room ${this.code}: store write failed (${w.reason}); reloading on next use`);
      this.stale = true;
    }
    return UNAVAILABLE;
  }

  /** Replaces the in-memory copy with the stored one, keeping connections by seat. */
  private async reload(): Promise<ServiceResult> {
    const loaded = await this.deps.store.loadRoom(this.code);
    if (!loaded) {
      for (const c of this.conns) if (c) this.deps.unbind(c);
      this.conns = [];
      this.deleted = true;
      this.disarm();
      this.deps.deleted(this);
      return fail("room_not_found", "the room no longer exists");
    }
    const now = this.deps.now();
    const rebuilt = loaded.meta.status === "lobby" ? null : rebuildState(loaded, now);
    this.meta = loaded.meta;
    this.state = rebuilt?.state ?? null;
    this.anchor = rebuilt?.anchor ?? now;
    this.version = loaded.version;
    const conns = loaded.meta.seats.map((_, i) => this.conns[i] ?? null);
    for (const c of this.conns.slice(conns.length)) if (c) this.deps.unbind(c);
    this.conns = conns;
    this.stale = false;
    this.arm();
    return OK;
  }
}

export const BAD_TOKEN_MESSAGE = "unknown room or seat token";
