// Real-Redis store tests: opt-in only (TEST_REDIS=1 REDIS_URL=redis://...).
import { randomBytes } from "node:crypto";
import { Redis } from "ioredis";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { createRedisStore } from "../src/store/redis.ts";
import { ROOM_TTL_MS, StoreUnavailableError } from "../src/store/types.ts";
import { freshCode, makeMeta, makeSnapshot, roll, storeContract } from "./store.contract.ts";

const realRedisUrl = process.env.TEST_REDIS === "1" ? process.env.REDIS_URL : undefined;
const runPrefix = `hexfall-test:${randomBytes(6).toString("hex")}:`;

function connect(): Redis {
  return new Redis(realRedisUrl ?? "", { enableOfflineQueue: true, maxRetriesPerRequest: 1 });
}

async function deleteByPrefix(client: Redis, prefix: string): Promise<void> {
  let cursor = "0";
  do {
    const [next, found] = await client.scan(cursor, "MATCH", `${prefix}*`, "COUNT", 500);
    cursor = next;
    if (found.length > 0) await client.del(...found);
  } while (cursor !== "0");
}

describe.skipIf(realRedisUrl === undefined)("Redis store", () => {
  let client: Redis;
  beforeAll(() => {
    client = connect();
  });
  afterAll(async () => {
    await deleteByPrefix(client, runPrefix);
    await client.quit();
  });

  storeContract("redis", async () => {
    const prefix = `${runPrefix}${randomBytes(4).toString("hex")}:`;
    return {
      store: createRedisStore(client, { prefix }),
      cleanup: () => deleteByPrefix(client, prefix),
    };
  });

  const keysOf = (prefix: string, code: string) =>
    ["meta", "actions", "snap"].map((k) => `${prefix}room:${code}:${k}`);

  it("uses the documented key layout", async () => {
    const prefix = `${runPrefix}layout:`;
    const store = createRedisStore(client, { prefix });
    const code = freshCode();
    await store.createMeta(makeMeta(code));
    await store.appendAction(code, 0, roll(1), makeSnapshot(1));
    const [meta, actions, snap] = keysOf(prefix, code) as [string, string, string];
    expect(JSON.parse((await client.get(meta)) ?? "null")).toEqual(makeMeta(code));
    expect((await client.lrange(actions, 0, -1)).map((a) => JSON.parse(a))).toEqual([roll(1)]);
    expect(JSON.parse((await client.get(snap)) ?? "null")).toEqual(makeSnapshot(1));
  });

  it("refreshes a ~14 day TTL on every key after each write", async () => {
    const prefix = `${runPrefix}ttl:`;
    const store = createRedisStore(client, { prefix });
    const code = freshCode();
    const keys = keysOf(prefix, code);
    const expectFresh = async (present: string[]) => {
      for (const key of keys) {
        const pttl = await client.pttl(key);
        if (present.includes(key)) {
          expect(pttl).toBeGreaterThan(ROOM_TTL_MS - 60_000);
          expect(pttl).toBeLessThanOrEqual(ROOM_TTL_MS);
        } else {
          expect(pttl).toBe(-2);
        }
      }
    };
    const [meta, actions, snap] = keys as [string, string, string];

    await store.createMeta(makeMeta(code));
    await expectFresh([meta]);

    // Age the keys, then check that each write brings every key back to full TTL.
    const age = async () => {
      for (const key of keys) await client.pexpire(key, 1_000_000);
    };
    await age();
    await store.appendAction(code, 0, roll());
    await expectFresh([meta, actions]);
    await age();
    await store.appendAction(code, 1, roll(), makeSnapshot(2));
    await expectFresh([meta, actions, snap]);
    await age();
    await store.saveMeta(makeMeta(code, { rev: 1 }), 0);
    await expectFresh([meta, actions, snap]);
  });

  it("expires rooms after ttlMs without writes", async () => {
    const store = createRedisStore(client, { prefix: `${runPrefix}exp:`, ttlMs: 150 });
    const code = freshCode();
    await store.createMeta(makeMeta(code));
    await store.appendAction(code, 0, roll(), makeSnapshot(1));
    expect(await store.loadRoom(code)).not.toBeNull();
    await new Promise((r) => setTimeout(r, 300));
    expect(await store.loadRoom(code)).toBeNull();
    expect(await store.createMeta(makeMeta(code))).toEqual({ ok: true });
    expect((await store.loadRoom(code))?.version).toBe(0);
  });

  it("clears stale history keys when creating a room", async () => {
    const prefix = `${runPrefix}stale:`;
    const store = createRedisStore(client, { prefix });
    const code = freshCode();
    const [, actions, snap] = keysOf(prefix, code) as [string, string, string];
    await client.rpush(actions, JSON.stringify(roll()));
    await client.set(snap, JSON.stringify(makeSnapshot(1)));
    expect(await store.createMeta(makeMeta(code))).toEqual({ ok: true });
    expect(await store.loadRoom(code)).toEqual({
      meta: makeMeta(code),
      snapshot: null,
      actions: [],
      version: 0,
    });
  });

  it("works after SCRIPT FLUSH (EVALSHA falls back to EVAL)", async () => {
    const store = createRedisStore(client, { prefix: `${runPrefix}flush:` });
    const code = freshCode();
    expect(await store.createMeta(makeMeta(code))).toEqual({ ok: true });
    await client.script("FLUSH");
    expect(await store.appendAction(code, 0, roll())).toEqual({ ok: true });
    await client.script("FLUSH");
    expect(await store.saveMeta(makeMeta(code, { rev: 1 }), 0)).toEqual({ ok: true });
    await client.script("FLUSH");
    const loaded = await store.loadRoom(code);
    expect(loaded?.meta.rev).toBe(1);
    expect(loaded?.version).toBe(1);
    await client.script("FLUSH");
    expect(await store.deleteRoom(code)).toEqual({ ok: true });
    expect(await store.createMeta(makeMeta(code))).toEqual({ ok: true });
  });
});

describe("Redis store with an unreachable server", () => {
  it("returns unavailable from writes and throws StoreUnavailableError from loads", async () => {
    // Port 1 on loopback: nothing listens; no offline queue, so commands fail fast.
    const dead = new Redis("redis://127.0.0.1:1", {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });
    dead.on("error", () => {});
    const store = createRedisStore(dead);
    const down = { ok: false, reason: "unavailable" };
    try {
      expect(await store.createMeta(makeMeta("DEAD"))).toEqual(down);
      expect(await store.saveMeta(makeMeta("DEAD", { rev: 1 }), 0)).toEqual(down);
      expect(await store.appendAction("DEAD", 0, roll(), makeSnapshot(1))).toEqual(down);
      expect(await store.deleteRoom("DEAD")).toEqual(down);
      await expect(store.loadRoom("DEAD")).rejects.toBeInstanceOf(StoreUnavailableError);
      // Programmer errors still throw plain Errors.
      await expect(store.createMeta(makeMeta("DEAD", { rev: 2 }))).rejects.not.toBeInstanceOf(
        StoreUnavailableError,
      );
    } finally {
      dead.disconnect();
    }
  });
});
