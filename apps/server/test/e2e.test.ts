// End-to-end (tasks 5.1-5.2): real ws clients against createServer, choosing moves
// only from the legal actions the server sends them.
import { RESOURCES, type PlayerView } from "@hexfall/engine";
import type { ClientAction, ServerMessage } from "@hexfall/protocol";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { Redis } from "ioredis";
import { createRoomService } from "../src/rooms/service.ts";
import { fakeClock, type FakeClock } from "../src/rooms/testing.ts";
import { createServer, type HexfallServer } from "../src/server.ts";
import { createMemoryStore } from "../src/store/memory.ts";
import { createRedisStore } from "../src/store/redis.ts";
import type { RoomStore } from "../src/store/types.ts";
import { ORIGIN, connect, type TestClient } from "./helpers/wsClient.ts";

const fakeRedis = { status: () => "up" as const, quit: async () => {} };
const servers: HexfallServer[] = [];
const sockets: TestClient[] = [];

async function startServer(
  store: RoomStore,
  clock?: FakeClock,
): Promise<{ server: HexfallServer; base: string }> {
  const service = createRoomService({
    store,
    log: () => {},
    ...(clock ? { now: clock.now, timers: clock.timers } : {}),
  });
  // With a fake clock the bots play hundreds of moves at once: give the rate limiter a
  // clock that moves a second per message so it never throttles them.
  let rateClock = 0;
  const server = createServer(
    { allowedOrigins: [ORIGIN] },
    {
      redis: fakeRedis,
      service,
      log: () => {},
      ...(clock ? { now: () => (rateClock += 1_000) } : {}),
    },
  );
  servers.push(server);
  const port = await server.listen(0);
  return { server, base: `127.0.0.1:${port}` };
}

async function client(base: string): Promise<TestClient> {
  const c = await connect(base);
  sockets.push(c);
  return c;
}

afterEach(async () => {
  for (const c of sockets.splice(0)) c.ws.terminate();
  for (const s of servers.splice(0)) await s.close();
});

const reply = (c: TestClient, seq: number) => c.waitFor((m) => m.re === seq);

/** First legal move for this client, by a fixed priority. Null if it has nothing to do. */
function choose(c: TestClient): ClientAction | null {
  const L = c.legal;
  const v = c.view;
  if (!L || !v || c.seat === null) return null;
  if (L.rollForOrder) return { type: "rollForOrder" };
  if (L.placeSettlement[0] !== undefined)
    return { type: "placeSettlement", vertex: L.placeSettlement[0] };
  if (L.placeRoad[0] !== undefined) return { type: "placeRoad", edge: L.placeRoad[0] };
  if (L.discard > 0) {
    const hand = { ...v.players[c.seat]!.resources! };
    const cards: Partial<Record<(typeof RESOURCES)[number], number>> = {};
    let n = L.discard;
    for (const r of RESOURCES) {
      const k = Math.min(n, hand[r]);
      if (k > 0) cards[r] = k;
      n -= k;
    }
    return { type: "discard", cards };
  }
  const robber = L.moveRobber[0];
  if (robber) return { type: "moveRobber", hex: robber.hex, victim: robber.victims[0] ?? null };
  if (L.rollDice) return { type: "rollDice" };
  if (L.buildSettlement[0] !== undefined)
    return { type: "buildSettlement", vertex: L.buildSettlement[0] };
  if (L.buildCity[0] !== undefined) return { type: "buildCity", vertex: L.buildCity[0] };
  if (L.buildRoad[0] !== undefined) return { type: "buildRoad", edge: L.buildRoad[0] };
  if (L.endTurn) return { type: "endTurn" };
  return null;
}

/** Plays until `done()`; each step one client acts and every client gets exactly +1. */
async function play(clients: TestClient[], done: () => boolean, maxSteps = 400): Promise<number> {
  let steps = 0;
  while (!done()) {
    if (steps++ > maxSteps) throw new Error("game did not progress");
    const actor = clients.find((c) => choose(c) !== null);
    if (!actor) throw new Error("no client has a legal move");
    const action = choose(actor)!;
    const before = clients.map((c) => c.version);
    const marks = clients.map((c) => c.all.length);
    const seq = actor.send("gameAction", { action });
    const r = await reply(actor, seq);
    if (r.type !== "gameUpdate")
      throw new Error(`${action.type} failed: ${JSON.stringify(r.payload)}`);
    await Promise.all(clients.map((c, i) => c.waitFor((m) => m.type === "gameUpdate", marks[i])));
    clients.forEach((c, i) => expect(c.version).toBe((before[i] ?? 0) + 1));
  }
  return steps;
}

function publicPart(v: PlayerView) {
  return {
    vertices: v.vertices,
    edges: v.edges,
    robber: v.robber,
    bank: v.bank,
    turn: v.turn,
    phase: v.phase,
    devDeckCount: v.devDeckCount,
    longestRoad: v.longestRoad,
    largestArmy: v.largestArmy,
    players: v.players.map((p) => ({
      seat: p.seat,
      resourceCount: p.resourceCount,
      publicVp: p.publicVp,
    })),
  };
}

function expectPrivacy(clients: TestClient[]): void {
  for (const c of clients) {
    const v = c.view!;
    expect(JSON.stringify(v)).not.toMatch(/"rng"|"devDeck"/);
    for (const p of v.players) {
      if (p.seat === c.seat) expect(p.resources).toBeDefined();
      else expect(p.resources, `seat ${c.seat} sees seat ${p.seat}'s hand`).toBeUndefined();
    }
    for (const e of v.log) {
      if (e.type === "stole" && e.thief !== c.seat && e.victim !== c.seat)
        expect(e.resource).toBeNull();
      if (e.type === "devCardBought" && e.seat !== c.seat) expect(e.card).toBeNull();
    }
  }
}

async function lobby(
  base: string,
  names: string[],
  turnTimer?: "off" | "standard" | "relaxed",
): Promise<TestClient[]> {
  const clients: TestClient[] = [];
  for (const [i, name] of names.entries()) {
    const c = await client(base);
    const seq =
      i === 0
        ? c.send("createRoom", { name })
        : c.send("joinRoom", { room: clients[0]!.room!.toLowerCase(), name });
    const r = await reply(c, seq);
    expect(r.type).toBe("roomJoined");
    clients.push(c);
  }
  clients.forEach((c, i) => expect(c.seat).toBe(i));
  const seq = clients[0]!.send(
    "startGame",
    turnTimer ? { mode: "variable", turnTimer } : { mode: "variable" },
  );
  await reply(clients[0]!, seq);
  await Promise.all(clients.map((c) => c.waitFor((m) => m.type === "gameSnapshot")));
  return clients;
}

describe("e2e over websockets", () => {
  it("3 players: lobby, start, setup and 3 full turns", async () => {
    const { base } = await startServer(createMemoryStore());
    const clients = await lobby(base, ["Ana", "Ben", "Cy"]);
    expect(clients.every((c) => c.view?.phase.kind === "rollForOrder")).toBe(true);

    await play(clients, () => (clients[0]!.view?.turn.number ?? 0) > 3);

    expectPrivacy(clients);
    const pub = clients.map((c) => publicPart(c.view!));
    expect(pub[1]).toEqual(pub[0]);
    expect(pub[2]).toEqual(pub[0]);
    for (const c of clients) {
      // Versions only ever go up by one after the initial snapshot.
      c.versions.forEach((v, i) => i > 0 && expect(v).toBe((c.versions[i - 1] ?? 0) + 1));
    }
  });

  it("an action for another seat is impossible and the rejection is private", async () => {
    const { base } = await startServer(createMemoryStore());
    const clients = await lobby(base, ["Ana", "Ben", "Cy"]);
    await play(clients, () => clients[0]!.view?.phase.kind === "turn");
    const active = clients[0]!.view!.turn.seat;
    const other = clients.find((c) => c.seat !== active)!;
    const marks = clients.map((c) => c.all.length);
    const seq = other.send("gameAction", { action: { type: "rollDice" } });
    const r = (await reply(other, seq)) as Extract<ServerMessage, { type: "actionRejected" }>;
    expect(r.type).toBe("actionRejected");
    expect(r.payload.code).toBe("not_your_turn");
    await new Promise((resolve) => setTimeout(resolve, 50));
    clients.forEach((c, i) => c !== other && expect(c.all.length).toBe(marks[i]));
  });
});

describe("e2e with the turn timer", () => {
  it("3 players, one silent: timeouts roll, end the turn and discard for them", async () => {
    const clock = fakeClock();
    const { base } = await startServer(createMemoryStore({ now: clock.now }), clock);
    const clients = await lobby(base, ["Ana", "Ben", "Cy"], "standard");
    const silent = 2;
    const firstTimer = clients[0]!.all.findLast((m) => m.type === "gameSnapshot");
    expect(firstTimer?.type === "gameSnapshot" && firstTimer.payload.timer).toMatchObject({
      kind: "roll",
      durationMs: 30_000,
    });

    const seen = { roll: 0, endTurn: 0, discard: 0, setup: 0 };
    const tally = () => {
      const log = clients[0]!.view!.log;
      seen.roll = seen.endTurn = seen.discard = seen.setup = 0;
      log.forEach((e, i) => {
        if (e.type !== "timedOut" || !e.seats.includes(silent)) return;
        const next = log[i + 1];
        if (e.phase === "turn" && next?.type === "diceRolled") seen.roll++;
        if (e.phase === "turn" && next?.type === "turnEnded") seen.endTurn++;
        if (e.phase === "discard") seen.discard++;
        if (e.phase === "setup") seen.setup++;
      });
    };
    const done = () => seen.roll > 0 && seen.endTurn > 0 && seen.discard > 0;

    let steps = 0;
    while (!done() && clients[0]!.view!.phase.kind !== "ended") {
      if (steps++ > 5_000) throw new Error(`no discard timeout after ${steps} steps`);
      const marks = clients.map((c) => c.all.length);
      const before = clients.map((c) => c.version);
      const actor = clients.find((c) => c.seat !== silent && choose(c) !== null);
      if (actor) {
        const action = choose(actor)!;
        const seq = actor.send("gameAction", { action });
        const r = await reply(actor, seq);
        if (r.type !== "gameUpdate")
          throw new Error(`${action.type} failed: ${JSON.stringify(r.payload)}`);
      } else {
        // Only the silent seat is waited for: let its deadline pass.
        const due = clock.pending()[0];
        if (due === undefined) throw new Error("waiting for the silent seat, but no deadline");
        const timer = clients[0]!.all.findLast(
          (m) => m.type === "gameUpdate" || m.type === "gameSnapshot",
        );
        if (timer && (timer.type === "gameUpdate" || timer.type === "gameSnapshot")) {
          expect(timer.payload.timer?.seats).toContain(silent);
        }
        await clock.advance(due - clock.now());
      }
      await Promise.all(clients.map((c, i) => c.waitFor((m) => m.type === "gameUpdate", marks[i])));
      clients.forEach((c, i) => expect(c.version).toBe((before[i] ?? 0) + 1));
      tally();
    }
    expect(seen.setup).toBeGreaterThan(0);
    expect(seen.roll).toBeGreaterThan(0);
    expect(seen.endTurn).toBeGreaterThan(0);
    expect(seen.discard).toBeGreaterThan(0);
    // The game went on past the silent player's turns.
    expect(clients[0]!.view!.turn.number).toBeGreaterThan(3);
    expectPrivacy(clients);
    const pub = clients.map((c) => publicPart(c.view!));
    expect(pub[1]).toEqual(pub[0]);
    expect(pub[2]).toEqual(pub[0]);
  }, 60_000);
});

async function restartScenario(makeStore: () => RoomStore) {
  const store = makeStore();
  const a = await startServer(store);
  const clients = await lobby(a.base, ["Ana", "Ben", "Cy", "Dee"]);
  await play(clients, () => (clients[0]!.view?.turn.number ?? 0) >= 2);
  const before = clients.map((c) => ({ view: c.view, version: c.version, legal: c.legal }));
  const creds = clients.map((c) => ({ room: c.room!, token: c.token! }));

  await a.server.close();
  servers.splice(servers.indexOf(a.server), 1);
  for (const c of clients) expect((await c.closed).code).toBe(1012);

  const b = await startServer(store);
  const again: TestClient[] = [];
  for (const cred of creds) {
    const c = await client(b.base);
    const seq = c.send("resumeRoom", cred);
    expect((await reply(c, seq)).type).toBe("roomJoined");
    await c.waitFor((m) => m.type === "gameSnapshot");
    c.token = cred.token;
    again.push(c);
  }
  again.forEach((c, i) => {
    expect(c.version).toBe(before[i]!.version);
    expect(c.view).toEqual(before[i]!.view);
    expect(c.legal).toEqual(before[i]!.legal);
  });
  await play(again, () => (again[0]!.view?.turn.number ?? 0) >= 4);
  expectPrivacy(again);
}

describe("restart recovery", () => {
  it("rebuilds the game on a new server from the same store", async () => {
    await restartScenario(() => createMemoryStore());
  });

  const realRedisUrl = process.env.TEST_REDIS === "1" ? process.env.REDIS_URL : undefined;
  it.skipIf(realRedisUrl === undefined)("works against real Redis", async () => {
    const redis = new Redis(realRedisUrl!, { lazyConnect: true });
    await redis.connect();
    const prefix = `hexfall-e2e-${Math.random().toString(36).slice(2)}:`;
    try {
      await restartScenario(() => createRedisStore(redis, { prefix }));
    } finally {
      const keys = await redis.keys(`${prefix}*`);
      if (keys.length > 0) await redis.del(...keys);
      await redis.quit();
    }
  });
});
