// Turn timer in the room layer (tasks 3.3-3.4), driven by a fake clock and scheduler:
// the game-server "Turn timer", "Starting a game" and "Presence" scenarios.
import {
  createGame,
  legalActions,
  publicVp,
  type GameEvent,
  type GameState,
} from "@hexfall/engine";
import type { TimerInfo, TurnTimerPreset } from "@hexfall/protocol";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { hashToken } from "../src/rooms/codes.ts";
import { TIMEOUT_RETRY_MS } from "../src/rooms/room.ts";
import { createRoomService, type RoomService } from "../src/rooms/service.ts";
import { drive, fakeClock, fakeConn, makeLobby, req, type FakeConn } from "../src/rooms/testing.ts";
import { createMemoryStore } from "../src/store/memory.ts";
import type { RoomMeta } from "../src/store/types.ts";

const services: RoomService[] = [];
afterEach(() => {
  for (const s of services.splice(0)) s.close();
});

function setup(opts: { idleEvictMs?: number } = {}) {
  const clock = fakeClock();
  const store = createMemoryStore({ now: clock.now });
  const logs: string[] = [];
  const svc = createRoomService({
    store,
    now: clock.now,
    timers: clock.timers,
    log: (m) => logs.push(m),
    ...opts,
  });
  services.push(svc);
  return { clock, store, svc, logs };
}

const updates = (c: FakeConn) => c.of("gameUpdate").map((m) => m.payload);
const lastUpdate = (c: FakeConn) => updates(c).at(-1);
const lastTimer = (c: FakeConn): TimerInfo | undefined => {
  const m = c.sent.findLast((x) => x.type === "gameUpdate" || x.type === "gameSnapshot");
  return m && (m.type === "gameUpdate" || m.type === "gameSnapshot") ? m.payload.timer : undefined;
};
const types = (events: GameEvent[]) => events.map((e) => e.type);

const CONFIG = { seed: "turn-timer", mode: "beginner" as const, playerCount: 3 as const };
const TOKENS = ["t0", "t1", "t2"];

/** A turn-phase game: seat 0 active (rolled or not), seat 0 with a settlement on vertex 20. */
function turnState(rolled: boolean): GameState {
  const s = createGame(CONFIG);
  s.phase = { kind: "turn" };
  s.turn = { seat: 0, number: 5, rolled, devPlayed: false, dice: rolled ? [3, 4] : null };
  s.vertices[20] = { owner: 0, kind: "settlement" };
  s.players[0]!.pieces.settlements = 4;
  for (const r of ["brick", "lumber", "ore"] as const) {
    s.players[0]!.resources[r] += 2;
    s.bank[r] -= 2;
  }
  return s;
}

/**
 * Stores a playing room whose history is covered by a snapshot of `state` (anchored at
 * the clock's now), then seats three fake connections by resuming.
 */
async function storedGame(
  t: ReturnType<typeof setup>,
  state: GameState,
  preset: TurnTimerPreset,
  code = "TMRRMS",
): Promise<FakeConn[]> {
  const meta: RoomMeta = {
    code,
    rev: 0,
    status: "playing",
    createdAt: 0,
    host: 0,
    seats: ["Ana", "Ben", "Cy"].map((name, i) => ({ name, tokenHash: hashToken(TOKENS[i]!) })),
    config: CONFIG,
    turnTimer: preset,
    startedAt: t.clock.now(),
  };
  expect(await t.store.createMeta(meta)).toEqual({ ok: true });
  expect(
    await t.store.appendAction(
      code,
      0,
      { action: { type: "rollForOrder", seat: 0 }, at: t.clock.now() },
      { version: 1, state, anchor: t.clock.now() },
    ),
  ).toEqual({ ok: true });
  const conns = TOKENS.map(() => fakeConn());
  for (const [i, c] of conns.entries()) {
    expect(await t.svc.resumeRoom(req(c), code, TOKENS[i]!)).toEqual({ ok: true });
    c.clear();
  }
  return conns;
}

describe("starting with a timer", () => {
  it("Start with a timer: every first view has a 30 s roll-for-order countdown", async () => {
    const t = setup();
    const { conns, code, tokens } = await makeLobby(t.svc, ["Ana", "Ben", "Cy"]);
    for (const c of conns) c.clear();
    expect(
      await t.svc.startGame(req(conns[0]!), { mode: "variable", turnTimer: "standard" }),
    ).toEqual({ ok: true });
    for (const c of conns) {
      const snap = c.of("gameSnapshot")[0]?.payload;
      expect(snap?.view.phase.kind).toBe("rollForOrder");
      expect(snap?.timer).toEqual({
        kind: "roll",
        durationMs: 30_000,
        remainingMs: 30_000,
        seats: [0, 1, 2],
      });
    }
    const stored = await t.store.loadRoom(code);
    expect(stored?.meta.turnTimer).toBe("standard");
    expect(stored?.meta.startedAt).toBe(t.clock.now());
    expect(t.clock.pending()).toEqual([t.clock.now() + 30_000]);

    // A snapshot sent later (resume) carries the time left at send time.
    await t.clock.advance(12_000);
    const tab = fakeConn();
    expect(await t.svc.resumeRoom(req(tab), code, tokens[1]!)).toEqual({ ok: true });
    expect(tab.of("gameSnapshot")[0]?.payload.timer?.remainingMs).toBe(18_000);

    // Roll-for-order runs out: the server rolls for everyone still to roll.
    await t.clock.advance(18_000);
    const u = lastUpdate(conns[0]!);
    expect(u?.events[0]).toEqual({ type: "timedOut", phase: "rollForOrder", seats: [0, 1, 2] });
    expect(types(u!.events).filter((x) => x === "orderRolled").length).toBeGreaterThanOrEqual(3);
  });

  it("the preset defaults to off", async () => {
    const t = setup();
    const { conns, code } = await makeLobby(t.svc, ["Ana", "Ben", "Cy"]);
    expect(await t.svc.startGame(req(conns[0]!), { mode: "variable" })).toEqual({ ok: true });
    expect((await t.store.loadRoom(code))?.meta.turnTimer).toBe("off");
  });
});

describe("turn timer scenarios", () => {
  it("Auto-roll: the server rolls 30 s into the turn and logs that time ran out", async () => {
    const t = setup();
    const conns = await storedGame(t, turnState(false), "standard");
    await t.clock.advance(29_999);
    expect(updates(conns[0]!)).toEqual([]);
    await t.clock.advance(1);
    for (const c of conns) {
      const u = updates(c);
      expect(u).toHaveLength(1);
      expect(u[0]?.events[0]).toEqual({ type: "timedOut", phase: "turn", seats: [0] });
      expect(u[0]?.events[1]).toMatchObject({ type: "diceRolled", seat: 0 });
      expect(u[0]?.view.turn.rolled).toBe(true);
    }
    const stored = await t.store.loadRoom("TMRRMS");
    expect(stored?.actions.at(-1)).toEqual({ action: { type: "timeout" }, at: t.clock.now() });
  });

  it("Idle turn ends: 90 s after the roll the turn ends and the next 30 s roll countdown starts", async () => {
    const t = setup();
    const conns = await storedGame(t, turnState(true), "standard");
    await t.clock.advance(89_999);
    expect(updates(conns[1]!)).toEqual([]);
    await t.clock.advance(1);
    const u = lastUpdate(conns[1]!);
    expect(types(u!.events)).toEqual(["timedOut", "turnEnded", "turnStarted"]);
    expect(u?.view.turn.seat).toBe(1);
    expect(u?.timer).toEqual({ kind: "roll", durationMs: 30_000, remainingMs: 30_000, seats: [1] });
    expect(t.clock.pending()).toEqual([t.clock.now() + 30_000]);
  });

  it("Acting restarts the idle countdown: a road built at 80 s gives 90 s from the build", async () => {
    const t = setup();
    const conns = await storedGame(t, turnState(true), "standard");
    await t.clock.advance(80_000);
    const edge = legalActions(turnState(true), 0).buildRoad[0]!;
    expect(await t.svc.gameAction(req(conns[0]!), { type: "buildRoad", edge })).toEqual({
      ok: true,
    });
    expect(lastTimer(conns[2]!)).toEqual({
      kind: "action",
      durationMs: 90_000,
      remainingMs: 90_000,
      seats: [0],
    });
    await t.clock.advance(89_999);
    expect(updates(conns[2]!)).toHaveLength(1);
    await t.clock.advance(1);
    expect(updates(conns[2]!)).toHaveLength(2);
    expect(lastUpdate(conns[2]!)?.events[0]).toMatchObject({ type: "timedOut", phase: "turn" });
  });

  it("Other players cannot extend the turn: a rejection keeps the countdown running", async () => {
    const t = setup();
    const conns = await storedGame(t, turnState(true), "standard");
    await t.clock.advance(10_000);
    const offer = { give: { ore: 1 }, get: { grain: 1 }, to: [1, 2] };
    expect(await t.svc.gameAction(req(conns[0]!), { type: "proposeTrade", ...offer })).toEqual({
      ok: true,
    });
    expect(lastTimer(conns[1]!)?.remainingMs).toBe(90_000); // the active player acted
    await t.clock.advance(40_000);
    const offerId = lastUpdate(conns[1]!)!.view.offers[0]!.id;
    expect(await t.svc.gameAction(req(conns[1]!), { type: "rejectTrade", offerId })).toEqual({
      ok: true,
    });
    // The update carries the time left at send time, and the deadline did not move.
    expect(lastTimer(conns[0]!)?.remainingMs).toBe(50_000);
    expect(t.clock.pending()).toEqual([t.clock.now() + 50_000]);
    await t.clock.advance(50_000);
    expect(lastUpdate(conns[0]!)?.events[0]).toMatchObject({ type: "timedOut", phase: "turn" });
    expect(lastUpdate(conns[0]!)?.view.turn.seat).toBe(1);
  });

  it("Race with a player's action: an end-turn accepted first drops the old timeout", async () => {
    const t = setup();
    const conns = await storedGame(t, turnState(true), "standard");
    await t.clock.advance(89_999);
    // The end-turn is queued, then the deadline passes before it is processed.
    const ended = t.svc.gameAction(req(conns[0]!), { type: "endTurn" });
    await t.clock.advance(1);
    expect(await ended).toEqual({ ok: true });
    await t.clock.flush();
    const u = updates(conns[1]!);
    expect(u).toHaveLength(1);
    expect(types(u[0]!.events)).toEqual(["turnEnded", "turnStarted"]);
    expect(u[0]?.timer).toEqual({
      kind: "roll",
      durationMs: 30_000,
      remainingMs: 30_000,
      seats: [1],
    });
    expect((await t.store.loadRoom("TMRRMS"))?.version).toBe(2);
    expect(t.clock.pending()).toEqual([t.clock.now() + 30_000]);
  });

  it("Timer off: null countdowns and no timeout ever", async () => {
    const t = setup();
    const { conns } = await makeLobby(t.svc, ["Ana", "Ben", "Cy"]);
    expect(await t.svc.startGame(req(conns[0]!), { mode: "variable", turnTimer: "off" })).toEqual({
      ok: true,
    });
    await drive(t.svc, conns, () => conns[0]!.game()!.view.phase.kind === "turn", 200);
    expect(t.clock.pending()).toEqual([]);
    for (const c of conns) {
      expect(c.of("gameSnapshot")[0]?.payload.timer).toBeNull();
      expect(updates(c).length).toBeGreaterThan(0);
      expect(updates(c).every((u) => u.timer === null)).toBe(true);
    }
    const before = updates(conns[0]!).length;
    await t.clock.advance(24 * 60 * 60 * 1000);
    expect(updates(conns[0]!)).toHaveLength(before);
  });

  it("rooms stored before the timer (no turnTimer in meta) behave as off", async () => {
    const t = setup();
    const conns = await storedGame(t, turnState(true), "off");
    const loaded = await t.store.loadRoom("TMRRMS");
    const meta = { ...loaded!.meta, rev: 1 };
    delete meta.turnTimer;
    delete meta.startedAt;
    expect(await t.store.saveMeta(meta, 0)).toEqual({ ok: true });
    const t2c = fakeConn();
    const svc2 = createRoomService({ store: t.store, now: t.clock.now, timers: t.clock.timers });
    services.push(svc2);
    expect(await svc2.resumeRoom(req(t2c), "TMRRMS", TOKENS[0]!)).toEqual({ ok: true });
    expect(t2c.of("gameSnapshot")[0]?.payload.timer).toBeNull();
    expect(t.clock.pending()).toEqual([]);
    expect(conns).toHaveLength(3);
  });

  it("a store outage during a timeout retries every 5 s and then succeeds", async () => {
    const t = setup();
    const conns = await storedGame(t, turnState(true), "standard");
    t.store.setAvailable(false);
    await t.clock.advance(90_000);
    expect(updates(conns[0]!)).toEqual([]);
    expect(t.clock.pending()).toEqual([t.clock.now() + TIMEOUT_RETRY_MS]);
    await t.clock.advance(TIMEOUT_RETRY_MS);
    expect(updates(conns[0]!)).toEqual([]);
    expect(t.clock.pending()).toEqual([t.clock.now() + TIMEOUT_RETRY_MS]);
    t.store.setAvailable(true);
    await t.clock.advance(TIMEOUT_RETRY_MS);
    const u = updates(conns[0]!);
    expect(u).toHaveLength(1);
    expect(u[0]?.events[0]).toMatchObject({ type: "timedOut", phase: "turn" });
    expect(u[0]?.view.turn.seat).toBe(1);
    expect(t.logs.some((l) => l.includes("timeout not stored"))).toBe(true);
    expect((await t.store.loadRoom("TMRRMS"))?.version).toBe(2);
  });

  it("the game-over update carries a null countdown and no deadline stays armed", async () => {
    const t = setup();
    const s = createGame(CONFIG);
    s.phase = { kind: "turn" };
    s.turn = { seat: 0, number: 5, rolled: true, devPlayed: false, dice: [3, 4] };
    s.longestRoad = 0;
    for (const v of [0, 10, 30]) s.vertices[v] = { owner: 0, kind: "city" };
    s.vertices[20] = { owner: 0, kind: "settlement" };
    const p = s.players[0]!;
    p.pieces.cities = 1;
    p.pieces.settlements = 4;
    p.resources.ore = 3;
    p.resources.grain = 2;
    s.bank.ore -= 3;
    s.bank.grain -= 2;
    expect(publicVp(s, 0)).toBe(9);
    const conns = await storedGame(t, s, "standard");
    expect(t.clock.pending()).toHaveLength(1);
    expect(await t.svc.gameAction(req(conns[0]!), { type: "buildCity", vertex: 20 })).toEqual({
      ok: true,
    });
    for (const c of conns) {
      expect(lastUpdate(c)?.view.winner).toBe(0);
      expect(lastUpdate(c)?.timer).toBeNull();
    }
    expect(t.clock.pending()).toEqual([]);
  });

  it("Disconnect during a discard with a timer: the server discards for the absent player", async () => {
    const t = setup();
    const s = turnState(true);
    s.phase = { kind: "discard", owed: [0, 4, 0] };
    const ben = s.players[1]!;
    ben.resources.wool = 8;
    s.bank.wool -= 8;
    const conns = await storedGame(t, s, "standard");
    t.svc.disconnect(conns[1]!);
    expect(lastTimer(conns[0]!)).toBeUndefined();
    await t.clock.advance(90_000);
    const u = lastUpdate(conns[0]!);
    expect(u?.events[0]).toEqual({ type: "timedOut", phase: "discard", seats: [1] });
    expect(u?.events[1]).toMatchObject({ type: "discarded", seat: 1 });
    expect(u?.view.phase.kind).toBe("moveRobber");
    expect(u?.view.players[1]?.resourceCount).toBe(4);
  });

  it("an evicted room's timer stops; the next load fires the passed deadline once", async () => {
    const t = setup({ idleEvictMs: 5 });
    const conns = await storedGame(t, turnState(true), "standard");
    for (const c of conns) t.svc.disconnect(c);
    await new Promise((r) => setTimeout(r, 40));
    expect(t.svc.loadedRooms()).toBe(0);
    expect(t.clock.pending()).toEqual([]);
    await t.clock.advance(200_000); // the 90 s deadline passes while unloaded
    const back = fakeConn();
    expect(await t.svc.resumeRoom(req(back), "TMRRMS", TOKENS[2]!)).toEqual({ ok: true });
    // Armed on load with no time left; the snapshot showed 0 s remaining.
    expect(back.of("gameSnapshot")[0]?.payload.timer?.remainingMs).toBe(0);
    expect(t.clock.pending()).toEqual([t.clock.now()]);
    await t.clock.advance(0);
    const u = updates(back);
    expect(u).toHaveLength(1);
    expect(u[0]?.events[0]).toMatchObject({ type: "timedOut", phase: "turn" });
    // The new anchor is that timeout: the next player gets a full 30 s roll countdown.
    expect(u[0]?.timer).toEqual({
      kind: "roll",
      durationMs: 30_000,
      remainingMs: 30_000,
      seats: [1],
    });
    expect(t.clock.pending()).toEqual([t.clock.now() + 30_000]);
  });
});
