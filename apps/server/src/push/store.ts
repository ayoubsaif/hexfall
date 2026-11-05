// Web Push subscriptions per room and seat (openspec change turn-sound-and-push;
// specs/game-server "Push subscriptions"). Keyed by the seat's token hash, which stays the
// same when lobby seats are renumbered. Kept apart from RoomStore: it never affects a game.
import type { Redis } from "ioredis";
import type { PushSubscriptionJSON } from "@hexfall/protocol";
import { ROOM_TTL_MS, StoreUnavailableError } from "../store/types.ts";

export interface StoredPushSub extends PushSubscriptionJSON {
  /** UI language when subscribed, for the notification text. */
  lang: string;
}

/** Newest subscriptions kept per seat. */
export const MAX_SUBS_PER_SEAT = 3;

export interface PushStore {
  /** Adds or replaces (same endpoint) a subscription; keeps the newest MAX_SUBS_PER_SEAT. */
  add(room: string, holder: string, sub: StoredPushSub): Promise<void>;
  remove(room: string, holder: string, endpoint: string): Promise<void>;
  list(room: string, holder: string): Promise<StoredPushSub[]>;
  /** Forgets every subscription of one seat (left the lobby). */
  clearHolder(room: string, holder: string): Promise<void>;
  /** Forgets the room's subscriptions (room deleted). */
  clearRoom(room: string): Promise<void>;
  /** Sets the room's subscriptions to expire `ttlMs` from now (pause, resume, early end). */
  touch(room: string, ttlMs: number): Promise<void>;
}

/** The list after adding `sub`: same endpoint replaced, newest last, capped. */
export function withSub(list: readonly StoredPushSub[], sub: StoredPushSub): StoredPushSub[] {
  return [...list.filter((s) => s.endpoint !== sub.endpoint), sub].slice(-MAX_SUBS_PER_SEAT);
}

export function createMemoryPushStore(): PushStore {
  const rooms = new Map<string, Map<string, StoredPushSub[]>>();
  const seat = (room: string) => {
    let m = rooms.get(room);
    if (!m) rooms.set(room, (m = new Map()));
    return m;
  };
  return {
    async add(room, holder, sub) {
      const m = seat(room);
      m.set(holder, withSub(m.get(holder) ?? [], sub));
    },
    async remove(room, holder, endpoint) {
      const m = seat(room);
      const next = (m.get(holder) ?? []).filter((s) => s.endpoint !== endpoint);
      if (next.length > 0) m.set(holder, next);
      else m.delete(holder);
    },
    async list(room, holder) {
      return [...(rooms.get(room)?.get(holder) ?? [])];
    },
    async clearHolder(room, holder) {
      rooms.get(room)?.delete(holder);
    },
    async clearRoom(room) {
      rooms.delete(room);
    },
    // Memory subscriptions live as long as the process; nothing to expire.
    async touch() {},
  };
}

export interface RedisPushStoreOptions {
  prefix?: string;
  ttlMs?: number;
}

function parseList(raw: string | null): StoredPushSub[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? (v as StoredPushSub[]) : [];
  } catch {
    return [];
  }
}

/** Hash `<prefix>push:<ROOM>`: field = seat token hash, value = JSON list. Room TTL on write. */
export function createRedisPushStore(client: Redis, opts: RedisPushStoreOptions = {}): PushStore {
  const prefix = opts.prefix ?? "hexfall:";
  const ttl = opts.ttlMs ?? ROOM_TTL_MS;
  const key = (room: string) => `${prefix}push:${room}`;
  const guard = async <T>(fn: () => Promise<T>): Promise<T> => {
    try {
      return await fn();
    } catch (err) {
      throw new StoreUnavailableError(
        `push store unavailable: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  };
  const save = async (room: string, holder: string, list: StoredPushSub[]) => {
    const k = key(room);
    if (list.length === 0) await client.hdel(k, holder);
    else await client.multi().hset(k, holder, JSON.stringify(list)).pexpire(k, ttl).exec();
  };
  return {
    add: (room, holder, sub) =>
      guard(async () => {
        const list = parseList(await client.hget(key(room), holder));
        await save(room, holder, withSub(list, sub));
      }),
    remove: (room, holder, endpoint) =>
      guard(async () => {
        const list = parseList(await client.hget(key(room), holder));
        await save(
          room,
          holder,
          list.filter((s) => s.endpoint !== endpoint),
        );
      }),
    list: (room, holder) => guard(async () => parseList(await client.hget(key(room), holder))),
    clearHolder: (room, holder) =>
      guard(async () => {
        await client.hdel(key(room), holder);
      }),
    clearRoom: (room) =>
      guard(async () => {
        await client.del(key(room));
      }),
    touch: (room, ttlMs) =>
      guard(async () => {
        await client.pexpire(key(room), ttlMs);
      }),
  };
}
