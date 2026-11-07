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
import { BotRng, chooseAction } from "@hexfall/bots";
import { chooseAvatar, resolveAvatars } from "./avatars.ts";
import {
  CHAT_HISTORY,
  CHAT_MAX_LENGTH,
  CloseCode,
  type AvatarId,
  type ChatEntry,
  type ClientAction,
  type RoomStatus,
  type TimerInfo,
  type TurnTimerPreset,
} from "@hexfall/protocol";
import {
  ENDED_EARLY_TTL_MS,
  MAX_PAUSES,
  PAUSED_TTL_MS,
  ROOM_TTL_MS,
  SNAPSHOT_EVERY,
  type ActionRecord,
  type GameConfigRecord,
  type LoadedRoom,
  type RoomMeta,
  type RoomStore,
  type Snapshot,
  type WriteResult,
} from "../store/types.ts";
import {
  botName,
  generateSeed,
  generateToken,
  hashToken,
  tokenMatches,
  validateName,
} from "./codes.ts";
import type { Conn, Outgoing, Request, ServiceResult, StartOptions } from "./service.ts";
import { earlyResult } from "./result.ts";
import { deadlineOf, nextAnchor, timerInfo, waitingSeats } from "./timer.ts";

export const MAX_SEATS = 4;
export const MIN_PLAYERS = 3;
/** Delay before retrying a timeout whose store write failed. */
export const TIMEOUT_RETRY_MS = 5_000;
/** Pause before each bot move while someone is connected, so humans can follow. */
export const BOT_DELAY_MS = 1_200;
/** Longer pause before a bot starts its turn (its roll), so the previous turn can be read. */
export const BOT_TURN_DELAY_MS = 2_200;
/** Pause before a bot moves when nobody is connected. */
export const BOT_FAST_MS = 25;

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
  /** The game moved from `before` (null at start) to `after`, already stored and sent. */
  waitsChanged?(room: Room, before: GameState | null, after: GameState): void;
  /** A seat left the lobby; `tokenHash` identified it. */
  seatLeft?(room: Room, tokenHash: string): void;
  /** The room's stored expiry changed (pause, resume, early end); `ttlMs` is the new TTL. */
  expiryChanged?(room: Room, ttlMs: number): void;
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
  return { state, anchor: anchor + pausedSince(meta, anchor) };
}

/**
 * Total length of the completed pauses that began while `anchor` was in force (at or after
 * it): the countdown did not run during them (pause-and-resume-games design decision 2).
 */
export function pausedSince(meta: RoomMeta, anchor: number): number {
  let ms = 0;
  for (const p of meta.pauses ?? []) if (p.at >= anchor) ms += p.ms;
  return ms;
}

/** `meta` without its pause time. */
function withoutPause(meta: RoomMeta): RoomMeta {
  const next = { ...meta };
  delete next.pausedAt;
  return next;
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
  /** Pending bot move timer, if any. */
  private botHandle: unknown = null;
  /** `version` when the bot timer was armed; a fire at any other version is dropped. */
  private botVersion = -1;

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

  /** No countdown and no game actions: paused, or ended early by the host. */
  frozen(): boolean {
    return this.meta.status === "paused" || this.meta.result !== undefined;
  }

  /** Server-clock deadline of the current wait, or null (timer off, lobby, paused, game over). */
  deadline(): number | null {
    if (!this.state || this.meta.status === "lobby" || this.frozen()) return null;
    if (this.botsOnly(this.state)) return null;
    return deadlineOf(this.state, this.anchor, this.preset());
  }

  isBot(seat: number): boolean {
    return this.meta.seats[seat]?.bot === true;
  }

  /** The game waits only for bot seats (they never need the turn timer). */
  private botsOnly(state: GameState): boolean {
    const waits = waitingSeats(state);
    return waits.length > 0 && waits.every((s) => this.isBot(s));
  }

  /** The countdown for a message built now. */
  timer(): TimerInfo {
    if (!this.state || this.meta.status === "lobby" || this.frozen()) return null;
    if (this.botsOnly(this.state)) return null;
    return timerInfo(this.state, this.anchor, this.preset(), this.deps.now());
  }

  seatOf(conn: Conn): number {
    return this.conns.findIndex((c) => c?.id === conn.id);
  }

  // ---- chat (held in memory only: never stored, gone with the room or a restart)

  private chatLog: ChatEntry[] = [];
  private chatId = 0;

  /** A seated player's chat line, cleaned and sent to every connected seat. */
  chat(req: Request, raw: string): ServiceResult {
    const seat = this.seatOf(req.conn);
    const name = this.meta.seats[seat]?.name;
    if (seat < 0 || name === undefined) return fail("no_seat", "this connection holds no seat");
    // eslint-disable-next-line no-control-regex
    const text = raw
      .replace(/[\u0000-\u001f\u007f]+/g, " ")
      .replace(/ {2,}/g, " ")
      .trim();
    if (text.length === 0) return OK;
    const entry: ChatEntry = {
      id: this.chatId++,
      seat,
      name,
      text: Array.from(text).slice(0, CHAT_MAX_LENGTH).join(""),
      at: this.deps.now(),
    };
    this.chatLog.push(entry);
    if (this.chatLog.length > CHAT_HISTORY) this.chatLog.shift();
    for (const c of this.conns) if (c) this.send(c, { type: "chatLine", payload: { entry } });
    return OK;
  }

  /** The recent chat to one connection (a seat that just joined or resumed). */
  private sendChatHistory(conn: Conn): void {
    if (this.chatLog.length > 0) {
      this.send(conn, { type: "chatHistory", payload: { entries: [...this.chatLog] } });
    }
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
    this.sendChatHistory(req.conn);
  }

  join(req: Request, rawName: string, avatar?: AvatarId): Promise<ServiceResult> {
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
        seats: [
          ...this.meta.seats,
          {
            name: name.name,
            tokenHash: hashToken(token),
            avatar: chooseAvatar(avatar, resolveAvatars(this.meta.seats)),
          },
        ],
      };
      const w = await this.saveMeta(next);
      if (w) return w;
      this.conns[seat] = req.conn;
      this.deps.bind(req.conn, this);
      this.send(req.conn, { type: "roomJoined", payload: { room: this.code, seat, token } }, req);
      this.broadcastRoomState(req);
      this.sendChatHistory(req.conn);
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
      this.sendChatHistory(req.conn);
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
      if (this.meta.seats.every((s, i) => i === seat || s.bot)) {
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
      const leaver = this.meta.seats[seat]?.tokenHash;
      const seats = this.meta.seats.filter((_, i) => i !== seat);
      const next: RoomMeta = {
        ...this.meta,
        rev: this.meta.rev + 1,
        seats,
        // The first remaining human takes over when the host leaves.
        host:
          host === seat
            ? Math.max(
                0,
                seats.findIndex((s) => !s.bot),
              )
            : host > seat
              ? host - 1
              : host,
      };
      const w = await this.saveMeta(next);
      if (w) return w;
      this.conns.splice(seat, 1);
      this.deps.unbind(conn);
      if (leaver) this.deps.seatLeft?.(this, leaver);
      this.send(conn, { type: "roomLeft", payload: { room: this.code } }, req);
      this.broadcastRoomState();
      return OK;
    });
  }

  private newBotSeat(seats: RoomMeta["seats"]): RoomMeta["seats"][number] {
    return {
      avatar: chooseAvatar(undefined, resolveAvatars(seats)),
      name: botName(seats.map((s) => s.name)),
      // Nobody holds this token, so the seat can never be resumed or listed.
      tokenHash: hashToken(generateToken()),
      bot: true,
    };
  }

  /** Lobby only: changes the avatar of the sender's seat. */
  setAvatar(req: Request, avatar: AvatarId): Promise<ServiceResult> {
    return this.run(async () => {
      if (this.status() !== "lobby") return fail("game_started", "the game has already started");
      const seat = this.seatOf(req.conn);
      if (seat < 0) return fail("no_seat", "you do not hold a seat");
      const current = resolveAvatars(this.meta.seats);
      if (current.some((a, i) => i !== seat && a === avatar))
        return fail("avatar_taken", "another player already has that avatar");
      const next: RoomMeta = {
        ...this.meta,
        rev: this.meta.rev + 1,
        seats: this.meta.seats.map((s, i) => ({
          ...s,
          avatar: i === seat ? avatar : (current[i] as string),
        })),
      };
      const w = await this.saveMeta(next);
      if (w) return w;
      this.broadcastRoomState(req);
      return OK;
    });
  }

  /** Host only, lobby only: seats a bot in the next free seat. */
  addBot(req: Request): Promise<ServiceResult> {
    return this.run(async () => {
      const denied = this.hostOnly(req, "add a bot to");
      if (denied) return denied;
      if (this.status() !== "lobby") return fail("game_started", "the game has already started");
      if (this.meta.seats.length >= MAX_SEATS) return fail("room_full", "the room is full");
      const next: RoomMeta = {
        ...this.meta,
        rev: this.meta.rev + 1,
        seats: [...this.meta.seats, this.newBotSeat(this.meta.seats)],
      };
      const w = await this.saveMeta(next);
      if (w) return w;
      this.conns.push(null);
      this.broadcastRoomState(req);
      return OK;
    });
  }

  /** Host only, lobby only: removes the bot in `botSeat`; later seats close up. */
  removeBot(req: Request, botSeat: number): Promise<ServiceResult> {
    return this.run(async () => {
      const denied = this.hostOnly(req, "remove a bot from");
      if (denied) return denied;
      if (this.status() !== "lobby") return fail("game_started", "the game has already started");
      if (this.meta.seats[botSeat]?.bot !== true)
        return fail("not_a_bot", "that seat is not a bot");
      const host = this.meta.host;
      const next: RoomMeta = {
        ...this.meta,
        rev: this.meta.rev + 1,
        seats: this.meta.seats.filter((_, i) => i !== botSeat),
        host: host > botSeat ? host - 1 : host,
      };
      const w = await this.saveMeta(next);
      if (w) return w;
      this.conns.splice(botSeat, 1);
      this.broadcastRoomState(req);
      return OK;
    });
  }

  start(req: Request, opts: StartOptions): Promise<ServiceResult> {
    return this.run(async () => {
      const seat = this.seatOf(req.conn);
      if (seat < 0) return fail("no_seat", "this connection holds no seat");
      if (this.status() !== "lobby") return fail("game_started", "the game has already started");
      if (seat !== this.meta.host) return fail("not_host", "only the host can start the game");
      // Fewer than 3 seats: bots fill the rest (bots specs "Auto-fill on start").
      let seats = this.meta.seats;
      while (seats.length < MIN_PLAYERS) seats = [...seats, this.newBotSeat(seats)];
      const count = seats.length;
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
        seats,
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
      while (this.conns.length < seats.length) this.conns.push(null);
      this.broadcastRoomState(req);
      for (const [s, c] of this.conns.entries()) {
        if (c) this.sendSnapshot(s, c.id === req.conn.id ? req : undefined);
      }
      this.arm();
      this.deps.waitsChanged?.(this, null, state);
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

  // ---- pause, resume, early end (pause-and-resume-games)

  /** Host only: freezes a playing game; the room then expires PAUSED_TTL_MS later. */
  pause(req: Request): Promise<ServiceResult> {
    return this.run(async () => {
      const denied = this.hostOnly(req, "pause");
      if (denied) return denied;
      if (this.status() !== "playing") return fail("not_playing", "the game is not running");
      const next: RoomMeta = {
        ...this.meta,
        rev: this.meta.rev + 1,
        status: "paused",
        pausedAt: this.deps.now(),
      };
      const w = await this.saveMeta(next, PAUSED_TTL_MS);
      if (w) return w;
      this.disarm();
      this.deps.expiryChanged?.(this, PAUSED_TTL_MS);
      this.broadcastRoomState(req);
      this.broadcastSnapshots();
      return OK;
    });
  }

  /** Host only: continues a paused game with the countdown time that was left. */
  resumeGame(req: Request): Promise<ServiceResult> {
    return this.run(async () => {
      const denied = this.hostOnly(req, "resume");
      if (denied) return denied;
      const state = this.state;
      if (this.meta.status !== "paused" || !state) {
        return fail("not_paused", "the game is not paused");
      }
      const now = this.deps.now();
      const pausedAt = this.meta.pausedAt ?? now;
      const ms = Math.max(0, now - pausedAt);
      const next: RoomMeta = {
        ...withoutPause(this.meta),
        rev: this.meta.rev + 1,
        status: "playing",
        pauses: [...(this.meta.pauses ?? []), { at: pausedAt, ms }].slice(-MAX_PAUSES),
      };
      const w = await this.saveMeta(next);
      if (w) return w;
      this.anchor += ms;
      this.deps.expiryChanged?.(this, ROOM_TTL_MS);
      this.broadcastRoomState(req);
      this.broadcastSnapshots();
      this.arm();
      this.deps.waitsChanged?.(this, null, state);
      return OK;
    });
  }

  /** Host only: ends a playing or paused game now; most total VP wins, ties share. */
  end(req: Request): Promise<ServiceResult> {
    return this.run(async () => {
      const denied = this.hostOnly(req, "end");
      return denied ?? this.endNow(req);
    });
  }

  /**
   * The host ends the game from the saved games list: proven by the host seat's token,
   * without taking the seat (no bind, no presence change).
   */
  endWithToken(req: Request, token: string): Promise<ServiceResult> {
    return this.run(async () => {
      let seat = -1;
      for (const [i, s] of this.meta.seats.entries()) {
        if (tokenMatches(token, s.tokenHash)) seat = i;
      }
      if (seat < 0) return fail("bad_token", BAD_TOKEN_MESSAGE);
      if (seat !== this.meta.host) return fail("not_host", "only the host can end the game");
      return this.endNow(req);
    });
  }

  /** Stores the early-end result and tells everyone. Runs inside `run()`. */
  private async endNow(req: Request): Promise<ServiceResult> {
    const status = this.status();
    if (!this.state || (status !== "playing" && status !== "paused")) {
      return fail("not_playing", "the game is not running");
    }
    const next: RoomMeta = {
      ...withoutPause(this.meta),
      rev: this.meta.rev + 1,
      status: "ended",
      result: earlyResult(this.state, this.deps.now()),
    };
    const w = await this.saveMeta(next, ENDED_EARLY_TTL_MS);
    if (w) return w;
    this.disarm();
    this.deps.expiryChanged?.(this, ENDED_EARLY_TTL_MS);
    this.broadcastRoomState(req);
    this.broadcastSnapshots();
    return OK;
  }

  /** null when `req` holds the host seat, else the error to answer. */
  private hostOnly(req: Request, what: string): ServiceResult | null {
    const seat = this.seatOf(req.conn);
    if (seat < 0) return fail("no_seat", "this connection holds no seat");
    if (seat !== this.meta.host) return fail("not_host", `only the host can ${what} the game`);
    return null;
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
    if (this.meta.result) {
      return { ok: false, rejected: { code: "game_over", message: "the host ended the game" } };
    }
    if (this.meta.status === "paused") return fail("game_paused", "the host paused the game");
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
    this.deps.waitsChanged?.(this, state, next);
    return OK;
  }

  // ---- turn timer

  /** (Re)schedules the timer for the current deadline; clears it when there is none. */
  arm(): void {
    this.disarm();
    if (this.deleted) return;
    this.armBots();
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
    if (this.botHandle !== null) {
      this.deps.clearTimer(this.botHandle);
      this.botHandle = null;
    }
  }

  // ---- bots (specs/bots "Bots act for themselves")

  /** Bot seats that must act now: awaited by the game, or holding an offer to turn down. */
  private pendingBots(state: GameState): number[] {
    const waits = new Set(waitingSeats(state));
    const out: number[] = [];
    for (const [seat, s] of this.meta.seats.entries()) {
      if (!s.bot) continue;
      if (waits.has(seat) || legalActions(state, seat).rejectTrade.length > 0) out.push(seat);
    }
    return out;
  }

  /** Schedules the next bot move, if any bot has one; nothing while paused or ended. */
  private armBots(): void {
    const state = this.state;
    if (!state || this.meta.status !== "playing" || this.frozen()) return;
    if (state.phase.kind === "ended" || this.pendingBots(state).length === 0) return;
    this.botVersion = this.version;
    const newTurn = state.phase.kind === "turn" && !state.turn.rolled;
    const ms =
      this.connectedCount() === 0 ? BOT_FAST_MS : newTurn ? BOT_TURN_DELAY_MS : BOT_DELAY_MS;
    this.botHandle = this.deps.setTimer(() => {
      this.botHandle = null;
      return this.botFire();
    }, ms);
  }

  /** One bot move through the normal commit path; a successful commit re-arms the next. */
  private botFire(): Promise<ServiceResult> {
    const armed = this.botVersion;
    return this.run(async () => {
      const state = this.state;
      if (this.version !== armed || !state || this.meta.status !== "playing" || this.frozen()) {
        return OK;
      }
      const seed = `${this.meta.config?.seed ?? this.code}:bot:${this.version}`;
      for (const seat of this.pendingBots(state)) {
        const action = chooseAction(
          playerView(state, seat),
          legalActions(state, seat),
          new BotRng(`${seed}:${seat}`),
        );
        if (!action) continue;
        const r = await this.commit(action, this.deps.now());
        if (!r.ok) {
          this.deps.log(`room ${this.code}: bot move refused: ${JSON.stringify(r)}`);
          if ("rejected" in r) return this.botFallback(state);
        }
        return r;
      }
      return this.botFallback(state);
    }).catch((e: unknown) => {
      this.deps.log(
        `room ${this.code}: bot failed: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`,
      );
      return fail("internal", "bot failed");
    });
  }

  /** A bot had no usable move: let the engine resolve the wait, but only if no human is awaited. */
  private async botFallback(state: GameState): Promise<ServiceResult> {
    if (!this.botsOnly(state)) return OK;
    this.deps.log(`room ${this.code}: bot stalled in ${state.phase.kind}; using timeout`);
    return this.commit({ type: "timeout" }, this.deps.now());
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
    const avatars = resolveAvatars(this.meta.seats);
    return {
      type: "roomState",
      payload: {
        room: this.code,
        status: this.status(),
        host: this.meta.host,
        seats: this.meta.seats.map((s, seat) => ({
          seat,
          name: s.name,
          avatar: avatars[seat] as AvatarId,
          connected: s.bot === true || this.conns[seat] != null,
          bot: s.bot === true,
        })),
        pausedAt: this.meta.status === "paused" ? (this.meta.pausedAt ?? null) : null,
        result: this.meta.result ?? null,
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

  /** A fresh snapshot (new countdown) to every connected seat. */
  private broadcastSnapshots(): void {
    for (const [s, c] of this.conns.entries()) if (c) this.sendSnapshot(s);
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
  private async saveMeta(next: RoomMeta, ttlMs?: number): Promise<ServiceResult | null> {
    const w = await this.deps.store.saveMeta(next, this.meta.rev, ttlMs);
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
