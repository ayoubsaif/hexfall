import { describe, expect, it } from "vite-plus/test";
import { createRedis, reconnectDelay } from "../src/redis.ts";

describe("reconnectDelay", () => {
  it("backs off exponentially and is bounded", () => {
    expect([1, 2, 3, 4].map((n) => reconnectDelay(n, 10_000))).toEqual([200, 400, 800, 1600]);
    expect(reconnectDelay(50, 10_000)).toBe(10_000);
  });
});

describe("createRedis with an unreachable server", () => {
  it("stays down without throwing, logs once, and quits cleanly", async () => {
    const logs: string[] = [];
    // Port 1 on loopback: connection refused immediately.
    const redis = createRedis("redis://127.0.0.1:1", {
      maxBackoffMs: 50,
      log: (m) => logs.push(m),
    });
    await new Promise((r) => setTimeout(r, 400));
    expect(redis.status()).toBe("down");
    expect(await redis.ping()).toBe(false);
    expect(logs.filter((l) => l.startsWith("unreachable"))).toHaveLength(1);
    await redis.quit();
  });
});

// Real Redis: opt-in only (TEST_REDIS=1 REDIS_URL=redis://...).
const realRedisUrl = process.env.TEST_REDIS === "1" ? process.env.REDIS_URL : undefined;

describe.skipIf(realRedisUrl === undefined)("createRedis against a real Redis", () => {
  it("connects, pings, and quits", async () => {
    const redis = createRedis(realRedisUrl ?? "", { log: () => {} });
    const deadline = Date.now() + 5_000;
    while (redis.status() !== "up" && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 50));
    }
    expect(redis.status()).toBe("up");
    expect(await redis.ping()).toBe(true);
    await redis.quit();
    expect(redis.status()).toBe("down");
  });
});
