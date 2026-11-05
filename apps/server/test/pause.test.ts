// Pause, resume, early end and seat lookup in the room layer (openspec change
// pause-and-resume-games: specs game-pause, early-end, saved-games, game-server).
import { createGame, legalActions, publicVp, type GameState } from "@hexfall/engine";
import type { TurnTimerPreset } from "@hexfall/protocol";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { hashToken } from "../src/rooms/codes.ts";
import { createRoomService, type RoomService } from "../src/rooms/service.ts";
import { fakeClock, fakeConn, makeLobby, req, type FakeConn } from "../src/rooms/testing.ts";
import type { TurnNotifier, WaitChange } from "../src/push/notify.ts";
import { createMemoryPushStore } from "../src/push/store.ts";
import { createMemoryStore } from "../src/store/memory.ts";
import {
  ENDED_EARLY_TTL_MS,
  PAUSED_TTL_MS,
  ROOM_TTL_MS,
  type RoomMeta,
} from "../src/store/types.ts";

const services: RoomService[] = [];
afterEach(() => {
  for (const s of services.splice(0)) s.close();
});

const HOUR = 60 * 60 * 1000;
const CODE = "PAUSEX";
const CONFIG = { seed: "pause", mode: "beginner" as const, playerCount: 3 as const };
const TOKENS = ["t0", "t1", "t2"];

function setup() {
  const clock = fakeClock();
  const store = createMemoryStore({ now: clock.now });
  const pushStore = createMemoryPushStore();
  const touches: { room: string; ttlMs: number }[] = [];
  pushStore.touch = async (room, ttlMs) => {
    touches.push({ room, ttlMs });
  };
  const waits: WaitChange[] = [];
  const notifier: TurnNotifier = {
    waitsChanged: (c) => void waits.push(c),
    idle: async () => {},
  };
  const make = () => {
    const svc = createRoomService({
      store,
      now: clock.now,
      timers: clock.timers,
      log: () => {},
      push: { store: pushStore, notifier },
    });
    services.push(svc);
    return svc;
  };
  return { clock, store, svc: make(), make, touches, waits };
}
type T = ReturnType<typeof setup>;

/** A turn-phase game: seat 0 active, one settlement for seat 0. */
function turnState(rolled: boolean): GameState {
  const s = createGame(CONFIG);
  s.phase = { kind: "turn" };
  s.turn = { seat: 0, number: 5, rolled, devPlayed: false, dice: rolled ? [3, 4] : null };
  return s;
}

/** Stores a playing room covered by a snapshot of `state`, then seats three connections. */
async function storedGame(
  t: T,
  state: GameState,
  preset: TurnTimerPreset = "standard",
  svc: RoomService = t.svc,
): Promise<FakeConn[]> {
  const meta: RoomMeta = {
    code: CODE,
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
      CODE,
      0,
      { action: { type: "rollForOrder", seat: 0 }, at: t.clock.now() },
      { version: 1, state, anchor: t.clock.now() },
    ),
  ).toEqual({ ok: true });
  return seatAll(svc);
}

async function seatAll(svc: RoomService): Promise<FakeConn[]> {
  const conns = TOKENS.map(() => fakeConn());
  for (const [i, c] of conns.entries()) {
    expect(await svc.resumeRoom(req(c), CODE, TOKENS[i]!)).toEqual({ ok: true });
  }
  for (const c of conns) c.clear();
  return conns;
}

/** A server restart: the old service stops, a new one rebuilds from the store. */
async function restart(t: T, old: RoomService): Promise<{ svc: RoomService; conns: FakeConn[] }> {
  old.close();
  const svc = t.make();
  return { svc, conns: await seatAll(svc) };
}

const err = (code: string) => ({ ok: false, error: { code, message: expect.any(String) } });
const lastRoomState = (c: FakeConn) => c.of("roomState").at(-1)?.payload;
const lastSnapshot = (c: FakeConn) => c.of("gameSnapshot").at(-1)?.payload;

describe("pause", () => {
  it("Host pauses mid-turn: everyone gets status paused, the view is unchanged", async () => {
    const t = setup();
    const conns = await storedGame(t, turnState(true));
    const before = lastSnapshot(conns[1]!);
    const r = req(conns[0]!);
    expect(await t.svc.pauseGame(r)).toEqual({ ok: true });
    for (const c of conns) {
      expect(lastRoomState(c)).toMatchObject({ status: "paused", pausedAt: t.clock.now() });
      expect(lastSnapshot(c)?.timer).toBeNull();
    }
    expect(conns[0]!.of("roomState").at(-1)?.re).toBe(r.seq);
    expect(lastSnapshot(conns[1]!)?.view.turn).toEqual(turnState(true).turn);
    expect(before).toBeUndefined();
    const stored = await t.store.loadMeta(CODE);
    expect(stored?.meta).toMatchObject({ status: "paused", pausedAt: t.clock.now() });
  });

  it("Non-host tries to pause; pausing a lobby or a paused game is not_playing", async () => {
    const t = setup();
    const conns = await storedGame(t, turnState(false));
    expect(await t.svc.pauseGame(req(conns[1]!))).toEqual(err("not_host"));
    expect(lastRoomState(conns[0]!)).toBeUndefined();
    expect(await t.svc.pauseGame(req(conns[0]!))).toEqual({ ok: true });
    expect(await t.svc.pauseGame(req(conns[0]!))).toEqual(err("not_playing"));
    const lobby = await makeLobby(t.svc, ["Ana", "Ben", "Cy"]);
    expect(await t.svc.pauseGame(req(lobby.conns[0]!))).toEqual(err("not_playing"));
    expect(await t.svc.pauseGame(req(fakeConn()))).toEqual(err("no_seat"));
  });

  it("Action while paused: game_paused, nobody gets an update", async () => {
    const t = setup();
    const conns = await storedGame(t, turnState(false));
    await t.svc.pauseGame(req(conns[0]!));
    for (const c of conns) c.clear();
    expect(await t.svc.gameAction(req(conns[0]!), { type: "rollDice" })).toEqual(
      err("game_paused"),
    );
    for (const c of conns) expect(c.sent).toEqual([]);
  });

  it("Timer frozen, then resumed with the time that was left", async () => {
    const t = setup();
    const conns = await storedGame(t, turnState(true));
    await t.clock.advance(50_000);
    await t.svc.pauseGame(req(conns[0]!));
    expect(t.clock.pending()).toEqual([]);
    await t.clock.advance(3 * HOUR);
    expect(conns[0]!.of("gameUpdate")).toEqual([]);

    expect(await t.svc.resumeGame(req(conns[1]!))).toEqual(err("not_host"));
    expect(await t.svc.resumeGame(req(conns[0]!))).toEqual({ ok: true });
    for (const c of conns) {
      expect(lastRoomState(c)).toMatchObject({ status: "playing", pausedAt: null });
      expect(lastSnapshot(c)?.timer).toMatchObject({ kind: "action", remainingMs: 40_000 });
    }
    expect(await t.svc.resumeGame(req(conns[0]!))).toEqual(err("not_paused"));
    await t.clock.advance(39_999);
    expect(conns[0]!.of("gameUpdate")).toEqual([]);
    await t.clock.advance(1);
    expect(conns[0]!.of("gameUpdate").at(-1)?.payload.events[0]).toMatchObject({
      type: "timedOut",
    });
  });

  it("Resume alone: the host continues with nobody else connected", async () => {
    const t = setup();
    const conns = await storedGame(t, turnState(false), "off");
    await t.svc.pauseGame(req(conns[0]!));
    t.svc.disconnect(conns[1]!);
    t.svc.disconnect(conns[2]!);
    expect(await t.svc.resumeGame(req(conns[0]!))).toEqual({ ok: true });
    expect(await t.svc.gameAction(req(conns[0]!), { type: "rollDice" })).toEqual({ ok: true });
  });

  it("Look at a paused game: resuming a seat shows status paused and the full view", async () => {
    const t = setup();
    const conns = await storedGame(t, turnState(false));
    await t.svc.pauseGame(req(conns[0]!));
    const tab = fakeConn();
    expect(await t.svc.resumeRoom(req(tab), CODE, TOKENS[2]!)).toEqual({ ok: true });
    expect(lastRoomState(tab)?.status).toBe("paused");
    expect(lastSnapshot(tab)?.view.viewer).toBe(2);
    expect(lastSnapshot(tab)?.timer).toBeNull();
  });

  it("Restart while paused keeps the status and the countdown time left", async () => {
    const t = setup();
    const conns = await storedGame(t, turnState(false));
    await t.clock.advance(5_000);
    await t.svc.pauseGame(req(conns[0]!));
    await t.clock.advance(2 * HOUR);
    const next = await restart(t, t.svc);
    const tab = fakeConn();
    expect(await next.svc.resumeRoom(req(tab), CODE, TOKENS[1]!)).toEqual({ ok: true });
    expect(lastRoomState(tab)?.status).toBe("paused");
    expect(t.clock.pending()).toEqual([]);
    await t.clock.advance(HOUR);
    expect(await next.svc.resumeGame(req(next.conns[0]!))).toEqual({ ok: true });
    expect(lastSnapshot(tab)?.timer).toMatchObject({ kind: "roll", remainingMs: 25_000 });
  });

  it("Restart after a resume: completed pauses still count", async () => {
    const t = setup();
    const conns = await storedGame(t, turnState(true));
    await t.clock.advance(10_000);
    await t.svc.pauseGame(req(conns[0]!));
    await t.clock.advance(HOUR);
    await t.svc.resumeGame(req(conns[0]!));
    await t.clock.advance(5_000);
    const next = await restart(t, t.svc);
    const tab = fakeConn();
    await next.svc.resumeRoom(req(tab), CODE, TOKENS[1]!);
    expect(lastSnapshot(tab)?.timer).toMatchObject({ kind: "action", remainingMs: 75_000 });
    expect(t.clock.pending()).toEqual([t.clock.now() + 75_000]);
  });

  it("Pause and an action race: whichever arrives first wins", async () => {
    const t = setup();
    const conns = await storedGame(t, turnState(false));
    const [a, p] = await Promise.all([
      t.svc.gameAction(req(conns[0]!), { type: "rollDice" }),
      t.svc.pauseGame(req(conns[0]!)),
    ]);
    expect(a).toEqual({ ok: true });
    expect(p).toEqual({ ok: true });
    await t.svc.resumeGame(req(conns[0]!));
    const [p2, a2] = await Promise.all([
      t.svc.pauseGame(req(conns[0]!)),
      t.svc.gameAction(req(conns[0]!), { type: "endTurn" }),
    ]);
    expect(p2).toEqual({ ok: true });
    expect(a2).toEqual(err("game_paused"));
  });

  it("A store failure keeps the room playing", async () => {
    const t = setup();
    const conns = await storedGame(t, turnState(false));
    t.store.setAvailable(false);
    expect(await t.svc.pauseGame(req(conns[0]!))).toEqual(err("unavailable"));
    t.store.setAvailable(true);
    expect(lastRoomState(conns[1]!)).toBeUndefined();
    expect(await t.svc.gameAction(req(conns[0]!), { type: "rollDice" })).toEqual({ ok: true });
  });

  it("Pausing sets a 7-day expiry (room and push); resuming restores the normal one", async () => {
    const t = setup();
    const conns = await storedGame(t, turnState(false));
    await t.svc.pauseGame(req(conns[0]!));
    expect(t.store.ttl(CODE)).toBe(PAUSED_TTL_MS);
    await t.clock.advance(HOUR);
    // Reads and seat resumes never extend it.
    await t.svc.resumeRoom(req(fakeConn()), CODE, TOKENS[1]!);
    await t.svc.lookupSeats(req(fakeConn()), [{ room: CODE, token: TOKENS[1]! }]);
    expect(t.store.ttl(CODE)).toBe(PAUSED_TTL_MS - HOUR);
    await t.svc.resumeGame(req(conns[0]!));
    expect(t.store.ttl(CODE)).toBe(ROOM_TTL_MS);
    await t.clock.flush();
    expect(t.touches).toEqual([
      { room: CODE, ttlMs: PAUSED_TTL_MS },
      { room: CODE, ttlMs: ROOM_TTL_MS },
    ]);
  });

  it("Forgotten paused game: gone after 7 days", async () => {
    const t = setup();
    const conns = await storedGame(t, turnState(false));
    await t.svc.pauseGame(req(conns[0]!));
    t.svc.close();
    await t.clock.advance(PAUSED_TTL_MS + 60_000);
    const svc = t.make();
    expect(await svc.resumeRoom(req(fakeConn()), CODE, TOKENS[0]!)).toEqual(err("bad_token"));
  });

  it("No turn alerts while paused; resuming alerts the waited seats", async () => {
    const t = setup();
    const conns = await storedGame(t, turnState(false));
    await t.svc.pauseGame(req(conns[0]!));
    await t.clock.advance(HOUR);
    expect(t.waits).toEqual([]);
    await t.svc.resumeGame(req(conns[0]!));
    expect(t.waits).toHaveLength(1);
    expect(t.waits[0]).toMatchObject({ room: CODE, before: null });
  });
});

describe("early end", () => {
  it("Host ends mid-turn: ended with a result, no timer, nothing else allowed", async () => {
    const t = setup();
    const state = turnState(true);
    state.players[1]!.devCards = ["victoryPoint", "victoryPoint", "victoryPoint"];
    const conns = await storedGame(t, state);
    const vp = [0, 1, 2].map((s) => publicVp(state, s));
    const r = req(conns[0]!);
    expect(await t.svc.endGame(r)).toEqual({ ok: true });
    for (const c of conns) {
      const rs = lastRoomState(c);
      expect(rs?.status).toBe("ended");
      expect(rs?.result).toEqual({
        reason: "host",
        at: t.clock.now(),
        winners: [1],
        scores: [
          { seat: 0, vp: vp[0], hiddenVp: 0 },
          { seat: 1, vp: vp[1]! + 3, hiddenVp: 3 },
          { seat: 2, vp: vp[2], hiddenVp: 0 },
        ],
      });
      expect(lastSnapshot(c)?.timer).toBeNull();
    }
    expect(t.clock.pending()).toEqual([]);
    const edge = legalActions(state, 0).buildRoad[0];
    for (const action of [{ type: "endTurn" as const }, { type: "buildRoad" as const, edge }]) {
      const res = await t.svc.gameAction(req(conns[0]!), action as never);
      expect(res).toMatchObject({ ok: false, rejected: { code: "game_over" } });
    }
    expect(await t.svc.endGame(r)).toEqual(err("not_playing"));
    expect(await t.svc.pauseGame(r)).toEqual(err("not_playing"));
    expect(t.store.ttl(CODE)).toBe(ENDED_EARLY_TTL_MS);
    await t.clock.flush();
    expect(t.touches).toEqual([{ room: CODE, ttlMs: ENDED_EARLY_TTL_MS }]);
    expect(t.waits).toEqual([]);
  });

  it("Host ends a paused game; non-host, lobby and failed writes are refused", async () => {
    const t = setup();
    const conns = await storedGame(t, turnState(false));
    expect(await t.svc.endGame(req(conns[2]!))).toEqual(err("not_host"));
    await t.svc.pauseGame(req(conns[0]!));
    t.store.setAvailable(false);
    expect(await t.svc.endGame(req(conns[0]!))).toEqual(err("unavailable"));
    t.store.setAvailable(true);
    expect(lastRoomState(conns[1]!)?.status).toBe("paused");
    expect(await t.svc.endGame(req(conns[0]!))).toEqual({ ok: true });
    expect(lastRoomState(conns[1]!)).toMatchObject({ status: "ended", pausedAt: null });
    expect((await t.store.loadMeta(CODE))?.meta.pausedAt).toBeUndefined();
    const lobby = await makeLobby(t.svc, ["Ana", "Ben", "Cy"]);
    expect(await t.svc.endGame(req(lobby.conns[0]!))).toEqual(err("not_playing"));
  });

  it("A game that ended normally cannot be ended again", async () => {
    const t = setup();
    const state = turnState(true);
    state.phase = { kind: "ended" };
    state.winner = 0;
    const conns = await storedGame(t, state);
    expect(await t.svc.endGame(req(conns[0]!))).toEqual(err("not_playing"));
  });

  it("Restart after an early end keeps the result and keeps refusing actions", async () => {
    const t = setup();
    const conns = await storedGame(t, turnState(false));
    await t.svc.endGame(req(conns[0]!));
    const result = lastRoomState(conns[0]!)?.result;
    const next = await restart(t, t.svc);
    const tab = fakeConn();
    expect(await next.svc.resumeRoom(req(tab), CODE, TOKENS[1]!)).toEqual({ ok: true });
    expect(lastRoomState(tab)).toMatchObject({ status: "ended", result });
    expect(await next.svc.gameAction(req(next.conns[0]!), { type: "rollDice" })).toMatchObject({
      rejected: { code: "game_over" },
    });
    expect(t.clock.pending()).toEqual([]);
  });

  it("Expired result: gone 1 day after the early end", async () => {
    const t = setup();
    const conns = await storedGame(t, turnState(false));
    await t.svc.endGame(req(conns[0]!));
    t.svc.close();
    await t.clock.advance(2 * HOUR);
    let svc = t.make();
    expect(await svc.resumeRoom(req(fakeConn()), CODE, TOKENS[0]!)).toEqual({ ok: true });
    svc.close();
    await t.clock.advance(ENDED_EARLY_TTL_MS);
    svc = t.make();
    expect(await svc.resumeRoom(req(fakeConn()), CODE, TOKENS[0]!)).toEqual(err("bad_token"));
  });
});

describe("seat lookup", () => {
  it("lists valid rooms and answers gone for missing rooms and wrong tokens", async () => {
    const t = setup();
    const conns = await storedGame(t, turnState(false));
    await t.clock.advance(1_000);
    await t.svc.pauseGame(req(conns[0]!));
    const lobby = await makeLobby(t.svc, ["Dee", "Eve"]);
    const asker = fakeConn();
    const r = req(asker);
    expect(
      await t.svc.lookupSeats(r, [
        { room: CODE.toLowerCase(), token: TOKENS[1]! },
        { room: "GONE99", token: "x" },
        { room: CODE, token: "wrong" },
        { room: lobby.code, token: lobby.tokens[1]! },
        { room: "!!", token: "x" },
      ]),
    ).toEqual({ ok: true });
    const info = asker.of("seatsInfo")[0];
    expect(info?.re).toBe(r.seq);
    expect(info?.payload.rooms).toEqual([
      {
        room: CODE,
        status: "paused",
        seat: 1,
        host: 0,
        names: ["Ana", "Ben", "Cy"],
        turn: 5,
        pausedAt: t.clock.now(),
        expiresAt: t.clock.now() + PAUSED_TTL_MS,
        createdAt: 0,
        startedAt: t.clock.now() - 1_000,
        lastActiveAt: t.clock.now(),
      },
      { room: "GONE99", status: "gone" },
      { room: CODE, status: "gone" },
      {
        room: lobby.code,
        status: "lobby",
        seat: 1,
        host: 0,
        names: ["Dee", "Eve"],
        turn: null,
        pausedAt: null,
        expiresAt: t.clock.now() + ROOM_TTL_MS,
        createdAt: t.clock.now(),
        startedAt: null,
        lastActiveAt: null,
      },
      { room: "!!", status: "gone" },
    ]);
  });

  it("reads stored metadata only: no turn for unloaded rooms, no load, no side effects", async () => {
    const t = setup();
    const conns = await storedGame(t, turnState(false));
    t.svc.close();
    const svc = t.make();
    const asker = fakeConn();
    await svc.lookupSeats(req(asker), [{ room: CODE, token: TOKENS[0]! }]);
    expect(asker.of("seatsInfo")[0]?.payload.rooms[0]).toMatchObject({
      status: "playing",
      turn: null,
    });
    expect(svc.loadedRooms()).toBe(0);
    expect(asker.sent.map((m) => m.type)).toEqual(["seatsInfo"]);
    // The asker holds no seat afterwards and can still claim one.
    expect(await svc.resumeRoom(req(asker), CODE, TOKENS[0]!)).toEqual({ ok: true });
    expect(conns).toHaveLength(3);
  });

  it("a held seat keeps its connection and nobody sees a presence change", async () => {
    const t = setup();
    const conns = await storedGame(t, turnState(false));
    await t.svc.lookupSeats(req(fakeConn()), [{ room: CODE, token: TOKENS[1]! }]);
    for (const c of conns) expect(c.sent).toEqual([]);
    expect(conns[1]!.closed).toBeNull();
    expect(await t.svc.gameAction(req(conns[0]!), { type: "rollDice" })).toEqual({ ok: true });
  });

  it("reports ended rooms, refuses more than 20, and answers unavailable on outage", async () => {
    const t = setup();
    const conns = await storedGame(t, turnState(false));
    await t.svc.endGame(req(conns[0]!));
    const asker = fakeConn();
    await t.svc.lookupSeats(req(asker), [{ room: CODE, token: TOKENS[2]! }]);
    expect(asker.of("seatsInfo")[0]?.payload.rooms[0]).toMatchObject({ status: "ended" });
    const many = Array.from({ length: 21 }, () => ({ room: CODE, token: "x" }));
    expect(await t.svc.lookupSeats(req(asker), many)).toEqual(err("bad_frame"));
    t.store.setAvailable(false);
    expect(await t.svc.lookupSeats(req(asker), [{ room: CODE, token: "x" }])).toEqual(
      err("unavailable"),
    );
  });
});

describe("activity times and ending from the saved list", () => {
  it("lastActiveAt follows the last move, then the pause and the resume", async () => {
    const t = setup();
    const conns = await storedGame(t, turnState(false), "off");
    const ask = async () => {
      const c = fakeConn();
      await t.svc.lookupSeats(req(c), [{ room: CODE, token: TOKENS[0]! }]);
      return c.of("seatsInfo")[0]?.payload.rooms[0] as { lastActiveAt: number | null };
    };
    const start = t.clock.now();
    expect((await ask()).lastActiveAt).toBe(start);
    await t.clock.advance(HOUR);
    await t.svc.gameAction(req(conns[0]!), { type: "rollDice" });
    expect((await ask()).lastActiveAt).toBe(start + HOUR);
    await t.clock.advance(HOUR);
    await t.svc.pauseGame(req(conns[0]!));
    expect((await ask()).lastActiveAt).toBe(start + 2 * HOUR);
    await t.clock.advance(HOUR);
    await t.svc.resumeGame(req(conns[0]!));
    expect((await ask()).lastActiveAt).toBe(start + 3 * HOUR);
  });

  it("the host ends a game from the list with the seat token, without taking the seat", async () => {
    const t = setup();
    const conns = await storedGame(t, turnState(false));
    await t.svc.pauseGame(req(conns[0]!));
    t.svc.disconnect(conns[0]!);
    const asker = fakeConn();
    const r = req(asker);
    expect(await t.svc.endSavedGame(r, CODE.toLowerCase(), TOKENS[0]!)).toEqual({ ok: true });
    const info = asker.of("seatsInfo")[0];
    expect(info?.re).toBe(r.seq);
    expect(info?.payload.rooms).toEqual([expect.objectContaining({ room: CODE, status: "ended" })]);
    expect(asker.of("roomState")).toEqual([]);
    for (const c of conns.slice(1)) {
      expect(lastRoomState(c)).toMatchObject({ status: "ended", result: { winners: [0, 1, 2] } });
    }
    expect(t.store.ttl(CODE)).toBe(ENDED_EARLY_TTL_MS);
    // The asker holds no seat afterwards.
    expect(await t.svc.pauseGame(req(asker))).toEqual(err("no_seat"));
  });

  it("refuses non-hosts, wrong tokens, unknown rooms and ended games", async () => {
    const t = setup();
    const conns = await storedGame(t, turnState(false));
    expect(await t.svc.endSavedGame(req(fakeConn()), CODE, TOKENS[1]!)).toEqual(err("not_host"));
    expect(await t.svc.endSavedGame(req(fakeConn()), CODE, "nope")).toEqual(err("bad_token"));
    expect(await t.svc.endSavedGame(req(fakeConn()), "ZZZZZZ", "x")).toEqual(err("bad_token"));
    expect(lastRoomState(conns[1]!)).toBeUndefined();
    await t.svc.endGame(req(conns[0]!));
    expect(await t.svc.endSavedGame(req(fakeConn()), CODE, TOKENS[0]!)).toEqual(err("not_playing"));
  });

  it("works on a room not loaded in memory (rebuilds it, then ends it)", async () => {
    const t = setup();
    await storedGame(t, turnState(false));
    t.svc.close();
    const svc = t.make();
    expect(await svc.endSavedGame(req(fakeConn()), CODE, TOKENS[0]!)).toEqual({ ok: true });
    expect((await t.store.loadMeta(CODE))?.meta.status).toBe("ended");
  });
});
