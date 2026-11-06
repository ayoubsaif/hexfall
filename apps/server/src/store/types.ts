// Durable room storage contract (design.md decisions 3-4). Redis in production,
// an in-memory fake in tests. Every write refreshes the room's TTL.
import type { Action, BoardMode, GameState, Seat } from "@hexfall/engine";
import type { EarlyResult, RoomStatus, TurnTimerPreset } from "@hexfall/protocol";

const DAY_MS = 24 * 60 * 60 * 1000;
export const ROOM_TTL_MS = 14 * DAY_MS;
/** A paused room expires this long after the pause (game-pause "Paused room expiry"). */
export const PAUSED_TTL_MS = 7 * DAY_MS;
/** A room the host ended early expires this long after the end (early-end). */
export const ENDED_EARLY_TTL_MS = DAY_MS;
/** A snapshot is written when the new version is a multiple of this, and at game end. */
export const SNAPSHOT_EVERY = 25;

export interface StoredSeat {
  name: string;
  /** SHA-256 hex of the seat token. The token itself is never stored. */
  tokenHash: string;
  /** A bot seat: driven by the server, its tokenHash matches no real token. */
  bot?: true;
  /** Avatar catalog id; absent in games saved before avatars (resolved by index on load). */
  avatar?: string;
}

export interface GameConfigRecord {
  seed: string;
  mode: BoardMode;
  playerCount: 3 | 4;
  startingPlayer?: Seat;
}

export interface RoomMeta {
  /** Upper-case room code. */
  code: string;
  /** Bumped by every saveMeta; createMeta stores rev 0. */
  rev: number;
  status: RoomStatus;
  /** ms since epoch (server clock). */
  createdAt: number;
  host: Seat;
  /** Index = seat. */
  seats: StoredSeat[];
  /** Set when the game starts. */
  config: GameConfigRecord | null;
  /** Turn timer preset, fixed at the start. Absent (rooms stored before the timer) = "off". */
  turnTimer?: TurnTimerPreset;
  /** ms since epoch (server clock) when the game started; the first timer anchor. */
  startedAt?: number;
  /** Server ms when the host paused; set only while `status` is "paused". */
  pausedAt?: number;
  /** Completed pauses (start time and length), newest last, capped at MAX_PAUSES. */
  pauses?: { at: number; ms: number }[];
  /** Set when the host ended the game early. */
  result?: EarlyResult;
}

/** Completed pauses kept in RoomMeta.pauses. */
export const MAX_PAUSES = 50;

/** What `loadMeta` returns. */
export interface StoredMeta {
  meta: RoomMeta;
  ttlMs: number;
  lastActionAt: number | null;
}

/** One stored action. */
export interface ActionRecord {
  /** Seat filled in (none for the system `timeout`). */
  action: Action;
  /** Server clock (ms) when it was accepted. Absent in records stored before the timer. */
  at?: number;
}

export interface Snapshot {
  /** Number of actions applied to reach `state`. */
  version: number;
  state: GameState;
  /**
   * Turn timer anchor after `version` actions: the `at` of the last action that restarted
   * the timer (or the start time). Absent in snapshots stored before the timer.
   */
  anchor?: number;
}

export interface LoadedRoom {
  meta: RoomMeta;
  /** Latest snapshot, if any. */
  snapshot: Snapshot | null;
  /** Actions after the snapshot (all actions if there is none), in order. */
  actions: ActionRecord[];
  /** Total number of stored actions. */
  version: number;
}

export type WriteResult =
  | { ok: true }
  /** exists: createMeta on a taken code. conflict: stale rev or version. */
  | { ok: false; reason: "exists" | "conflict" | "unavailable" | "not_found" };

/** Thrown by loadRoom when the backend cannot be reached. */
export class StoreUnavailableError extends Error {
  constructor(message = "room store unavailable") {
    super(message);
    this.name = "StoreUnavailableError";
  }
}

export interface RoomStore {
  /** Stores a new room (meta.rev must be 0). Fails with "exists" if the code is taken. */
  createMeta(meta: RoomMeta): Promise<WriteResult>;
  /**
   * Replaces meta if the stored rev equals expectedRev; meta.rev must be expectedRev + 1.
   * Sets the room's expiry to `ttlMs` (default: the store's normal TTL).
   */
  saveMeta(meta: RoomMeta, expectedRev: number, ttlMs?: number): Promise<WriteResult>;
  /**
   * The room's metadata, remaining time to live (ms) and the server time of its last
   * stored action (null when none, or stored before the timer), or null if absent. Never
   * refreshes the expiry. Throws StoreUnavailableError on outage.
   */
  loadMeta(code: string): Promise<StoredMeta | null>;
  /**
   * Appends `record` if exactly `expectedVersion` actions are stored, and stores
   * `snapshot` (version = expectedVersion + 1) when given.
   */
  appendAction(
    code: string,
    expectedVersion: number,
    record: ActionRecord,
    snapshot?: Snapshot,
  ): Promise<WriteResult>;
  /** Null if the room does not exist (or expired). Throws StoreUnavailableError on outage. */
  loadRoom(code: string): Promise<LoadedRoom | null>;
  deleteRoom(code: string): Promise<WriteResult>;
}

/**
 * Stored JSON of one action record: `{"at":…,"action":{…}}`. Records written before the
 * turn timer are the bare action JSON; decodeRecord accepts both.
 */
export function encodeRecord(record: ActionRecord): string {
  return JSON.stringify(
    record.at === undefined ? { action: record.action } : { at: record.at, action: record.action },
  );
}

export function decodeRecord(json: string): ActionRecord {
  const v = JSON.parse(json) as Record<string, unknown>;
  if (typeof v.action === "object" && v.action !== null && !("type" in v)) {
    const at = typeof v.at === "number" ? v.at : undefined;
    return at === undefined ? { action: v.action as Action } : { action: v.action as Action, at };
  }
  return { action: v as unknown as Action };
}
