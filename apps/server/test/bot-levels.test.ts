// Bot difficulty levels in the room layer (specs/bots "Bot difficulty levels").
import { afterEach, describe, expect, it } from "vite-plus/test";
import { BOT_TURN_DELAY_MS } from "../src/rooms/room.ts";
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
import type { RoomStore } from "../src/store/types.ts";

const services: RoomService[] = [];
afterEach(() => {
  for (const s of services.splice(0)) s.close();
});

function service(clock = fakeClock(), store: RoomStore = createMemoryStore({ now: clock.now })) {
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
const levels = (c: FakeConn) =>
  c
    .of("roomState")
    .at(-1)
    ?.payload.seats.map((s) => s.level);

describe("bot levels", () => {
  it("new bots are Normal, humans have no level", async () => {
    const t = service();
    const { conns } = await makeLobby(t.svc, ["Ana", "Ben"]);
    const ana = conns[0] as FakeConn;
    await t.svc.addBot(req(ana));
    expect(levels(ana)).toEqual([undefined, undefined, "normal"]);
  });

  it("the host sets a level; it is stored and sent to everyone", async () => {
    const t = service();
    const { conns, code } = await makeLobby(t.svc, ["Ana", "Ben"]);
    const [ana, ben] = conns as [FakeConn, FakeConn];
    await t.svc.addBot(req(ana));
    expect(await t.svc.setBotLevel(req(ana), 2, "hard")).toEqual({ ok: true });
    expect(levels(ana)).toEqual([undefined, undefined, "hard"]);
    expect(levels(ben)).toEqual([undefined, undefined, "hard"]);
    expect((await t.store.loadRoom(code))?.meta.seats[2]?.level).toBe("hard");
  });

  it("refuses non-hosts, human seats and started games", async () => {
    const t = service();
    const { conns } = await makeLobby(t.svc, ["Ana", "Ben"]);
    const [ana, ben] = conns as [FakeConn, FakeConn];
    await t.svc.addBot(req(ana));
    expect(await t.svc.setBotLevel(req(ben), 2, "easy")).toEqual(err("not_host"));
    expect(await t.svc.setBotLevel(req(ana), 1, "easy")).toEqual(err("not_a_bot"));
    expect(await t.svc.setBotLevel(req(ana), 7, "easy")).toEqual(err("not_a_bot"));
    expect(await t.svc.startGame(req(ana), { mode: "variable" })).toEqual({ ok: true });
    expect(await t.svc.setBotLevel(req(ana), 2, "easy")).toEqual(err("game_started"));
    expect(levels(ana)).toEqual([undefined, undefined, "normal"]);
  });

  it("bots filled in on start are Normal and keep a level set in the lobby", async () => {
    const t = service();
    const { conns } = await makeLobby(t.svc, ["Ana"]);
    const ana = conns[0] as FakeConn;
    await t.svc.addBot(req(ana));
    await t.svc.setBotLevel(req(ana), 1, "easy");
    await t.svc.startGame(req(ana), { mode: "variable" });
    expect(levels(ana)).toEqual([undefined, "easy", "normal"]);
  });

  it("a stored room without a level, or with an unknown one, plays its bots at Normal", async () => {
    const t = service();
    const { conns, tokens, code } = await makeLobby(t.svc, ["Ana"]);
    const ana = conns[0] as FakeConn;
    await t.svc.addBot(req(ana));
    await t.svc.addBot(req(ana));
    await t.svc.setBotLevel(req(ana), 1, "hard");
    await t.svc.startGame(req(ana), { mode: "variable" });
    // The server goes away; the stored seats are rewritten as an older room (no level)
    // and a corrupt one.
    t.svc.close();
    const loaded = (await t.store.loadRoom(code))!;
    const seats = loaded.meta.seats.map(({ level: _, ...s }, i) =>
      i === 2 ? { ...s, level: "insane" as never } : s,
    );
    const meta = { ...loaded.meta, seats, rev: loaded.meta.rev + 1 };
    expect(await t.store.saveMeta(meta, loaded.meta.rev)).toEqual({ ok: true });
    // A restarted server loads the room from the store.
    const next = service(t.clock, t.store);
    const back = fakeConn();
    expect(await next.svc.resumeRoom(req(back), code, tokens[0]!)).toEqual({ ok: true });
    expect(levels(back)).toEqual([undefined, "normal", "normal"]);
    // Bots keep playing from the stored state.
    for (let i = 0; i < 200 && (back.game()?.view.turn.number ?? 0) < 3; i++) {
      const move = nextMove([back]);
      if (move) expect((await next.svc.gameAction(req(back), move.action)).ok).toBe(true);
      else await t.clock.advance(BOT_TURN_DELAY_MS);
    }
    expect(back.game()?.view.turn.number).toBeGreaterThanOrEqual(3);
    expect(next.logs.filter((l) => /refused|stalled|failed/.test(l))).toEqual([]);
  });

  it("Easy and Hard bots play without a refused move", async () => {
    const t = service();
    const { conns } = await makeLobby(t.svc, ["Ana"]);
    const ana = conns[0] as FakeConn;
    await t.svc.addBot(req(ana));
    await t.svc.addBot(req(ana));
    await t.svc.setBotLevel(req(ana), 1, "easy");
    await t.svc.setBotLevel(req(ana), 2, "hard");
    await t.svc.startGame(req(ana), { mode: "variable" });
    for (let i = 0; i < 400 && (ana.game()?.view.turn.number ?? 0) < 10; i++) {
      const move = nextMove([ana]);
      if (move) expect((await t.svc.gameAction(req(ana), move.action)).ok).toBe(true);
      else await t.clock.advance(BOT_TURN_DELAY_MS);
    }
    expect(ana.game()?.view.turn.number).toBeGreaterThanOrEqual(10);
    expect(t.logs.filter((l) => /refused|stalled|failed/.test(l))).toEqual([]);
  });
});
