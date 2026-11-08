import { describe, expect, it } from "vite-plus/test";
import {
  CloseCode,
  PROTOCOL_VERSION,
  decodeServerMessage,
  encodeClient,
  type ServerMessage,
} from "@hexfall/protocol";
import type { Conn, Request, RoomService, ServiceResult } from "../src/rooms/service.ts";
import { RATE_CAPACITY, RATE_REFILL_PER_SEC, createSession } from "../src/session.ts";

interface Call {
  method: string;
  conn: Conn;
  seq: number;
  args: unknown[];
}

/** A scripted fake RoomService that records calls. */
function fakeService() {
  const calls: Call[] = [];
  const disconnects: Conn[] = [];
  let next: (req: Request, method: string) => Promise<ServiceResult> | ServiceResult = () => ({
    ok: true,
  });
  const record =
    (method: string) =>
    async (req: Request, ...args: unknown[]): Promise<ServiceResult> => {
      calls.push({ method, conn: req.conn, seq: req.seq, args });
      return next(req, method);
    };
  const service: RoomService = {
    createRoom: record("createRoom"),
    joinRoom: record("joinRoom"),
    resumeRoom: record("resumeRoom"),
    leaveRoom: record("leaveRoom"),
    startGame: record("startGame"),
    setAvatar: record("setAvatar"),
    chat: record("chat"),
    addBot: record("addBot"),
    removeBot: record("removeBot"),
    setBotLevel: record("setBotLevel"),
    gameAction: record("gameAction"),
    pauseGame: record("pauseGame"),
    resumeGame: record("resumeGame"),
    endGame: record("endGame"),
    lookupSeats: record("lookupSeats"),
    endSavedGame: record("endSavedGame"),
    pushSubscribe: record("pushSubscribe"),
    pushUnsubscribe: record("pushUnsubscribe"),
    setVisibility: (conn, visible) =>
      void calls.push({ method: "setVisibility", conn, seq: -1, args: [visible] }),
    disconnect: (conn) => void disconnects.push(conn),
    loadedRooms: () => 0,
    close: () => {},
  };
  return {
    service,
    calls,
    disconnects,
    script(fn: typeof next) {
      next = fn;
    },
  };
}

function setup() {
  const fake = fakeService();
  const out: ServerMessage[] = [];
  const closes: Array<{ code: number; reason: string }> = [];
  let t = 1_000_000;
  const logs: string[] = [];
  const session = createSession({
    service: fake.service,
    id: "conn-1",
    serverVersion: "9.9.9",
    now: () => t,
    log: (m) => void logs.push(m),
    send: (raw) => {
      const d = decodeServerMessage(raw);
      if (!d.ok) throw new Error(`invalid server frame: ${d.detail}`);
      out.push(d.message);
    },
    close: (code, reason) => void closes.push({ code, reason }),
  });
  return {
    ...fake,
    session,
    out,
    closes,
    logs,
    advance(ms: number) {
      t += ms;
    },
  };
}

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

describe("hello / ping", () => {
  it("replies with welcome and pong carrying re", async () => {
    const s = setup();
    await s.session.handle(encodeClient("hello", { clientVersion: "c" }, 5));
    await s.session.handle(encodeClient("ping", { t: 42 }, 6));
    expect(s.out[0]).toMatchObject({
      v: PROTOCOL_VERSION,
      type: "welcome",
      re: 5,
      payload: { serverVersion: "9.9.9", protocolVersion: PROTOCOL_VERSION, pushKey: null },
    });
    expect(s.out[1]).toMatchObject({ type: "pong", re: 6, payload: { t: 42 } });
  });
});

describe("bad frames", () => {
  it("malformed JSON, unknown type and a gameAction with seat are bad_frame", async () => {
    const s = setup();
    await s.session.handle("{nope");
    await s.session.handle(JSON.stringify({ v: PROTOCOL_VERSION, type: "x", seq: 1, payload: {} }));
    await s.session.handle(
      JSON.stringify({
        v: PROTOCOL_VERSION,
        type: "gameAction",
        seq: 2,
        payload: { action: { type: "rollDice", seat: 1 } },
      }),
    );
    // The turn timer's system action can never come from a client.
    await s.session.handle(
      JSON.stringify({
        v: PROTOCOL_VERSION,
        type: "gameAction",
        seq: 3,
        payload: { action: { type: "timeout" } },
      }),
    );
    expect(s.out.map((m) => m.type === "error" && m.payload.code)).toEqual([
      "bad_frame",
      "bad_frame",
      "bad_frame",
      "bad_frame",
    ]);
    expect(s.calls).toEqual([]);
    expect(s.closes).toEqual([]);
  });

  it("binary frames are bad_frame", () => {
    const s = setup();
    s.session.handleBinary();
    expect(s.out[0]).toMatchObject({ type: "error", payload: { code: "bad_frame" } });
  });

  it("a version mismatch sends an error and closes with 4000", async () => {
    const s = setup();
    await s.session.handle(
      JSON.stringify({ v: PROTOCOL_VERSION + 1, type: "hello", seq: 0, payload: {} }),
    );
    expect(s.out[0]).toMatchObject({ type: "error", payload: { code: "version_mismatch" } });
    expect(s.closes).toEqual([
      { code: CloseCode.VersionMismatch, reason: "protocol version mismatch" },
    ]);
  });
});

describe("routing", () => {
  it("routes every request type to the matching service method with conn and seq", async () => {
    const s = setup();
    await s.session.handle(encodeClient("createRoom", { name: "Ann" }, 10));
    await s.session.handle(encodeClient("joinRoom", { room: "abcdef", name: "Bo" }, 11));
    await s.session.handle(encodeClient("resumeRoom", { room: "ABCDEF", token: "tok" }, 12));
    await s.session.handle(encodeClient("leaveRoom", {}, 13));
    await s.session.handle(encodeClient("startGame", { mode: "variable" }, 14));
    await s.session.handle(encodeClient("startGame", { mode: "beginner", startingPlayer: 2 }, 15));
    await s.session.handle(encodeClient("gameAction", { action: { type: "rollDice" } }, 16));
    await s.session.handle(
      encodeClient("startGame", { mode: "variable", turnTimer: "relaxed" }, 17),
    );
    expect(s.calls.map(({ method, seq, args }) => ({ method, seq, args }))).toEqual([
      { method: "createRoom", seq: 10, args: ["Ann", undefined] },
      { method: "joinRoom", seq: 11, args: ["abcdef", "Bo", undefined] },
      { method: "resumeRoom", seq: 12, args: ["ABCDEF", "tok"] },
      { method: "leaveRoom", seq: 13, args: [] },
      { method: "startGame", seq: 14, args: [{ mode: "variable" }] },
      { method: "startGame", seq: 15, args: [{ mode: "beginner", startingPlayer: 2 }] },
      { method: "gameAction", seq: 16, args: [{ type: "rollDice" }] },
      { method: "startGame", seq: 17, args: [{ mode: "variable", turnTimer: "relaxed" }] },
    ]);
    s.calls.length = 0;
    await s.session.handle(encodeClient("pauseGame", {}, 20));
    await s.session.handle(encodeClient("resumeGame", {}, 21));
    await s.session.handle(encodeClient("endGame", {}, 22));
    await s.session.handle(
      encodeClient("lookupSeats", { seats: [{ room: "abcdef", token: "tok" }] }, 23),
    );
    await s.session.handle(encodeClient("endSavedGame", { room: "abcdef", token: "tok" }, 24));
    expect(s.calls.map(({ method, seq, args }) => ({ method, seq, args }))).toEqual([
      { method: "pauseGame", seq: 20, args: [] },
      { method: "resumeGame", seq: 21, args: [] },
      { method: "endGame", seq: 22, args: [] },
      { method: "lookupSeats", seq: 23, args: [[{ room: "abcdef", token: "tok" }]] },
      { method: "endSavedGame", seq: 24, args: ["abcdef", "tok"] },
    ]);
    // Same conn object every time, with the session id.
    expect(new Set(s.calls.map((c) => c.conn)).size).toBe(1);
    expect(s.calls[0]!.conn.id).toBe("conn-1");
    // Successful results send nothing by themselves.
    expect(s.out).toEqual([]);
  });

  it("maps error results to error and rejected results to actionRejected, both with re", async () => {
    const s = setup();
    s.script(() => ({ ok: false, error: { code: "room_not_found", message: "no room" } }));
    await s.session.handle(encodeClient("joinRoom", { room: "ZZZZZZ", name: "Bo" }, 3));
    s.script(() => ({ ok: false, rejected: { code: "not_your_turn", message: "wait" } }));
    await s.session.handle(encodeClient("gameAction", { action: { type: "endTurn" } }, 4));
    s.script(() => ({ ok: false, error: { code: "game_paused", message: "paused" } }));
    await s.session.handle(encodeClient("gameAction", { action: { type: "rollDice" } }, 5));
    expect(s.out).toMatchObject([
      { type: "error", re: 3, payload: { code: "room_not_found", message: "no room" } },
      { type: "actionRejected", re: 4, payload: { code: "not_your_turn", message: "wait" } },
      { type: "error", re: 5, payload: { code: "game_paused", message: "paused" } },
    ]);
  });

  it("a service throw answers internal with re and keeps the session usable", async () => {
    const s = setup();
    s.script(() => {
      throw new Error("boom");
    });
    await s.session.handle(encodeClient("createRoom", { name: "Ann" }, 8));
    expect(s.out[0]).toMatchObject({ type: "error", re: 8, payload: { code: "internal" } });
    expect(s.logs.some((l) => l.includes("boom"))).toBe(true);
    expect(s.closes).toEqual([]);
    await s.session.handle(encodeClient("ping", { t: 1 }, 9));
    expect(s.out[1]).toMatchObject({ type: "pong", re: 9 });
  });

  it("outgoing seq increases by one across replies and pushed messages", async () => {
    const s = setup();
    s.script((req) => {
      req.conn.send({
        type: "roomJoined",
        payload: { room: "ABCDEF", seat: 0, token: "t" },
        re: req.seq,
      });
      req.conn.send({
        type: "roomState",
        payload: {
          room: "ABCDEF",
          status: "lobby",
          host: 0,
          seats: [],
          pausedAt: null,
          result: null,
        },
        re: req.seq,
      });
      return { ok: true };
    });
    await s.session.handle(encodeClient("hello", { clientVersion: "c" }, 0));
    await s.session.handle(encodeClient("createRoom", { name: "Ann" }, 1));
    // An unsolicited push (e.g. a broadcast from another seat's action).
    s.calls[0]!.conn.send({ type: "roomLeft", payload: { room: "ABCDEF" } });
    await s.session.handle(encodeClient("ping", { t: 0 }, 2));
    expect(s.out.map((m) => m.type)).toEqual([
      "welcome",
      "roomJoined",
      "roomState",
      "roomLeft",
      "pong",
    ]);
    expect(s.out.map((m) => m.seq)).toEqual([0, 1, 2, 3, 4]);
    expect(s.out[1]!.re).toBe(1);
    expect(s.out[3]!.re).toBeUndefined();
  });

  it("handles messages from one socket strictly in order", async () => {
    const s = setup();
    const order: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    s.script(async (req, method) => {
      order.push(`start:${method}:${req.seq}`);
      if (req.seq === 1) await gate;
      order.push(`end:${method}:${req.seq}`);
      return { ok: true };
    });
    const a = s.session.handle(encodeClient("createRoom", { name: "Ann" }, 1));
    const b = s.session.handle(encodeClient("leaveRoom", {}, 2));
    await flush();
    expect(order).toEqual(["start:createRoom:1"]);
    release();
    await Promise.all([a, b]);
    expect(order).toEqual([
      "start:createRoom:1",
      "end:createRoom:1",
      "start:leaveRoom:2",
      "end:leaveRoom:2",
    ]);
  });
});

describe("rate limit", () => {
  it("allows a burst of 40, rejects the rest, then refills 20 per second", async () => {
    const s = setup();
    expect(RATE_CAPACITY).toBe(40);
    expect(RATE_REFILL_PER_SEC).toBe(20);
    const pending: Promise<void>[] = [];
    for (let i = 0; i < 100; i++) pending.push(s.session.handle(encodeClient("ping", { t: i }, i)));
    await Promise.all(pending);
    const pongs = s.out.filter((m) => m.type === "pong");
    const limited = s.out.filter((m) => m.type === "error" && m.payload.code === "rate_limited");
    expect(pongs.map((m) => m.re)).toEqual([...Array(40).keys()]);
    expect(limited).toHaveLength(60);
    expect(limited.map((m) => m.re)).toEqual([...Array(60).keys()].map((i) => i + 40));

    s.out.length = 0;
    s.advance(1000);
    for (let i = 0; i < 25; i++) await s.session.handle(encodeClient("ping", { t: i }, 200 + i));
    expect(s.out.filter((m) => m.type === "pong")).toHaveLength(20);
    expect(s.out.filter((m) => m.type === "error")).toHaveLength(5);
  });

  it("rate-limited requests never reach the service", async () => {
    const s = setup();
    for (let i = 0; i < 45; i++) void s.session.handle(encodeClient("leaveRoom", {}, i));
    await flush();
    expect(s.calls).toHaveLength(40);
  });

  it("omits re when the frame's seq cannot be read cheaply", async () => {
    const s = setup();
    for (let i = 0; i < 40; i++) void s.session.handle(encodeClient("ping", { t: i }, i));
    await s.session.handle("garbage");
    const limited = s.out.filter((m) => m.type === "error" && m.payload.code === "rate_limited");
    expect(limited).toHaveLength(1);
    expect(limited[0]!.re).toBeUndefined();
  });
});

describe("closed()", () => {
  it("calls disconnect exactly once with the session's conn", async () => {
    const s = setup();
    await s.session.handle(encodeClient("createRoom", { name: "Ann" }, 1));
    s.session.closed();
    s.session.closed();
    await flush();
    expect(s.disconnects).toHaveLength(1);
    expect(s.disconnects[0]).toBe(s.calls[0]!.conn);
  });

  it("waits for an in-flight request before disconnecting and ignores later frames", async () => {
    const s = setup();
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    s.script(async () => {
      await gate;
      return { ok: true };
    });
    const a = s.session.handle(encodeClient("createRoom", { name: "Ann" }, 1));
    s.session.closed();
    await s.session.handle(encodeClient("leaveRoom", {}, 2));
    await flush();
    expect(s.disconnects).toHaveLength(0);
    release();
    await a;
    await flush();
    expect(s.disconnects).toHaveLength(1);
    expect(s.calls.map((c) => c.method)).toEqual(["createRoom"]);
  });
});
