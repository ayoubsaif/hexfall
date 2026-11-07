// Leaving a running game and taking over an open seat (openspec change leave-running-game:
// specs leave-game, game-server).
import { createGame, type GameState } from "@hexfall/engine";
import type { TurnTimerPreset } from "@hexfall/protocol";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { hashToken } from "../src/rooms/codes.ts";
import { BOT_TURN_DELAY_MS } from "../src/rooms/room.ts";
import { createRoomService, type RoomService } from "../src/rooms/service.ts";
import { fakeClock, fakeConn, req, type FakeConn } from "../src/rooms/testing.ts";
import { createMemoryStore } from "../src/store/memory.ts";
import type { RoomMeta, StoredSeat } from "../src/store/types.ts";

const services: RoomService[] = [];
afterEach(() => {
  for (const s of services.splice(0)) s.close();
});

const CODE = "BYEBYE";
const CONFIG = { seed: "leave", mode: "beginner" as const, playerCount: 3 as const };
const NAMES = ["Ana", "Ben", "Cy"];
const TOKENS = ["t0", "t1", "t2"];

function setup() {
  const clock = fakeClock();
  const store = createMemoryStore({ now: clock.now });
  const make = () => {
    const svc = createRoomService({ store, now: clock.now, timers: clock.timers, log: () => {} });
    services.push(svc);
    return svc;
  };
  return { clock, store, svc: make(), make };
}
type T = ReturnType<typeof setup>;

const err = (code: string) => ({ ok: false, error: { code, message: expect.any(String) } });
const lastRoomState = (c: FakeConn) => c.of("roomState").at(-1)?.payload;
const chatLines = (c: FakeConn) => c.of("chatLine").map((m) => m.payload.entry);

/** A turn-phase game with `seat` active. */
function turnState(seat: number, rolled: boolean): GameState {
  const s = createGame(CONFIG);
  s.phase = { kind: "turn" };
  s.turn = { seat, number: 5, rolled, devPlayed: false, dice: rolled ? [3, 4] : null };
  return s;
}

/**
 * Stores a game at `state` with the given seats (default: three humans), then seats a
 * connection for every human seat. `conns[i]` is null for a bot seat.
 */
async function storedGame(
  t: T,
  state: GameState,
  opts: { seats?: StoredSeat[]; status?: "playing" | "paused"; preset?: TurnTimerPreset } = {},
): Promise<(FakeConn | null)[]> {
  const seats = opts.seats ?? NAMES.map((name, i) => ({ name, tokenHash: hashToken(TOKENS[i]!) }));
  const meta: RoomMeta = {
    code: CODE,
    rev: 0,
    status: opts.status ?? "playing",
    createdAt: 0,
    host: 0,
    seats,
    config: CONFIG,
    turnTimer: opts.preset ?? "off",
    startedAt: t.clock.now(),
    ...(opts.status === "paused" ? { pausedAt: t.clock.now() } : {}),
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
  return seatHumans(t.svc, seats);
}

async function seatHumans(svc: RoomService, seats: StoredSeat[]): Promise<(FakeConn | null)[]> {
  const conns: (FakeConn | null)[] = [];
  for (const [i, s] of seats.entries()) {
    if (s.bot) {
      conns.push(null);
      continue;
    }
    const c = fakeConn();
    expect(await svc.resumeRoom(req(c), CODE, TOKENS[i]!)).toEqual({ ok: true });
    conns.push(c);
  }
  for (const c of conns) c?.clear();
  return conns;
}

const human = (conns: (FakeConn | null)[], i: number) => conns[i] as FakeConn;
/** Events and the latest view from the updates `c` got (its snapshot was cleared). */
const updates = (c: FakeConn) => {
  const all = c.of("gameUpdate");
  return { events: all.flatMap((m) => m.payload.events), view: all.at(-1)?.payload.view };
};

describe("leave a running game", () => {
  it("Non-host leaves mid-game: the seat stays, becomes an open bot seat", async () => {
    const t = setup();
    const state = turnState(0, true);
    state.players[1]!.resources.ore = 3;
    state.players[1]!.devCards = ["knight"];
    const conns = await storedGame(t, state);
    const ben = human(conns, 1);
    const r = req(ben);
    expect(await t.svc.leaveRoom(r)).toEqual({ ok: true });
    expect(ben.of("roomLeft")[0]).toMatchObject({ re: r.seq, payload: { room: CODE } });
    for (const c of [human(conns, 0), human(conns, 2)]) {
      const seats = lastRoomState(c)?.seats;
      expect(seats).toHaveLength(3);
      expect(seats?.[1]).toMatchObject({ seat: 1, bot: true, open: true, connected: true });
      expect(seats?.[1]?.name).not.toBe("Ben");
      expect(chatLines(c)).toEqual([
        expect.objectContaining({ seat: 1, name: "Ben", system: "left", text: "" }),
      ]);
    }
    // The leaver hears nothing more.
    ben.clear();
    await t.svc.chat(req(human(conns, 0)), "hi");
    expect(ben.sent).toEqual([]);
    // The game is unchanged: same seat count, the seat keeps its cards.
    const stored = await t.store.loadRoom(CODE);
    expect(stored?.meta.seats).toHaveLength(3);
    expect(stored?.meta.seats[1]).toMatchObject({ bot: true, open: true });
    expect(stored?.version).toBe(1);
    const view = human(conns, 0).game() ?? null;
    expect(view).toBeNull(); // no new snapshot: the timer is off and the game did not move
  });

  it("Old token no longer works: resume fails and lookup reports gone", async () => {
    const t = setup();
    const conns = await storedGame(t, turnState(0, true));
    await t.svc.leaveRoom(req(human(conns, 1)));
    expect(await t.svc.resumeRoom(req(fakeConn()), CODE, TOKENS[1]!)).toEqual(err("bad_token"));
    const c = fakeConn();
    await t.svc.lookupSeats(req(c), [{ room: CODE, token: TOKENS[1]! }]);
    expect(c.of("seatsInfo")[0]?.payload.rooms).toEqual([{ room: CODE, status: "gone" }]);
  });

  it("Host leaves: the lowest remaining human becomes host", async () => {
    const t = setup();
    const seats: StoredSeat[] = [
      { name: "Ana", tokenHash: hashToken(TOKENS[0]!) },
      { name: "Bot", tokenHash: hashToken("nobody"), bot: true },
      { name: "Cy", tokenHash: hashToken(TOKENS[2]!) },
    ];
    const conns = await storedGame(t, turnState(2, true), { seats });
    expect(await t.svc.leaveRoom(req(human(conns, 0)))).toEqual({ ok: true });
    expect(lastRoomState(human(conns, 2))).toMatchObject({ host: 2 });
    expect(await t.svc.pauseGame(req(human(conns, 2)))).toEqual({ ok: true });
  });

  it("Last human leaves: the room is deleted", async () => {
    const t = setup();
    const seats: StoredSeat[] = [
      { name: "Ana", tokenHash: hashToken(TOKENS[0]!) },
      { name: "Bot1", tokenHash: hashToken("x"), bot: true },
      { name: "Bot2", tokenHash: hashToken("y"), bot: true },
    ];
    const conns = await storedGame(t, turnState(1, false), { seats });
    const ana = human(conns, 0);
    expect(await t.svc.leaveRoom(req(ana))).toEqual({ ok: true });
    expect(ana.of("roomLeft")).toHaveLength(1);
    expect(await t.store.loadRoom(CODE)).toBeNull();
    expect(t.clock.pending()).toEqual([]);
  });

  it("Leave while paused: the seat opens, the room stays paused, the bot waits", async () => {
    const t = setup();
    const conns = await storedGame(t, turnState(1, false), { status: "paused" });
    expect(await t.svc.leaveRoom(req(human(conns, 1)))).toEqual({ ok: true });
    expect(lastRoomState(human(conns, 0))).toMatchObject({ status: "paused" });
    await t.clock.advance(BOT_TURN_DELAY_MS * 3);
    expect((await t.store.loadRoom(CODE))?.version).toBe(1);
    expect(await t.svc.resumeGame(req(human(conns, 0)))).toEqual({ ok: true });
    await t.clock.advance(BOT_TURN_DELAY_MS);
    expect((await t.store.loadRoom(CODE))?.version).toBeGreaterThan(1);
  });

  it("Leave after the game ended fails and changes nothing", async () => {
    const t = setup();
    const state = turnState(0, true);
    state.phase = { kind: "ended" };
    state.winner = 0;
    const conns = await storedGame(t, state);
    expect(await t.svc.leaveRoom(req(human(conns, 1)))).toEqual(err("not_playing"));
    expect((await t.store.loadRoom(CODE))?.meta.seats[1]?.bot).toBeUndefined();
  });

  it("Store down: the leave is refused and the player keeps their seat", async () => {
    const t = setup();
    const conns = await storedGame(t, turnState(0, true));
    t.store.setAvailable(false);
    expect(await t.svc.leaveRoom(req(human(conns, 1)))).toEqual(err("unavailable"));
    t.store.setAvailable(true);
    expect(human(conns, 1).of("roomLeft")).toEqual([]);
    expect(lastRoomState(human(conns, 0))).toBeUndefined();
    expect(await t.svc.chat(req(human(conns, 1)), "still here")).toEqual({ ok: true });
  });
});

describe("bot plays an open seat", () => {
  it("Leaver owed a discard: the bot discards for the seat", async () => {
    const t = setup();
    const state = turnState(0, true);
    state.phase = { kind: "discard", owed: [0, 0, 4] };
    state.players[2]!.resources = { brick: 2, grain: 2, lumber: 2, ore: 1, wool: 1 };
    const conns = await storedGame(t, state);
    expect(await t.svc.leaveRoom(req(human(conns, 2)))).toEqual({ ok: true });
    await t.clock.advance(BOT_TURN_DELAY_MS);
    const g = updates(human(conns, 0));
    expect(g.events.find((e) => e.type === "discarded")).toMatchObject({ seat: 2 });
    expect(g.view?.phase.kind).toBe("moveRobber");
  });

  it("Leaver was the active player with an open offer: the bot cancels it and ends the turn", async () => {
    const t = setup();
    const state = turnState(1, true);
    state.players[1]!.resources.ore = 1;
    state.offers = [
      { id: 0, from: 1, to: [0, 2], give: { ore: 1 }, get: { wool: 1 }, rejectedBy: [] },
    ];
    state.nextOfferId = 1;
    const conns = await storedGame(t, state);
    expect(await t.svc.leaveRoom(req(human(conns, 1)))).toEqual({ ok: true });
    for (let i = 0; i < 40 && updates(human(conns, 0)).view?.turn.seat !== 2; i++) {
      await t.clock.advance(BOT_TURN_DELAY_MS);
    }
    const g = updates(human(conns, 0));
    expect(g.events[0]).toMatchObject({ type: "tradeCancelled", offerId: 0 });
    expect(g.view?.turn.seat).toBe(2);
  });
});

describe("bot finishes what the leaver owed", () => {
  for (const phase of [
    { kind: "moveRobber" as const, source: "knight" as const },
    { kind: "roadBuilding" as const, remaining: 2 },
  ]) {
    it(`Leaver left in ${phase.kind}: the bot resolves it and the game goes on`, async () => {
      const t = setup();
      const state = turnState(1, true);
      state.phase = phase;
      // One road for seat 1, so Road Building has legal edges next to it.
      state.edges[0] = 1;
      state.players[1]!.pieces.roads -= 1;
      const conns = await storedGame(t, state);
      expect(await t.svc.leaveRoom(req(human(conns, 1)))).toEqual({ ok: true });
      for (let i = 0; i < 40 && updates(human(conns, 0)).view?.turn.seat !== 2; i++) {
        await t.clock.advance(BOT_TURN_DELAY_MS);
      }
      const g = updates(human(conns, 0));
      const done = (e: (typeof g.events)[number]) =>
        phase.kind === "moveRobber"
          ? e.type === "robberMoved" && e.seat === 1
          : e.type === "built" && e.seat === 1 && e.piece === "road" && e.free;
      expect(g.events.some(done)).toBe(true);
      expect(g.view?.turn.seat).toBe(2);
    });
  }
});

describe("take over an open seat", () => {
  async function withOpenSeat(t: T, state: GameState) {
    const conns = await storedGame(t, state);
    expect(await t.svc.leaveRoom(req(human(conns, 1)))).toEqual({ ok: true });
    for (const c of conns) c?.clear();
    return conns;
  }

  it("Newcomer takes the seat with its game state", async () => {
    const t = setup();
    const state = turnState(0, true);
    state.players[1]!.resources.ore = 3;
    const conns = await withOpenSeat(t, state);
    const eve = fakeConn();
    const r = req(eve);
    expect(await t.svc.joinRoom(r, CODE.toLowerCase(), "Eve", "baker")).toEqual({ ok: true });
    const joined = eve.of("roomJoined")[0];
    expect(joined).toMatchObject({ re: r.seq, payload: { room: CODE, seat: 1 } });
    expect(joined?.payload.token).toEqual(expect.any(String));
    expect(eve.game()?.view.players[1]?.resources?.ore).toBe(3);
    expect(eve.game()?.view.viewer).toBe(1);
    for (const c of [human(conns, 0), eve]) {
      const seat = lastRoomState(c)?.seats[1];
      expect(seat).toMatchObject({ name: "Eve", bot: false, connected: true, avatar: "baker" });
      expect(seat?.open).toBeUndefined();
    }
    expect(chatLines(human(conns, 0)).at(-1)).toMatchObject({ system: "tookOver", name: "Eve" });
    // Eve's token resumes the seat later.
    const again = fakeConn();
    expect(await t.svc.resumeRoom(req(again), CODE, joined?.payload.token ?? "")).toEqual({
      ok: true,
    });
    expect(again.of("roomJoined")[0]?.payload.seat).toBe(1);
  });

  it("Takeover on the seat's turn: the bot makes no further move", async () => {
    const t = setup();
    const conns = await storedGame(t, turnState(1, false));
    expect(await t.svc.leaveRoom(req(human(conns, 1)))).toEqual({ ok: true });
    const eve = fakeConn();
    expect(await t.svc.joinRoom(req(eve), CODE, "Eve")).toEqual({ ok: true });
    await t.clock.advance(BOT_TURN_DELAY_MS * 3);
    expect((await t.store.loadRoom(CODE))?.version).toBe(1);
    expect(eve.game()?.legal.rollDice).toBe(true);
  });

  it("Name clash and no open seat", async () => {
    const t = setup();
    const conns = await withOpenSeat(t, turnState(0, true));
    expect(await t.svc.joinRoom(req(fakeConn()), CODE, "ana")).toEqual(err("bad_name"));
    expect(await t.svc.joinRoom(req(fakeConn()), CODE, "Eve")).toEqual({ ok: true });
    expect(await t.svc.joinRoom(req(fakeConn()), CODE, "Fay")).toEqual(err("game_started"));
    expect(lastRoomState(human(conns, 0))?.seats.map((s) => s.name)).toEqual(["Ana", "Eve", "Cy"]);
  });

  it("Bots from the start are not open seats", async () => {
    const t = setup();
    const seats: StoredSeat[] = [
      { name: "Ana", tokenHash: hashToken(TOKENS[0]!) },
      { name: "Bot1", tokenHash: hashToken("x"), bot: true },
      { name: "Bot2", tokenHash: hashToken("y"), bot: true },
    ];
    await storedGame(t, turnState(0, true), { seats });
    expect(await t.svc.joinRoom(req(fakeConn()), CODE, "Eve")).toEqual(err("game_started"));
  });

  it("The leaver comes back as a newcomer with a new token", async () => {
    const t = setup();
    await withOpenSeat(t, turnState(0, true));
    const ben = fakeConn();
    expect(await t.svc.joinRoom(req(ben), CODE, "Ben")).toEqual({ ok: true });
    const token = ben.of("roomJoined")[0]?.payload.token;
    expect(token).not.toBe(TOKENS[1]);
    expect(ben.of("roomJoined")[0]?.payload.seat).toBe(1);
  });

  it("Joining a paused game takes the seat and stays paused", async () => {
    const t = setup();
    const conns = await storedGame(t, turnState(0, true), { status: "paused" });
    await t.svc.leaveRoom(req(human(conns, 1)));
    const eve = fakeConn();
    expect(await t.svc.joinRoom(req(eve), CODE, "Eve")).toEqual({ ok: true });
    expect(lastRoomState(eve)).toMatchObject({ status: "paused" });
  });
});

describe("open seats survive a restart", () => {
  it("Restart with an open seat: still open, the bot plays, it can be taken over", async () => {
    const t = setup();
    const conns = await storedGame(t, turnState(0, true));
    await t.svc.leaveRoom(req(human(conns, 1)));
    t.svc.close();
    const svc = t.make();
    const ana = fakeConn();
    expect(await svc.resumeRoom(req(ana), CODE, TOKENS[0]!)).toEqual({ ok: true });
    expect(lastRoomState(ana)?.seats[1]).toMatchObject({ bot: true, open: true });
    const eve = fakeConn();
    expect(await svc.joinRoom(req(eve), CODE, "Eve")).toEqual({ ok: true });
    expect(eve.of("roomJoined")[0]?.payload.seat).toBe(1);
  });

  it("Rooms stored before this change have no open seats", async () => {
    const t = setup();
    const conns = await storedGame(t, turnState(0, true));
    expect(lastRoomState(human(conns, 0))).toBeUndefined();
    const c = fakeConn();
    await t.svc.resumeRoom(req(c), CODE, TOKENS[0]!);
    // (a second connection replaces the first; the state shows no open seat)
    expect(lastRoomState(c)?.seats.every((s) => s.open === undefined)).toBe(true);
  });
});
