// In-memory RoomStore with the same semantics as the Redis store (tests and dev).
// Values are JSON-copied in and out, so callers can never alias stored data.
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

interface Entry {
  meta: string;
  actions: string[];
  snapshot: string | null;
  expiresAt: number;
}

export interface MemoryStore extends RoomStore {
  /** Simulates an outage: writes return "unavailable", loads throw. */
  setAvailable(up: boolean): void;
  /** Test introspection: remaining TTL in ms, or null if absent. */
  ttl(code: string): number | null;
  /** Test fixture: appends raw stored JSON (e.g. a record in an older format). */
  pushRaw(code: string, json: string): void;
}

export function createMemoryStore(opts: { now?: () => number } = {}): MemoryStore {
  const now = opts.now ?? (() => Date.now());
  const rooms = new Map<string, Entry>();
  let up = true;

  const live = (code: string): Entry | undefined => {
    const e = rooms.get(code);
    if (e && e.expiresAt <= now()) {
      rooms.delete(code);
      return undefined;
    }
    return e;
  };
  const touch = (e: Entry) => {
    e.expiresAt = now() + ROOM_TTL_MS;
  };
  const down: WriteResult = { ok: false, reason: "unavailable" };

  return {
    setAvailable(v) {
      up = v;
    },
    ttl(code) {
      const e = live(code);
      return e ? e.expiresAt - now() : null;
    },
    pushRaw(code, json) {
      const e = live(code);
      if (!e) throw new Error(`no room ${code}`);
      e.actions.push(json);
    },
    async createMeta(meta: RoomMeta) {
      if (!up) return down;
      if (meta.rev !== 0) throw new Error("createMeta needs rev 0");
      if (live(meta.code)) return { ok: false, reason: "exists" };
      const e: Entry = { meta: JSON.stringify(meta), actions: [], snapshot: null, expiresAt: 0 };
      touch(e);
      rooms.set(meta.code, e);
      return { ok: true };
    },
    async saveMeta(meta: RoomMeta, expectedRev: number) {
      if (!up) return down;
      if (meta.rev !== expectedRev + 1) throw new Error("saveMeta needs rev = expectedRev + 1");
      const e = live(meta.code);
      if (!e) return { ok: false, reason: "not_found" };
      if ((JSON.parse(e.meta) as RoomMeta).rev !== expectedRev) {
        return { ok: false, reason: "conflict" };
      }
      e.meta = JSON.stringify(meta);
      touch(e);
      return { ok: true };
    },
    async appendAction(
      code: string,
      expectedVersion: number,
      record: ActionRecord,
      snapshot?: Snapshot,
    ) {
      if (!up) return down;
      const e = live(code);
      if (!e) return { ok: false, reason: "not_found" };
      if (e.actions.length !== expectedVersion) return { ok: false, reason: "conflict" };
      if (snapshot && snapshot.version !== expectedVersion + 1) {
        throw new Error("snapshot version must be expectedVersion + 1");
      }
      e.actions.push(encodeRecord(record));
      if (snapshot) e.snapshot = JSON.stringify(snapshot);
      touch(e);
      return { ok: true };
    },
    async loadRoom(code: string): Promise<LoadedRoom | null> {
      if (!up) throw new StoreUnavailableError();
      const e = live(code);
      if (!e) return null;
      const snapshot = e.snapshot ? (JSON.parse(e.snapshot) as Snapshot) : null;
      const from = snapshot?.version ?? 0;
      return {
        meta: JSON.parse(e.meta) as RoomMeta,
        snapshot,
        actions: e.actions.slice(from).map(decodeRecord),
        version: e.actions.length,
      };
    },
    async deleteRoom(code: string) {
      if (!up) return down;
      rooms.delete(code);
      return { ok: true };
    },
  };
}
