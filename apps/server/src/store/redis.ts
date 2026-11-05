// Redis-backed RoomStore (design.md decisions 3-4). Every write is one Lua script
// (EVALSHA, with ioredis falling back to EVAL on NOSCRIPT) that checks its
// precondition, writes, and refreshes the TTL on all of the room's keys.
import type { Redis } from "ioredis";
import {
  ROOM_TTL_MS,
  StoreUnavailableError,
  decodeRecord,
  encodeRecord,
  type ActionRecord,
  type LoadedRoom,
  type RoomMeta,
  type RoomStore,
  type Snapshot,
  type WriteResult,
} from "./types.ts";

export interface RedisStoreOptions {
  /** Key prefix, default "hexfall:". Keys are `${prefix}room:${CODE}:meta|actions|snap`. */
  prefix?: string;
  /** TTL refreshed on every write, default ROOM_TTL_MS (14 days). */
  ttlMs?: number;
}

// KEYS: meta, actions, snap. ARGV: meta json, ttl.
// Stale actions/snap keys without a meta (e.g. expiry skew) are cleared first.
const CREATE_META = `
if redis.call('EXISTS', KEYS[1]) == 1 then return 'exists' end
redis.call('DEL', KEYS[2], KEYS[3])
redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[2])
return 'ok'
`;

// KEYS: meta, actions, snap. ARGV: meta json, expectedRev, ttl.
const SAVE_META = `
local cur = redis.call('GET', KEYS[1])
if not cur then return 'not_found' end
if tonumber(cjson.decode(cur).rev) ~= tonumber(ARGV[2]) then return 'conflict' end
redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[3])
redis.call('PEXPIRE', KEYS[2], ARGV[3])
redis.call('PEXPIRE', KEYS[3], ARGV[3])
return 'ok'
`;

// KEYS: meta, actions, snap. ARGV: expectedVersion, action json, snapshot json or "", ttl.
const APPEND_ACTION = `
if redis.call('EXISTS', KEYS[1]) == 0 then return 'not_found' end
if redis.call('LLEN', KEYS[2]) ~= tonumber(ARGV[1]) then return 'conflict' end
redis.call('RPUSH', KEYS[2], ARGV[2])
if ARGV[3] ~= '' then redis.call('SET', KEYS[3], ARGV[3]) end
redis.call('PEXPIRE', KEYS[1], ARGV[4])
redis.call('PEXPIRE', KEYS[2], ARGV[4])
redis.call('PEXPIRE', KEYS[3], ARGV[4])
return 'ok'
`;

// KEYS: meta, actions, snap. Returns nil, or { meta, snap or "", total, actions after snap }.
// The snapshot is serialized with "version" first, so its version is read without
// decoding the whole game state; cjson is the fallback.
const LOAD_ROOM = `
local meta = redis.call('GET', KEYS[1])
if not meta then return nil end
local snap = redis.call('GET', KEYS[3])
local from = 0
if snap then
  local v = string.match(snap, '^{"version":(%d+),')
  if v then from = tonumber(v) else from = tonumber(cjson.decode(snap).version) end
else
  snap = ''
end
local total = redis.call('LLEN', KEYS[2])
local actions = redis.call('LRANGE', KEYS[2], from, -1)
return { meta, snap, total, actions }
`;

type Keys = [string, string, string];

interface StoreCommands {
  hexfallCreateMeta(...args: [...Keys, string, number]): Promise<string>;
  hexfallSaveMeta(...args: [...Keys, string, number, number]): Promise<string>;
  hexfallAppendAction(...args: [...Keys, number, string, string, number]): Promise<string>;
  hexfallLoadRoom(...args: Keys): Promise<[string, string, number, string[]] | null>;
}

export function createRedisStore(client: Redis, opts: RedisStoreOptions = {}): RoomStore {
  const prefix = opts.prefix ?? "hexfall:";
  const ttl = opts.ttlMs ?? ROOM_TTL_MS;

  client.defineCommand("hexfallCreateMeta", { numberOfKeys: 3, lua: CREATE_META });
  client.defineCommand("hexfallSaveMeta", { numberOfKeys: 3, lua: SAVE_META });
  client.defineCommand("hexfallAppendAction", { numberOfKeys: 3, lua: APPEND_ACTION });
  client.defineCommand("hexfallLoadRoom", { numberOfKeys: 3, lua: LOAD_ROOM });
  const cmd = client as unknown as StoreCommands;

  const keys = (code: string): Keys => {
    const base = `${prefix}room:${code}`;
    return [`${base}:meta`, `${base}:actions`, `${base}:snap`];
  };

  /** Maps a script reply to a WriteResult; any Redis/connection failure is "unavailable". */
  const write = async (run: () => Promise<string>): Promise<WriteResult> => {
    let reply: string;
    try {
      reply = await run();
    } catch {
      return { ok: false, reason: "unavailable" };
    }
    switch (reply) {
      case "ok":
        return { ok: true };
      case "exists":
      case "conflict":
      case "not_found":
        return { ok: false, reason: reply };
      default:
        return { ok: false, reason: "unavailable" };
    }
  };

  return {
    async createMeta(meta: RoomMeta) {
      if (meta.rev !== 0) throw new Error("createMeta needs rev 0");
      const json = JSON.stringify(meta);
      return write(() => cmd.hexfallCreateMeta(...keys(meta.code), json, ttl));
    },

    async saveMeta(meta: RoomMeta, expectedRev: number, ttlMs?: number) {
      if (meta.rev !== expectedRev + 1) throw new Error("saveMeta needs rev = expectedRev + 1");
      const json = JSON.stringify(meta);
      return write(() => cmd.hexfallSaveMeta(...keys(meta.code), json, expectedRev, ttlMs ?? ttl));
    },

    async loadMeta(code: string) {
      let reply: [Error | null, unknown][] | null;
      try {
        const [metaKey, actionsKey] = keys(code);
        reply = (await client
          .multi()
          .get(metaKey)
          .pttl(metaKey)
          .lindex(actionsKey, -1)
          .exec()) as typeof reply;
      } catch (err) {
        throw new StoreUnavailableError(
          `room store unavailable: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      if (!reply) throw new StoreUnavailableError("room store unavailable: transaction aborted");
      const failed = reply.find(([err]) => err);
      if (failed) throw new StoreUnavailableError(`room store unavailable: ${String(failed[0])}`);
      const [raw, pttl, last] = reply.map(([, v]) => v);
      if (typeof raw !== "string") return null;
      const ms = Number(pttl);
      return {
        meta: JSON.parse(raw) as RoomMeta,
        ttlMs: ms > 0 ? ms : 0,
        lastActionAt: typeof last === "string" ? (decodeRecord(last).at ?? null) : null,
      };
    },

    async appendAction(
      code: string,
      expectedVersion: number,
      record: ActionRecord,
      snapshot?: Snapshot,
    ) {
      if (snapshot && snapshot.version !== expectedVersion + 1) {
        throw new Error("snapshot version must be expectedVersion + 1");
      }
      const actionJson = encodeRecord(record);
      // "version" first: LOAD_ROOM reads it with a pattern match.
      const snapJson = snapshot
        ? JSON.stringify({
            version: snapshot.version,
            ...(snapshot.anchor !== undefined ? { anchor: snapshot.anchor } : {}),
            state: snapshot.state,
          })
        : "";
      return write(() =>
        cmd.hexfallAppendAction(...keys(code), expectedVersion, actionJson, snapJson, ttl),
      );
    },

    async loadRoom(code: string): Promise<LoadedRoom | null> {
      let reply: Awaited<ReturnType<StoreCommands["hexfallLoadRoom"]>>;
      try {
        reply = await cmd.hexfallLoadRoom(...keys(code));
      } catch (err) {
        throw new StoreUnavailableError(
          `room store unavailable: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      if (reply === null) return null;
      const [meta, snap, total, actions] = reply;
      return {
        meta: JSON.parse(meta) as RoomMeta,
        snapshot: snap === "" ? null : (JSON.parse(snap) as Snapshot),
        actions: actions.map(decodeRecord),
        version: Number(total),
      };
    },

    async deleteRoom(code: string) {
      return write(async () => {
        await client.del(...keys(code));
        return "ok";
      });
    },
  };
}
