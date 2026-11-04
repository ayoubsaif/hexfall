import type { Action } from "@hexfall/engine";
import { describe, expect, expectTypeOf, it } from "vite-plus/test";
import {
  CloseCode,
  ClientActionSchema,
  PROTOCOL_VERSION,
  TURN_TIMER_PRESETS,
  decodeClientMessage,
  decodeServerMessage,
  encodeClient,
  encodeServer,
  type ClientAction,
  type SeatlessAction,
} from "../src/index.ts";

const frame = (obj: unknown) => JSON.stringify(obj);
/** true only if every A is assignable to B (checked by the type checker). */
type Assignable<A, B> = [A] extends [B] ? true : false;

describe("protocol v3", () => {
  it("is version 3 and has the Replaced close code", () => {
    expect(PROTOCOL_VERSION).toBe(3);
    expect(CloseCode.Replaced).toBe(4001);
  });

  it("round-trips every new client message", () => {
    const cases = [
      encodeClient("createRoom", { name: "Ana" }, 1),
      encodeClient("joinRoom", { room: "abc234", name: "Ben" }, 2),
      encodeClient("resumeRoom", { room: "ABC234", token: "t0k" }, 3),
      encodeClient("leaveRoom", {}, 4),
      encodeClient("startGame", { mode: "variable" }, 5),
      encodeClient("startGame", { mode: "beginner", startingPlayer: 2 }, 6),
      encodeClient("startGame", { mode: "variable", turnTimer: "relaxed" }, 7),
      encodeClient("gameAction", { action: { type: "rollDice" } }, 7),
      encodeClient(
        "gameAction",
        { action: { type: "proposeTrade", give: { ore: 1 }, get: { wool: 2 }, to: [1, 2] } },
        8,
      ),
      encodeClient("gameAction", { action: { type: "moveRobber", hex: 4, victim: null } }, 9),
    ];
    for (const raw of cases) {
      const r = decodeClientMessage(raw);
      expect(r.ok, raw).toBe(true);
      if (r.ok) expect(r.message).toEqual(JSON.parse(raw));
    }
  });

  it("round-trips every new server message", () => {
    const view = { viewer: 0, log: [] };
    const legal = { rollDice: true };
    const cases = [
      encodeServer("roomJoined", { room: "ABC234", seat: 0, token: "secret" }, 1, 1),
      encodeServer("roomJoined", { room: "ABC234", seat: 1 }, 2),
      encodeServer("roomLeft", { room: "ABC234" }, 3),
      encodeServer(
        "roomState",
        {
          room: "ABC234",
          status: "lobby",
          host: 0,
          seats: [{ seat: 0, name: "Ana", connected: true }],
        },
        4,
      ),
      encodeServer(
        "gameSnapshot",
        { version: 0, view: view as never, legal: legal as never, timer: null },
        5,
      ),
      encodeServer(
        "gameUpdate",
        {
          version: 1,
          view: view as never,
          events: [{ type: "turnEnded", seat: 0 }],
          logLength: 7,
          legal: legal as never,
          timer: { kind: "action", durationMs: 90_000, remainingMs: 41_250, seats: [0] },
        },
        6,
      ),
      encodeServer("actionRejected", { code: "not_your_turn", message: "no" }, 7, 7),
      encodeServer("error", { code: "rate_limited", message: "slow down" }, 8),
    ];
    for (const raw of cases) {
      const r = decodeServerMessage(raw);
      expect(r.ok, raw).toBe(true);
      if (r.ok) expect(r.message).toEqual(JSON.parse(raw));
    }
  });

  it("rejects bad payloads as bad_frame", () => {
    const v = PROTOCOL_VERSION;
    const bad = [
      { v, type: "createRoom", seq: 0, payload: {} },
      { v, type: "startGame", seq: 0, payload: { mode: "chaos" } },
      { v, type: "startGame", seq: 0, payload: { mode: "variable", startingPlayer: 4 } },
      { v, type: "startGame", seq: 0, payload: { mode: "variable", turnTimer: "blitz" } },
      { v, type: "gameAction", seq: 0, payload: { action: { type: "timeout" } } },
      { v, type: "gameAction", seq: 0, payload: { action: { type: "nope" } } },
      { v, type: "gameAction", seq: 0, payload: { action: { type: "rollDice", seat: 1 } } },
      { v, type: "gameAction", seq: 0, payload: { action: { type: "buildRoad", edge: -1 } } },
      {
        v,
        type: "gameAction",
        seq: 0,
        payload: { action: { type: "discard", cards: { ore: 1, gold: 1 } } },
      },
      {
        v,
        type: "gameAction",
        seq: 0,
        payload: { action: { type: "playMonopoly", resource: "gold" } },
      },
    ];
    for (const m of bad) {
      expect(decodeClientMessage(frame(m)), JSON.stringify(m)).toMatchObject({
        ok: false,
        error: "bad_frame",
      });
    }
    expect(
      decodeServerMessage(
        frame({ v, type: "error", seq: 0, payload: { code: "nope", message: "" } }),
      ),
    ).toMatchObject({ ok: false, error: "bad_frame" });
  });

  it("the action schema matches engine Action minus seat, both ways", () => {
    // Every wire action is a valid engine action (minus seat), and every engine action
    // can be sent: mutual assignability over the whole union.
    const wireToEngine: Assignable<ClientAction, SeatlessAction> = true;
    const engineToWire: Assignable<SeatlessAction, ClientAction> = true;
    expect([wireToEngine, engineToWire]).toEqual([true, true]);
    expectTypeOf<ClientAction["type"]>().toEqualTypeOf<Action["type"]>();
    // Spot checks at runtime: one parse per action type.
    const samples: SeatlessAction[] = [
      { type: "rollForOrder" },
      { type: "placeSettlement", vertex: 0 },
      { type: "placeRoad", edge: 0 },
      { type: "rollDice" },
      { type: "discard", cards: { ore: 2 } },
      { type: "moveRobber", hex: 1, victim: 2 },
      { type: "buildRoad", edge: 1 },
      { type: "buildSettlement", vertex: 1 },
      { type: "buildCity", vertex: 1 },
      { type: "buyDevCard" },
      { type: "playKnight" },
      { type: "playRoadBuilding" },
      { type: "playYearOfPlenty", resources: ["ore", "ore"] },
      { type: "playMonopoly", resource: "wool" },
      { type: "revealVictoryPoints" },
      { type: "proposeTrade", give: { ore: 1 }, get: { grain: 1 }, to: [0] },
      { type: "acceptTrade", offerId: 1 },
      { type: "rejectTrade", offerId: 1 },
      { type: "cancelTrade", offerId: 1 },
      { type: "maritimeTrade", give: "ore", get: "wool", count: 1 },
      { type: "endTurn" },
    ];
    const types = new Set<Action["type"]>();
    for (const s of samples) {
      expect(ClientActionSchema.safeParse(s).success, s.type).toBe(true);
      types.add(s.type);
    }
    expect(types.size).toBe(21);
  });
});

describe("turn timer (floating-hud-turn-timer 2.1)", () => {
  it("has the standard and relaxed presets", () => {
    expect(TURN_TIMER_PRESETS.standard).toEqual({ roll: 30_000, action: 90_000 });
    expect(TURN_TIMER_PRESETS.relaxed).toEqual({ roll: 60_000, action: 120_000 });
  });

  it("never lets a client send the system timeout action", () => {
    expect(ClientActionSchema.safeParse({ type: "timeout" }).success).toBe(false);
  });

  it("requires the timer field on snapshots", () => {
    const raw = JSON.stringify({
      v: PROTOCOL_VERSION,
      type: "gameSnapshot",
      seq: 0,
      payload: { version: 0, view: {}, legal: {} },
    });
    expect(decodeServerMessage(raw).ok).toBe(false);
  });
});
