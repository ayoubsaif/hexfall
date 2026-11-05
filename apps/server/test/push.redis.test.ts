// Real-Redis push store: opt-in only (TEST_REDIS=1 REDIS_URL=redis://...).
import { randomBytes } from "node:crypto";
import { Redis } from "ioredis";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { MAX_SUBS_PER_SEAT, createRedisPushStore } from "../src/push/store.ts";

const realRedisUrl = process.env.TEST_REDIS === "1" ? process.env.REDIS_URL : undefined;
const prefix = `hexfall-test:${randomBytes(6).toString("hex")}:`;
const sub = (n: number) => ({
  endpoint: `https://push.example.com/${n}`,
  keys: { p256dh: `p${n}`, auth: `a${n}` },
  lang: "en",
});

describe.skipIf(realRedisUrl === undefined)("Redis push store", () => {
  let client: Redis;
  beforeAll(() => {
    client = new Redis(realRedisUrl ?? "", { maxRetriesPerRequest: 1 });
  });
  afterAll(async () => {
    await client.del(`${prefix}push:ROOM`);
    await client.quit();
  });

  it("adds, caps, removes, expires with the room TTL and clears", async () => {
    const store = createRedisPushStore(client, { prefix, ttlMs: 60_000 });
    for (let i = 0; i < MAX_SUBS_PER_SEAT + 1; i++) await store.add("ROOM", "h", sub(i));
    expect((await store.list("ROOM", "h")).map((s) => s.endpoint)).toEqual(
      [1, 2, 3].map((i) => sub(i).endpoint),
    );
    expect(await client.pttl(`${prefix}push:ROOM`)).toBeGreaterThan(0);
    await store.remove("ROOM", "h", sub(1).endpoint);
    expect(await store.list("ROOM", "h")).toHaveLength(2);
    await store.clearHolder("ROOM", "h");
    expect(await store.list("ROOM", "h")).toEqual([]);
    await store.add("ROOM", "x", sub(9));
    await store.clearRoom("ROOM");
    expect(await store.list("ROOM", "x")).toEqual([]);
  });

  it("touch sets the subscriptions' expiry (pause, resume, early end)", async () => {
    const store = createRedisPushStore(client, { prefix, ttlMs: 60_000 });
    await store.add("ROOM", "h", sub(1));
    await store.touch("ROOM", 5_000);
    const pttl = await client.pttl(`${prefix}push:ROOM`);
    expect(pttl).toBeGreaterThan(0);
    expect(pttl).toBeLessThanOrEqual(5_000);
    await store.clearRoom("ROOM");
    await store.touch("ROOM", 5_000);
    expect(await client.exists(`${prefix}push:ROOM`)).toBe(0);
  });
});
