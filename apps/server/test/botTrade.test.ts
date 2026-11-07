// Bots answering trade offers through the room layer (openspec change trade-with-bots,
// specs bots "Bots trade with a lone human").
import { RESOURCES, createGame, type GameState, type ResourceBundle } from "@hexfall/engine";
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

const CODE = "TRADEB";
const CONFIG = { seed: "bot-trade", mode: "variable" as const, playerCount: 3 as const };
const TOKENS = ["t0", "t1", "t2"];

function setup() {
  const clock = fakeClock();
  const store = createMemoryStore({ now: clock.now });
  const svc = createRoomService({ store, now: clock.now, timers: clock.timers, log: () => {} });
  services.push(svc);
  return { clock, store, svc };
}
type T = ReturnType<typeof setup>;

const human = (name: string, i: number): StoredSeat => ({
  name,
  tokenHash: hashToken(TOKENS[i]!),
});
const bot = (name: string): StoredSeat => ({
  name,
  tokenHash: hashToken(`bot-${name}`),
  bot: true,
});

function hand(s: GameState, seat: number, b: ResourceBundle): void {
  const p = s.players[seat]!;
  for (const r of RESOURCES) {
    s.bank[r] += p.resources[r] - (b[r] ?? 0);
    p.resources[r] = b[r] ?? 0;
  }
}

/**
 * Seat 0 (a human) is active and rolled, holding 2 grain. Each seat in `keen` owns a
 * settlement and holds brick, lumber, wool and 2 ore: 1 grain for 1 ore completes a settlement.
 */
function tradeState(keen: number[]): GameState {
  const s = createGame(CONFIG);
  s.phase = { kind: "turn" };
  s.turn = { seat: 0, number: 5, rolled: true, devPlayed: false, dice: [3, 4] };
  const sites = [20, 40];
  keen.forEach((seat, i) => {
    s.vertices[sites[i]!] = { owner: seat, kind: "settlement" };
    s.players[seat]!.pieces.settlements = 4;
    hand(s, seat, { brick: 1, lumber: 1, wool: 1, ore: 2 });
  });
  hand(s, 0, { grain: 2 });
  return s;
}

async function storedGame(t: T, state: GameState, seats: StoredSeat[]) {
  const meta: RoomMeta = {
    code: CODE,
    rev: 0,
    status: "playing",
    createdAt: 0,
    host: 0,
    seats,
    config: CONFIG,
    turnTimer: "off",
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
  const conns: (FakeConn | null)[] = [];
  for (const [i, s] of seats.entries()) {
    if (s.bot) {
      conns.push(null);
      continue;
    }
    const c = fakeConn();
    expect(await t.svc.resumeRoom(req(c), CODE, TOKENS[i]!)).toEqual({ ok: true });
    conns.push(c);
  }
  return conns;
}

const events = (c: FakeConn) => c.of("gameUpdate").flatMap((m) => m.payload.events);
const offer = { give: { grain: 1 }, get: { ore: 1 } };

describe("bots answer offers", () => {
  it("accepts a helpful offer in a solo game", async () => {
    const t = setup();
    const [ana] = await storedGame(t, tradeState([1]), [human("Ana", 0), bot("B1"), bot("B2")]);
    expect(await t.svc.gameAction(req(ana!), { type: "proposeTrade", to: [1], ...offer })).toEqual({
      ok: true,
    });
    await t.clock.advance(BOT_TURN_DELAY_MS);
    expect(events(ana!).filter((e) => e.type === "tradeAccepted")).toEqual([
      expect.objectContaining({ from: 0, by: 1 }),
    ]);
    const view = ana!.game()!.view;
    expect(view.players[0]!.resources).toMatchObject({ grain: 1, ore: 1 });
    expect(view.players[1]!.resourceCount).toBe(5);
    expect(view.offers).toEqual([]);
  });

  it("rejects the same offer when two humans are in the room", async () => {
    const t = setup();
    const [ana] = await storedGame(t, tradeState([2]), [
      human("Ana", 0),
      human("Ben", 1),
      bot("B"),
    ]);
    await t.svc.gameAction(req(ana!), { type: "proposeTrade", to: [2], ...offer });
    await t.clock.advance(BOT_TURN_DELAY_MS);
    expect(events(ana!).some((e) => e.type === "tradeAccepted")).toBe(false);
    expect(events(ana!).filter((e) => e.type === "tradeRejected")).toEqual([
      expect.objectContaining({ seat: 2 }),
    ]);
    expect(ana!.game()!.view.players[0]!.resources).toMatchObject({ grain: 2, ore: 0 });
  });

  it("makes exactly one trade when two bots both like the offer", async () => {
    const t = setup();
    const [ana] = await storedGame(t, tradeState([1, 2]), [human("Ana", 0), bot("B1"), bot("B2")]);
    await t.svc.gameAction(req(ana!), { type: "proposeTrade", to: [1, 2], ...offer });
    await t.clock.advance(BOT_TURN_DELAY_MS * 3);
    expect(events(ana!).filter((e) => e.type === "tradeAccepted")).toHaveLength(1);
    const view = ana!.game()!.view;
    expect(view.players[0]!.resources).toMatchObject({ grain: 1, ore: 1 });
    expect(view.offers).toEqual([]);
  });

  it("trades with the remaining human once the other one leaves", async () => {
    const t = setup();
    const [ana, ben] = await storedGame(t, tradeState([1]), [
      human("Ana", 0),
      human("Ben", 1),
      bot("B"),
    ]);
    expect(await t.svc.leaveRoom(req(ben!))).toEqual({ ok: true });
    await t.svc.gameAction(req(ana!), { type: "proposeTrade", to: [1], ...offer });
    await t.clock.advance(BOT_TURN_DELAY_MS);
    expect(events(ana!).filter((e) => e.type === "tradeAccepted")).toEqual([
      expect.objectContaining({ from: 0, by: 1 }),
    ]);
  });
});
