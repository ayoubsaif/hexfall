// Turn timer across a server restart against real Redis (task 3.5). Opt-in only:
// TEST_REDIS=1 REDIS_URL=redis://... The clock and scheduler are fake; the store is real.
import { randomBytes } from "node:crypto";
import { Redis } from "ioredis";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { createRoomService, type RoomService } from "../src/rooms/service.ts";
import { drive, fakeClock, fakeConn, makeLobby, req, type FakeConn } from "../src/rooms/testing.ts";
import { createRedisStore } from "../src/store/redis.ts";
import type { RoomStore } from "../src/store/types.ts";

const realRedisUrl = process.env.TEST_REDIS === "1" ? process.env.REDIS_URL : undefined;
const runPrefix = `hexfall-test:${randomBytes(6).toString("hex")}:timer:`;

describe.skipIf(realRedisUrl === undefined)("turn timer across a restart (Redis)", () => {
  let client: Redis;
  beforeAll(() => {
    client = new Redis(realRedisUrl ?? "", { enableOfflineQueue: true, maxRetriesPerRequest: 1 });
  });
  afterAll(async () => {
    const keys = await client.keys(`${runPrefix}*`);
    if (keys.length > 0) await client.del(...keys);
    await client.quit();
  });

  /** A standard-timer game driven into setup (a 90 s action wait), then the first server dropped. */
  async function timedGameInSetup() {
    const clock = fakeClock();
    const store: RoomStore = createRedisStore(client, {
      prefix: `${runPrefix}${randomBytes(4).toString("hex")}:`,
    });
    const make = (): RoomService =>
      createRoomService({ store, now: clock.now, timers: clock.timers, log: () => {} });
    const first = make();
    const { conns, code, tokens } = await makeLobby(first, ["Ana", "Ben", "Cy"]);
    expect(
      await first.startGame(req(conns[0]!), { mode: "variable", turnTimer: "standard" }),
    ).toEqual({ ok: true });
    await drive(first, conns, () => conns[0]!.game()!.view.phase.kind === "setup", 50);
    const version = conns[0]!.game()!.version;
    const last = conns[0]!.of("gameUpdate").at(-1)?.payload.timer;
    expect(last).toEqual({
      kind: "action",
      durationMs: 90_000,
      remainingMs: 90_000,
      seats: [expect.any(Number)],
    });
    return { clock, make, first, code, tokens, version };
  }

  /** Simulates the restart: the old process's rooms and timers are gone. */
  function restart(first: RoomService, make: () => RoomService): RoomService {
    first.close();
    return make();
  }

  async function resume(svc: RoomService, code: string, token: string): Promise<FakeConn> {
    const c = fakeConn();
    expect(await svc.resumeRoom(req(c), code, token)).toEqual({ ok: true });
    return c;
  }

  it("Restart keeps the countdown: 10 s in, rebuilt 20 s later, about 60 s left", async () => {
    const { clock, make, first, code, tokens, version } = await timedGameInSetup();
    await clock.advance(10_000);
    const second = restart(first, make);
    expect(clock.pending()).toEqual([]);
    await clock.advance(20_000);
    const c = await resume(second, code, tokens[1]!);
    const snap = c.of("gameSnapshot")[0]?.payload;
    expect(snap?.version).toBe(version);
    expect(snap?.timer?.kind).toBe("action");
    expect(snap?.timer?.remainingMs).toBe(60_000);
    expect(clock.pending()).toEqual([clock.now() + 60_000]);
    // ...and it fires on time from the rebuilt room.
    await clock.advance(60_000);
    expect(c.of("gameUpdate")[0]?.payload.events[0]).toMatchObject({
      type: "timedOut",
      phase: "setup",
    });
    second.close();
  });

  it("a deadline that passed while the server was down fires exactly one timeout on resume", async () => {
    const { clock, make, first, code, tokens, version } = await timedGameInSetup();
    const second = restart(first, make);
    await clock.advance(10 * 60_000);
    const c = await resume(second, code, tokens[0]!);
    expect(c.of("gameSnapshot")[0]?.payload.timer?.remainingMs).toBe(0);
    await clock.advance(0);
    const updates = c.of("gameUpdate");
    expect(updates).toHaveLength(1);
    expect(updates[0]?.payload.version).toBe(version + 1);
    expect(updates[0]?.payload.events[0]).toMatchObject({ type: "timedOut", phase: "setup" });
    // The new anchor is that timeout: a full countdown, no catch-up cascade.
    expect(updates[0]?.payload.timer?.remainingMs).toBe(updates[0]?.payload.timer?.durationMs);
    expect(clock.pending()).toHaveLength(1);
    await clock.flush();
    expect(c.of("gameUpdate")).toHaveLength(1);
    second.close();
  });
});
