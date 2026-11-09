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
  it("is version 9 and has the Replaced close code", () => {
    expect(PROTOCOL_VERSION).toBe(9);
    expect(CloseCode.Replaced).toBe(4001);
  });

  it("accepts avatars on create, join and setAvatar and rejects unknown ids", () => {
    const ok = [
      encodeClient("createRoom", { name: "Ana", avatar: "farmer" }, 1),
      encodeClient("joinRoom", { room: "abc234", name: "Ben", avatar: "baker" }, 2),
      encodeClient("setAvatar", { avatar: "fisher" }, 3),
    ];
    for (const f of ok) expect(decodeClientMessage(f).ok).toBe(true);
    const bad = encodeClient("setAvatar", { avatar: "king" as never }, 4);
    expect(decodeClientMessage(bad).ok).toBe(false);
  });

  it("round-trips every new client message", () => {
    const cases = [
      encodeClient("createRoom", { name: "Ana" }, 1),
      encodeClient("joinRoom", { room: "abc234", name: "Ben" }, 2),
      encodeClient("resumeRoom", { room: "ABC234", token: "t0k" }, 3),
      encodeClient("leaveRoom", {}, 4),
      encodeClient("addBot", {}, 40),
      encodeClient("removeBot", { seat: 2 }, 41),
      encodeClient("startGame", { mode: "variable" }, 5),
      encodeClient("startGame", { mode: "beginner", startingPlayer: 2 }, 6),
      encodeClient("startGame", { mode: "variable", turnTimer: "relaxed" }, 7),
      encodeClient("startGame", { mode: "variable", victoryTarget: 12, startingPlayer: 5 }, 8),
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
          seats: [
            {
              seat: 0,
              name: "Ana",
              connected: true,
              bot: false,
              avatar: "villager-beard" as const,
            },
          ],
          pausedAt: null,
          result: null,
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
      { v, type: "startGame", seq: 0, payload: { mode: "variable", startingPlayer: 6 } },
      { v, type: "startGame", seq: 0, payload: { mode: "variable", victoryTarget: 20 } },
      { v, type: "startGame", seq: 0, payload: { mode: "variable", victoryTarget: 7 } },
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
    // `timeout` is raised by the server, never sent by a client.
    expectTypeOf<ClientAction["type"]>().toEqualTypeOf<Exclude<Action["type"], "timeout">>();
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
      { type: "passSpecialBuild" },
    ];
    const types = new Set<Action["type"]>();
    for (const s of samples) {
      expect(ClientActionSchema.safeParse(s).success, s.type).toBe(true);
      types.add(s.type);
    }
    expect(types.size).toBe(22);
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

describe("push and visibility messages (protocol v4)", () => {
  const v = PROTOCOL_VERSION;
  const sub = {
    endpoint: "https://push.example.com/abc",
    keys: { p256dh: "BPk", auth: "x1" },
  };

  it("accepts pushSubscribe, pushUnsubscribe and visibility", () => {
    for (const m of [
      { v, type: "pushSubscribe", seq: 0, payload: { subscription: sub, lang: "es" } },
      { v, type: "pushUnsubscribe", seq: 0, payload: { endpoint: sub.endpoint } },
      { v, type: "visibility", seq: 0, payload: { visible: false } },
    ]) {
      expect(decodeClientMessage(frame(m)), JSON.stringify(m)).toMatchObject({ ok: true });
    }
  });

  it("rejects non-https, oversized or incomplete subscriptions", () => {
    for (const subscription of [
      { ...sub, endpoint: "http://push.example.com/abc" },
      { ...sub, endpoint: `https://push.example.com/${"a".repeat(1100)}` },
      { endpoint: sub.endpoint, keys: { p256dh: "BPk" } },
    ]) {
      const m = { v, type: "pushSubscribe", seq: 0, payload: { subscription, lang: "en" } };
      expect(decodeClientMessage(frame(m))).toMatchObject({ ok: false, error: "bad_frame" });
    }
    const noLang = { v, type: "pushSubscribe", seq: 0, payload: { subscription: sub, lang: "" } };
    expect(decodeClientMessage(frame(noLang))).toMatchObject({ ok: false });
  });

  it("welcome carries pushKey (string or null)", () => {
    for (const pushKey of ["BKey", null]) {
      const raw = encodeServer("welcome", { serverVersion: "1", protocolVersion: v, pushKey }, 0);
      expect(decodeServerMessage(raw)).toMatchObject({ ok: true });
    }
  });
});

describe("pause, end and saved games (protocol v5)", () => {
  const v = PROTOCOL_VERSION;
  const seats = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ room: `R${i}`, token: `t${i}` }));

  it("accepts pauseGame, resumeGame, endGame and lookupSeats", () => {
    for (const m of [
      { v, type: "pauseGame", seq: 0, payload: {} },
      { v, type: "resumeGame", seq: 0, payload: {} },
      { v, type: "endGame", seq: 0, payload: {} },
      { v, type: "lookupSeats", seq: 0, payload: { seats: seats(20) } },
      { v, type: "lookupSeats", seq: 0, payload: { seats: [] } },
      { v, type: "endSavedGame", seq: 0, payload: { room: "abc234", token: "t" } },
    ]) {
      expect(decodeClientMessage(frame(m)), JSON.stringify(m)).toMatchObject({ ok: true });
    }
  });

  it("rejects more than 20 lookups or empty tokens", () => {
    for (const bad of [{ room: "ABC" }, { room: "ABC", token: "" }]) {
      const m = { v, type: "endSavedGame", seq: 0, payload: bad };
      expect(decodeClientMessage(frame(m))).toMatchObject({ ok: false, error: "bad_frame" });
    }
    for (const payload of [
      { seats: seats(21) },
      { seats: [{ room: "ABC", token: "" }] },
      { seats: [{ room: "ABC" }] },
    ]) {
      const m = { v, type: "lookupSeats", seq: 0, payload };
      expect(decodeClientMessage(frame(m))).toMatchObject({ ok: false, error: "bad_frame" });
    }
  });

  it("round-trips paused and ended room states and seatsInfo", () => {
    const base = {
      room: "ABC234",
      host: 0,
      seats: [
        { seat: 0, name: "Ana", connected: true, bot: false, avatar: "villager-beard" as const },
      ],
    };
    const cases = [
      encodeServer("roomState", { ...base, status: "paused", pausedAt: 123, result: null }, 1),
      encodeServer(
        "roomState",
        {
          ...base,
          status: "ended",
          pausedAt: null,
          result: {
            reason: "host",
            at: 5,
            winners: [0, 2],
            scores: [
              { seat: 0, vp: 8, hiddenVp: 1 },
              { seat: 1, vp: 6, hiddenVp: 0 },
              { seat: 2, vp: 8, hiddenVp: 0 },
            ],
          },
        },
        2,
      ),
      encodeServer(
        "seatsInfo",
        {
          rooms: [
            {
              room: "ABC234",
              status: "paused",
              seat: 1,
              host: 0,
              names: ["Ana", "Ben", "Cy"],
              bots: [false, false, false],
              turn: null,
              pausedAt: 10,
              expiresAt: 20,
              createdAt: 1,
              startedAt: 2,
              lastActiveAt: 9,
            },
            { room: "ZZZ999", status: "gone" },
          ],
        },
        3,
      ),
      encodeServer("error", { code: "game_paused", message: "paused" }, 4),
      encodeServer("error", { code: "not_paused", message: "x" }, 5),
      encodeServer("error", { code: "not_playing", message: "x" }, 6),
    ];
    for (const raw of cases) {
      const r = decodeServerMessage(raw);
      expect(r.ok, raw).toBe(true);
      if (r.ok) expect(r.message).toEqual(JSON.parse(raw));
    }
  });

  it("rejects a result without winners", () => {
    const raw = frame({
      v,
      type: "roomState",
      seq: 0,
      payload: {
        room: "A",
        status: "ended",
        host: 0,
        seats: [],
        pausedAt: null,
        result: { reason: "host", at: 1, winners: [], scores: [] },
      },
    });
    expect(decodeServerMessage(raw)).toMatchObject({ ok: false, error: "bad_frame" });
  });
});

describe("leaving a running game (leave-game)", () => {
  it("round-trips open seats and system chat lines", () => {
    const state = encodeServer(
      "roomState",
      {
        room: "ABC234",
        host: 0,
        status: "playing",
        pausedAt: null,
        result: null,
        seats: [
          { seat: 0, name: "Ana", connected: true, bot: false, avatar: "villager-beard" },
          {
            seat: 1,
            name: "Bot",
            connected: true,
            bot: true,
            open: true,
            avatar: "villager-beard",
          },
        ],
      },
      1,
    );
    expect(decodeServerMessage(state)).toMatchObject({
      ok: true,
      message: { payload: { seats: [{ seat: 0 }, { seat: 1, open: true }] } },
    });
    for (const system of ["left", "tookOver"] as const) {
      const line = encodeServer(
        "chatLine",
        { entry: { id: 0, seat: 1, name: "Ben", text: "", at: 5, system } },
        2,
      );
      expect(decodeServerMessage(line)).toMatchObject({
        ok: true,
        message: { payload: { entry: { system } } },
      });
    }
    const bad = encodeServer(
      "chatLine",
      { entry: { id: 0, seat: 1, name: "Ben", text: "", at: 5, system: "kicked" as "left" } },
      3,
    );
    expect(decodeServerMessage(bad).ok).toBe(false);
  });
});
