// Bots in the room layer (specs/bots): seats, auto-fill, the driver, pause and recovery.
import { afterEach, describe, expect, it } from "vite-plus/test";
import { BOT_DELAY_MS } from "../src/rooms/room.ts";
import { createRoomService, type RoomService } from "../src/rooms/service.ts";
import {
  fakeClock,
  fakeConn,
  makeLobby,
  nextMove,
  req,
  type FakeConn,
} from "../src/rooms/testing.ts";
import { createMemoryStore } from "../src/store/memory.ts";

const services: RoomService[] = [];
afterEach(() => {
  for (const s of services.splice(0)) s.close();
});

function setup() {
  const clock = fakeClock();
  const store = createMemoryStore({ now: clock.now });
  const logs: string[] = [];
  const svc = createRoomService({
    store,
    now: clock.now,
    timers: clock.timers,
    log: (m) => logs.push(m),
  });
  services.push(svc);
  return { clock, store, svc, logs };
}

const err = (code: string) => ({ ok: false, error: { code, message: expect.any(String) } });
const lastRoomState = (c: FakeConn) => c.of("roomState").at(-1)?.payload;

/** The human plays a move whenever it has one; time moves on so bots can act. */
async function play(
  t: ReturnType<typeof setup>,
  human: FakeConn,
  stop: () => boolean,
  max = 600,
): Promise<number> {
  for (let i = 0; i < max; i++) {
    if (stop()) return i;
    const move = nextMove([human]);
    if (move) {
      const r = await t.svc.gameAction(req(human), move.action);
      if (!r.ok) throw new Error(`human move refused: ${JSON.stringify(r)}`);
    } else {
      await t.clock.advance(BOT_DELAY_MS);
    }
  }
  return max;
}

describe("bot seats", () => {
  it("the host adds and removes bots", async () => {
    const t = setup();
    const { conns } = await makeLobby(t.svc, ["Ana", "Ben"]);
    const [ana, ben] = conns as [FakeConn, FakeConn];
    expect(await t.svc.addBot(req(ben))).toEqual(err("not_host"));
    expect(await t.svc.addBot(req(ana))).toEqual({ ok: true });
    const seats = lastRoomState(ana)?.seats;
    expect(seats).toHaveLength(3);
    expect(seats?.[2]).toMatchObject({ seat: 2, connected: true, bot: true });
    expect(await t.svc.addBot(req(ana))).toEqual({ ok: true });
    expect(await t.svc.addBot(req(ana))).toEqual(err("room_full"));
    expect(await t.svc.removeBot(req(ana), 1)).toEqual(err("not_a_bot"));
    expect(await t.svc.removeBot(req(ana), 9)).toEqual(err("not_a_bot"));
    expect(await t.svc.removeBot(req(ben), 2)).toEqual(err("not_host"));
    expect(await t.svc.removeBot(req(ana), 2)).toEqual({ ok: true });
    expect(lastRoomState(ben)?.seats.map((s) => s.bot)).toEqual([false, false, true]);
  });

  it("gives bots unique names", async () => {
    const t = setup();
    const { conns } = await makeLobby(t.svc, ["Atlas"]);
    const ana = conns[0] as FakeConn;
    await t.svc.addBot(req(ana));
    await t.svc.addBot(req(ana));
    const names = lastRoomState(ana)?.seats.map((s) => s.name.toLowerCase()) ?? [];
    expect(new Set(names).size).toBe(names.length);
  });

  it("deletes the room when the last human leaves, even with bots", async () => {
    const t = setup();
    const { conns, code } = await makeLobby(t.svc, ["Ana"]);
    const ana = conns[0] as FakeConn;
    await t.svc.addBot(req(ana));
    expect(await t.svc.leaveRoom(req(ana))).toEqual({ ok: true });
    expect(await t.store.loadRoom(code)).toBeNull();
  });

  it("hands the host to the first human when the host leaves", async () => {
    const t = setup();
    const { conns } = await makeLobby(t.svc, ["Ana", "Ben"]);
    const [ana, ben] = conns as [FakeConn, FakeConn];
    await t.svc.addBot(req(ana));
    expect(await t.svc.leaveRoom(req(ana))).toEqual({ ok: true });
    expect(lastRoomState(ben)?.host).toBe(0);
    expect(lastRoomState(ben)?.seats.map((s) => s.bot)).toEqual([false, true]);
  });
});

describe("auto-fill and the bot driver", () => {
  it("fills to 3 seats on start", async () => {
    const t = setup();
    const { conns } = await makeLobby(t.svc, ["Ana"]);
    const ana = conns[0] as FakeConn;
    expect(await t.svc.startGame(req(ana), { mode: "variable" })).toEqual({ ok: true });
    const state = lastRoomState(ana);
    expect(state?.status).toBe("playing");
    expect(state?.seats.map((s) => s.bot)).toEqual([false, true, true]);
    expect(ana.game()?.view.playerCount).toBe(3);
  });

  it("bots play on their own and never get a move refused", async () => {
    const t = setup();
    const { conns } = await makeLobby(t.svc, ["Ana"]);
    const ana = conns[0] as FakeConn;
    await t.svc.startGame(req(ana), { mode: "variable" });
    await play(t, ana, () => (ana.game()?.view.turn.number ?? 0) >= 12);
    const view = ana.game()!.view;
    expect(view.turn.number).toBeGreaterThanOrEqual(12);
    // Bots placed their setup pieces and built during turns.
    for (const bot of [1, 2]) {
      expect(view.vertices.filter((b) => b?.owner === bot).length).toBeGreaterThanOrEqual(2);
    }
    expect(t.logs.filter((l) => /refused|stalled|failed/.test(l))).toEqual([]);
  });

  it("makes no bot move while paused, and continues after resume", async () => {
    const t = setup();
    const { conns } = await makeLobby(t.svc, ["Ana"]);
    const ana = conns[0] as FakeConn;
    await t.svc.startGame(req(ana), { mode: "variable" });
    // Roll for order goes seat by seat: the human rolls, then the bots are up.
    expect(await t.svc.gameAction(req(ana), { type: "rollForOrder" })).toEqual({ ok: true });
    expect(await t.svc.pauseGame(req(ana))).toEqual({ ok: true });
    const before = ana.game()?.version;
    await t.clock.advance(3 * 60 * 60 * 1000);
    expect(ana.game()?.version).toBe(before);
    expect(await t.svc.resumeGame(req(ana))).toEqual({ ok: true });
    await t.clock.advance(BOT_DELAY_MS * 3);
    expect(ana.game()?.version).toBeGreaterThan(before ?? 0);
  });

  it("continues after the room is evicted and loaded again", async () => {
    const t = setup();
    const { conns, tokens, code } = await makeLobby(t.svc, ["Ana"]);
    const ana = conns[0] as FakeConn;
    await t.svc.startGame(req(ana), { mode: "variable" });
    await play(t, ana, () => (ana.game()?.view.turn.number ?? 0) >= 1);
    // The player reconnects on a new connection; the stored game replays with bot actions.
    const back = fakeConn();
    expect(await t.svc.resumeRoom(req(back), code, tokens[0]!)).toEqual({ ok: true });
    expect(back.game()?.view.viewer).toBe(0);
    await play(t, back, () => (back.game()?.view.turn.number ?? 0) >= 4);
    expect(back.game()?.view.turn.number).toBeGreaterThanOrEqual(4);
    expect(t.logs.filter((l) => /refused|stalled|failed/.test(l))).toEqual([]);
  });

  it("does not list a bot seat for anyone's token", async () => {
    const t = setup();
    const { conns, tokens, code } = await makeLobby(t.svc, ["Ana"]);
    const ana = conns[0] as FakeConn;
    await t.svc.startGame(req(ana), { mode: "variable" });
    await t.svc.lookupSeats(req(ana), [{ room: code, token: tokens[0]! }]);
    const entry = ana.of("seatsInfo").at(-1)?.payload.rooms[0];
    expect(entry).toMatchObject({ seat: 0, bots: [false, true, true] });
    // A made-up token never matches a bot seat.
    await t.svc.lookupSeats(req(ana), [{ room: code, token: "x".repeat(43) }]);
    expect(ana.of("seatsInfo").at(-1)?.payload.rooms[0]).toMatchObject({ status: "gone" });
  });
});
